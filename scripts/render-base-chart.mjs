/**
 * Render the real coastline to a flat reference raster (art/map/base.png)
 * that Gemini restyles into the vintage-chart background. The projection
 * here MUST stay in lockstep with chartProjection() in src/map/projection.ts:
 * same parallels/rotate, same CHART frame, same reference extent — that
 * contract is what lets the app anchor the raster to live geography.
 *
 * Usage: node scripts/render-base-chart.mjs
 * Needs sharp; pass its dir via SHARP_DIR (defaults to scratchpad install).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_DIR ?? 'sharp');

// Keep in sync with CHART in src/map/projection.ts.
const CHART = { west: -124.0, south: 46.9, east: -122.0, north: 49.3 };
const REF_W = 1664;
const REF_H = 2048;

const topo = JSON.parse(
  readFileSync('src/assets/coastline/salish-sea.topo.json', 'utf8'),
);
const land = feature(topo, topo.objects.land);

const frame = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [CHART.west, CHART.south],
        [CHART.west, CHART.north],
        [CHART.east, CHART.north],
        [CHART.east, CHART.south],
        [CHART.west, CHART.south],
      ],
    ],
  },
};

const proj = geoConicConformal()
  .parallels([47.5, 48.7])
  .rotate([122.7, 0])
  .fitExtent(
    [
      [0, 0],
      [REF_W, REF_H],
    ],
    frame,
  );
const path = geoPath(proj);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${REF_W}" height="${REF_H}">
  <rect width="${REF_W}" height="${REF_H}" fill="#0a1622"/>
  <path d="${path(land)}" fill="#1c2a26" stroke="#3b5450" stroke-width="2"/>
</svg>`;

mkdirSync('art/map', { recursive: true });
writeFileSync('art/map/base.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('art/map/base.png');
console.log(`art/map/base.png ${REF_W}x${REF_H}`);
