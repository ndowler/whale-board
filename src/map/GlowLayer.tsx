import { useMemo } from 'react';
import type { Sighting, SpeciesId } from '../types';
import type { WindowHours } from '../config';
import { CONFIG } from '../config';
import type { MapFrame } from './MapView';
import { kmToPx } from './projection';
import { decay } from '../state/selectors';

interface GlowLayerProps {
  sightings: Sighting[];
  frame: MapFrame;
  nowMs: number;
  windowHours: WindowHours;
  newIds: readonly string[];
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

export function GlowLayer({
  sightings,
  frame,
  nowMs,
  windowHours,
  newIds,
}: GlowLayerProps) {
  const r = useMemo(
    () => Math.max(8, kmToPx(frame.projection, CONFIG.glowRadiusKm)),
    [frame.projection],
  );
  const fresh = new Set(newIds);

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
        const p = frame.projection([s.lng, s.lat]);
        if (!p) return null;
        const d = decay(s, nowMs, windowHours);
        return (
          <g key={s.id} transform={`translate(${p[0]}, ${p[1]})`}>
            <circle
              className="glow"
              r={r}
              fill={`url(#glow-${tintFor(s.species)})`}
              opacity={d.opacity}
            />
            {fresh.has(s.id) && (
              <circle className="glow__ping" r={r} fill="none" />
            )}
          </g>
        );
      })}
    </g>
  );
}
