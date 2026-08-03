#!/usr/bin/env node
/**
 * Lake removal — run after the coastline build, commit the output.
 *
 * The OSM-derived land layer carries every inland water body as an interior
 * ring: Lake Washington, Sammamish, Cushman, and ~630 alpine ponds. On a
 * board about the Sound they read as noise — dark specks scattered over the
 * land mass that the eye keeps mistaking for channels. This drops every
 * interior ring so only the marine edge remains, and along with it any
 * polygon that was an island *inside* one of those lakes (otherwise its
 * coast stroke would draw a stray loop across solid land).
 *
 * Side output: art/map/lakes.geo.json — the removed rings, in lng/lat, so
 * scripts/patch-chart-lakes.mjs can erase the same shapes from the restyled
 * chart raster.
 *
 * Usage: node scripts/strip-lakes.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { feature } from 'topojson-client';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TOPO = path.join(ROOT, 'src', 'assets', 'coastline', 'salish-sea.topo.json');
const LAKES = path.join(ROOT, 'art', 'map', 'lakes.geo.json');

/** Ray casting on a closed ring of [lng, lat] pairs. */
function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

const bboxOf = (ring) => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
};

const inBbox = ([x, y], [w, s, e, n]) => x >= w && x <= e && y >= s && y <= n;

const topo = JSON.parse(readFileSync(TOPO, 'utf8'));
const geoms = topo.objects.land.geometries ?? [topo.objects.land];

// Decoded rings (real lng/lat) drive the geometric tests and the lake export;
// the arc surgery below happens in the quantized topology space.
const decoded = [];
for (const f of feature(topo, topo.objects.land).features ?? []) {
  const g = f.geometry;
  if (g.type === 'MultiPolygon') decoded.push(...g.coordinates);
  else if (g.type === 'Polygon') decoded.push(g.coordinates);
}

const lakes = [];
for (const poly of decoded) {
  for (const ring of poly.slice(1)) lakes.push({ ring, bbox: bboxOf(ring) });
}

/** Polygons whose exterior sits inside a removed lake — drop them whole. */
const inLake = (ring) => {
  const pt = ring[0];
  return lakes.some((l) => inBbox(pt, l.bbox) && pointInRing(pt, l.ring));
};

let dropped = 0;
let holes = 0;
let ringIndex = 0; // walks `decoded` in the same order the topology does
const keepPoly = (arcs) => {
  const ring = decoded[ringIndex++][0];
  if (inLake(ring)) {
    dropped++;
    return false;
  }
  holes += arcs.length - 1;
  return true;
};

for (const g of geoms) {
  if (g.type === 'Polygon') {
    g.arcs = keepPoly(g.arcs) ? [g.arcs[0]] : [];
  } else if (g.type === 'MultiPolygon') {
    g.arcs = g.arcs.filter((p) => keepPoly(p)).map((p) => [p[0]]);
  }
}

// Prune arcs the surviving exterior rings no longer reference, then reindex.
const used = new Set();
const walk = (arcs, visit) =>
  arcs.map((a) => (Array.isArray(a) ? walk(a, visit) : visit(a)));
for (const g of geoms) walk(g.arcs ?? [], (a) => used.add(a < 0 ? ~a : a));

const remap = new Map();
const kept = [];
for (let i = 0; i < topo.arcs.length; i++) {
  if (!used.has(i)) continue;
  remap.set(i, kept.length);
  kept.push(topo.arcs[i]);
}
for (const g of geoms)
  g.arcs = walk(g.arcs ?? [], (a) => (a < 0 ? ~remap.get(~a) : remap.get(a)));
const prunedArcs = topo.arcs.length - kept.length;
topo.arcs = kept;

writeFileSync(TOPO, JSON.stringify(topo));
mkdirSync(path.dirname(LAKES), { recursive: true });
writeFileSync(
  LAKES,
  JSON.stringify({
    type: 'FeatureCollection',
    features: lakes.map((l) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [l.ring] },
    })),
  }),
);

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(
  `removed ${holes} lake rings, ${dropped} lake islands, ${prunedArcs} arcs`,
);
console.log(`wrote ${path.relative(ROOT, TOPO)} (${kb(TOPO)} KB)`);
console.log(`wrote ${path.relative(ROOT, LAKES)} (${kb(LAKES)} KB)`);
