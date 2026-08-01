import { CONFIG, type WindowHours } from '../config';
import type { Sighting, SpeciesId } from '../types';
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

/** Visible (window-filtered, deduped) sightings of one species, newest first. */
export function visibleOfSpecies(
  state: AppState,
  species: SpeciesId,
): Sighting[] {
  return visibleSightings(state).filter((s) => s.species === species);
}

/** Payload to fit the map to a species and ping every on-map icon of it. */
export function speciesFocusAction(
  state: AppState,
  species: SpeciesId,
): { type: 'FOCUS_SPECIES'; ids: string[]; points: [number, number][] } {
  const matches = visibleOfSpecies(state, species);
  return {
    type: 'FOCUS_SPECIES',
    ids: matches.map((s) => s.id),
    points: matches.map((s) => [s.lng, s.lat]),
  };
}

/** Local midnight for the day containing nowMs. */
export function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface SpeciesToday {
  species: SpeciesId;
  /** Collapsed sightings in the active window (post-dedupe). */
  count: number;
  /** Sum of raw reports behind those sightings. */
  reportCount: number;
  latestMs: number;
  /** Newest sighting — the representative (drives region/pods, selection). */
  latest: Sighting;
}

/** Drawer / collage title for the active freshness window. */
export function windowTitle(hours: WindowHours): string {
  switch (hours) {
    case 24:
      return 'Past 24 Hours';
    case 72:
      return 'Past 3 Days';
    case 168:
      return 'Past 7 Days';
  }
}

/** Empty-state copy matching the active window. */
export function windowEmptyLabel(hours: WindowHours): string {
  switch (hours) {
    case 24:
      return 'Nothing in the past 24 hours';
    case 72:
      return 'Nothing in the past 3 days';
    case 168:
      return 'Nothing in the past 7 days';
  }
}

/**
 * Species observed inside the active freshness window, newest group first.
 * Matches the map: same visibleSightings set, grouped by species for the
 * drawer tally and fullscreen collage.
 */
export function seenInWindow(state: AppState): SpeciesToday[] {
  const groups = new Map<SpeciesId, SpeciesToday>();
  for (const s of visibleSightings(state)) {
    const g = groups.get(s.species);
    if (!g) {
      groups.set(s.species, {
        species: s.species,
        count: 1,
        reportCount: s.reportCount,
        latestMs: s.epochMs,
        latest: s,
      });
    } else {
      g.count += 1;
      g.reportCount += s.reportCount;
      // visibleSightings is newest-first, so the first hit is the latest.
    }
  }
  return [...groups.values()].sort((a, b) => b.latestMs - a.latestMs);
}

export interface Decay {
  /** 1 fresh → 0.25 at the window edge — the halo/glow fade (honest age). */
  opacity: number;
  /**
   * 1 fresh → 0.85 at the window edge — the marker body. High floor:
   * the illustrated plates go ghostly below ~0.8 over dark water, so age
   * reads through scale and the halo, not through translucency.
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
    markerOpacity: 1 - 0.15 * age,
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
