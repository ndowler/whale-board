import type { SpeciesId } from '../../types';
import { CONFIG } from '../../config';

/**
 * The M4 AI-restyled illustration set: one vintage natural-history plate
 * per species/ecotype, generated in a single visual language (see
 * scripts/generate-species-art.mjs) and keyed to transparency. Served
 * statically; the hand-authored SVG silhouettes remain as the fallback
 * style and for anything that fails to load.
 */
export function plateArtUrl(species: SpeciesId): string {
  return `${import.meta.env.BASE_URL}art/species/${species}.png`;
}

export function usePlates(): boolean {
  return CONFIG.speciesArt === 'plate';
}
