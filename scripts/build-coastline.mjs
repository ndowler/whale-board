#!/usr/bin/env node
/**
 * Coastline pipeline — run once, commit the output.
 *
 * Downloads OSM-derived land polygons (@geo-maps/countries-land-100m, npm),
 * clips them to the Salish Sea bounding box, simplifies to a stylized-but-
 * honest coastline, and writes a small TopoJSON the app bundles.
 *
 * 100 m source precision ≈ 1 px at the board's render scale, so nothing
 * visible is lost before the deliberate simplification pass.
 *
 * Data: © OpenStreetMap contributors, ODbL — via the geo-maps project (MIT).
 *
 * Usage: npm run coastline [-- --keep-cache]
 */
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, 'scripts', '.cache');
const TARBALL = path.join(CACHE, 'countries-land-100m.tgz');
const EXTRACTED = path.join(CACHE, 'package', 'map.geo.json');
const OUT = path.join(ROOT, 'src', 'assets', 'coastline', 'salish-sea.topo.json');

const PKG_URL =
  'https://registry.npmjs.org/@geo-maps/countries-land-100m/-/countries-land-100m-0.6.0.tgz';

// Much wider than the app's ingest bbox: the board region is portrait but
// wall displays are landscape, so the letterboxed margins must show real
// geography (Olympic Peninsula, Vancouver Island) rather than clip seams.
const CLIP_BBOX = '-125.3,46.4,-120.3,49.8';

async function download() {
  if (existsSync(EXTRACTED)) return;
  mkdirSync(CACHE, { recursive: true });
  if (!existsSync(TARBALL)) {
    console.log(`downloading ${PKG_URL} ...`);
    const res = await fetch(PKG_URL);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(TARBALL));
  }
  console.log('extracting map.geo.json ...');
  execFileSync('tar', ['xzf', TARBALL, '-C', CACHE, 'package/map.geo.json']);
}

function build() {
  mkdirSync(path.dirname(OUT), { recursive: true });
  const args = [
    EXTRACTED,
    '-clip', `bbox=${CLIP_BBOX}`,
    // Visvalingam reads as intentional stylization rather than degradation;
    // keep-shapes preserves the small islands that make the Sound legible.
    '-simplify', 'visvalingam', '80%', 'keep-shapes',
    '-filter-islands', 'min-area=0.15km2',
    '-clean',
    // One borderless landmass — the US/Canada line would otherwise render
    // as a stray stroke across the ambient map.
    '-dissolve2',
    '-rename-layers', 'land',
    '-o', 'format=topojson', OUT,
  ];
  console.log('mapshaper', args.join(' '));
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'mapshaper'), args, {
    stdio: 'inherit',
  });
  // The source carries every inland lake as an interior ring; on a board
  // about the Sound they read as noise. Strip them (and drop the matching
  // shapes from the chart raster with scripts/patch-chart-lakes.mjs).
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'strip-lakes.mjs')], {
    stdio: 'inherit',
  });
  const kb = Math.round(statSync(OUT).size / 1024);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${kb} KB)`);
  if (kb > 350) {
    console.warn('warning: output exceeds the 300 KB budget — raise simplify %');
  }
}

await download();
build();
if (!process.argv.includes('--keep-cache')) {
  rmSync(CACHE, { recursive: true, force: true });
  console.log('cache cleaned (use --keep-cache to keep the download)');
}
