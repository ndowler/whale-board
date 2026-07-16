# M4 — Acoustic bridge findings (verified 2026-07-13)

Goal: "a *heard* orca can light the same board" (PRD §10 M4). Verified the
public acoustic endpoints live, picked one, and wired it in.

## Endpoint verification

### Orcasound GraphQL — ✅ the whole backbone

- `POST https://live.orcasound.net/graphql` — keyless, JSON, and sends
  `access-control-allow-origin: *` (verified with a cross-origin `Origin`
  header). A browser SPA calls it directly; no proxy, same as Acartia.
- `feeds` returns the 7 hydrophone nodes with `latLng`, `slug`, `name`,
  `visible`, `online`. Slug maps to a public listen page:
  `https://live.orcasound.net/listen/{slug}`.
- `detections(filter: {category: {eq: WHALE}}, sort: {field: TIMESTAMP,
  order: DESC}, limit: 100)` returns whale-category detections with
  `feedId`, `timestamp` (ISO UTC), `source` (`MACHINE` | `HUMAN`), and
  `candidateId` (groups a burst of detections into one event).
- Live sample at verification time: 100 detections spanning ~39 h, newest
  ~27 min old — the feed is active and fresh.
- `source: MACHINE` rows **are** the OrcaHello AI pipeline's detections,
  routed into orcasite; `HUMAN` rows are live-listener reports.

### OrcaHello dashboard/API — ❌ not needed

- `aifororcas.azurewebsites.net` serves a Blazor Server app (HTML +
  websocket circuit), not a REST API usable from a SPA.
- `aifororcas-api.azurewebsites.net` does not resolve.
- No loss: OrcaHello's detections arrive via Orcasound's `detections`
  (`source: MACHINE`), so one GraphQL endpoint covers both.

## Design decisions

- **One request per poll** — feeds + detections in a single GraphQL query,
  on the same interval as the Acartia poll but in an independent loop
  (`useAcousticLoop`). Acoustic failure never touches sighting state; it is
  silent and the layer simply ages out.
- **Decorative, not primary** — no stale badge, no rail cards. Hydrophones
  are quiet map furniture (`--ink-faint`) until a detection lights them.
- **Three states** per node, derived in `hydroStatuses()`:
  - *hot* — detection within `acoustic.hotMs` (30 min): amber glyph +
    looping sonar rings, the acoustic sibling of the arrival ping.
  - *heard* — detection within `acoustic.heardWindowMs` (6 h): amber tint.
  - *idle* — nothing recent: faint glyph.
- **Popover** on tap: node name, "whales heard N min ago" (AI vs
  listener-confirmed), and a "Listen live" link to the node's Orcasound
  page. Offline nodes say so.
- **Retention**: reducer keeps only detections inside the heard window;
  ~100-row payloads stay tiny.
- **Fixture mode**: `src/data/fixtures/orcasound-acoustic.json` is a live
  capture; timestamps are shifted so the newest detection is always ~10 min
  old — the dev board reliably shows one hot hydrophone.
- **Attribution** extended: "Acoustic detections via Orcasound & OrcaHello".

## Open questions (carry forward)

- `candidateId` could group a detection burst into one "event" for a
  possible future rail card or chime treatment.
- Orcasound adds nodes occasionally; the feed list is fetched per poll, so
  new nodes appear without a deploy.
- The other M4 item — AI-restyled illustration set — is untouched here; it
  is an asset pipeline task, not a data task.
