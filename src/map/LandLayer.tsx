import { memo, useMemo } from 'react';
import { feature } from 'topojson-client';
import type { GeoPermissibleObjects, GeoPath } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topology from '../assets/coastline/salish-sea.topo.json';

const land = feature(
  topology as unknown as Topology,
  (topology as unknown as { objects: { land: GeometryCollection } }).objects.land,
) as GeoPermissibleObjects;

/** Single stylized landmass path; re-renders only when the path generator
 *  (i.e. the container size) changes. */
export const LandLayer = memo(function LandLayer({ path }: { path: GeoPath }) {
  const d = useMemo(() => path(land) ?? '', [path]);
  return <path className="map__land" d={d} />;
});
