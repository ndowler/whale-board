import zonesJson from '../assets/zones/salish-zones.geo.json';

type Ring = number[][];

interface Zone {
  name: string;
  labelAnchor: [number, number];
  ring: Ring;
}

/**
 * Planar ray-cast point-in-polygon. The zones are coarse, degree-scale
 * quads, so planar math is plenty accurate and sidesteps spherical-winding
 * concerns entirely.
 */
function ringContains(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export const ZONES: Zone[] = zonesJson.features.map((f) => ({
  name: f.properties.name,
  labelAnchor: f.properties.labelAnchor as [number, number],
  ring: f.geometry.coordinates[0],
}));

/** First zone containing the point, in specific→general order, else null. */
export function regionFor(lat: number, lng: number): string | null {
  for (const z of ZONES) {
    if (ringContains(z.ring, lng, lat)) return z.name;
  }
  return null;
}
