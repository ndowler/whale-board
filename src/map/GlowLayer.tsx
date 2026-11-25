import { memo, useMemo } from 'react';
import type { Sighting, SpeciesId } from '../types';
import type { WindowHours } from '../config';
import { CONFIG } from '../config';
import type { Track } from '../data/tracks';
import type { MapFrame } from './MapView';
import { kmToPx } from './projection';
import { decay } from '../state/selectors';
import { clusterGlow, layoutMarkers, spriteScaleFor } from './layout';

interface GlowLayerProps {
  sightings: Sighting[];
  /** Same tracks MarkerLayer lays out, so folded singles share one halo. */
  tracks?: Track[];
  frame: MapFrame;
  nowMs: number;
  windowHours: WindowHours;
  newIds: readonly string[];
  /** Manual focus pings (seen-today chip); remount via highlightSeq. */
  highlightIds?: readonly string[];
  highlightSeq?: number;
}

/**
 * Soft halo under each marker sized to the real observation error — the
 * honest "this is approximately here" treatment (FR-12a). Three shared
 * radial gradients tint by species family; no per-node blur filters, which
 * would crush low-end kiosk hardware.
 */
type GlowTint = 'orca' | 'baleen' | 'neutral';

function tintFor(species: SpeciesId): GlowTint {
  if (species.startsWith('orca')) return 'orca';
  if (
    species === 'humpback' ||
    species === 'gray_whale' ||
    species === 'blue_whale' ||
    species === 'fin_whale' ||
    species === 'minke'
  )
    return 'baleen';
  return 'neutral';
}

export const GlowLayer = memo(function GlowLayer({
  sightings,
  tracks = [],
  frame,
  nowMs,
  windowHours,
  newIds,
  highlightIds = [],
  highlightSeq = 0,
}: GlowLayerProps) {
  const r = useMemo(
    () => Math.max(8, kmToPx(frame.projection, CONFIG.glowRadiusKm)),
    [frame.projection],
  );
  const damp = (1 / Math.max(1, frame.transform.k)) * spriteScaleFor(frame.width);
  const { merged, clusterSize } = layoutMarkers(sightings, tracks, frame.projection, damp);
  const fresh = new Set(newIds);
  // A folded member's arrival/focus ping rides on the host that draws it.
  const pingOn = new Set<string>();
  for (const id of newIds) pingOn.add(merged.get(id) ?? id);
  for (const id of highlightIds) pingOn.add(merged.get(id) ?? id);

  return (
    <g className="glows">
      <defs>
        {/* Four stops for a softer falloff; center opacities kept low so
            overlapping glows layer instead of blooming. */}
        <radialGradient id="glow-orca">
          <stop offset="0%" stopColor="#eed9ac" stopOpacity="0.45" />
          <stop offset="35%" stopColor="#eed9ac" stopOpacity="0.22" />
          <stop offset="70%" stopColor="#eed9ac" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#eed9ac" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-baleen">
          <stop offset="0%" stopColor="#9fc3e8" stopOpacity="0.4" />
          <stop offset="35%" stopColor="#9fc3e8" stopOpacity="0.18" />
          <stop offset="70%" stopColor="#9fc3e8" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#9fc3e8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-neutral">
          <stop offset="0%" stopColor="#a8c4bc" stopOpacity="0.36" />
          <stop offset="35%" stopColor="#a8c4bc" stopOpacity="0.16" />
          <stop offset="70%" stopColor="#a8c4bc" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#a8c4bc" stopOpacity="0" />
        </radialGradient>
      </defs>
      {sightings.map((s) => {
        if (merged.has(s.id)) return null;
        const p = frame.projection([s.lng, s.lat]);
        if (!p) return null;
        const d = decay(s, nowMs, windowHours);
        const halo = clusterGlow(r, d.opacity, clusterSize.get(s.id) ?? 1);
        const ping = pingOn.has(s.id);
        return (
          <g key={s.id} transform={`translate(${p[0]}, ${p[1]})`}>
            <circle
              className="glow"
              r={halo.r}
              fill={`url(#glow-${tintFor(s.species)})`}
              opacity={halo.opacity}
            />
            {ping && (
              <circle
                key={`${s.id}-${highlightSeq}-${fresh.has(s.id) ? 'n' : 'h'}`}
                className="glow__ping"
                r={halo.r}
                fill="none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
