import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topology from '../assets/coastline/salish-sea.topo.json';

type LngLat = [number, number];

const collection = feature(
  topology as unknown as Topology,
  (topology as unknown as { objects: { land: GeometryCollection } }).objects.land,
) as unknown as GeoJSON.FeatureCollection | GeoJSON.Feature;

const polygons: LngLat[][][] = [];
(function collect(g: unknown) {
  const o = g as { type: string; features?: unknown[]; geometry?: unknown; coordinates?: never };
  if (o.type === 'FeatureCollection') (o.features ?? []).forEach(collect);
  else if (o.type === 'Feature') collect(o.geometry);
  else if (o.type === 'GeometryCollection')
    ((g as GeoJSON.GeometryCollection).geometries ?? []).forEach(collect);
  else if (o.type === 'Polygon') polygons.push((g as GeoJSON.Polygon).coordinates as LngLat[][]);
  else if (o.type === 'MultiPolygon')
    for (const p of (g as GeoJSON.MultiPolygon).coordinates) polygons.push(p as LngLat[][]);
})(collection);

interface Poly {
  rings: LngLat[][];
  minX: number; maxX: number; minY: number; maxY: number;
}
const polys: Poly[] = polygons.map((rings) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings)
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  return { rings, minX, maxX, minY, maxY };
});

/** Exact even-odd point-in-polygon against the coastline's land polygons. */
export function isLand(lng: number, lat: number): boolean {
  for (const p of polys) {
    if (lng < p.minX || lng > p.maxX || lat < p.minY || lat > p.maxY) continue;
    let inside = false;
    for (const ring of p.rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
    if (inside) return true;
  }
  return false;
}

/**
 * Land mask over a lng/lat box, one scanline sweep per row (much cheaper
 * than a point test per cell). Cell (i,j) is land when its centre is.
 */
export function landMask(
  west: number,
  south: number,
  dLng: number,
  dLat: number,
  cols: number,
  rows: number,
): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const east = west + cols * dLng;
  const north = south + rows * dLat;
  for (const p of polys) {
    if (p.maxX < west || p.minX > east || p.maxY < south || p.minY > north) continue;
    for (let r = 0; r < rows; r++) {
      const y = south + (r + 0.5) * dLat;
      if (y < p.minY || y > p.maxY) continue;
      const xs: number[] = [];
      for (const ring of p.rings)
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
        }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - west) / dLng - 0.5));
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - west) / dLng - 0.5));
        for (let c = c0; c <= c1; c++) mask[r * cols + c] = 1;
      }
    }
  }
  return mask;
}
