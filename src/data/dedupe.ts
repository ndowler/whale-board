import { CONFIG } from '../config';
import type { Sighting, SpeciesId } from '../types';

/** Great-circle distance in km (spherical earth is plenty at 500 m scales). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Orca ecotypes share a base so a generic "Orca" report merges with a
 * "Biggs T46B" report of the same animal — but the two ecotypes never merge
 * with each other (different bases would be wrong; the check below handles it).
 */
function baseSpecies(s: SpeciesId): SpeciesId {
  return s === 'orca_biggs' || s === 'orca_srkw' ? 'orca' : s;
}

function canMerge(a: Sighting, b: Sighting): boolean {
  if (baseSpecies(a.species) !== baseSpecies(b.species)) return false;
  // Conflicting ecotypes are different animals, even at the same spot.
  if (a.ecotype && b.ecotype && a.ecotype !== b.ecotype) return false;
  return true;
}

/** Higher trusted wins; then newer; then the report that knows more. */
function richness(s: Sighting): number {
  return (s.ecotype ? 2 : 0) + s.pods.length + s.individuals.length;
}

function seedOrder(a: Sighting, b: Sighting): number {
  if (a.trusted !== b.trusted) return b.trusted - a.trusted;
  if (a.epochMs !== b.epochMs) return b.epochMs - a.epochMs;
  return richness(b) - richness(a);
}

/**
 * FR-8: collapse near-duplicate reports (one animal, multiple witnesses) —
 * same base species within `distanceKm` and `windowMs` of a cluster seed.
 *
 * Greedy, no transitive chaining: records are visited best-first (trusted,
 * then newest); each unclaimed record seeds a cluster and absorbs every other
 * unclaimed record within both thresholds *of the seed*. The seed keeps its
 * id/position/time and absorbs the rest: `mergedIds`/`reportCount` grow, pods
 * and individuals union, count takes the max (multiple witnesses, not more
 * whales), and a generic orca upgrades to the ecotype an absorbed report knew.
 *
 * Pure view transform — the store keeps every raw report; run this at
 * display time (visibleSightings).
 */
export function collapseNearDupes(
  sightings: Sighting[],
  opts: { distanceKm: number; windowMs: number } = CONFIG.dedupe,
): Sighting[] {
  if (sightings.length < 2) return sightings;

  const ordered = [...sightings].sort(seedOrder);
  const claimed = new Set<string>();
  const out: Sighting[] = [];

  for (const seed of ordered) {
    if (claimed.has(seed.id)) continue;
    claimed.add(seed.id);

    const absorbed: Sighting[] = [];
    for (const other of ordered) {
      if (claimed.has(other.id)) continue;
      if (Math.abs(other.epochMs - seed.epochMs) > opts.windowMs) continue;
      if (!canMerge(seed, other)) continue;
      if (haversineKm(seed.lat, seed.lng, other.lat, other.lng) > opts.distanceKm)
        continue;
      claimed.add(other.id);
      absorbed.push(other);
    }

    if (absorbed.length === 0) {
      out.push(seed);
      continue;
    }

    const pods = new Set(seed.pods);
    const individuals = new Set(seed.individuals);
    let species = seed.species;
    let ecotype = seed.ecotype;
    let count = seed.count;
    const mergedIds = [...seed.mergedIds];
    for (const a of absorbed) {
      a.pods.forEach((p) => pods.add(p));
      a.individuals.forEach((i) => individuals.add(i));
      if (species === 'orca' && baseSpecies(a.species) === 'orca' && a.species !== 'orca') {
        species = a.species;
      }
      if (!ecotype && a.ecotype) ecotype = a.ecotype;
      if (a.count !== null) count = count === null ? a.count : Math.max(count, a.count);
      mergedIds.push(a.id, ...a.mergedIds);
    }

    out.push({
      ...seed,
      species,
      ecotype,
      pods: [...pods],
      individuals: [...individuals],
      count,
      mergedIds,
      reportCount: 1 + mergedIds.length,
    });
  }

  return out;
}
