import { describe, expect, it } from 'vitest';
import live from '../data/fixtures/acartia-live-20261123.json';
import { normalizeBatch, withinWindow } from '../data/normalize';
import { collapseNearDupes } from '../data/dedupe';
import { buildTracks } from '../data/tracks';
import { isLand } from '../data/land';
import { fixtureTracks } from '../data/trackGeometry.test';
import { makeProjection } from './projection';
import {
  layoutMarkers,
  trackObstacles,
  spriteScaleFor,
  NUDGE_CAP_WIDTHS,
  SPRITE_HALF_H,
  SPRITE_HALF_W,
} from './layout';

describe('layoutMarkers (?scenario=tracks fixture)', () => {
  const { tracks, singles } = fixtureTracks();
  const projection = makeProjection(1400, 800);
  const all = [...tracks.map((t) => t.head), ...singles];

  for (const damp of [1, 0.5]) {
    it(`keeps single sprites clear of track lines and heads when they move (scale ${damp})`, () => {
      const { offsets, merged } = layoutMarkers(all, tracks, projection, damp);
      const lines = trackObstacles(tracks, projection, 14 * damp);
      const heads = tracks.map((t) => projection([t.head.lng, t.head.lat])!);
      const hw = SPRITE_HALF_W * damp;
      const hh = SPRITE_HALF_H * damp;
      for (const s of singles) {
        if (merged.has(s.id)) continue;
        const p = projection([s.lng, s.lat])!;
        const o = offsets.get(s.id);
        if (!o) continue; // unmoved sprites had room by definition
        const pos: [number, number] = [p[0] + o[0], p[1] + o[1]];
        for (const l of lines)
          expect(((l.x - pos[0]) / hw) ** 2 + ((l.y - pos[1]) / hh) ** 2).toBeGreaterThanOrEqual(1);
        for (const h of heads)
          expect(((h[0] - pos[0]) / (2 * hw)) ** 2 + ((h[1] - pos[1]) / (2 * hh)) ** 2)
            .toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('reuses layout within a pinch bucket and recomputes across distant zoom', () => {
    const near = layoutMarkers(all, tracks, projection, 1.05);
    expect(layoutMarkers(all, tracks, projection, 1)).toBe(near);
    expect(layoutMarkers(all, tracks, projection, 0.97)).toBe(near);
    expect(layoutMarkers(all, tracks, projection, 2)).not.toBe(near);
  });
});

/**
 * Regression gates for the live board (PR #3 shipped a grid of ~60 sprites
 * across land): real 256-sighting capture, desktop + 390px phone, several zooms.
 */
describe('layoutMarkers (live capture 2026-11-23)', () => {
  const NOW = Date.parse('2026-11-24T00:00:00Z');
  const parsed = normalizeBatch(live);
  const viewports = [
    { name: 'desktop', w: 1400, h: 800 },
    { name: 'mobile', w: 390, h: 844 },
  ];
  const zooms = [1, 2.5];

  for (const hours of [24, 72, 168] as const)
    for (const vp of viewports)
      for (const k of zooms) {
        it(`${hours}h ${vp.name} zoom ${k}: sprites stay near, on water, and never outnumber sightings`, () => {
          const visible = collapseNearDupes(parsed.filter((s) => withinWindow(s, NOW, hours)));
          expect(visible.length).toBeGreaterThan(5);
          const { tracks, singles } = buildTracks(visible);
          const marks = [...tracks.map((t) => t.head), ...singles];
          const projection = makeProjection(vp.w, vp.h);
          const scale = (1 / k) * spriteScaleFor(vp.w);
          // Layout solves on ~15% zoom buckets; judge the footprint it actually used.
          const qScale = Math.pow(1.15, Math.round(Math.log(scale) / Math.log(1.15)));
          const { offsets, merged, clusterSize } = layoutMarkers(marks, tracks, projection, scale);

          // 1. hard displacement cap
          const cap = 2 * SPRITE_HALF_W * qScale * NUDGE_CAP_WIDTHS + 1e-6;
          for (const [id, [dx, dy]] of offsets)
            expect(Math.hypot(dx, dy), `${id} moved too far`).toBeLessThanOrEqual(cap);

          // 2. never more sprites than sightings; clusters account for every sighting
          const rendered = marks.filter((s) => !merged.has(s.id));
          expect(rendered.length).toBeLessThanOrEqual(visible.length);
          let folded = 0;
          for (const n of clusterSize.values()) folded += n - 1;
          expect(folded).toBe(merged.size);
          for (const host of merged.values()) expect(merged.has(host)).toBe(false);

          // 3. nothing pushed from water onto land
          const onLand = (x: number, y: number) =>
            [0, -0.7, 0.7].some((f) => {
              const g = projection.invert!([x + f * SPRITE_HALF_W * qScale, y]);
              return !!g && isLand(g[0], g[1]);
            });
          for (const s of rendered) {
            const p = projection([s.lng, s.lat])!;
            const o = offsets.get(s.id);
            if (!o) continue;
            if (!onLand(p[0], p[1])) expect(onLand(p[0] + o[0], p[1] + o[1]), `${s.id} pushed onto land`).toBe(false);
          }
        });
      }
});
