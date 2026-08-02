#!/usr/bin/env node
/**
 * Erase the inland lakes from the restyled chart raster.
 *
 * scripts/strip-lakes.mjs drops the lake rings from the vector coastline, but
 * the Gemini restyle (art/map/raw-chart.png) baked them in as dark navy
 * blotches — with inked outlines and shore hatching to match. Re-restyling
 * would re-roll the whole look, so instead each lake is inpainted: filled
 * with the median tone of the land immediately around it, blurred so the
 * gouache wash carries across, and feathered back in over a dilated mask
 * that also swallows the lake's outline and hatching ticks.
 *
 * Reads the untouched AI original and writes both the patched intermediate
 * and the app's raster through the same resample/sharpen/webp tail as
 * scripts/restyle-chart.mjs — the geo anchoring is aspect-based, so the
 * raw image's own pixel dimensions are all this needs.
 *
 * Usage: node scripts/patch-chart-lakes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoConicConformal, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_DIR ?? 'sharp');

const IN = 'art/map/raw-chart.png';
const MID = 'art/map/chart-nolakes.png';
const OUT = 'public/art/map-chart.webp';

// Keep in sync with CHART_FRAME in src/map/projection.ts.
const CHART = { west: -124.0, south: 46.9, east: -122.0, north: 49.3 };
const REF_W = 1664;
const REF_H = 2048;

/** Outward dilation (raw px) — covers the inked lake edge and shore ticks. */
const DILATE = 13;
/** Softness of the inpaint edge and of the wash inside it. */
const FEATHER = 5;
const WASH = 12;
/** How far out to look for the land tone that replaces a lake. */
const SAMPLE_PAD = 46;

const meta = await sharp(IN).metadata();
const W = meta.width;
const H = meta.height;

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

// Same conic as the app, fit to the reference frame, then stretched to the
// raw image's pixels exactly as restyle-chart.mjs's fit:'fill' resize does.
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
const sx = W / REF_W;
const sy = H / REF_H;
const path = geoPath(proj);

const lakes = JSON.parse(readFileSync('art/map/lakes.geo.json', 'utf8')).features;

/** Lake outlines in raw-image pixels, with their pixel bounds. */
const shapes = [];
for (const f of lakes) {
  const b = path.bounds(f);
  const x0 = b[0][0] * sx;
  const y0 = b[0][1] * sy;
  const x1 = b[1][0] * sx;
  const y1 = b[1][1] * sy;
  if (x1 < -DILATE || y1 < -DILATE || x0 > W + DILATE || y0 > H + DILATE) continue;
  const d = f.geometry.coordinates[0]
    .map((c) => {
      const p = proj(c);
      return p ? `${(p[0] * sx).toFixed(1)},${(p[1] * sy).toFixed(1)}` : null;
    })
    .filter(Boolean)
    .join(' ');
  if (d) shapes.push({ d, x0, y0, x1, y1 });
}
console.log(`${shapes.length} of ${lakes.length} lakes fall on the chart`);

const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#000"/>
  <g fill="#fff" stroke="#fff" stroke-width="${DILATE * 2}" stroke-linejoin="round">
    ${shapes.map((s) => `<polygon points="${s.d}"/>`).join('\n    ')}
  </g>
</svg>`;

const mask = await sharp(Buffer.from(maskSvg))
  .greyscale()
  .raw()
  .toBuffer();

const base = await sharp(IN).removeAlpha().raw().toBuffer();
const filled = Buffer.from(base);

const isLand = (i) => {
  const r = base[i];
  const g = base[i + 1];
  const b = base[i + 2];
  // Sage land is green-dominant and far brighter than the navy water; this
  // keeps a lakeside sample from picking up the sea next door.
  return g > b && 0.299 * r + 0.587 * g + 0.114 * b > 40;
};

const median = (a) => a.sort((p, q) => p - q)[a.length >> 1];

/** Median land tone in the ring around a lake; null if it is all water. */
function landTone(x0, y0, x1, y1) {
  const xa = Math.max(0, Math.floor(x0 - SAMPLE_PAD));
  const xb = Math.min(W - 1, Math.ceil(x1 + SAMPLE_PAD));
  const ya = Math.max(0, Math.floor(y0 - SAMPLE_PAD));
  const yb = Math.min(H - 1, Math.ceil(y1 + SAMPLE_PAD));
  const step = Math.max(1, Math.floor(Math.sqrt(((xb - xa) * (yb - ya)) / 4000)));
  const rs = [];
  const gs = [];
  const bs = [];
  for (let y = ya; y <= yb; y += step) {
    for (let x = xa; x <= xb; x += step) {
      const p = y * W + x;
      if (mask[p] > 8) continue;
      const i = p * 3;
      if (!isLand(i)) continue;
      rs.push(base[i]);
      gs.push(base[i + 1]);
      bs.push(base[i + 2]);
    }
  }
  if (rs.length < 12) return null;
  return [median(rs), median(gs), median(bs)];
}

let global = null;
function globalTone() {
  if (global) return global;
  const rs = [];
  const gs = [];
  const bs = [];
  for (let p = 0; p < W * H; p += 97) {
    const i = p * 3;
    if (mask[p] > 8 || !isLand(i)) continue;
    rs.push(base[i]);
    gs.push(base[i + 1]);
    bs.push(base[i + 2]);
  }
  global = [median(rs), median(gs), median(bs)];
  return global;
}

let fallbacks = 0;
for (const s of shapes) {
  const tone = landTone(s.x0, s.y0, s.x1, s.y1) ?? (fallbacks++, globalTone());
  const xa = Math.max(0, Math.floor(s.x0 - DILATE - 2));
  const xb = Math.min(W - 1, Math.ceil(s.x1 + DILATE + 2));
  const ya = Math.max(0, Math.floor(s.y0 - DILATE - 2));
  const yb = Math.min(H - 1, Math.ceil(s.y1 + DILATE + 2));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const p = y * W + x;
      if (mask[p] < 128) continue;
      const i = p * 3;
      filled[i] = tone[0];
      filled[i + 1] = tone[1];
      filled[i + 2] = tone[2];
    }
  }
}
console.log(`inpainted ${shapes.length} lakes (${fallbacks} used the global tone)`);

const raw = { raw: { width: W, height: H, channels: 3 } };

// The wash: blur the filled image so each patch picks up its neighbourhood's
// gradient instead of reading as a flat sticker...
const wash = await sharp(filled, raw).blur(WASH).png().toBuffer();
// ...and feather the mask so the patch dissolves into the untouched paint.
const soft = await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
  .blur(FEATHER)
  .png()
  .toBuffer();
const patch = await sharp(wash)
  .composite([{ input: soft, blend: 'dest-in' }])
  .png()
  .toBuffer();

const patched = await sharp(base, raw)
  .composite([{ input: patch }])
  .png()
  .toBuffer();
writeFileSync(MID, patched);
console.log(`${MID} ${W}x${H}`);

// Same tail as restyle-chart.mjs, so the app raster stays byte-comparable.
await sharp(patched)
  .resize(REF_W * 2, REF_H * 2, { fit: 'fill' })
  .sharpen({ sigma: 0.8, m1: 0.6, m2: 0.4 })
  .webp({ quality: 86 })
  .toFile(OUT);
console.log(`${OUT} ${REF_W * 2}x${REF_H * 2}`);
