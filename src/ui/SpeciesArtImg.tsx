import { useState } from 'react';
import type { SpeciesId } from '../types';
import { markerHref } from '../assets/species/SpeciesSprite';
import { collageArtUrl, plateArtUrl, usePlates } from '../assets/species/art';

interface SpeciesArtImgProps {
  species: SpeciesId;
  /**
   * 'plate' — the landscape marker plate (rail-card sizing);
   * 'collage' — the square seen-today plate, falling back to the marker
   * plate before the silhouette.
   */
  variant?: 'plate' | 'collage';
  /** Class name base: renders `{base}__art` + modifier classes. */
  base: string;
}

/**
 * Shared species illustration with the board's graceful-degradation chain:
 * collage plate → marker plate → hand-authored SVG silhouette.
 */
export function SpeciesArtImg({
  species,
  variant = 'plate',
  base,
}: SpeciesArtImgProps) {
  // Number of failed tiers so far; silhouette is the floor.
  const [failed, setFailed] = useState(0);
  const sources =
    variant === 'collage'
      ? [collageArtUrl(species), plateArtUrl(species)]
      : [plateArtUrl(species)];

  if (!usePlates() || failed >= sources.length)
    return (
      <svg
        className={`${base}__art sp-art sp-art--${species}`}
        viewBox="0 0 100 60"
        aria-hidden="true"
      >
        <use href={markerHref(species)} />
      </svg>
    );

  return (
    <img
      className={`${base}__art ${base}__art--plate`}
      src={sources[failed]}
      alt=""
      loading="lazy"
      onError={() => setFailed((n) => n + 1)}
    />
  );
}
