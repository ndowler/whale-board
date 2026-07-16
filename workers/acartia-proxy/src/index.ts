/**
 * Token-keeping proxy for Acartia's full sightings feed.
 *
 * The board's primary source (`/api/v1/sightings/current`) is keyless and
 * called directly from the browser. The full-history endpoint needs a Bearer
 * token, which must never reach the client bundle — so this Worker holds it
 * (wrangler secret / .dev.vars) and exposes a single read-only route.
 *
 * The upstream feed is ~2.4 MB of ~4 months of history and ignores all query
 * params (verified 2026-07-13, docs/M2-endpoint-findings.md), so the Worker
 * trims to the board's retention window before responding (~100 KB).
 */

interface Env {
  ACARTIA_TOKEN: string;
  /** Comma-separated origin allowlist; unset → localhost dev origins only. */
  ALLOWED_ORIGINS?: string;
}

const UPSTREAM = 'https://acartia.io/api/v1/sightings';
/** Upstream responses are cached this long — protects Acartia from reloads. */
const CACHE_TTL_S = 120;
/** Matches the SPA's maxAgeMs (168 h); older records would be pruned anyway. */
const MAX_AGE_DAYS = 7;

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function allowedOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get('origin');
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : DEV_ORIGINS;
  // Non-browser clients (curl, uptime checks) send no Origin; let them read.
  if (origin === null) return '*';
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'accept',
    vary: 'origin',
  };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = allowedOrigin(req, env);
    if (origin === null) return new Response('forbidden origin', { status: 403 });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (req.method !== 'GET') {
      return new Response('method not allowed', { status: 405 });
    }
    if (new URL(req.url).pathname !== '/sightings') {
      return new Response('not found', { status: 404 });
    }

    // One normalized cache key for every caller; CORS is applied per-response
    // after the cache so per-origin variants are never stored.
    const cacheKey = new Request(UPSTREAM);
    const cache = caches.default;
    let res = await cache.match(cacheKey);

    if (!res) {
      const upstream = await fetch(UPSTREAM, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${env.ACARTIA_TOKEN}`,
        },
      });
      if (!upstream.ok) {
        // Pass the status through (token never echoes); don't cache failures.
        return new Response(`upstream ${upstream.status}`, {
          status: upstream.status,
          headers: corsHeaders(origin),
        });
      }

      const body = await trimToWindow(upstream);
      res = new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': `public, max-age=${CACHE_TTL_S}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }

    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v);
    return out;
  },
};

/**
 * Keep only records whose `created` falls within MAX_AGE_DAYS. The feed's
 * dominant stamp is naive-UTC "YYYY-MM-DD HH:MM:SS"; anything unparseable is
 * kept — the SPA's normalizer is the authority on dropping records.
 */
async function trimToWindow(upstream: Response): Promise<string> {
  const data: unknown = await upstream.json();
  if (!Array.isArray(data)) return JSON.stringify(data);
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const trimmed = data.filter((r) => {
    const created = (r as { created?: unknown }).created;
    if (typeof created !== 'string') return true;
    const ms = Date.parse(created.trim().replace(' ', 'T') + 'Z');
    return Number.isNaN(ms) ? true : ms >= cutoff;
  });
  return JSON.stringify(trimmed);
}
