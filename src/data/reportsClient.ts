import { CONFIG } from '../config';
import type { RawSighting, Sighting } from '../types';
import { normalizeBatch, type WarnFn } from './normalize';
import { shiftToRecent } from './acartiaClient';

/**
 * Community reports relayed from Facebook groups via the fb-relay Worker
 * (workers/fb-relay). The Worker stores hand-entered reports in Acartia's
 * raw record shape, so the shared normalizer — species table, pod/ecotype
 * comment parsing, region lookup, bbox and trust gates — applies unchanged;
 * the only addition is the 'facebook' channel tag that drives the popover's
 * source credit. Near-dupe collapse then merges a relayed report with the
 * same sighting arriving later through Acartia.
 *
 * 'fixture' mode serves the committed sample with timestamps shifted so the
 * newest report is always ~40 minutes old.
 */
export async function fetchReports(
  signal: AbortSignal,
  warn: WarnFn = () => {},
): Promise<Sighting[]> {
  const payload =
    CONFIG.dataMode === 'fixture'
      ? await fetchFixture(signal)
      : await fetchLive(signal);
  return normalizeBatch(payload, warn).map((s) => ({
    ...s,
    channel: 'facebook' as const,
  }));
}

async function fetchLive(signal: AbortSignal): Promise<unknown> {
  const res = await fetch(CONFIG.reports.url, {
    signal,
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`fb-relay responded HTTP ${res.status}`);
  return res.json();
}

async function fetchFixture(signal: AbortSignal): Promise<unknown> {
  const { default: fixture } = await import('./fixtures/fb-reports.json');
  await new Promise((r) => setTimeout(r, 300));
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  return shiftToRecent(fixture as RawSighting[], 40 * 60_000);
}
