import type { GeoProjection } from 'd3-geo';
import type { Sighting } from '../types';
import type { Track } from '../data/tracks';
import { trackGeometry } from '../data/trackGeometry';
import { declutter } from './declutter';
import { isLand } from '../data/land';

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
export interface Layout {
  /** Sprite offsets from the true position, each within the nudge cap. */
  offsets: Map<string, [number, number]>;
  /** Singles folded into a neighbour: member id → host id. Not drawn. */
  merged: Map<string, string>;
  /** Host id → how many sightings it stands for (>= 2). */
  clusterSize: Map<string, number>;
}

/** Sprites shrink on narrow screens so a phone isn't wall-to-wall whale. */
export function spriteScaleFor(width: number): number {
  return Math.min(1, Math.max(0.5, width / 800));
}

/** A sprite may drift at most ~1.25 sprite widths from where it was reported. */
export const NUDGE_CAP_WIDTHS = 1.25;

let memo: { key: string; proj: GeoProjection; out: Layout } | null = null;

/**
 * Sprite layout for the board: track heads hold their true position; singles
 * yield to each other, to heads and to track lines — within a hard nudge cap,
 * folding into a count badge when there's no room. `scale` is the full sprite
 * scale on screen (counter-zoom damp x narrow-screen factor).
 */
export function layoutMarkers(
  sightings: Sighting[],
  tracks: Track[],
  projection: GeoProjection,
  scale: number,
): Layout {
  const key = `${scale}|${sightings.map((s) => `${s.id}@${s.lat},${s.lng}`).join(';')}|${tracks.map((t) => t.id + t.points.length).join(',')}`;
  if (memo && memo.proj === projection && memo.key === key) return memo.out;
  const heads = new Set(tracks.map((t) => t.id));
  const spots = sightings.flatMap((s) => {
    const p = projection([s.lng, s.lat]);
    return p ? [{ id: s.id, x: p[0], y: p[1], fixed: heads.has(s.id) }] : [];
  });
  const onLand = (x: number, y: number) => {
    // Body centre and both ends of the sprite — a whale shouldn't sit on a headland.
    for (const dx of [0, -SPRITE_HALF_W * scale * 0.7, SPRITE_HALF_W * scale * 0.7]) {
      const g = projection.invert?.([x + dx, y]);
      if (g && isLand(g[0], g[1])) return true;
    }
    return false;
  };
  const { offsets, merged } = declutter(spots, {
    avoid: onLand,
    halfW: SPRITE_HALF_W * scale,
    halfH: SPRITE_HALF_H * scale,
    maxNudge: 2 * SPRITE_HALF_W * scale * NUDGE_CAP_WIDTHS,
    obstacles: trackObstacles(tracks, projection, 14 * scale),
    margin: 6 * scale,
  });
  const clusterSize = new Map<string, number>();
  for (const host of merged.values()) clusterSize.set(host, (clusterSize.get(host) ?? 1) + 1);
  const out = { offsets, merged, clusterSize };
  memo = { key, proj: projection, out };
  return out;
}
