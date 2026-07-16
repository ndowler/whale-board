import {
  geoConicConformal,
  geoGraticule,
  geoPath,
  type GeoPath,
  type GeoProjection,
} from 'd3-geo';
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
 * How far to push past "contain" toward "cover" when the viewport is wider
 * than the frame. 0 = contain (letterboxed: the raster fills the sides with
 * flanking land), 1 = cover (the narrow channel fills the width but crops
 * the Sound to a sliver on a 2:1 kiosk screen). The geometric-mean blend
 * halves the side land while keeping Vashon→Edmonds in the opening frame.
 */
const COVER_BLEND = 0.5;

/**
 * Conic conformal keeps shapes honest at 47–49°N (Mercator would stretch
 * the Sound north–south). Rotate/parallels must be set before fitExtent,
 * which only solves scale and translate.
 */
export function makeProjection(width: number, height: number): GeoProjection {
  const projection = geoConicConformal()
    .parallels([47.5, 48.7])
    .rotate([122.7, 0])
    .fitExtent(
      [
        [0, 0],
        [width, height],
      ],
      FRAME,
    );
  // Scale up from the contain fit toward a cover fit, then re-center the
  // frame so the crop is symmetric. The water channel dominates the screen
  // instead of the land the letterbox would otherwise expose.
  const b = geoPath(projection).bounds(FRAME);
  const cover = Math.max(
    width / (b[1][0] - b[0][0]),
    height / (b[1][1] - b[0][1]),
  );
  if (cover > 1) {
    projection.scale(projection.scale() * cover ** COVER_BLEND);
    const t = projection.translate();
    const b2 = geoPath(projection).bounds(FRAME);
    projection.translate([
      t[0] + (width - b2[0][0] - b2[1][0]) / 2,
      t[1] + (height - b2[0][1] - b2[1][1]) / 2,
    ]);
  }
  return projection;
}

export function makePath(projection: GeoProjection) {
  return geoPath(projection);
}

/**
 * Faint chart graticule (7.5-minute grid) covering the ingest bbox — vector,
 * so it stays a crisp hairline at any zoom while the raster softens.
 */
const GRATICULE = geoGraticule()
  .extent([
    [CONFIG.bbox.west, CONFIG.bbox.south],
    [CONFIG.bbox.east, CONFIG.bbox.north],
  ])
  .step([0.125, 0.125])();

export function graticulePathD(path: GeoPath): string {
  return path(GRATICULE) ?? '';
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
