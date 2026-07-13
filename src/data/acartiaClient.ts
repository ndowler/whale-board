import { CONFIG } from '../config';
import { parseCreatedUtc } from './normalize';
import type { RawSighting } from '../types';

/**
 * Fetch the raw sightings payload.
 *
 * 'live' mode calls acartia.io directly — the endpoint is keyless and sends
 * CORS `*`. 'fixture' mode serves the committed capture with timestamps
 * shifted so the newest record is always ~20 minutes old, keeping the dev
 * board alive regardless of the calendar. `?demo=1` additionally injects a
 * synthetic fresh sighting on every later poll to exercise the arrival path.
 */
export async function fetchSightings(signal: AbortSignal): Promise<unknown> {
  if (CONFIG.dataMode === 'fixture') return fetchFixture(signal);
  const res = await fetch(CONFIG.apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Acartia responded HTTP ${res.status}`);
  return res.json();
}

let demoCounter = 0;

const DEMO_SPOTS: Array<[number, number, string]> = [
  [47.33, -122.52, 'Dalco Passage'],
  [47.6, -122.46, 'off Alki'],
  [48.5, -123.15, 'Haro Strait'],
  [48.05, -122.63, 'off Marrowstone'],
  [47.17, -122.88, 'Case Inlet'],
];

const DEMO_TYPES = ['Orca', 'Humpback', 'Gray Whale', 'Minke Whale'];
const DEMO_COMMENTS = [
  '[demo] Biggs T99s traveling north',
  '[demo] J pod spread out, foraging',
  '[demo] single whale, direction unknown',
  '[demo] breaching repeatedly',
];

async function fetchFixture(signal: AbortSignal): Promise<unknown> {
  const { default: fixture } = await import('./fixtures/acartia-current.json');
  // Simulated latency keeps loading states honest in dev.
  await new Promise((r) => setTimeout(r, 300));
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  const records = (fixture as RawSighting[]).map((r) => ({ ...r }));
  const epochs = records
    .map((r) => parseCreatedUtc(r.created))
    .filter((e): e is number => e !== null);
  const newest = Math.max(...epochs);
  const shift = Date.now() - 20 * 60_000 - newest;
  for (const r of records) {
    const e = parseCreatedUtc(r.created);
    if (e !== null) r.created = new Date(e + shift).toISOString();
  }

  if (new URLSearchParams(location.search).get('demo') === '1') {
    if (demoCounter > 0) {
      const i = (demoCounter - 1) % DEMO_SPOTS.length;
      const [lat, lng, where] = DEMO_SPOTS[i];
      records.push({
        ssemmi_id: `DEMO ${demoCounter}`,
        created: new Date(Date.now() - 2 * 60_000).toISOString(),
        type: DEMO_TYPES[(demoCounter - 1) % DEMO_TYPES.length],
        latitude: String(lat + (Math.random() - 0.5) * 0.02),
        longitude: String(lng + (Math.random() - 0.5) * 0.02),
        no_sighted: String(1 + Math.floor(Math.random() * 8)),
        trusted: 1,
        data_source_comments: `${DEMO_COMMENTS[(demoCounter - 1) % DEMO_COMMENTS.length]} — ${where}`,
        data_source_entity: 'demo',
      });
    }
    demoCounter += 1;
  }

  return records;
}
