import type { Track } from './tracks';
import { isLand, landMask } from './land';

export type LngLat = [number, number];

export interface TrackGeometry {
  /** One dense polyline per hop (points[i] → points[i+1]), water-only. */
  hops: LngLat[][];
  /** Where each report's dot sits (report position nudged onto open water). */
  nodes: LngLat[];
}

const D_LAT = 0.004;
const D_LNG = 0.006;
const PAD = 0.12;

/** Is the straight lng/lat segment clear of land (sampled ~ every 0.4 cell)? */
function segmentClear(a: LngLat, b: LngLat, blocked: (x: number, y: number) => boolean): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot((b[0] - a[0]) / D_LNG, (b[1] - a[1]) / D_LAT) * 10));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (blocked(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

function chaikin(pts: LngLat[], rounds: number): LngLat[] {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    if (p.length < 3) break;
    const out: LngLat[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

/** Densify so every drawn/sampled point is checkable. */
function densify(pts: LngLat[]): LngLat[] {
  const out: LngLat[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) / D_LNG, (b[1] - a[1]) / D_LAT) / 0.25));
    for (let k = 1; k <= n; k++)
      out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

const allWater = (pts: LngLat[]) => pts.every((p) => !isLand(p[0], p[1]));

/**
 * Water-following geometry for a track. Hops that cross land (a peninsula, a
 * point) are routed through open water on a coarse grid (A*, then line-of-sight
 * shortcuts); the result is gently smoothed only where the smoothed curve
 * itself stays on water, otherwise the straight water-safe polyline is kept.
 * Every returned hop point is verified against the exact coastline.
 */
export function trackGeometry(track: Track): TrackGeometry {
  const key = track.points.map((p) => `${p.id}@${p.lat},${p.lng}`).join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const raw: LngLat[] = track.points.map((p) => [p.lng, p.lat]);
  const lngs = raw.map((p) => p[0]);
  const lats = raw.map((p) => p[1]);
  const west = Math.floor((Math.min(...lngs) - PAD) / D_LNG) * D_LNG;
  const south = Math.floor((Math.min(...lats) - PAD) / D_LAT) * D_LAT;
  const cols = Math.ceil((Math.max(...lngs) + PAD - west) / D_LNG);
  const rows = Math.ceil((Math.max(...lats) + PAD - south) / D_LAT);
  // Conservative mask: a cell is land if ANY of its 3x3 sub-cells is, so thin
  // spits and points can't slip between cell centres.
  const SUB = 3;
  const fine = landMask(west, south, D_LNG / SUB, D_LAT / SUB, cols * SUB, rows * SUB);
  const land = new Uint8Array(cols * rows);
  for (let r = 0; r < rows * SUB; r++)
    for (let c = 0; c < cols * SUB; c++)
      if (fine[r * cols * SUB + c]) land[Math.floor(r / SUB) * cols + Math.floor(c / SUB)] = 1;

  // Shore buffer: cells touching land are blocked so routes/curves keep off the coast.
  const buffered = new Uint8Array(land.length);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let b = 0;
      for (let dr = -1; dr <= 1 && !b; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && land[rr * cols + cc]) {
            b = 1;
            break;
          }
        }
      buffered[r * cols + c] = b;
    }
  const cellOf = (x: number, y: number): [number, number] => [
    Math.floor((x - west) / D_LNG),
    Math.floor((y - south) / D_LAT),
  ];
  const inGrid = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows;
  const makeBlocked = (mask: Uint8Array) => (x: number, y: number) => {
    const [c, r] = cellOf(x, y);
    return !inGrid(c, r) || mask[r * cols + c] === 1 || isLand(x, y);
  };
  const blockedBuf = makeBlocked(buffered);
  const blockedLand = makeBlocked(land);

  // Nudge each report onto nearby open water (BFS over free cells).
  const centre = (c: number, r: number): LngLat => [west + (c + 0.5) * D_LNG, south + (r + 0.5) * D_LAT];
  const snap = (p: LngLat, mask: Uint8Array): LngLat | null => {
    const [c0, r0] = cellOf(p[0], p[1]);
    if (inGrid(c0, r0) && !mask[r0 * cols + c0] && !isLand(p[0], p[1])) return p;
    for (let ring = 1; ring < 40; ring++) {
      let best: LngLat | null = null;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++)
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!inGrid(c, r) || mask[r * cols + c]) continue;
          const q = centre(c, r);
          if (isLand(q[0], q[1])) continue;
          const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
      if (best) return best;
    }
    return null;
  };
  const nodes: LngLat[] = raw.map((p) => snap(p, buffered) ?? snap(p, land) ?? p);

  const route = (a: LngLat, b: LngLat, mask: Uint8Array, blocked: typeof blockedBuf): LngLat[] | null => {
    if (segmentClear(a, b, blocked)) return [a, b];
    const [ac, ar] = cellOf(a[0], a[1]);
    const [bc, br] = cellOf(b[0], b[1]);
    if (!inGrid(ac, ar) || !inGrid(bc, br)) return null;
    const idx = (c: number, r: number) => r * cols + c;
    const g = new Float64Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const open: [number, number][] = [[0, idx(ac, ar)]];
    g[idx(ac, ar)] = 0;
    const h = (c: number, r: number) => Math.hypot(c - bc, r - br);
    const goal = idx(bc, br);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      const c = cur % cols;
      const r = (cur - c) / cols;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!inGrid(nc, nr)) continue;
          const ni = idx(nc, nr);
          if (mask[ni] && ni !== goal) continue;
          const ng = g[cur] + Math.hypot(dc, dr);
          if (ng < g[ni]) {
            g[ni] = ng;
            from[ni] = cur;
            open.push([ng + h(nc, nr), ni]);
          }
        }
    }
    if (from[goal] === -1 && goal !== idx(ac, ar)) return null;
    const cells: LngLat[] = [];
    for (let i = goal; i !== -1; i = from[i]) cells.push(centre(i % cols, (i - (i % cols)) / cols));
    cells.reverse();
    const path: LngLat[] = [a, ...cells.slice(1, -1), b];
    // Line-of-sight pull: drop vertices a straight water-safe leg can skip.
    const out: LngLat[] = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !segmentClear(path[i], path[j], blocked)) j--;
      out.push(path[j]);
      i = j;
    }
    return out;
  };

  const hops: LngLat[][] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const legs =
      route(a, b, buffered, blockedBuf) ?? route(a, b, land, blockedLand) ?? [a, b];
    const smooth = densify(chaikin(legs, 2));
    hops.push(allWater(smooth) ? smooth : densify(legs));
  }
  const result = { hops, nodes };
  if (cache.size > 200) cache.clear();
  cache.set(key, result);
  return result;
}

const cache = new Map<string, TrackGeometry>();
