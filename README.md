# Salish Sea Whale Board

A wall-mountable, always-on ambient display showing which whales are in the
Salish Sea right now. It polls the [Acartia Data Cooperative](https://acartia.io)'s
public sightings feed every few minutes and renders each sighting as an
illustrated species mark on a stylized dark map of Puget Sound — at the place
it was seen. Fresh sightings glow bright and animate in; older ones fade and
shrink toward the edge of the freshness window. Quiet water is a designed
state, not an error.

Tier 1 of the project PRD: sightings only — no hydrophone, no ML, no backend.
A pure React SPA; state lives in memory and rehydrates from a fresh poll.

## Running it

```sh
npm install
npm run dev        # fixture mode: committed sample data, timestamps kept fresh
npm run build      # production build (dist/) — live mode, polls acartia.io
npm test           # 81 unit + smoke tests
```

- **Live mode** (production builds) fetches
  `https://acartia.io/api/v1/sightings/current` directly from the browser —
  the endpoint is keyless and CORS-open, so no proxy or server is needed.
  Force it in dev with `VITE_DATA_MODE=live npm run dev`.
- **Fixture mode** (dev default) serves `src/data/fixtures/acartia-current.json`
  with timestamps shifted so the board is always alive. Swap in a real
  capture any time:

  ```sh
  curl https://acartia.io/api/v1/sightings/current > src/data/fixtures/acartia-current.json
  ```

### URL switches

| Param | Effect |
| --- | --- |
| `?demo=1` | (fixture mode) injects a synthetic fresh sighting on each later poll — previews the arrival animation and chime |
| `?poll=30` | poll every 30 seconds instead of 3 minutes (min 5s) |

### Kiosk / ambient mode

The ⛶ button enters fullscreen: controls fade away, the cursor hides after
5 s, a screen wake lock keeps the display on, and the app reloads itself at
4 am daily as a memory backstop for unattended runs. Polling survives network
blips (backoff ladder, catch-up poll on reconnect) and the last-good view is
never torn down — a small "reconnecting" badge appears instead.

## Deploying (Cloudflare)

The board is a static SPA. `wrangler.jsonc` in the repo root declares a
static-assets Worker — no `main` entrypoint, no server code in the request
path — so Cloudflare serves `dist/` straight from the edge:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Assets directory | `dist` (from `wrangler.jsonc`) |
| Node version | pinned via `.node-version` (22) |

```sh
# one-off deploy from the CLI (or import the repo in the Cloudflare dashboard)
npm run deploy
```

- No environment variables are required: production builds default to live
  mode and poll the keyless `/current` endpoint directly from the browser.
- **Optional backfill proxy**: deploy `workers/acartia-proxy` (holds the
  Acartia token, see its README), set its `ALLOWED_ORIGINS` to the board's
  origin, then set
  `VITE_PROXY_URL=https://acartia-proxy.<account>.workers.dev/sightings` as a
  *build* environment variable and redeploy.
- Cache headers ship via `public/_headers` (immutable hashed assets, always
  revalidated shell). No `_redirects` needed — single route, no client router.
- Cloudflare Pages works too, with build output directory `dist`.

Full step-by-step walkthrough — Workers Builds, CLI, and Pages, plus the
optional proxy, custom domains, and troubleshooting:
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Reporting from Facebook groups

Facebook groups (Orca Network, Puget Sound Orcas, …) are where many Salish
Sea sightings surface first — but Facebook shut down third-party read access
to group content (Groups API, April 2024), so posts can't be ingested
automatically without ToS-violating scraping. The board's answer is a
**community relay** (`workers/fb-relay`): a tiny token-gated Cloudflare
Worker that serves a phone-friendly entry form. See a post in a group, open
the form, tap species + place + time, submit — the board picks it up on its
next poll and renders it like any other sighting, credited to the group
("Orca Network · community relay" in the popover) with the relay named in
the attribution footer.

Relayed reports ride the exact same pipeline as Acartia records (species
table, pod/T-number parsing, region lookup, freshness decay), and the
near-dupe collapse merges a relayed report with the same sighting arriving
later through Acartia — Orca Network group traffic usually does, with a
delay — so nothing doubles up. Reports expire after the board's 7-day
retention window.

Setup lives in [`workers/fb-relay/README.md`](workers/fb-relay/README.md);
the board enables the feed when built with
`VITE_REPORTS_URL=https://fb-relay.<account>.workers.dev/reports`. In dev
(fixture mode) a committed sample exercises the path automatically.

## How it works

```
acartia /current ──poll──▶ normalize ──merge──▶ in-memory store ──▶ d3-geo map + rail
                  3 min      coerce/filter        7d rolling         SVG, CSS motion
```

- **Normalization** (`src/data/normalize.ts`) is the heart: the feed mixes
  strings and numbers for coordinates/counts, uses naive UTC timestamps
  (parsed with `Date.UTC`, never `new Date(string)`), and drifts on species
  labels (`Gray` vs `Gray Whale`). Ecotype, pod (T-numbers, J/K/L), and
  individual IDs (BCX…, CRC…) are parsed best-effort from free-text comments;
  everything degrades gracefully to species-only.
- **Regions** are derived point-in-polygon from coarse hand-drawn zones
  (`src/assets/zones/`) — the feed has no place names.
- **The map** is d3-geo (conic conformal) over a bundled TopoJSON coastline —
  no tiles, no tokens, fully offline. Rebuild it with `npm run coastline`
  (downloads OSM-derived land polygons, clips + simplifies via mapshaper).
- **Positions render as soft glows** sized to real observation error (>1 km).
  The board never implies GPS precision.
- **Species art** (`src/assets/species/SpeciesSprite.tsx`) is an original
  hand-authored SVG silhouette set — one visual language, no third-party
  assets. `Unspecified` is a first-class category with its own mark.

## Data, attribution & licenses

- **Sightings**: Acartia Data Cooperative — Orca Network via Conserve.io and
  partners. The data is contributor-owned with an attribution norm (not a
  blanket CC license). This project displays it **non-commercially with
  persistent attribution**; contact Acartia / Orca Network before any public
  or commercial use.
- **Community relay**: reports hand-relayed from Facebook group posts carry
  the group's name on the marker and in the footer. Relay the essentials,
  not whole posts, and respect each group's sharing rules — same
  non-commercial, personal-use spirit as the rest of the board.
- **Coastline**: © OpenStreetMap contributors (ODbL), via the
  [geo-maps](https://github.com/simonepri/geo-maps) project (MIT).
- **Illustrations**: original to this repository.
- **Not a safety tool.** This board is an ambient display. It is not a
  mariner alert system, not WRAS, and not a navigation aid.
