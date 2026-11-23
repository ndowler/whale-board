import { useState, type CSSProperties } from 'react';
import type { Sighting, SpeciesId } from '../types';
import type { WindowHours } from '../config';
import type { MapFrame } from './MapView';
import { decay } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { markerHref } from '../assets/species/SpeciesSprite';
import type { Track } from '../data/tracks';
import { layoutMarkers } from './layout';
import { plateArtUrl, usePlates } from '../assets/species/art';

/** Plate-art marker body; falls back to the silhouette if the PNG fails. */
function MarkerArt({ species }: { species: SpeciesId }) {
  const [failed, setFailed] = useState(false);
  if (!usePlates() || failed)
    return <use href={markerHref(species)} x={-72} y={-42} width={144} height={84} />;
  return (
    <image
      href={plateArtUrl(species)}
      x={-80}
      y={-46}
      width={160}
      height={94}
      preserveAspectRatio="xMidYMid meet"
      onError={() => setFailed(true)}
    />
  );
}

/** Mirror + clamped tilt so left-facing art points along `bearing` (deg from N). */
export function facingFor(bearing: number): { flip: boolean; tilt: number } {
  const r = (bearing * Math.PI) / 180;
  const dx = Math.sin(r);
  const dy = -Math.cos(r);
  const flip = dx > 0.2;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  let rot = flip ? ang : ang - 180;
  rot = ((((rot + 180) % 360) + 360) % 360) - 180;
  return { flip, tilt: Math.max(-28, Math.min(28, rot)) };
}

interface MarkerLayerProps {
  sightings: Sighting[];
  /** Linked tracks — their heads (in `sightings`) face the travel direction. */
  tracks?: Track[];
  frame: MapFrame;
  nowMs: number;
  windowHours: WindowHours;
  selectedId: string | null;
  newIds: readonly string[];
  highlightIds?: readonly string[];
  onSelect: (id: string | null) => void;
}

/**
 * Illustrated marker per sighting. Only `transform` and `opacity` change
 * over time (compositor-friendly); time-decay is computed from the store
 * clock each render and CSS transitions glide between ticks.
 */
export function MarkerLayer({
  sightings,
  tracks = [],
  frame,
  nowMs,
  windowHours,
  selectedId,
  newIds,
  highlightIds = [],
  onSelect,
}: MarkerLayerProps) {
  const fresh = new Set(newIds);
  const highlighted = new Set(highlightIds);
  // Markers live inside the zoomed group, so left alone they'd balloon under
  // deep zoom. Full counter-scale keeps them a constant screen size — zooming
  // reveals more chart, not bigger art. Zoom-out (k<1) shrinks naturally.
  const damp = 1 / Math.max(1, frame.transform.k);
  // Track heads face their direction of travel (art faces left by default,
  // so eastward travel mirrors it; tilt is clamped so nothing goes upside-down).
  const facing = new Map<string, { flip: boolean; tilt: number }>();
  for (const t of tracks) if (t.bearing !== null) facing.set(t.id, facingFor(t.bearing));

  // Unrelated sightings must not pile up or sit on track lines; nudge them
  // clear (track heads keep their true spot).
  const offsets = layoutMarkers(sightings, tracks, frame.projection, damp);

  return (
    <g className="markers">
      <defs>
        {/* Soft dark disc behind each plate — grounds the art over both
            water and land without per-node blur filters (kiosk-friendly). */}
        <radialGradient id="marker-disc">
          <stop offset="0%" stopColor="#050d15" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#050d15" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#050d15" stopOpacity="0" />
        </radialGradient>
      </defs>
      {sightings.map((s, i) => {
        const p = frame.projection([s.lng, s.lat]);
        if (!p) return null;
        const d = decay(s, nowMs, windowHours);
        const off = offsets.get(s.id);
        const face = facing.get(s.id);
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
            transform={`translate(${p[0] + (off ? off[0] : 0)}, ${p[1] + (off ? off[1] : 0)}) scale(${damp})`}
            opacity={selected || highlighted.has(s.id) ? 1 : d.markerOpacity}
            role="button"
            tabIndex={0}
            aria-label={SPECIES_LABEL[s.species]}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? null : s.id);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onSelect(selected ? null : s.id);
            }}
            onMouseEnter={() => onSelect(s.id)}
          >
            <g className="marker__scale" transform={`scale(${selected ? 1.15 : d.scale})`}>
              <ellipse className="marker__disc" rx={92} ry={52} fill="url(#marker-disc)" />
              {selected && (
                <>
                  <circle className="marker__ring marker__ring--outer" r={100} />
                  <circle className="marker__ring" r={90} />
                </>
              )}
              <g className="marker__breathe">
                <g
                  className="marker__face"
                  transform={
                    face
                      ? `rotate(${face.tilt}) scale(${face.flip ? -1 : 1}, 1)`
                      : undefined
                  }
                >
                  <MarkerArt species={s.species} />
                </g>
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}
