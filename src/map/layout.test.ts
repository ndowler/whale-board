import { describe, expect, it } from 'vitest';
import { fixtureTracks } from '../data/trackGeometry.test';
import { makeProjection } from './projection';
import { layoutMarkers, trackObstacles, SPRITE_HALF_H, SPRITE_HALF_W } from './layout';

describe('layoutMarkers (?scenario=tracks fixture)', () => {
  const { tracks, singles } = fixtureTracks();
  const projection = makeProjection(1400, 800);
  const all = [...tracks.map((t) => t.head), ...singles];

  for (const damp of [1, 0.5]) {
    it(`keeps single sprites clear of track lines and head sprites (damp ${damp})`, () => {
      expect(singles.length).toBeGreaterThanOrEqual(2);
      const off = layoutMarkers(all, tracks, projection, damp);
      const lines = trackObstacles(tracks, projection, 14 * damp);
      const heads = tracks.map((t) => projection([t.head.lng, t.head.lat])!);
      const hw = SPRITE_HALF_W * damp;
      const hh = SPRITE_HALF_H * damp;
      const placed: [number, number][] = [];
      for (const s of singles) {
        const p = projection([s.lng, s.lat])!;
        const o = off.get(s.id) ?? [0, 0];
        const pos: [number, number] = [p[0] + o[0], p[1] + o[1]];
        placed.push(pos);
        for (const l of lines)
          expect(((l.x - pos[0]) / hw) ** 2 + ((l.y - pos[1]) / hh) ** 2, `${s.id} vs line`)
            .toBeGreaterThanOrEqual(1);
        for (const h of heads)
          expect(((h[0] - pos[0]) / (2 * hw)) ** 2 + ((h[1] - pos[1]) / (2 * hh)) ** 2, `${s.id} vs head`)
            .toBeGreaterThanOrEqual(1);
      }
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++)
          expect(
            ((placed[i][0] - placed[j][0]) / (2 * hw)) ** 2 + ((placed[i][1] - placed[j][1]) / (2 * hh)) ** 2,
          ).toBeGreaterThanOrEqual(1);
    });
  }

  it('actually had to move something (the fixture stacks singles on tracks)', () => {
    expect(layoutMarkers(all, tracks, projection, 1).size).toBeGreaterThan(0);
  });
});
