import { memo, useMemo } from 'react';
import { feature } from 'topojson-client';
import type { GeoPermissibleObjects, GeoPath } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topology from '../assets/coastline/salish-sea.topo.json';

const land = feature(
  topology as unknown as Topology,
  (topology as unknown as { objects: { land: GeometryCollection } }).objects.land,
) as GeoPermissibleObjects;

/** Stylized landmass over a stack of sheer halo strokes — engraved
 *  depth-contour bands hugging the shore, in the manner of hand-inked
 *  chart shelving. Being vector, they sharpen as the raster softens under
 *  zoom. Re-renders only when the path generator changes. */
export const LandLayer = memo(function LandLayer({ path }: { path: GeoPath }) {
  const d = useMemo(() => path(land) ?? '', [path]);
  return (
    <>
      <path className="map__coast-halo map__coast-halo--far" d={d} />
      <path className="map__coast-halo map__coast-halo--mid" d={d} />
      <path className="map__coast-halo" d={d} />
      <path className="map__land" d={d} />
    </>
  );
});
