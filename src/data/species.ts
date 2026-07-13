import type { SpeciesId } from '../types';

/**
 * Feed `type` string → internal species id. Keys are lowercased/trimmed.
 * The live feed drifts ("Gray Whale" vs "Gray"); this table owns the merge.
 */
const SPECIES_TABLE: Record<string, SpeciesId> = {
  orca: 'orca',
  'killer whale': 'orca',
  'southern resident': 'orca_srkw',
  'southern resident killer whale': 'orca_srkw',
  "bigg's": 'orca_biggs',
  biggs: 'orca_biggs',
  transient: 'orca_biggs',
  humpback: 'humpback',
  'humpback whale': 'humpback',
  gray: 'gray_whale',
  'gray whale': 'gray_whale',
  grey: 'gray_whale',
  'grey whale': 'gray_whale',
  blue: 'blue_whale',
  'blue whale': 'blue_whale',
  fin: 'fin_whale',
  'fin whale': 'fin_whale',
  minke: 'minke',
  'minke whale': 'minke',
  'harbor porpoise': 'harbor_porpoise',
  'harbour porpoise': 'harbor_porpoise',
  "dall's porpoise": 'dalls_porpoise',
  'dalls porpoise': 'dalls_porpoise',
  'pacific white-sided dolphin': 'pacific_white_sided_dolphin',
  'pacific white sided dolphin': 'pacific_white_sided_dolphin',
  lags: 'pacific_white_sided_dolphin',
  unspecified: 'unspecified',
  other: 'unspecified',
  '': 'unspecified',
};

/** Substring fallbacks, checked in order after the exact table misses. */
const SUBSTRING_FALLBACKS: Array<[string, SpeciesId]> = [
  ['humpback', 'humpback'],
  ['orca', 'orca'],
  ['killer whale', 'orca'],
  ['gray whale', 'gray_whale'],
  ['grey whale', 'gray_whale'],
  ['blue whale', 'blue_whale'],
  ['fin whale', 'fin_whale'],
  ['minke', 'minke'],
  ['harbor porpoise', 'harbor_porpoise'],
  ['harbour porpoise', 'harbor_porpoise'],
  ['dall', 'dalls_porpoise'],
  ['white-sided', 'pacific_white_sided_dolphin'],
  ['white sided', 'pacific_white_sided_dolphin'],
];

export interface SpeciesMatch {
  species: SpeciesId;
  /** false → the string was novel; caller logs it so the table can grow. */
  matched: boolean;
}

export function mapSpecies(type: unknown): SpeciesMatch {
  const key = typeof type === 'string' ? type.trim().toLowerCase() : '';
  if (typeof type !== 'string' || key === '') {
    return { species: 'unspecified', matched: typeof type === 'string' };
  }
  const exact = SPECIES_TABLE[key];
  if (exact) return { species: exact, matched: true };
  for (const [needle, id] of SUBSTRING_FALLBACKS) {
    if (key.includes(needle)) return { species: id, matched: true };
  }
  return { species: 'unknown_cetacean', matched: false };
}

/** Display names for the UI; `unspecified` is a real category, not an error. */
export const SPECIES_LABEL: Record<SpeciesId, string> = {
  orca: 'Orca',
  orca_srkw: 'Orca — Southern Resident',
  orca_biggs: "Orca — Bigg's",
  humpback: 'Humpback Whale',
  gray_whale: 'Gray Whale',
  blue_whale: 'Blue Whale',
  fin_whale: 'Fin Whale',
  minke: 'Minke Whale',
  harbor_porpoise: 'Harbor Porpoise',
  dalls_porpoise: "Dall's Porpoise",
  pacific_white_sided_dolphin: 'Pacific White-sided Dolphin',
  unspecified: 'Whale (species not reported)',
  unknown_cetacean: 'Unknown Cetacean',
};
