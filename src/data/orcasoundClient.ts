import { CONFIG } from '../config';
import type { AcousticDetection, Hydrophone } from '../types';

/**
 * The acoustic bridge: Orcasound's public GraphQL in one round trip —
 * hydrophone nodes (`feeds`) plus recent whale-category detections
 * (OrcaHello AI = MACHINE, live listeners = HUMAN). Keyless, CORS `*`.
 *
 * 'fixture' mode serves the committed capture with detection timestamps
 * shifted so the newest is always ~10 minutes old — one hydrophone is
 * reliably "hot" on the dev board.
 */

const QUERY = `{
  feeds { id name slug latLng { lat lng } visible online }
  detections(limit: ${CONFIG.acoustic.fetchLimit}, filter: {category: {eq: WHALE}}, sort: {field: TIMESTAMP, order: DESC}) {
    results { id feedId timestamp source candidateId }
  }
}`;

export interface AcousticPayload {
  hydrophones: Hydrophone[];
  detections: AcousticDetection[];
}

export async function fetchAcoustic(signal: AbortSignal): Promise<AcousticPayload> {
  const raw =
    CONFIG.dataMode === 'fixture'
      ? await fetchFixture(signal)
      : await fetchLive(signal);
  return normalizeAcoustic(raw);
}

async function fetchLive(signal: AbortSignal): Promise<unknown> {
  const res = await fetch(CONFIG.acoustic.graphqlUrl, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`Orcasound responded HTTP ${res.status}`);
  return res.json();
}

async function fetchFixture(signal: AbortSignal): Promise<unknown> {
  const { default: fixture } = await import('./fixtures/orcasound-acoustic.json');
  await new Promise((r) => setTimeout(r, 300));
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  const data = (fixture as { data: { detections: { results: unknown[] } } }).data;
  const results = data.detections.results.map((r) => ({
    ...(r as Record<string, unknown>),
  }));
  const epochs = results
    .map((r) => parseUtc(r.timestamp))
    .filter((e): e is number => e !== null);
  const shift = Date.now() - 10 * 60_000 - Math.max(...epochs);
  for (const r of results) {
    const e = parseUtc(r.timestamp);
    if (e !== null) r.timestamp = new Date(e + shift).toISOString();
  }
  return { data: { ...data, detections: { results } } };
}

function parseUtc(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Coerce the GraphQL payload; drop rows that don't parse. */
export function normalizeAcoustic(raw: unknown): AcousticPayload {
  const data = (raw as { data?: Record<string, unknown> } | null)?.data ?? {};
  const feeds = Array.isArray(data.feeds) ? data.feeds : [];
  const results = Array.isArray(
    (data.detections as { results?: unknown[] } | undefined)?.results,
  )
    ? (data.detections as { results: unknown[] }).results
    : [];

  const hydrophones: Hydrophone[] = [];
  for (const f of feeds) {
    if (typeof f !== 'object' || f === null) continue;
    const r = f as Record<string, unknown>;
    const latLng = r.latLng as { lat?: unknown; lng?: unknown } | undefined;
    const lat = Number(latLng?.lat);
    const lng = Number(latLng?.lng);
    if (
      typeof r.id !== 'string' ||
      typeof r.slug !== 'string' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      r.visible === false
    )
      continue;
    hydrophones.push({
      id: r.id,
      name: typeof r.name === 'string' ? r.name : r.slug,
      slug: r.slug,
      lat,
      lng,
      online: r.online === true,
    });
  }

  const detections: AcousticDetection[] = [];
  for (const d of results) {
    const r = d as Record<string, unknown>;
    const epochMs = parseUtc(r.timestamp);
    if (typeof r.id !== 'string' || typeof r.feedId !== 'string' || epochMs === null)
      continue;
    detections.push({
      id: r.id,
      feedId: r.feedId,
      epochMs,
      source: r.source === 'HUMAN' ? 'HUMAN' : 'MACHINE',
    });
  }

  return { hydrophones, detections };
}
