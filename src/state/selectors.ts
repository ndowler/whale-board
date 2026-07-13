import { CONFIG } from '../config';
import type { Sighting } from '../types';
import { withinWindow } from '../data/normalize';
import type { AppState } from './store';

/** Sightings inside the active freshness window, newest first. */
export function visibleSightings(state: AppState): Sighting[] {
  const out: Sighting[] = [];
  for (const s of state.sightings.values()) {
    if (withinWindow(s, state.nowMs, state.windowHours)) out.push(s);
  }
  out.sort((a, b) => b.epochMs - a.epochMs);
  return out;
}

export interface Decay {
  /** 1 fresh → 0.25 at the window edge */
  opacity: number;
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
    scale: 1 - 0.4 * age,
    age,
  };
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
