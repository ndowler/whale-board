import { CONFIG, type Bbox } from '../config';
import type { RawSighting, Sighting, SpeciesId } from '../types';
import { mapSpecies } from './species';
import { parseComment } from './commentParse';
import { regionFor } from './regions';

/**
 * The feed mixes numbers and strings for numeric fields (80/132 lat-lngs were
 * strings in the M0 pull). Returns null for anything unparseable.
 */
export function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse `created` as UTC. The feed emits naive "YYYY-MM-DD HH:MM:SS" stamps;
 * `new Date(string)` would read those as LOCAL time (or reject them), so we
 * extract fields and build the epoch with Date.UTC. ISO strings with an
 * explicit Z/offset take the fast path.
 */
export function parseCreatedUtc(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s === '') return null;

  // Explicit zone → the platform parser is unambiguous.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );
  if (!m) {
    // Date-only form.
    const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!d) return null;
    return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]));
  }
  const ms = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  );
  return Number.isNaN(ms) ? null : ms;
}

export function inBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return (
    lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
  );
}

// Novel species strings are logged once each so the table can grow; capped so
// a misbehaving feed can't grow the set unbounded over a weeks-long session.
const loggedUnknownTypes = new Set<string>();
const LOGGED_UNKNOWN_CAP = 100;

export type WarnFn = (message: string) => void;

/**
 * Raw record → Sighting, or null when the record can't be shown:
 * missing id, unparseable timestamp or coordinates, outside the Salish Sea
 * bbox, or trusted below the display threshold.
 */
export function normalizeRecord(
  raw: RawSighting,
  warn: WarnFn = () => {},
): Sighting | null {
  const id =
    typeof raw.ssemmi_id === 'string' && raw.ssemmi_id.trim() !== ''
      ? raw.ssemmi_id.trim().replace(/\s+/g, ' ')
      : null;
  if (!id) return null;

  const epochMs = parseCreatedUtc(raw.created);
  if (epochMs === null) return null;

  const lat = coerceNumber(raw.latitude);
  const lng = coerceNumber(raw.longitude);
  if (lat === null || lng === null || (lat === 0 && lng === 0)) return null;
  if (!inBbox(lat, lng, CONFIG.bbox)) return null;

  const trusted = coerceNumber(raw.trusted) ?? 0;
  if (trusted < CONFIG.minTrusted) return null;

  const { species: mappedSpecies, matched } = mapSpecies(raw.type);
  if (!matched && typeof raw.type === 'string') {
    const key = raw.type.trim().toLowerCase();
    if (!loggedUnknownTypes.has(key) && loggedUnknownTypes.size < LOGGED_UNKNOWN_CAP) {
      loggedUnknownTypes.add(key);
      warn(`unmapped species type: "${raw.type}"`);
    }
  }

  const comment =
    typeof raw.data_source_comments === 'string' ? raw.data_source_comments : '';
  const parsed = parseComment(comment);

  // A generic "Orca" promotes to an ecotype when the comment says so; a bare
  // orca with no hints stays generic — don't guess Bigg's.
  let species: SpeciesId = mappedSpecies;
  if (species === 'orca' && parsed.ecotype === 'biggs') species = 'orca_biggs';
  if (species === 'orca' && parsed.ecotype === 'srkw') species = 'orca_srkw';

  return {
    id,
    epochMs,
    species,
    ecotype:
      parsed.ecotype ??
      (species === 'orca_biggs' ? 'biggs' : species === 'orca_srkw' ? 'srkw' : null),
    pods: parsed.pods,
    individuals: parsed.individuals,
    lat,
    lng,
    count: coerceNumber(raw.no_sighted),
    trusted,
    comment,
    sourceEntity:
      typeof raw.data_source_entity === 'string' ? raw.data_source_entity : '',
    region: regionFor(lat, lng),
  };
}

/**
 * Whole-payload guard: tolerate a non-array body and malformed records —
 * one bad record must never blank the board. Dedupes within the batch by id,
 * keeping the newest timestamp.
 */
export function normalizeBatch(payload: unknown, warn: WarnFn = () => {}): Sighting[] {
  if (!Array.isArray(payload)) {
    warn('unexpected payload shape (not an array)');
    return [];
  }
  const byId = new Map<string, Sighting>();
  for (const item of payload) {
    try {
      const s = normalizeRecord(item as RawSighting, warn);
      if (!s) continue;
      const existing = byId.get(s.id);
      if (!existing || s.epochMs > existing.epochMs) byId.set(s.id, s);
    } catch (err) {
      warn(`record threw during normalize: ${String(err)}`);
    }
  }
  return [...byId.values()];
}

export interface MergeResult {
  next: Map<string, Sighting>;
  /** Ids not present before this merge — drives arrival animation + chime. */
  addedIds: string[];
}

/**
 * Fold a poll's batch into the rolling store. Future timestamps (source clock
 * skew) are clamped to `nowMs` so decay math never goes negative; entries
 * older than `maxAgeMs` are pruned, bounding memory for unattended runs.
 */
export function mergeSightings(
  prev: ReadonlyMap<string, Sighting>,
  incoming: Sighting[],
  nowMs: number,
  maxAgeMs: number = CONFIG.maxAgeMs,
): MergeResult {
  const next = new Map(prev);
  const addedIds: string[] = [];
  for (const s of incoming) {
    const clamped = s.epochMs > nowMs ? { ...s, epochMs: nowMs } : s;
    if (nowMs - clamped.epochMs > maxAgeMs) continue;
    if (!next.has(clamped.id)) addedIds.push(clamped.id);
    next.set(clamped.id, clamped);
  }
  for (const [id, s] of next) {
    if (nowMs - s.epochMs > maxAgeMs) next.delete(id);
  }
  return { next, addedIds };
}

export function withinWindow(s: Sighting, nowMs: number, windowHours: number): boolean {
  return nowMs - s.epochMs <= windowHours * 3_600_000;
}
