# PRD — Salish Sea Whale Board (Tier 1: Sightings Map)

| | |
|---|---|
| **Product** | Salish Sea Whale Board — a live, illustrated map of whales currently in Puget Sound |
| **Owner** | Nick |
| **Status** | Draft v0.3 — M0 + full assumptions audit complete (see `M0-findings.md`, `assumptions-audit.md`) |
| **Scope** | Tier 1 only: sightings-driven, **no hardware, no acoustic detection** |
| **Inspiration** | [AvianVisitors](https://github.com/Twarner491/AvianVisitors) (BirdNET-Pi fork) — translated from a backyard mic to the Sound's open sightings feeds |

---

## 1. Summary

A wall-mountable, always-on display that shows which whales are in the Salish Sea right now. It polls public whale-sighting APIs every few minutes and renders each fresh sighting as an illustrated species card dropped onto a map of Puget Sound, at the location it was seen. Older sightings fade; quiet water is its own state. Think of it as AvianVisitors' illustrated collage, but geographic — the whales appear *where they are* rather than in an abstract grid.

Tier 1 deliberately uses **existing sightings data only**. No hydrophone, no ML model, no backend beyond a thin proxy. The goal is a beautiful, correct, low-maintenance ambient display standing up in a weekend, with a clean path to bolt on the acoustic layer (Tier 2) later.

---

## 2. Problem & motivation

The data exists but is scattered and utilitarian. Orca Network's sightings, the Whale Museum's hotline, and the Acartia cooperative all track marine-mammal locations across the Sound in near real time, but they're consumed as mariner alerts, spreadsheets, and research feeds — not as something you'd want on your wall. There's no calm, glanceable "are the whales around today?" object for a Puget Sound resident who's on the water.

This is that object. It also serves as a portfolio-grade demonstration of turning open civic/scientific data into an ambient information display.

---

## 3. Goals & non-goals

**Goals**
- Show all marine-mammal sightings in the Salish Sea from a rolling recent window (default 24h), on a map, updating automatically.
- Represent each species (and orca pod/ecotype where known) with a distinct illustration.
- Run unattended in a kiosk/fullscreen "ambient mode" for a wall display.
- Be honest about data freshness and gracefully handle empty water and API failures.
- Respect the source data licenses (attribution, non-commercial).

**Non-goals (Tier 1)**
- No hydrophone, no live audio, no acoustic ML (that's Tier 2/3).
- No real-time push/alerts — polling is sufficient; sightings aren't second-by-second.
- No user accounts, no submitting sightings, no historical analytics dashboards.
- Not a mariner safety tool. Explicitly **not** a substitute for WRAS or any navigation aid.
- No commercial use. Source data is **contributor-owned with an attribution norm** (not a blanket CC license — see §5.7 and the audit); non-commercial personal display is the safe lane.

---

## 4. Users & use cases

**Primary persona — "the resident on the water."** Wants a glanceable answer to "are whales around, and where?" Checks it over coffee, before heading out to fish, or leaves it running on a wall/tablet.

**Secondary persona — "the ambient viewer."** A guest, kid, or visitor who finds it delightful and educational — learns to tell a southern resident from a Bigg's, a humpback from a gray.

**Core use cases**
1. Glance at the board and see there are orcas near Point Defiance / the South Sound in the last few hours.
2. Watch a new sighting animate in when the poll picks it up.
3. See at a glance that it's been quiet all day (empty state, not a broken screen).
4. Tap/hover a marker for species, pod/ecotype, count, time-ago, and source.

---

## 5. Functional requirements

### 5.1 Data ingestion
- **FR-1** Poll the primary source (Whale Museum Hotline API) on a fixed interval (default 3 min, configurable).
- **FR-2** Optionally poll the secondary source (Acartia) when a token is configured; otherwise run on the primary source alone.
- **FR-3** Normalize every incoming record to the internal Sighting schema (§7).
- **FR-4** De-duplicate across sources and across polls (§5.2).
- **FR-5** Retain sightings within the active freshness window (**default 3d**; feed lags too much for sub-day defaults — see M0); drop older.
- **FR-6** Filter to the Salish Sea bounding box; discard out-of-region records.

### 5.2 De-duplication (light — see audit)
Deferred in scope: the feed is single-source today and shows only ~6 within-feed near-dupes (one animal, multiple witnesses). Cross-source dedup is premature.
- **FR-7** Drop exact `ssemmi_id` repeats across polls (trivial).
- **FR-8** *(Optional, post-MVP)* Merge near-dupes (same species, ~500 m, ~15 min); prefer higher `trusted`. Only becomes real when a second source or the token endpoint is added.

### 5.3 Map display
- **FR-9** Render a map of the Salish Sea, default-centered on the South Sound (Tacoma-relevant waters) at a zoom that shows Seattle → Tacoma → the San Juans.
- **FR-10** Place an illustrated marker at each sighting's lat/lng, keyed to species and (for orcas) ecotype/pod.
- **FR-11** Apply time-decay: recent sightings render bright/large; older ones fade and shrink toward the edge of the freshness window.
- **FR-12** New sightings animate in (fade/scale/gentle bounce) so a watcher notices arrivals.
- **FR-12a** Render positions as **approximate** (soft glow / small radius, no hairline pinpoint). Visual sightings carry >1 km observation error; the board must not imply GPS-grade precision.
- **FR-13** Marker interaction (tap/hover) reveals a detail popover: species, pod/ecotype, count, **region label** (derived via point-in-polygon against Salish Sea zones — there is no source-provided place name; see audit), time-ago, source + attribution.

### 5.4 Recent-sightings feed
- **FR-14** A side/bottom rail shows the N most recent sightings as illustrated cards (species art, time-ago, location), newest on top — the direct nod to the AvianVisitors collage.
- **FR-15** Cards and map markers are linked (selecting one highlights the other).

### 5.5 States
- **FR-16 Fresh-sighting state:** arrival animation + optional subtle chime (muted by default).
- **FR-17 Quiet-water state:** when no sightings in the window, show a deliberate calm empty state ("Quiet water — no whales reported in the last 24h"), not a blank or error screen.
- **FR-18 Stale/error state:** if polling fails or data is older than a staleness threshold (default 2× poll interval), show an unobtrusive "reconnecting / last updated HH:MM" indicator without tearing down the last-good view.

### 5.6 Ambient / kiosk mode
- **FR-19** A fullscreen mode with no chrome, safe for a wall tablet or monitor, that runs indefinitely without interaction and survives network blips.
- **FR-20** Configurable freshness window (**24h / 3d / 7d**). M0 found the feed lags ~12h+ and spans ~a week, so sub-day windows render empty — default to 3d (or the whole `/current` feed) with time-decay so the board reliably shows whales.

### 5.7 Attribution & licensing (corrected — see audit)
There is **no blanket CC BY-NC-SA on the data.** Acartia's *code* is MIT; the *data* is contributor-owned with an attribution norm.
- **FR-21** Persistently display attribution to the upstream networks: **Orca Network via Conserve.io / Acartia Data Cooperative.** Keep it visible in all modes.
- **FR-22** Keep the project **non-commercial and personal.** For any public-facing or commercial use, contact Acartia / Orca Network for acceptable-use terms first — do not assume a CC grant.
- **FR-23** Illustration assets carry **per-asset** licenses (CC0 vs CC-BY); prefer CC0/Public Domain, and record attribution where CC-BY. If forking Acartia's own code, that piece is MIT.

---

## 6. Data sources & integration spec

> **M0-verified (2026-07-10).** The originally-planned primary source is dead; Acartia is the primary and is keyless. See `M0-findings.md` for evidence.

### 6.1 Primary — Acartia `/current` (keyless)
- `GET https://acartia.io/api/v1/sightings/current` — **no auth token**, `access-control-allow-origin: *`, returns JSON.
- Verified live: ~132 records, ~100 KB, small enough to pull whole and filter client-side.
- Aggregates Orca Network + partners (routed via Conserve.io / Spotter-API). This is the whole MVP backbone on its own.
- Role: **primary source, MVP.** No key, no proxy.

### 6.2 Secondary — Acartia full endpoint (token-gated)
- `GET https://acartia.io/api/v1/sightings` — returns **401 Bearer** without a token. This is the full-history / write endpoint.
- Register per Acartia's contributing guidance for a token; use `ssemmi_id` as a high-water mark for incremental pulls.
- Role: coverage/history upgrade in M2. This is the *only* piece that needs the token kept server-side (see §8).

### 6.3 Dead — The Whale Museum "Hotline" API
- `hotline.whalemuseum.org` **no longer resolves.** Removed as a source. Its Orca Network data reaches us through Acartia anyway.

### 6.4 Remaining verification (carry into M1)
- Confirm `trusted: 2` semantics vs `1` (display rule currently assumes `>= 1` shows).
- Confirm `created` timestamps are UTC.
- Confirm whether the `/current` window length is fixed (affects whether a "7d" view is always populated).

---

## 7. Data model

Normalized internal `Sighting` (field mapping confirmed against live Acartia data):

```
{
  id:            string,   // `acartia:${ssemmi_id}` with spaces stripped
  source_id:     string,   // ssemmi_id, e.g. "SPOTTER 251921"
  timestamp:     string,   // from `created`; parse as UTC (confirm)
  species:       string,   // normalized from `type` (see §11)
  ecotype:       string | null,  // parsed from data_source_comments: "Biggs" | "SRKW" | null
  pod:           string | null,  // parsed: T-numbers (Bigg's) or J/K/L; often null
  ind_id:        string | null,  // humpback/individual ID from comments (e.g. "BCX2077")
  count:         number | null,  // from `no_sighted` — COERCE (mixed int/str)
  lat:           number,   // from `latitude`  — COERCE (mixed float/str)
  lng:           number,   // from `longitude` — COERCE (mixed float/str)
  trusted:       0 | 1 | 2,      // NOT boolean; display rule treats >= 1 as shown
  note:          string,   // data_source_comments (source-tagged, ~40% empty)
  raw:           object    // untouched original payload
}
```

**Mandatory coercion:** `latitude`, `longitude`, and `no_sighted` arrive as a mix of numbers and strings (in the M0 pull, 80/132 lat-lng were strings). Coerce on ingest; drop records where lat/lng won't parse.

**Species normalization** is confirmed necessary on day one — the live feed contains both `Gray Whale` and `Gray` as distinct values. Maintain one mapping table `type` → internal enum. Unmapped species → "unknown cetacean" illustration, logged.

**Free-text parsing:** ecotype, pod/T-number, and individual whale IDs are not structured — they live in `data_source_comments` (e.g. `[Orca Network] Biggs T46Bs southbound`). Parse best-effort; ~40% are empty, so `ecotype`/`pod` are frequently null and the UI must degrade gracefully to just species.

---

## 8. Technical architecture

**Shape:** a single-page front end (React) with a rolling in-memory store of normalized sightings, a polling loop, and a map renderer. No database. State lives in memory; on reload it rehydrates from a fresh poll.

**No proxy for the MVP (M0-confirmed).** The primary endpoint (`/api/v1/sightings/current`) is keyless, served over HTTPS, and sends `access-control-allow-origin: *` — a browser SPA can call it directly. The proxy the earlier draft assumed is **not needed to ship.** It comes back only when you add the token-gated full endpoint in M2 (to keep the token server-side) or want server-side caching; at that point a thin Cloudflare Worker / Vercel function is the move.

**Rendering (sandbox-corrected — see audit):** if built as a **Claude artifact**, Leaflet/MapLibre are **not available** — use **d3-geo** with a **simplified Salish Sea coastline GeoJSON bundled into the artifact** (clipped + simplified via mapshaper), a Mercator/Conic projection, and illustrated markers as static assets keyed by species/ecotype. No tiles, no token, fully offline — and a stylized coastline suits the illustrated look. Leaflet/MapLibre + real tiles are back on the table only if this ships as a standalone deployed app.

**Config constants:** poll interval, freshness window, dedup thresholds, map center/zoom, staleness threshold, chime on/off — all in one config module.

**Deployment:** static hosting (the front end) + the serverless proxy. Runs on a wall tablet in kiosk/fullscreen. If it starts as a pure artifact for prototyping, the proxy step is the thing that must move server-side before it's reliable.

---

## 9. Illustration system

- **MVP:** a fixed, hand-selected illustration per species and per orca ecotype (southern resident vs Bigg's read differently, and that distinction is half the fun). Assets sized for both map markers and feed cards.
- **Coverage set (v1):** southern resident orca, Bigg's/transient orca, humpback, gray, minke, harbor porpoise, Dall's porpoise, harbor seal, sea lion, plus `Unspecified` and "unknown cetacean" fallbacks.
- **Sources (verified):** PhyloPic (CC0/CC-BY silhouettes), rawpixel & freesvg (CC0), public-domain natural-history plates. **Licenses are per-asset** — prefer CC0/PD; a PhyloPic composite inherits its most restrictive part. Track attribution for any CC-BY asset.
- **Future (post-Tier-1):** an AI restyle pipeline (your 4090) to render a cohesive illustrated set in one visual language, mirroring AvianVisitors' restyling step. Non-commercial use keeps this clean against the source licenses.

---

## 10. Milestones

- **M0 — Data spike ✅ DONE:** APIs verified, proxy ruled out for MVP, fixtures captured. See `M0-findings.md`.
- **M1 — MVP (a weekend):** direct client-side fetch of Acartia `/current` (no proxy); coerce + normalize + bbox-filter; map with illustrated markers; recent-sightings feed; quiet-water + error states; 3d default window. Ships as a usable board.
- **M2 — Coverage & quality:** add Acartia (token), cross-source dedup, species normalization table, time-decay rendering, selectable 3/12/24h windows.
- **M3 — Ambient polish:** arrival animations, quiet-water state, optional chime, fullscreen kiosk hardening, attribution treatment.
- **M4 — Beyond Tier 1 (future):** AI-restyled illustration set; bridge to the acoustic layer (OrcaHello / Orcasound) so a *heard* orca can light the same board.

---

## 11. Appendix

### Species enum (from live `type` values, M0)
Observed: `Humpback`, `Orca`, `Unspecified`, `Gray Whale`, `Blue Whale`, `Fin Whale`, `Harbor Porpoise`, `Minke Whale`, `Pacific White-sided Dolphin`, and stray `Gray`.
Internal enum + normalization: `orca` (ecotype split to `orca_biggs` / `orca_srkw` when the comment says so), `humpback`, `gray_whale` (merge `Gray Whale` + `Gray`), `blue_whale`, `fin_whale`, `minke`, `harbor_porpoise`, `pacific_white_sided_dolphin`, `unspecified`, `unknown_cetacean` (fallback). `Unspecified` is common (24/132) and needs its own respectable illustration — it is not an error state.

### Orca pod reference (southern residents)
J, K, L pods. Bigg's (transients) are catalogued by T-numbers rather than pods. Where the source provides it, surface pod/T-id in the detail popover; otherwise fall back to ecotype.

### Salish Sea bounding box (approximate, refine in M0)
South Puget Sound up through Admiralty Inlet, Hood Canal, the San Juans, Haro/Rosario Strait, and the eastern Strait of Juan de Fuca. Discard sightings outside it.

### Attribution string (corrected)
"Sightings data via the Acartia Data Cooperative — Orca Network via Conserve.io and partners. Displayed non-commercially with attribution; not a blanket CC-licensed dataset." Keep visible in all modes. (Confirm exact wording with Acartia for any public display.)

### Risks & open questions (post-audit)
- **CORS/HTTPS** — ✅ resolved: primary endpoint is keyless + CORS `*`, no proxy needed.
- **Species-label drift** — real (`Gray Whale` vs `Gray`); owned by the normalization table; log unknowns.
- **Sighting sparsity + feed lag** — the quiet-water state is a *frequent* state (feed lags ~12h+); it must feel intentional.
- **Licensing** — not CC BY-NC-SA; contributor-owned + attribution norm. Non-commercial + prominent attribution are hard requirements. Ask Acartia before any public/commercial use.
- **Approximate positions** — >1 km sighting error; never imply GPS precision.
- **Not a safety tool** — persistent disclaimer; not a navigation aid.
- **Open (one email to Acartia):** meaning of `trusted: 2`; whether the `/current` window length is fixed; preferred public-attribution string.
