import type { Sighting, SpeciesId } from '../types';
import { haversineKm } from './dedupe';

/**
 * Group tracks: link repeat reports of the *same identified group* into one
 * movement path. Deliberately conservative — a wrong link draws a false
 * migration, a missed link merely leaves two plain markers.
 *
 * Rules (documented in README "Group tracks"):
 *  1. Same base species (orca ecotypes share a base), no conflicting ecotype.
 *  2. Same explicit identity: identical non-empty set of pod IDs + individual
 *     catalog IDs (J, K, L, T46B, BCX2077 …). Ecotype alone, or a report with
 *     no ID at all, never links. "J and K pods" is its own identity, distinct
 *     from "J" — it is never chained into a J track.
 *  3. Plausible motion: from the track's last point, the hop must fit
 *     `slackKm + maxSpeedKmh * dt` and dt <= `maxGapMs`.
 *  4. A track needs >= 2 points; everything else stays a single marker.
 */
export const TRACK_RULES = {
  maxGapMs: 12 * 3_600_000,
  maxSpeedKmh: 25,
  slackKm: 1.5,
};

export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const COMPASS: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COMPASS_BEARING: Record<Compass, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};
const WORD: Record<string, Compass> = {
  north: 'N', northeast: 'NE', east: 'E', southeast: 'SE',
  south: 'S', southwest: 'SW', west: 'W', northwest: 'NW',
  northeastbound: 'NE', northwestbound: 'NW', southeastbound: 'SE', southwestbound: 'SW',
};
const BOUND: Record<string, Compass> = {
  nb: 'N', sb: 'S', eb: 'E', wb: 'W',
};

export const COMPASS_LABEL: Record<Compass, string> = {
  N: 'northbound', NE: 'northeastbound', E: 'eastbound', SE: 'southeastbound',
  S: 'southbound', SW: 'southwestbound', W: 'westbound', NW: 'northwestbound',
};

/**
 * Direction of travel stated in a free-text comment: "northbound", "NB",
 * "headed north", "heading west", "traveling southeast", "trending south".
 * Returns null when absent. First statement wins.
 */
export function parseHeading(comment: string | null | undefined): Compass | null {
  if (typeof comment !== 'string' || !comment.trim()) return null;
  const text = comment.toLowerCase();
  const m =
    text.match(/\b(north|south|east|west)(?:ern)?\s?-?(north|south|east|west)?(?:ern)?\s?-?bound\b/) ??
    text.match(
      /\b(?:head(?:ed|ing)|travel(?:l?ing|l?ed)|trending|moving|going|swimming)\s+(?:to(?:wards?)?\s+the\s+|(?:to)?wards?\s+the\s+)?(north|south|east|west|northeast|northwest|southeast|southwest)\b/,
    );
  if (m) {
    const key = ((m[1] ?? '') + (m[2] ?? '')).replace(/^(east|west)(north|south)$/, '$2$1');
    if (WORD[key]) return WORD[key];
  }
  const ab = text.match(/\b(nb|sb|eb|wb)\b/);
  if (ab) return BOUND[ab[1]];
  return null;
}

/** Initial great-circle bearing a→b in degrees clockwise from north. */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(bLng - aLng)) * Math.cos(r(bLat));
  const x =
    Math.cos(r(aLat)) * Math.sin(r(bLat)) -
    Math.sin(r(aLat)) * Math.cos(r(bLat)) * Math.cos(r(bLng - aLng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassOf(bearing: number): Compass {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export interface Track {
  /** Stable id: the head (newest) sighting's id. */
  id: string;
  species: SpeciesId;
  /** Oldest → newest. */
  points: Sighting[];
  head: Sighting;
  /** Union of pods + individuals shared by the group. */
  identity: string[];
  /** Union of pods across all points (display). */
  pods: string[];
  firstMs: number;
  lastMs: number;
  /** Sum of raw reports behind all points. */
  reportCount: number;
  /** Latest known animal count. */
  count: number | null;
  /** Heading stated in a comment (newest statement), if any. */
  statedHeading: Compass | null;
  /** Bearing of travel, degrees; stated heading wins, else last hop, else null. */
  bearing: number | null;
  /** Distance travelled along the path, km. */
  distanceKm: number;
}

export interface TrackSet {
  tracks: Track[];
  /** Sightings not linked into any track. */
  singles: Sighting[];
}

const baseSpecies = (s: SpeciesId): SpeciesId =>
  s === 'orca_biggs' || s === 'orca_srkw' ? 'orca' : s;

function identityOf(s: Sighting): string[] {
  return [...new Set([...s.pods, ...s.individuals])].sort();
}

function plausible(prev: Sighting, next: Sighting): boolean {
  const dt = next.epochMs - prev.epochMs;
  if (dt < 0 || dt > TRACK_RULES.maxGapMs) return false;
  const km = haversineKm(prev.lat, prev.lng, next.lat, next.lng);
  return km <= TRACK_RULES.slackKm + (TRACK_RULES.maxSpeedKmh * dt) / 3_600_000;
}

export function buildTracks(sightings: Sighting[]): TrackSet {
  const buckets = new Map<string, Sighting[]>();
  const singles: Sighting[] = [];
  for (const s of sightings) {
    const id = identityOf(s);
    if (id.length === 0) {
      singles.push(s);
      continue;
    }
    const key = `${baseSpecies(s.species)}|${id.join(',')}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(s);
  }

  const tracks: Track[] = [];
  for (const group of buckets.values()) {
    group.sort((a, b) => a.epochMs - b.epochMs);
    const chains: Sighting[][] = [];
    for (const s of group) {
      // Attach to the chain whose last point is nearest in space among plausible ones.
      let best: Sighting[] | null = null;
      let bestKm = Infinity;
      for (const c of chains) {
        const last = c[c.length - 1];
        if (last.ecotype && s.ecotype && last.ecotype !== s.ecotype) continue;
        if (!plausible(last, s)) continue;
        const km = haversineKm(last.lat, last.lng, s.lat, s.lng);
        if (km < bestKm) {
          bestKm = km;
          best = c;
        }
      }
      if (best) best.push(s);
      else chains.push([s]);
    }
    for (const c of chains) {
      if (c.length < 2) singles.push(c[0]);
      else tracks.push(makeTrack(c));
    }
  }
  tracks.sort((a, b) => b.lastMs - a.lastMs);
  singles.sort((a, b) => b.epochMs - a.epochMs);
  return { tracks, singles };
}

function makeTrack(points: Sighting[]): Track {
  const head = points[points.length - 1];
  let statedHeading: Compass | null = null;
  for (let i = points.length - 1; i >= 0 && !statedHeading; i--)
    statedHeading = parseHeading(points[i].comment);
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++)
    distanceKm += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);

  let bearing: number | null = null;
  // Last hop that moved far enough to mean something (>= 0.4 km).
  for (let i = points.length - 1; i > 0 && bearing === null; i--) {
    const a = points[i - 1];
    const b = points[i];
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) >= 0.4)
      bearing = bearingDeg(a.lat, a.lng, b.lat, b.lng);
  }
  if (bearing === null && statedHeading) bearing = COMPASS_BEARING[statedHeading];

  return {
    id: head.id,
    species: head.species,
    points,
    head,
    identity: [...new Set(points.flatMap(identityOf))].sort(),
    pods: [...new Set(points.flatMap((p) => p.pods))].sort(),
    firstMs: points[0].epochMs,
    lastMs: head.epochMs,
    reportCount: points.reduce((n, p) => n + p.reportCount, 0),
    count: head.count,
    statedHeading,
    bearing,
    distanceKm,
  };
}
