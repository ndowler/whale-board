import type { Sighting } from '../types';

/** Hard cap for wheel, button, and cluster drill-down zoom. */
export const MAX_ZOOM = 12;

const CLUSTER_RADIUS_PX = 58;

export interface MarkerCluster {
  /** Representative sighting (first/newest in the cluster). */
  lead: Sighting;
  /** Projected SVG coords of `lead`. */
  x: number;
  y: number;
  items: Sighting[];
}

/**
 * Greedy screen-space clustering by species (no transitive chaining).
 * Input is newest-first so the newest sighting seeds each cluster and drives
 * its plate art and position. As zoom `scale` grows, clusters split naturally.
 * ponytail: O(n²) per zoom tick; swap to a grid hash if visible sightings > ~1k.
 * One-slot cache so glow, markers, and the popover share a zoom's clusters.
 */
let clusterSlot:
  | {
      sightings: readonly Sighting[];
      project: (coords: [number, number]) => [number, number] | null;
      scale: number;
      radiusPx: number;
      clusters: MarkerCluster[];
    }
  | undefined;

export function clusterMarkers(
  sightings: readonly Sighting[],
  project: (coords: [number, number]) => [number, number] | null,
  scale: number,
  radiusPx = CLUSTER_RADIUS_PX,
): MarkerCluster[] {
  const hit = clusterSlot;
  if (
    hit &&
    hit.sightings === sightings &&
    hit.project === project &&
    hit.scale === scale &&
    hit.radiusPx === radiusPx
  ) {
    return hit.clusters;
  }
  const clusters: MarkerCluster[] = [];
  const r2 = radiusPx * radiusPx;
  const k2 = scale * scale;
  for (const s of sightings) {
    const p = project([s.lng, s.lat]);
    if (!p) continue;
    const [x, y] = p;
    let host: MarkerCluster | undefined;
    for (const c of clusters) {
      if (c.lead.species !== s.species) continue;
      const dx = c.x - x;
      const dy = c.y - y;
      if ((dx * dx + dy * dy) * k2 <= r2) {
        host = c;
        break;
      }
    }
    if (host) host.items.push(s);
    else clusters.push({ lead: s, x, y, items: [s] });
  }
  clusterSlot = { sightings, project, scale, radiusPx, clusters };
  return clusters;
}

/** Density bump for a cluster of `count` sightings. count 1 is a no-op. */
export function clusterGlow(
  baseR: number,
  opacity: number,
  count: number,
): { r: number; opacity: number } {
  const density = Math.log2(count);
  return {
    r: baseR * (1 + Math.min(0.45, density * 0.12)),
    opacity: Math.min(1, opacity * (1 + density * 0.18)),
  };
}
