# Deploying the whale board to Cloudflare

The board is a static single-page app with no server-side runtime, so
Cloudflare serves it directly from the build output. An optional Worker
(`workers/acartia-proxy`) can be added later for backfill; the board is fully
functional without it.

Two independent pieces, in order:

1. **The board itself.** Required. Deployed as a static-assets Worker using the
   `wrangler.jsonc` in the repo root.
2. **The backfill proxy.** Optional; skip on the first deploy and add it any
   time.

## Workers or Pages?

Both work. New projects created in the Cloudflare dashboard now land in the
**Workers** flow, which is what `wrangler.jsonc` targets, so that is the path
documented here. Pages is still supported and is covered in
[Option C](#option-c--cloudflare-pages) below.

The root `wrangler.jsonc` declares a Worker with **no `main` entrypoint** —
just an assets directory. Cloudflare serves `dist/` straight from its edge
cache with no script in the request path:

```jsonc
{
  "name": "whale-board",
  "compatibility_date": "2026-07-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

`not_found_handling` is `404-page` rather than `single-page-application`
because the board is a single route with no client-side router — the URL
switches (`?poll=30`, `?demo=1`) are query parameters on `/`, so an unmatched
path is a genuine 404, not a route to rehydrate.

---

## Before you start

- A Cloudflare account (the free plan covers both Pages and Workers).
- Node 22 locally, matching the `.node-version` file in the repo root.
- A clean build:

  ```sh
  npm install
  npm test
  npm run build
  ```

  `npm run build` should finish with no TypeScript errors and write `dist/`
  containing `index.html`, `assets/`, `art/`, `fonts/`, and `_headers`.

---

## Part 1 — Deploy the board

Pick **one**: the Git integration (auto-deploys on every push, recommended for
ongoing work), the CLI (a direct upload, good for a one-off), or Pages.

### Option A — Connect the Git repository (Workers Builds)

1. Push the branch you want to deploy to GitHub or GitLab.
2. In the Cloudflare dashboard go to **Workers & Pages → Create → Workers →
   Import a repository**, then authorize and pick this repository.
3. Configure the build:

   | Field | Value |
   | --- | --- |
   | Worker name | `whale-board` (must match `name` in `wrangler.jsonc`) |
   | Production branch | your deploy branch |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Non-production branch deploy command | `npx wrangler versions upload` |
   | Root directory | `/` (repo root) |

   There is **no build-output-directory field** in this flow — the output path
   comes from `assets.directory` in `wrangler.jsonc`. Node version comes from
   `.node-version` (22) automatically. Accept the API token Cloudflare offers
   to create; it is what the build runner uses to deploy. Leave the build
   environment variables empty — none are required (see Part 2 if you add the
   proxy).
4. Click **Create and deploy**. The first build takes a couple of minutes.
5. When it finishes, open the `https://whale-board.<subdomain>.workers.dev` URL.

Every later push to the production branch redeploys automatically. Pushes to
other branches run `wrangler versions upload` instead, which publishes a
preview URL without touching production.

### Option B — Deploy from the CLI

```sh
npm run deploy      # runs the build, then wrangler deploy
```

The first run prompts you to log in through the browser. Re-run the same
command to publish updates.

### Option C — Cloudflare Pages

Pages ignores `wrangler.jsonc` and takes the output directory from its own
settings instead. Under **Workers & Pages → Create → Pages → Connect to Git**:

| Field | Value |
| --- | --- |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | leave blank |

Or from the CLI:

```sh
npm run build
npx wrangler pages deploy dist --project-name whale-board
```

Everything else in this guide — caching, the proxy, custom domains — applies
unchanged; only the deployed URL differs (`*.pages.dev`).

### Verify the deployment

Open the deployed URL and confirm:

- Species art and the nautical chart background render (assets resolve from
  `/art/...`).
- The Fraunces typeface loads — headings are serif, not the fallback sans.
- Sightings appear within a few minutes, or the board shows its designed quiet
  state rather than an error badge. Production builds run in **live** mode and
  poll `https://acartia.io/api/v1/sightings/current` directly; that endpoint is
  keyless and CORS-open, so no proxy is involved.
- The browser console is free of CORS or 404 errors.

---

## Part 2 — Optional: deploy the backfill proxy

The proxy exists only to pull Acartia's token-gated full history so the 7-day
window is populated at startup rather than filling in as sightings arrive.
Skip this entirely if you do not have an Acartia token.

You need the Acartia Bearer token before starting.

1. Install the Worker's dependencies and deploy it:

   ```sh
   cd workers/acartia-proxy
   npm install
   npx wrangler secret put ACARTIA_TOKEN   # paste the token when prompted
   npx wrangler deploy
   ```

   Wrangler prints the deployed URL, e.g.
   `https://acartia-proxy.<account>.workers.dev`.

2. Restrict which origins may call it from a browser. Add the board's origin to
   `workers/acartia-proxy/wrangler.toml`:

   ```toml
   [vars]
   ALLOWED_ORIGINS = "https://whale-board.<subdomain>.workers.dev"
   ```

   Use a comma-separated list to allow more than one origin (a custom domain,
   say). Then redeploy: `npx wrangler deploy`.

   **Leaving `ALLOWED_ORIGINS` unset means only `localhost` dev origins are
   accepted** — the deployed board would get a 403.

3. Point the board at the proxy. In the board's project settings, add a
   **build** environment variable (Workers: **Settings → Build → Variables and
   Secrets**; Pages: **Settings → Environment variables → Production**):

   ```
   VITE_PROXY_URL = https://acartia-proxy.<account>.workers.dev/sightings
   ```

   This is a *build-time* variable — Vite inlines it into the bundle, so it
   only takes effect on the next build, and it must be set on the **build**
   step rather than as a runtime variable on the deployed Worker. Trigger a
   redeploy (push a commit, or **Retry deployment** in the dashboard). On a CLI
   deploy, set it in the shell instead:

   ```sh
   VITE_PROXY_URL=https://acartia-proxy.<account>.workers.dev/sightings npm run build
   npx wrangler deploy
   ```

4. Verify the proxy independently:

   ```sh
   curl -i https://acartia-proxy.<account>.workers.dev/sightings   # 200, JSON array
   ```

   Then reload the board and confirm no 403 appears in the console.

---

## Custom domain

In the project's dashboard: **Settings → Domains & Routes → Add** (Pages:
**Custom domains → Set up a custom domain**). Enter the hostname and follow the
DNS prompt — if the domain is already on Cloudflare the record is added for
you, otherwise point a `CNAME` at the `workers.dev` / `pages.dev` hostname. TLS
is provisioned automatically.

If you use the proxy, add the new origin to `ALLOWED_ORIGINS` and redeploy the
Worker — otherwise backfill breaks on the custom domain while still working on
the default hostname.

---

## Caching

`public/_headers` ships to `dist/_headers`, and both Workers static assets and
Pages apply it:

- `/assets/*` and `/fonts/*` — immutable, one year. Safe because Vite
  content-hashes those filenames.
- `/art/*` — one day. The filenames are stable, so a shorter TTL lets
  replacement artwork propagate without a rename.
- `/` and `/index.html` — `no-cache`, meaning revalidate every time. This is
  what lets an unattended kiosk pick up a new deploy on its 4 am reload.

There is no `_redirects` file and none is needed: the board is a single route
with no client-side router, so there are no deep links to rewrite.

---

## Updating a deployed board

With the Git integration, push to the production branch. From the CLI:

```sh
npm run deploy
```

Kiosks running fullscreen pick up the new build at their next 4 am reload, or
immediately on a manual refresh.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Build fails on a TypeScript error | The build runs `tsc -b` before Vite. Reproduce with `npm run build` locally and fix the error — the build runner will not skip it. |
| Deploy step fails with a missing-entry-point or no-config error | `npx wrangler deploy` must run from the repo root so it reads `wrangler.jsonc`. Check the project's root directory setting is `/`, not `workers/acartia-proxy`. |
| Deploy succeeds but the Worker returns 404 on every path | `dist/` was empty when `wrangler deploy` ran — the build command did not run first, or it failed silently. Confirm the build step logs `✓ built in …`. |
| Worker name mismatch warning, or a second Worker appears | The dashboard's Worker name must equal `name` in `wrangler.jsonc` (`whale-board`); `wrangler deploy` uses the config value. |
| Board loads but stays empty, console shows CORS errors on `acartia.io` | Upstream availability issue, not a deploy issue. Confirm with `curl https://acartia.io/api/v1/sightings/current`. |
| Console shows `403 forbidden origin` from the Worker | `ALLOWED_ORIGINS` does not include the board's exact origin, scheme included. Update `wrangler.toml` and redeploy the Worker. |
| Backfill never runs after setting `VITE_PROXY_URL` | The variable is inlined at build time. Redeploy so a fresh build picks it up. |
| Art or fonts 404 | Assets must live under `public/` to be copied verbatim into `dist/`. Check `dist/art/` after a local build. |
| Stale board after a deploy | A proxy or browser is ignoring `no-cache` on the shell. Hard-refresh, and confirm `dist/_headers` exists in the build output. |
