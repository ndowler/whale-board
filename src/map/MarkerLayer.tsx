import { useState, type CSSProperties } from 'react';
import type { Sighting, SpeciesId } from '../types';
import type { WindowHours } from '../config';
import type { MapFrame } from './MapView';
import { decay } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { markerHref } from '../assets/species/SpeciesSprite';
import { plateArtUrl, usePlates } from '../assets/species/art';

/** Plate-art marker body; falls back to the silhouette if the PNG fails. */
function MarkerArt({ species }: { species: SpeciesId }) {
  const [failed, setFailed] = useState(false);
  if (!usePlates() || failed)
    return <use href={markerHref(species)} x={-22} y={-13} width={44} height={26} />;
  return (
    <image
      href={plateArtUrl(species)}
      x={-24}
      y={-14}
      width={48}
      height={28}
      preserveAspectRatio="xMidYMid meet"
      onError={() => setFailed(true)}
    />
  );
}

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
      {sightings.map((s, i) => {
        const p = frame.projection([s.lng, s.lat]);
        if (!p) return null;
        const d = decay(s, nowMs, windowHours);
        const selected = s.id === selectedId;
        const cls = [
          'marker',
          `marker--${s.species}`,
          fresh.has(s.id) ? 'marker--new' : '',
          selected ? 'marker--selected' : '',
          // Only the freshest sightings idle with a breath; old ones sit still.
          d.age < 0.25 ? 'marker--breathing' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={s.id}
            className={cls}
            style={{ '--i': i } as CSSProperties}
            transform={`translate(${p[0]}, ${p[1]})`}
            opacity={selected ? 1 : d.markerOpacity}
            role="button"
            aria-label={SPECIES_LABEL[s.species]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? null : s.id);
            }}
            onMouseEnter={() => onSelect(s.id)}
          >
            <g className="marker__scale" transform={`scale(${selected ? 1.15 : d.scale})`}>
              {selected && (
                <>
                  <circle className="marker__ring marker__ring--outer" r={30} />
                  <circle className="marker__ring" r={26} />
                </>
              )}
              <g className="marker__breathe">
                <MarkerArt species={s.species} />
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}
