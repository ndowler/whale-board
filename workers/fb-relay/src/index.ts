/**
 * fb-relay — hand-entry relay for whale reports posted in Facebook groups.
 *
 * Facebook removed third-party read access to group content (Groups API,
 * April 2024), so there is no legitimate automated feed. This Worker is the
 * honest alternative: a human sees a post, opens the form at `/` on their
 * phone, and relays the essentials. The board polls `GET /reports` alongside
 * Acartia and renders the relayed reports as first-class sightings.
 *
 * Records are stored in Acartia's raw shape (see src/types.ts RawSighting in
 * the SPA) so the board's existing normalizer, comment parser, and near-dupe
 * collapse apply unchanged — a relayed report that later arrives through
 * Acartia (Orca Network group traffic usually does) merges instead of
 * doubling up.
 */

import { FORM_HTML } from './form';

interface Env {
  REPORTS: KVNamespace;
  /** Shared secret required to POST; `wrangler secret put REPORT_TOKEN`. */
  REPORT_TOKEN: string;
  /** Comma-separated origin allowlist; unset → localhost dev origins only. */
  ALLOWED_ORIGINS?: string;
}

/** Mirrors the SPA's Salish Sea ingest bbox — reports outside it would be
 * silently dropped by the board anyway, so reject them loudly here. */
const BBOX = { west: -124.0, south: 46.9, east: -122.0, north: 49.3 };
/** Matches the SPA's maxAgeMs (168 h); KV expires each entry itself. */
const MAX_AGE_MS = 7 * 86_400_000;
const TTL_S = 7 * 86_400;
/** Tolerated phone-clock skew on "just now" reports. */
const MAX_FUTURE_MS = 5 * 60_000;

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function allowedOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get('origin');
  // Non-browser clients (curl, the board's server-side checks) send no
  // Origin; let them through — reads are public data, writes need the token.
  if (origin === null) return '*';
  // The entry form posts from this Worker's own origin.
  if (origin === new URL(req.url).origin) return origin;
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : DEV_ORIGINS;
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'accept, authorization, content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

interface ReportInput {
  species: string;
  lat: number;
  lng: number;
  group: string;
  comment: string;
  count: number | null;
  observedAtMs: number;
}

/** Strict field-by-field validation; returns an error string users can fix. */
export function parseReport(
  body: unknown,
  nowMs: number,
): { ok: true; report: ReportInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null)
    return { ok: false, error: 'body must be a JSON object' };
  const b = body as Record<string, unknown>;

  const species = typeof b.species === 'string' ? b.species.trim() : '';
  if (species === '' || species.length > 60)
    return { ok: false, error: 'species is required (max 60 chars)' };

  const lat = typeof b.lat === 'number' ? b.lat : NaN;
  const lng = typeof b.lng === 'number' ? b.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { ok: false, error: 'lat/lng must be numbers' };
  if (lat < BBOX.south || lat > BBOX.north || lng < BBOX.west || lng > BBOX.east)
    return { ok: false, error: 'position is outside the Salish Sea board area' };

  const group = typeof b.group === 'string' ? b.group.trim() : '';
  if (group === '' || group.length > 80)
    return { ok: false, error: 'group is required (max 80 chars)' };

  const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
  if (comment.length > 500)
    return { ok: false, error: 'comment too long (max 500 chars)' };

  let count: number | null = null;
  if (b.count !== undefined && b.count !== null && b.count !== '') {
    const n = Number(b.count);
    if (!Number.isInteger(n) || n < 1 || n > 500)
      return { ok: false, error: 'count must be a whole number 1–500' };
    count = n;
  }

  let observedAtMs = nowMs;
  if (b.observedAtMs !== undefined) {
    const t = Number(b.observedAtMs);
    if (!Number.isFinite(t)) return { ok: false, error: 'observedAtMs must be a number' };
    if (t > nowMs + MAX_FUTURE_MS) return { ok: false, error: 'sighting time is in the future' };
    if (nowMs - t > MAX_AGE_MS)
      return { ok: false, error: 'sighting is older than the board keeps (7 days)' };
    observedAtMs = Math.min(t, nowMs);
  }

  return { ok: true, report: { species, lat, lng, group, comment, count, observedAtMs } };
}

/** The stored record — Acartia raw shape, so the SPA pipeline reuses as-is. */
export function toRawSighting(r: ReportInput, id: string): Record<string, unknown> {
  return {
    ssemmi_id: id,
    created: new Date(r.observedAtMs).toISOString(),
    type: r.species,
    latitude: r.lat,
    longitude: r.lng,
    no_sighted: r.count,
    trusted: 1,
    data_source_comments: r.comment
      ? `[Facebook: ${r.group}] ${r.comment}`
      : `[Facebook: ${r.group}]`,
    data_source_entity: r.group,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(req, env);
    if (origin === null) return new Response('forbidden origin', { status: 403 });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const path = new URL(req.url).pathname;

    if (path === '/' && req.method === 'GET') {
      return new Response(FORM_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    if (path !== '/reports') return new Response('not found', { status: 404 });

    if (req.method === 'GET') {
      // Tiny volumes: a KV list + parallel gets per poll is well inside free
      // tier at the board's 3-minute cadence. Keys embed the observation
      // epoch (zero-padded) so lexicographic order is chronological.
      const list = await env.REPORTS.list({ prefix: 'r:', limit: 1000 });
      const values = await Promise.all(
        list.keys.map((k) => env.REPORTS.get(k.name, 'json')),
      );
      const records = values.filter((v) => v !== null).reverse(); // newest first
      return json(records, 200, origin);
    }

    if (req.method === 'POST') {
      const auth = req.headers.get('authorization') ?? '';
      if (!env.REPORT_TOKEN || auth !== `Bearer ${env.REPORT_TOKEN}`) {
        return json({ error: 'unauthorized' }, 401, origin);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'body must be JSON' }, 400, origin);
      }

      const parsed = parseReport(body, Date.now());
      if (!parsed.ok) return json({ error: parsed.error }, 400, origin);

      const id = `fb-${crypto.randomUUID()}`;
      const key = `r:${String(parsed.report.observedAtMs).padStart(15, '0')}:${id}`;
      await env.REPORTS.put(key, JSON.stringify(toRawSighting(parsed.report, id)), {
        expirationTtl: TTL_S,
      });
      return json({ ok: true, id }, 201, origin);
    }

    return new Response('method not allowed', { status: 405 });
  },
};
