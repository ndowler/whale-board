export interface Anchor {
  id: string;
  x: number;
  y: number;
  /** Fixed anchors (track heads' true positions) never move; others yield. */
  fixed?: boolean;
}

/**
 * Nudge co-located markers apart so sprites don't pile up. Pure and
 * deterministic: input order decides who yields (earlier = keeps its spot),
 * and movers are placed on the nearest free slot of an expanding ring.
 * Returns id → [dx, dy] offsets for the ones that moved.
 */
export function declutter(
  anchors: Anchor[],
  minDist: number,
): Map<string, [number, number]> {
  const placed: { x: number; y: number }[] = [];
  const out = new Map<string, [number, number]>();
  const free = (x: number, y: number) =>
    placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist);

  // Fixed first so they claim their true spot.
  const ordered = [...anchors.filter((a) => a.fixed), ...anchors.filter((a) => !a.fixed)];
  for (const a of ordered) {
    if (a.fixed || free(a.x, a.y)) {
      placed.push({ x: a.x, y: a.y });
      continue;
    }
    let done = false;
    for (let ring = 1; ring <= 6 && !done; ring++) {
      const r = minDist * ring;
      const steps = 6 * ring;
      // Prefer sideways slots (the Sound is a N–S column; sprites are wide).
      for (let i = 0; i < steps && !done; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const x = a.x + Math.cos(ang) * r;
        const y = a.y + Math.sin(ang) * r * 0.6;
        if (free(x, y)) {
          placed.push({ x, y });
          out.set(a.id, [x - a.x, y - a.y]);
          done = true;
        }
      }
    }
    if (!done) placed.push({ x: a.x, y: a.y });
  }
  return out;
}
