# fb-relay

Cloudflare Worker that brings **reports from Facebook groups** onto the
whale board — the honest way. Facebook removed third-party read access to
group content (the Groups API shut down in April 2024), so group posts
cannot be ingested automatically without scraping, which violates Meta's
terms and breaks constantly. Instead, this Worker gives a human a
20-second relay flow:

1. You see a sighting posted in a group (Orca Network, Puget Sound Orcas…).
2. You open the Worker's root URL on your phone — a small dark form:
   species, a picker of named Salish Sea spots (or pasted coordinates),
   time seen, count, notes, group name.
3. Submit. The board picks it up on its next poll and renders it like any
   other sighting, attributed to the group ("Orca Network · community
   relay" in the popover).

Reports are stored in KV in **Acartia's raw record shape**, so the SPA's
normalizer, comment parser (pod/ecotype extraction), region lookup, and
near-dupe collapse all apply unchanged. A relayed report that later arrives
through Acartia (Orca Network group traffic usually does, with a delay)
merges into one marker instead of doubling up. Entries expire from KV after
7 days — the board's own retention ceiling.

## Setup

```sh
cd workers/fb-relay
npm install
npx wrangler kv namespace create REPORTS   # paste the id into wrangler.toml
npx wrangler secret put REPORT_TOKEN       # any long random string
npx wrangler deploy
```

Then set `ALLOWED_ORIGINS` (comma-separated) in `wrangler.toml` `[vars]` or
the dashboard to the board's origin(s), and rebuild the SPA with

```
VITE_REPORTS_URL=https://fb-relay.<account>.workers.dev/reports
```

Share the form URL (`https://fb-relay.<account>.workers.dev/`) and the
token with whoever relays reports; the form remembers both the token and
the group name in localStorage, so repeat entries are species + place +
submit.

Local dev — put the token in `.dev.vars` (gitignored, never commit):

```
REPORT_TOKEN=dev-token
```

```sh
npm run dev            # serves http://localhost:8787/
```

The SPA needs nothing locally: in fixture mode (dev default) it serves the
committed `src/data/fixtures/fb-reports.json` sample. To exercise the live
path in dev, add `VITE_REPORTS_URL=http://localhost:8787/reports` to
`.env.local` and run `VITE_DATA_MODE=live npm run dev`.

## Behavior

- `GET /` — the phone entry form (HTML, no auth; posting needs the token).
- `GET /reports` — JSON array of stored reports, newest first. Browser
  callers must match the origin allowlist (403 otherwise); origin-less
  clients (curl) may read.
- `POST /reports` — requires `Authorization: Bearer <REPORT_TOKEN>`.
  Validates species/coords (must be inside the board's Salish Sea bbox),
  timestamps (≤7 days old, not in the future), and length-caps every string.
  Returns 201 with the new id, 400 with a fixable message, or 401.
- Anything else: 404/405.

KV is eventually consistent (~60 s to propagate) and the board polls every
3 minutes, so a submitted report can take a few minutes to appear on the
wall.

## Relay etiquette

- Relay the essentials, not the whole post — and credit the group, which
  the form requires. Don't paste people's names without their consent.
- The board is non-commercial and personal (PRD FR-22); the same spirit
  applies here. If a group's rules restrict sharing sightings outside the
  group, respect that.

## Testing

No unit tests — like acartia-proxy, the Worker is small and verified
manually (accepted gap):

```sh
curl -i http://localhost:8787/reports                      # 200 []
curl -i -X POST http://localhost:8787/reports \
  -H 'authorization: Bearer dev-token' -H 'content-type: application/json' \
  -d '{"species":"Orca","lat":47.3,"lng":-122.5,"group":"Orca Network","comment":"T65As northbound"}'
                                                           # 201 {"ok":true,...}
curl -i http://localhost:8787/reports                      # 200 [record]
curl -i -X POST http://localhost:8787/reports -d '{}'      # 401 (no token)
curl -i http://localhost:8787/other                        # 404
```
