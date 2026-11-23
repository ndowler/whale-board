export interface Anchor {
  id: string;
  x: number;
  y: number;
  /** Fixed anchors (track heads' true positions) never move or absorb others. */
  fixed?: boolean;
}

export interface DeclutterOptions {
  /** Half-extents of a sprite (map units). Two sprites clear when their
   *  centres sit outside the ellipse with radii (2*halfW, 2*halfH). */
  halfW: number;
  halfH: number;
  /** HARD cap on how far any sprite may move from its true position. */
  maxNudge: number;
  /** Points a sprite must not cover (sampled track lines), plus a margin. */
  obstacles?: { x: number; y: number }[];
  margin?: number;
  /** True for spots that are land. A sprite is never moved from water onto land. */
  avoid?: (x: number, y: number) => boolean;
}

export interface DeclutterResult {
  /** id → [dx, dy] for sprites that moved (always within `maxNudge`). */
  offsets: Map<string, [number, number]>;
  /** Unrelated singles with no room nearby fold into a neighbour: member → host. */
  merged: Map<string, string>;
}

/**
 * Keep sprites from piling up and from sitting on track lines, WITHOUT ever
 * relocating one far from where it was reported. Input order decides who
 * yields (earlier keeps its spot). A mover takes the nearest free slot within
 * `maxNudge` that isn't land (unless it already was). If there is none, it is
 * folded into the nearest placed single (rendered as a count badge) — or, when
 * no single is near, left at its true position. Pure and deterministic.
 */
export function declutter(anchors: Anchor[], opts: DeclutterOptions): DeclutterResult {
  const { halfW, halfH, maxNudge, obstacles = [], margin = 6, avoid } = opts;
  const placed: { id: string; x: number; y: number; fixed: boolean }[] = [];
  const offsets = new Map<string, [number, number]>();
  const merged = new Map<string, string>();
  const spriteClear = (x: number, y: number) =>
    placed.every((p) => ((p.x - x) / (2 * halfW)) ** 2 + ((p.y - y) / (2 * halfH)) ** 2 >= 1);
  const lineClear = (x: number, y: number) =>
    obstacles.every(
      (o) => ((o.x - x) / (halfW + margin)) ** 2 + ((o.y - y) / (halfH + margin)) ** 2 >= 1,
    );
  const free = (x: number, y: number) => spriteClear(x, y) && lineClear(x, y);

  const ordered = [...anchors.filter((a) => a.fixed), ...anchors.filter((a) => !a.fixed)];
  for (const a of ordered) {
    if (a.fixed || free(a.x, a.y)) {
      placed.push({ id: a.id, x: a.x, y: a.y, fixed: !!a.fixed });
      continue;
    }
    const wasLand = avoid ? avoid(a.x, a.y) : false;
    const step = halfH;
    let best: [number, number] | null = null;
    for (let ring = 1; ring * step <= maxNudge * 1.001 && !best; ring++) {
      const steps = 8 * ring;
      let bestD = Infinity;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const x = a.x + Math.cos(ang) * step * ring * 1.6;
        const y = a.y + Math.sin(ang) * step * ring;
        const d = Math.hypot(x - a.x, y - a.y);
        if (d > maxNudge || d >= bestD) continue;
        if (!free(x, y)) continue;
        if (avoid && !wasLand && avoid(x, y)) continue;
        bestD = d;
        best = [x, y];
      }
    }
    if (best) {
      placed.push({ id: a.id, x: best[0], y: best[1], fixed: false });
      offsets.set(a.id, [best[0] - a.x, best[1] - a.y]);
      continue;
    }
    // No room within the cap: fold into the nearest placed single in reach.
    let host: (typeof placed)[number] | null = null;
    let hd = Infinity;
    for (const p of placed) {
      if (p.fixed || merged.has(p.id)) continue;
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < hd) {
        hd = d;
        host = p;
      }
    }
    if (host && hd <= 2 * halfW + maxNudge) merged.set(a.id, host.id);
    else placed.push({ id: a.id, x: a.x, y: a.y, fixed: false });
  }
  return { offsets, merged };
}
