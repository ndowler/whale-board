# acartia-proxy

Cloudflare Worker that holds the Acartia Bearer token and proxies the
token-gated full sightings feed (`GET https://acartia.io/api/v1/sightings`)
for the whale board. It trims the ~2.4 MB / 4-month upstream payload to the
last 7 days (~100 KB) and caches responses for 2 minutes.

The board works without this Worker — `/current` is keyless. The proxy only
backfills the 7-day retention window and future-proofs longer windows. See
`docs/M2-endpoint-findings.md`.

## Setup

```sh
cd workers/acartia-proxy
npm install
```

Local dev — put the token in `.dev.vars` (gitignored, never commit):

```
ACARTIA_TOKEN=<your token>
```

```sh
npm run dev            # serves http://localhost:8787/sightings
```

Point the SPA at it via `.env.local` in the repo root (gitignored):

```
VITE_PROXY_URL=http://localhost:8787/sightings
```

## Deploy

```sh
npx wrangler secret put ACARTIA_TOKEN
npx wrangler deploy
```

Then set `ALLOWED_ORIGINS` (comma-separated) in `wrangler.toml` `[vars]` or the
dashboard to the board's origin(s) — unset, only localhost dev origins may call
from a browser. Rebuild the SPA with
`VITE_PROXY_URL=https://acartia-proxy.<account>.workers.dev/sightings`.

## Behavior

- `GET /sightings` — trimmed, cached upstream feed. Anything else: 404/405.
- Browser callers must match the origin allowlist (403 otherwise);
  origin-less clients (curl) may read.
- Upstream failures pass through as their status; never cached, token never
  echoed.

## Testing

No unit tests — the Worker is ~120 lines and verified manually (accepted gap):

```sh
curl -i http://localhost:8787/sightings        # 200 JSON array
curl -i -X POST http://localhost:8787/sightings  # 405
curl -i http://localhost:8787/other            # 404
# repeat GET within 2 min → served from cache (one upstream call in dev log)
```
