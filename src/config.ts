export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type WindowHours = 24 | 72 | 168;

// Kiosk-friendly runtime overrides — tune without a rebuild:
//   ?poll=30   poll every 30 s (min 5; e.g. with ?demo=1 to preview arrivals)
const params =
  typeof location !== 'undefined'
    ? new URLSearchParams(location.search)
    : new URLSearchParams();
const pollOverrideS = Number(params.get('poll'));
const pollMs =
  Number.isFinite(pollOverrideS) && pollOverrideS >= 5
    ? pollOverrideS * 1000
    : 3 * 60_000;

export const CONFIG = {
  apiUrl: 'https://acartia.io/api/v1/sightings/current',

  /**
   * Token-gated full-feed proxy (Cloudflare Worker, see workers/acartia-proxy).
   * '' disables backfill entirely — the board runs keyless on /current alone.
   */
  proxyUrl: (import.meta.env.VITE_PROXY_URL ?? '') as string,
  /** Backfill is a single big pull; give it a longer leash than /current. */
  backfillTimeoutMs: 30_000,
  /**
   * Re-pull the full feed this often; null = startup only. Default off: the
   * /current window spans the full 7d retention (see docs/M2-endpoint-findings).
   */
  backfillRefreshMs: null as number | null,

  /** FR-8 near-dupe collapse: same species within both thresholds merge. */
  dedupe: { distanceKm: 0.5, windowMs: 15 * 60_000 },

  /**
   * 'live'    — fetch acartia.io directly (the deployed default).
   * 'fixture' — serve the committed fixture (dev default; the dev sandbox
   *             cannot reach acartia.io). Override with VITE_DATA_MODE.
   */
  dataMode: (import.meta.env.VITE_DATA_MODE ??
    (import.meta.env.DEV ? 'fixture' : 'live')) as 'live' | 'fixture',

  pollIntervalMs: pollMs,
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
  /** Default map frame: Tacoma → Edmonds, central Puget Sound. East edge
   * clipped past Bainbridge/Kitsap so the Eastside (Bellevue) stays off-map. */
  defaultView: { west: -122.75, south: 47.18, east: -122.28, north: 47.92 } as Bbox,

  /** UI clock tick — drives time-ago, decay, and staleness rendering. */
  tickMs: 30_000,
  /** How long a fresh sighting keeps its arrival treatment. */
  arrivalAnimMs: 6_000,
  /** Positions are approximate (>1 km observer error) — glow radius. */
  glowRadiusKm: 2.5,
  /** Max cards in the recent-sightings rail. */
  railMaxCards: 30,

  /**
   * Species art style: 'plate' = the AI-restyled natural-history plates
   * (M4); 'silhouette' = the original hand-authored SVG set. Silhouettes
   * also serve as the automatic fallback when a plate fails to load.
   */
  speciesArt: 'plate' as 'plate' | 'silhouette',
  /**
   * Map background: 'chart' = the AI-restyled vintage nautical chart raster
   * (geo-anchored; vector land stays on top at reduced opacity so geometry
   * remains authoritative); 'flat' = the original flat polygon look.
   */
  mapArt: 'chart' as 'chart' | 'flat',

  chimeDefaultOn: false,
  /** Local hour for the kiosk's daily hygiene reload; null disables. */
  dailyReloadHour: 4 as number | null,

  /**
   * Acoustic bridge (M4): Orcasound's public GraphQL — hydrophone nodes plus
   * whale-category detections (OrcaHello AI + human listeners). Keyless,
   * CORS `*` (verified 2026-07-13; see docs/M4-acoustic-findings.md).
   */
  acoustic: {
    enabled: true,
    graphqlUrl: 'https://live.orcasound.net/graphql',
    /** Detections fetched per poll (newest first); plenty for a week. */
    fetchLimit: 100,
    /** Detection younger than this: hydrophone is "hot" — active pulse. */
    hotMs: 30 * 60_000,
    /** Detection younger than this: hydrophone shows "heard" tint. */
    heardWindowMs: 6 * 3_600_000,
    listenUrl: (slug: string) => `https://live.orcasound.net/listen/${slug}`,
  },

  attribution:
    'Sightings data via the Acartia Data Cooperative — Orca Network via Conserve.io and partners · Acoustic detections via Orcasound & OrcaHello',
  disclaimer: 'Non-commercial · not a navigation or safety tool',
};
