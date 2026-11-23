import { describe, expect, it } from 'vitest';
import fixture from './fixtures/acartia-tracks.json';
import { normalizeBatch } from './normalize';
import { collapseNearDupes } from './dedupe';
import { buildTracks } from './tracks';
import { trackGeometry } from './trackGeometry';
import { isLand } from './land';

export function fixtureTracks() {
  const sightings = normalizeBatch(fixture);
  return buildTracks(collapseNearDupes(sightings));
}

describe('trackGeometry (?scenario=tracks fixture)', () => {
  const { tracks } = fixtureTracks();
  it('builds tracks from the fixture', () => {
    expect(tracks.length).toBeGreaterThanOrEqual(3);
  });
  it('no sampled point of any rendered track path is on land', () => {
    for (const t of tracks) {
      const g = trackGeometry(t);
      expect(g.hops).toHaveLength(t.points.length - 1);
      for (const hop of g.hops)
        for (const [lng, lat] of hop) expect(isLand(lng, lat), `${t.id} @ ${lat},${lng}`).toBe(false);
    }
  });
  it('is a meaningful check: the naive straight hops do cross land', () => {
    let hits = 0;
    for (const t of tracks)
      for (let i = 1; i < t.points.length; i++) {
        const a = t.points[i - 1];
        const b = t.points[i];
        for (let k = 0; k <= 60; k++) {
          const f = k / 60;
          if (isLand(a.lng + (b.lng - a.lng) * f, a.lat + (b.lat - a.lat) * f)) hits++;
        }
      }
    expect(hits).toBeGreaterThan(0);
  });
  it('detects land (sanity: Bainbridge Island interior)', () => {
    expect(isLand(-122.52, 47.65)).toBe(true);
    expect(isLand(-122.42, 47.62)).toBe(false);
  });
});
