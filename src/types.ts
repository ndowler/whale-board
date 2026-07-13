/** A record as it arrives from Acartia — trust nothing about it. */
export interface RawSighting {
  ssemmi_id?: unknown;
  created?: unknown;
  type?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  no_sighted?: unknown;
  trusted?: unknown;
  data_source_comments?: unknown;
  data_source_entity?: unknown;
  [k: string]: unknown;
}

export type SpeciesId =
  | 'orca'
  | 'orca_srkw'
  | 'orca_biggs'
  | 'humpback'
  | 'gray_whale'
  | 'blue_whale'
  | 'fin_whale'
  | 'minke'
  | 'harbor_porpoise'
  | 'dalls_porpoise'
  | 'pacific_white_sided_dolphin'
  | 'unspecified'
  | 'unknown_cetacean';

export type Ecotype = 'biggs' | 'srkw';

export interface Sighting {
  /** ssemmi_id, whitespace-collapsed. */
  id: string;
  /** Parsed from `created`, treated as UTC; clamped to <= now at merge time. */
  epochMs: number;
  species: SpeciesId;
  ecotype: Ecotype | null;
  /** e.g. ['T46B'] or ['J'] */
  pods: string[];
  /** Catalog IDs, e.g. ['BCX2077'] */
  individuals: string[];
  lat: number;
  lng: number;
  count: number | null;
  trusted: number;
  comment: string;
  sourceEntity: string;
  /** Derived label via point-in-polygon over the Salish Sea zones. */
  region: string | null;
}
