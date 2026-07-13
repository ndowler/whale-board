import { geoConicConformal, geoPath, type GeoProjection } from 'd3-geo';
import { CONFIG } from '../config';

const { west, south, east, north } = CONFIG.defaultView;

// d3-geo treats spherical polygons with CLOCKWISE exterior rings as the
// enclosed area (opposite of RFC 7946) — wound the other way, fitExtent
// fits the polygon's complement and the map collapses to a point.
const FRAME: GeoJSON.Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
    ],
  },
};

/**
 * Conic conformal keeps shapes honest at 47–49°N (Mercator would stretch
 * the Sound north–south). Rotate/parallels must be set before fitExtent,
 * which only solves scale and translate.
 */
export function makeProjection(width: number, height: number): GeoProjection {
  return geoConicConformal()
    .parallels([47.5, 48.7])
    .rotate([122.7, 0])
    .fitExtent(
      [
        [8, 8],
        [width - 8, height - 8],
      ],
      FRAME,
    );
}

export function makePath(projection: GeoProjection) {
  return geoPath(projection);
}

/**
 * Pixel radius of `km` kilometers at the map's center latitude — used to
 * render honest "approximate position" glows instead of pinpoints.
 */
export function kmToPx(projection: GeoProjection, km: number): number {
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;
  const dLat = km / 111.32; // deg latitude per km
  const a = projection([midLng, midLat]);
  const b = projection([midLng, midLat + dLat]);
  if (!a || !b) return 8;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
