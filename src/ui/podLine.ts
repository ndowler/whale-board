import type { Sighting } from '../types';

/** Pods → individuals → ecotype — the most specific identity line we have. */
export function podLine(s: Sighting): string | null {
  if (s.pods.length > 0) return s.pods.join(', ');
  if (s.individuals.length > 0) return s.individuals.join(', ');
  if (s.ecotype === 'biggs') return "Bigg's";
  if (s.ecotype === 'srkw') return 'Southern Resident';
  return null;
}
