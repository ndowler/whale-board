# M2 — Token-gated endpoint spike findings

Verified 2026-07-13 against `GET https://acartia.io/api/v1/sightings` with a Bearer token
(token held in shell env / wrangler secret only — never in this repo).

## Endpoint shape

- **200 OK, plain JSON array** — same top-level shape as `/current`.
- **3,233 records, ~2.4 MB**, spanning **~128 days** (2026-03-08 → now). It is a deep
  history feed, not a window.
- **Query params are ignored.** `?limit=`, `?since=`, `?days=` all return the full
  3,233-record payload. There is no server-side filtering — the Worker must trim.
  → **Gate triggered:** payload > 2 MB, so the proxy Worker filters to the last 7 days
  (~131 records, ~100 KB) before responding.
- **Field shape:** superset of `/current` — identical core fields plus `entry_id`,
  `photo_url`, `signature`, `profile`, `submitter_did`, `data_source_id`,
  `data_source_name`, `ssemmi_date_added`, `data_source_witness`. `/current` actually
  returns the same superset; the normalizer already ignores the extras.

## Dedup safety (critical check)

- **`ssemmi_id` namespace is shared**: all 119 `/current` ids were present in the full
  feed (119/119 overlap). Exact-id dedup in `mergeSightings` handles feed overlap.
- The full feed itself contains **~83 repeated `ssemmi_id`s** (3,150 unique / 3,233).
  Repeats have *different* `entry_id`s and slightly different time/position/type — they
  are the "one animal, multiple witnesses" near-dupes FR-8 targets. `normalizeBatch`
  keeps the newest per id; the FR-8 collapse handles the rest at display time.

## §6.4 carry-overs

- **`/current` window:** spans almost exactly **7 days** (6.9d, 119 records). It appears
  to be a fixed 7-day window, so the 7d board view is already fully populated by
  `/current` alone. The backfill's present value is guaranteeing the 7d tail and
  future-proofing longer windows (the full feed reaches back ~4 months); the periodic
  backfill refresh defaults **off** (`backfillRefreshMs: null`).
- **`created` timestamps:** dominant format is naive `"YYYY-MM-DD HH:MM:SS"` (parsed as
  UTC by `parseCreatedUtc` — cross-checked against known sighting times, consistent).
  Exactly **2 records** (June 10, junk rows missing type/entity) use a JS
  `toString()`-style format `"Wed Jun 10 2026 05:59:35 GMT+0000 (...)"` that
  `parseCreatedUtc` rejects → they drop. Accepted: not worth a parser branch for 2 dead
  rows; the format self-labels as UTC if it ever becomes common.
- **`trusted` semantics:** distribution 0: 521 / 1: 2,048 / 2: 662 (+2 undefined). All
  levels come via Conserve.io across the same witness apps (whalealertoa,
  cascadiaWebMap, whaleAndroid), so the data does not reveal what 2 means beyond "more
  trusted than 1". Display rule (`minTrusted: 1`) unchanged; FR-8 "prefer higher
  trusted" is safe under any interpretation. Still worth the one email to Acartia.

## Species-label drift (bigger than M0 showed)

The 4-month feed surfaces `type` values M0's 132-record pull never saw. Notable, with
how the current table handles them:

| Feed value | Current mapping | Correct mapping |
|---|---|---|
| `Southern Resident Orca` (7) | `orca` (substring) | `orca_srkw` |
| `Killer whale(Southern Resident)` (2) | `orca` | `orca_srkw` |
| `Killer whale(Bigg's (Transient))` (9) | `orca` | `orca_biggs` |
| `Killer whale (Ecotype Unknown)` (3) | `orca` | `orca` ✓ |
| `Finback Whale` (3) | `unknown_cetacean` | `fin_whale` |
| `Gray Whale whale` (3) | `gray_whale` ✓ | — |
| `Unknown` (13), `Other (Specify in comments)` (7) | `unknown_cetacean` | `unspecified` |
| `No especificado` (3), `Non spécifié` (1) | `unknown_cetacean` | `unspecified` |
| `Baleine grise` (1) | `unknown_cetacean` | `gray_whale` |
| `Baird's Beaked Whale` (3), `Northern Right Whale Dolphin` (2), `Long-beaked Common Dolphin` (1) | `unknown_cetacean` ✓ | — (no illustration; correct fallback) |

→ Table extended in `src/data/species.ts` as part of M2 (ecotyped exact entries must
win before the generic `orca` substring fallback).

## Multi-source field decision

No `feed`/`source` field added to `Sighting`: both feeds are Acartia, per-record
attribution already lives in `sourceEntity` (`data_source_entity`), and FR-8 provenance
is carried by `mergedIds`/`reportCount`. If a genuinely non-Acartia source lands
(M4+), add `source: string` defaulted `'acartia'` then.

## Fixture

`src/data/fixtures/acartia-full.json` — the full pull filtered to the Salish bbox +
last 7 days at capture time (90 records, ~77 KB). Same license posture as the existing
`/current` fixture: contributor-owned sighting data, non-commercial use with
attribution.
