export interface Anchor {
  id: string;
  x: number;
  y: number;
  /** Fixed anchors (track heads' true positions) never move; others yield. */
  fixed?: boolean;
}

export interface DeclutterOptions {
  /** Half-extents of a sprite (map units). Two sprites clear when their
   *  centres sit outside the ellipse with radii (2*halfW, 2*halfH). */
  halfW: number;
  halfH: number;
  /** Points a sprite must not cover (sampled track lines), plus a margin. */
  obstacles?: { x: number; y: number }[];
  margin?: number;
}

/**
 * Nudge co-located markers apart so sprites don't pile up and don't sit on
 * track lines. Pure and deterministic: input order decides who yields (earlier
 * keeps its spot); movers take the nearest free slot on an expanding ring.
 * Returns id → [dx, dy] offsets for the ones that moved.
 */
export function declutter(
  anchors: Anchor[],
  opts: DeclutterOptions,
): Map<string, [number, number]> {
  const { halfW, halfH, obstacles = [], margin = 6 } = opts;
  const placed: { x: number; y: number }[] = [];
  const out = new Map<string, [number, number]>();
  const spriteClear = (x: number, y: number) =>
    placed.every((p) => ((p.x - x) / (2 * halfW)) ** 2 + ((p.y - y) / (2 * halfH)) ** 2 >= 1);
  const lineClear = (x: number, y: number) =>
    obstacles.every(
      (o) => ((o.x - x) / (halfW + margin)) ** 2 + ((o.y - y) / (halfH + margin)) ** 2 >= 1,
    );
  const free = (x: number, y: number) => spriteClear(x, y) && lineClear(x, y);

  // Fixed first so they claim their true spot.
  const ordered = [...anchors.filter((a) => a.fixed), ...anchors.filter((a) => !a.fixed)];
  for (const a of ordered) {
    if (a.fixed || free(a.x, a.y)) {
      placed.push({ x: a.x, y: a.y });
      continue;
    }
    let done = false;
    const step = halfH;
    for (let ring = 1; ring <= 14 && !done; ring++) {
      const steps = 8 * ring;
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        // Wider than tall: sprites are wide and the Sound is a N–S column.
        const x = a.x + Math.cos(ang) * step * ring * 1.6;
        const y = a.y + Math.sin(ang) * step * ring;
        const d = Math.hypot(x - a.x, y - a.y);
        if (d < bestD && free(x, y)) {
          bestD = d;
          best = [x, y];
        }
      }
      if (best) {
        placed.push({ x: best[0], y: best[1] });
        out.set(a.id, [best[0] - a.x, best[1] - a.y]);
        done = true;
      }
    }
    if (!done) placed.push({ x: a.x, y: a.y });
  }
  return out;
}
