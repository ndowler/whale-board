import { memo } from 'react';
import type { MapFrame } from './MapView';

interface Place {
  name: string;
  lng: number;
  lat: number;
  /** Cities get a point and a name set beside it; regions get spaced
   *  italic caps laid across the area, as on an engraved chart. */
  kind: 'city' | 'region';
  /** Label offset from the point, in screen pixels. */
  dx?: number;
  dy?: number;
}

/** Deliberately sparse — three anchors are enough to orient a viewer who
 *  doesn't know the Sound, and every extra name is one more thing between
 *  them and the whales. City points sit on the real municipal coordinate;
 *  the region name rides the archipelago it covers. */
const PLACES: readonly Place[] = [
  { name: 'Seattle', lng: -122.3321, lat: 47.6062, kind: 'city', dx: 11, dy: 4.5 },
  { name: 'Tacoma', lng: -122.4443, lat: 47.2529, kind: 'city', dx: 11, dy: 4.5 },
  { name: 'San Juan Islands', lng: -123.02, lat: 48.59, kind: 'region' },
];

/** Region names are orientation, not detail — past a neighborhood zoom they
 *  are just a banner across the view, so fade them out. */
function regionOpacity(k: number): number {
  if (k <= 2.5) return 1;
  if (k >= 4) return 0;
  return (4 - k) / 1.5;
}

/**
 * Place names over the chart. Type counter-scales to a constant screen size:
 * left alone inside the zoom group it would balloon into a billboard, and
 * scaled down with the map it would be unreadable at the wide frame.
 */
export const PlaceLabels = memo(function PlaceLabels({ frame }: { frame: MapFrame }) {
  const damp = 1 / frame.transform.k;
  return (
    <g className="places" aria-hidden="true">
      {PLACES.map((p) => {
        const pt = frame.projection([p.lng, p.lat]);
        if (!pt) return null;
        return (
          <g
            key={p.name}
            className={`place place--${p.kind}`}
            transform={`translate(${pt[0]} ${pt[1]}) scale(${damp})`}
            opacity={p.kind === 'region' ? regionOpacity(frame.transform.k) : 1}
          >
            {p.kind === 'city' && <circle className="place__dot" r={2.4} />}
            {/* Stroke painted under the fill — the one halo that survives
                over both dark water and sage land without a filter. */}
            <text className="place__name" x={p.dx ?? 0} y={p.dy ?? 0}>
              {p.name}
            </text>
          </g>
        );
      })}
    </g>
  );
});
