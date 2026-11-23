import type { GeoProjection } from 'd3-geo';
import type { Sighting } from '../types';
import type { Track } from '../data/tracks';
import { trackGeometry } from '../data/trackGeometry';
import { declutter } from './declutter';

/** Marker art footprint in map units (the plate is 160 x 94, centred). */
export const SPRITE_HALF_W = 80;
export const SPRITE_HALF_H = 46;

type Pt = { x: number; y: number };

/** Projected track lines resampled to ~`spacing` units — obstacles for singles. */
export function trackObstacles(tracks: Track[], projection: GeoProjection, spacing: number): Pt[] {
  const out: Pt[] = [];
  for (const t of tracks) {
    for (const hop of trackGeometry(t).hops) {
      let prev: [number, number] | null = null;
      for (const q of hop) {
        const p = projection(q);
        if (!p) continue;
        if (prev) {
          const n = Math.max(1, Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / spacing));
          for (let k = 1; k <= n; k++)
            out.push({
              x: prev[0] + ((p[0] - prev[0]) * k) / n,
              y: prev[1] + ((p[1] - prev[1]) * k) / n,
            });
        } else out.push({ x: p[0], y: p[1] });
        prev = p;
      }
    }
  }
  return out;
}

/**
 * Sprite offsets for the board: track heads hold their true position, singles
 * yield to each other, to heads, and to every track line. `damp` is the
 * counter-zoom scale applied to sprites, so the footprint shrinks with it.
 */
export function layoutMarkers(
  sightings: Sighting[],
  tracks: Track[],
  projection: GeoProjection,
  damp: number,
): Map<string, [number, number]> {
  const heads = new Set(tracks.map((t) => t.id));
  const spots = sightings.flatMap((s) => {
    const p = projection([s.lng, s.lat]);
    return p ? [{ id: s.id, x: p[0], y: p[1], fixed: heads.has(s.id) }] : [];
  });
  return declutter(spots, {
    halfW: SPRITE_HALF_W * damp,
    halfH: SPRITE_HALF_H * damp,
    obstacles: trackObstacles(tracks, projection, 14 * damp),
    margin: 6 * damp,
  });
}
