import type { Sighting } from '../types';
import type { WindowHours } from '../config';
import type { MapFrame } from './MapView';
import { decay } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { markerHref } from '../assets/species/SpeciesSprite';

interface MarkerLayerProps {
  sightings: Sighting[];
  frame: MapFrame;
  nowMs: number;
  windowHours: WindowHours;
  selectedId: string | null;
  newIds: readonly string[];
  onSelect: (id: string | null) => void;
}

/**
 * Illustrated marker per sighting. Only `transform` and `opacity` change
 * over time (compositor-friendly); time-decay is computed from the store
 * clock each render and CSS transitions glide between ticks.
 */
export function MarkerLayer({
  sightings,
  frame,
  nowMs,
  windowHours,
  selectedId,
  newIds,
  onSelect,
}: MarkerLayerProps) {
  const fresh = new Set(newIds);
  return (
    <g className="markers">
      {sightings.map((s) => {
        const p = frame.projection([s.lng, s.lat]);
        if (!p) return null;
        const d = decay(s, nowMs, windowHours);
        const selected = s.id === selectedId;
        const cls = [
          'marker',
          `marker--${s.species}`,
          fresh.has(s.id) ? 'marker--new' : '',
          selected ? 'marker--selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={s.id}
            className={cls}
            transform={`translate(${p[0]}, ${p[1]})`}
            opacity={selected ? 1 : d.opacity}
            role="button"
            aria-label={SPECIES_LABEL[s.species]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? null : s.id);
            }}
            onMouseEnter={() => onSelect(s.id)}
          >
            <g className="marker__scale" transform={`scale(${selected ? 1.15 : d.scale})`}>
              {selected && <circle className="marker__ring" r={26} />}
              <use href={markerHref(s.species)} x={-22} y={-13} width={44} height={26} />
            </g>
          </g>
        );
      })}
    </g>
  );
}
