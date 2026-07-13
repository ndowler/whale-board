export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type WindowHours = 24 | 72 | 168;

export const CONFIG = {
  apiUrl: 'https://acartia.io/api/v1/sightings/current',

  /**
   * 'live'    — fetch acartia.io directly (the deployed default).
   * 'fixture' — serve the committed fixture (dev default; the dev sandbox
   *             cannot reach acartia.io). Override with VITE_DATA_MODE.
   */
  dataMode: (import.meta.env.VITE_DATA_MODE ??
    (import.meta.env.DEV ? 'fixture' : 'live')) as 'live' | 'fixture',

  pollIntervalMs: 3 * 60_000,
  fetchTimeoutMs: 15_000,
  /** Retry delays after consecutive failures; sticks at the last entry. */
  backoffMs: [30_000, 60_000, 120_000, 300_000],
  /** Data older than this (since last successful poll) shows the stale badge. */
  staleAfterMs: 10 * 60_000,

  windowOptions: [24, 72, 168] as readonly WindowHours[],
  defaultWindowHours: 72 as WindowHours,
  /** Retention ceiling — sightings older than the largest window are pruned. */
  maxAgeMs: 168 * 3_600_000,

  /** Sightings must have trusted >= this to be shown. */
  minTrusted: 1,

  /** Salish Sea ingest filter: discard records outside this box. */
  bbox: { west: -124.0, south: 46.9, east: -122.0, north: 49.3 } as Bbox,
  /** Default map frame: Tacoma → San Juans, biased toward the South Sound. */
  defaultView: { west: -123.45, south: 47.0, east: -122.1, north: 48.8 } as Bbox,

  /** UI clock tick — drives time-ago, decay, and staleness rendering. */
  tickMs: 30_000,
  /** How long a fresh sighting keeps its arrival treatment. */
  arrivalAnimMs: 6_000,
  /** Positions are approximate (>1 km observer error) — glow radius. */
  glowRadiusKm: 2.5,
  /** Max cards in the recent-sightings rail. */
  railMaxCards: 30,

  chimeDefaultOn: false,
  /** Local hour for the kiosk's daily hygiene reload; null disables. */
  dailyReloadHour: 4 as number | null,

  attribution:
    'Sightings data via the Acartia Data Cooperative — Orca Network via Conserve.io and partners',
  disclaimer: 'Non-commercial · not a navigation or safety tool',
};
