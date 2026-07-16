import { useEffect, type Dispatch } from 'react';
import { CONFIG } from '../config';
import type { Action } from '../state/store';
import { fetchBackfill, fetchSightings } from './acartiaClient';
import { fetchAcoustic } from './orcasoundClient';
import { normalizeBatch } from './normalize';

/**
 * The poll loop the kiosk's reliability depends on.
 *
 * Chained setTimeout — never setInterval — so a throttled background tab
 * can't queue a burst of stale attempts; each next fire is scheduled only
 * after the previous attempt settles. Failures back off along
 * CONFIG.backoffMs and stick at its last entry; the store keeps last-good
 * data throughout. Returning visibility or connectivity triggers an
 * immediate catch-up poll when the data is older than one interval.
 */
export function usePollingLoop(dispatch: Dispatch<Action>) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    let failures = 0;
    let lastSuccessAt = 0;
    let inFlight = false;
    let disposed = false;

    const schedule = (ms: number) => {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(attempt, ms);
    };

    const attempt = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      ctrl = new AbortController();
      const killer = setTimeout(() => ctrl?.abort(), CONFIG.fetchTimeoutMs);
      try {
        const payload = await fetchSightings(ctrl.signal);
        if (disposed) return;
        const sightings = normalizeBatch(payload, (m) =>
          console.warn(`[whale-board] ${m}`),
        );
        failures = 0;
        lastSuccessAt = Date.now();
        dispatch({ type: 'POLL_SUCCESS', sightings, at: lastSuccessAt });
        schedule(CONFIG.pollIntervalMs);
      } catch {
        if (disposed) return;
        failures += 1;
        dispatch({ type: 'POLL_ERROR', at: Date.now() });
        const i = Math.min(failures - 1, CONFIG.backoffMs.length - 1);
        schedule(CONFIG.backoffMs[i]);
      } finally {
        clearTimeout(killer);
        inFlight = false;
      }
    };

    const catchUp = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSuccessAt > CONFIG.pollIntervalMs) void attempt();
    };
    const onOnline = () => void attempt();

    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('online', onOnline);
    void attempt();

    return () => {
      disposed = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('online', onOnline);
    };
  }, [dispatch]);
}

/**
 * History backfill from the token-gated full feed (via the proxy Worker).
 * Disabled when CONFIG.proxyUrl is empty. One fetch on mount — plus a slow
 * chained-setTimeout refresh when backfillRefreshMs is set. Strictly
 * best-effort: any failure is a console warning and nothing more, because
 * the board is fully functional on /current alone (FR-2 spirit).
 */
export function useBackfill(dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (!CONFIG.proxyUrl) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    let disposed = false;

    const attempt = async () => {
      ctrl = new AbortController();
      const killer = setTimeout(() => ctrl?.abort(), CONFIG.backfillTimeoutMs);
      try {
        const payload = await fetchBackfill(ctrl.signal);
        if (disposed) return;
        const sightings = normalizeBatch(payload, (m) =>
          console.warn(`[whale-board] ${m}`),
        );
        dispatch({ type: 'BACKFILL_SUCCESS', sightings, at: Date.now() });
      } catch (err) {
        if (!disposed)
          console.warn(`[whale-board] backfill unavailable: ${String(err)}`);
      } finally {
        clearTimeout(killer);
        if (!disposed && CONFIG.backfillRefreshMs !== null) {
          clearTimeout(timer);
          timer = setTimeout(attempt, CONFIG.backfillRefreshMs);
        }
      }
    };

    void attempt();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [dispatch]);
}

/**
 * Acoustic side-channel: same chained-setTimeout discipline, deliberately
 * simpler — the layer is decorative, so failures retry on the next interval
 * without a backoff ladder and never surface an error state.
 */
export function useAcousticLoop(dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (!CONFIG.acoustic.enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    let disposed = false;

    const attempt = async () => {
      ctrl = new AbortController();
      const killer = setTimeout(() => ctrl?.abort(), CONFIG.fetchTimeoutMs);
      try {
        const { hydrophones, detections } = await fetchAcoustic(ctrl.signal);
        if (disposed) return;
        dispatch({
          type: 'ACOUSTIC_SUCCESS',
          hydrophones,
          detections,
          at: Date.now(),
        });
      } catch {
        // silent — last-good hydrophone state simply ages out
      } finally {
        clearTimeout(killer);
        if (!disposed) {
          clearTimeout(timer);
          timer = setTimeout(attempt, CONFIG.pollIntervalMs);
        }
      }
    };

    void attempt();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [dispatch]);
}

/** 30-second UI clock: time-ago labels, decay, staleness all derive from it. */
export function useClock(dispatch: Dispatch<Action>) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      dispatch({ type: 'TICK', now: Date.now() });
      timer = setTimeout(tick, CONFIG.tickMs);
    };
    timer = setTimeout(tick, CONFIG.tickMs);
    return () => clearTimeout(timer);
  }, [dispatch]);
}
