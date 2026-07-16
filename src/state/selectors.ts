import { CONFIG } from '../config';
import type { Sighting } from '../types';
import { withinWindow } from '../data/normalize';
import { collapseNearDupes } from '../data/dedupe';
import type { AppState } from './store';

/**
 * Sightings inside the active freshness window, near-dupes collapsed (FR-8),
 * newest first. Dedupe runs here — at display time — so the store stays a
 * faithful id-keyed cache of every report.
 */
export function visibleSightings(state: AppState): Sighting[] {
  const out: Sighting[] = [];
  for (const s of state.sightings.values()) {
    if (withinWindow(s, state.nowMs, state.windowHours)) out.push(s);
  }
  const collapsed = collapseNearDupes(out);
  collapsed.sort((a, b) => b.epochMs - a.epochMs);
  return collapsed;
}

export interface Decay {
  /** 1 fresh → 0.25 at the window edge — the halo/glow fade (honest age). */
  opacity: number;
  /**
   * 1 fresh → 0.65 at the window edge — the marker body. Gentler floor:
   * the illustrated plates go ghostly below ~0.6 over dark water, so age
   * reads mainly through scale and the halo, not through translucency.
   */
  markerOpacity: number;
  /** 1 fresh → 0.6 at the window edge */
  scale: number;
  /** age as fraction of the window, clamped 0..1 */
  age: number;
}

export function decay(s: Sighting, nowMs: number, windowHours: number): Decay {
  const windowMs = windowHours * 3_600_000;
  const age = Math.min(1, Math.max(0, (nowMs - s.epochMs) / windowMs));
  return {
    opacity: 1 - 0.75 * age,
    markerOpacity: 1 - 0.35 * age,
    scale: 1 - 0.4 * age,
    age,
  };
}

export interface HydroStatus {
  /** Newest whale detection on this hydrophone, or null. */
  lastHeardMs: number | null;
  /** True when any listener (human) row backs the detection window. */
  humanConfirmed: boolean;
  /** Detection within CONFIG.acoustic.hotMs — active pulse. */
  hot: boolean;
  /** Detection within the heard window — lit tint. */
  heard: boolean;
}

/** Per-hydrophone acoustic state derived from the retained detections. */
export function hydroStatuses(state: AppState): Map<string, HydroStatus> {
  const out = new Map<string, HydroStatus>();
  for (const h of state.hydrophones) {
    out.set(h.id, {
      lastHeardMs: null,
      humanConfirmed: false,
      hot: false,
      heard: false,
    });
  }
  for (const d of state.detections) {
    const s = out.get(d.feedId);
    if (!s) continue;
    if (s.lastHeardMs === null || d.epochMs > s.lastHeardMs)
      s.lastHeardMs = d.epochMs;
    if (d.source === 'HUMAN') s.humanConfirmed = true;
  }
  for (const s of out.values()) {
    if (s.lastHeardMs === null) continue;
    const age = state.nowMs - s.lastHeardMs;
    s.heard = age <= CONFIG.acoustic.heardWindowMs;
    s.hot = age <= CONFIG.acoustic.hotMs;
  }
  return out;
}

export function isStale(state: AppState): boolean {
  if (state.lastSuccessAt === null) return state.consecutiveFailures > 0;
  return state.nowMs - state.lastSuccessAt > CONFIG.staleAfterMs;
}

export function timeAgo(epochMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - epochMs) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function clockLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
