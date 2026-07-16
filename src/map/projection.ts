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
 * The vintage-chart raster's reference frame. MUST stay in lockstep with
 * scripts/render-base-chart.mjs, which rasterized the coastline with this
 * exact projection — same parallels/rotate/frame/extent. Because fitExtent
 * only ever applies a uniform scale + translate on top of fixed conic
 * parameters, mapping the raster into any live projection reduces to
 * anchoring its two pixel corners.
 */
const CHART_FRAME: GeoJSON.Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-124.0, 46.9],
        [-124.0, 49.3],
        [-122.0, 49.3],
        [-122.0, 46.9],
        [-124.0, 46.9],
      ],
    ],
  },
};
const CHART_W = 1664;
const CHART_H = 2048;

const chartRef = geoConicConformal()
  .parallels([47.5, 48.7])
  .rotate([122.7, 0])
  .fitExtent(
    [
      [0, 0],
      [CHART_W, CHART_H],
    ],
    CHART_FRAME,
  );

/** Where the chart raster's corners land in a live projection's pixels. */
export function chartPlacement(
  projection: GeoProjection,
): { x: number; y: number; width: number; height: number } | null {
  const g0 = chartRef.invert?.([0, 0]);
  const g1 = chartRef.invert?.([CHART_W, CHART_H]);
  if (!g0 || !g1) return null;
  const p0 = projection(g0);
  const p1 = projection(g1);
  if (!p0 || !p1) return null;
  return { x: p0[0], y: p0[1], width: p1[0] - p0[0], height: p1[1] - p0[1] };
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
