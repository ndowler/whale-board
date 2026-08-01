import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from './store';
import { normalizeRecord } from '../data/normalize';
import type { Sighting } from '../types';
import { CONFIG } from '../config';
import {
  decay,
  isStale,
  seenInWindow,
  visibleSightings,
  windowTitle,
} from './selectors';

const now = Date.UTC(2026, 6, 13, 12);

function mk(id: string, ageHours: number): Sighting {
  return {
    ...(normalizeRecord({
      ssemmi_id: id,
      created: '2026-07-13 00:00:00',
      type: 'Orca',
      latitude: '47.6',
      longitude: '-122.45',
      no_sighted: '3',
      trusted: 1,
      data_source_comments: '',
      data_source_entity: 'test',
    })! as Sighting),
    epochMs: now - ageHours * 3_600_000,
  };
}

function seeded(): AppState {
  let s = initialState(now);
  s = reducer(s, { type: 'POLL_SUCCESS', sightings: [mk('A', 1)], at: now });
  return s;
}

describe('reducer', () => {
  it('first POLL_SUCCESS populates without flagging arrivals', () => {
    const s = seeded();
    expect(s.sightings.size).toBe(1);
    expect(s.newIds).toEqual([]);
    expect(s.lastSuccessAt).toBe(now);
  });

  it('later polls flag only genuinely new ids', () => {
    let s = seeded();
    s = reducer(s, {
      type: 'POLL_SUCCESS',
      sightings: [mk('A', 1), mk('B', 0)],
      at: now + 60_000,
    });
    expect(s.newIds).toEqual(['B']);
    expect(s.sightings.size).toBe(2);
  });

  it('POLL_ERROR keeps last-good data and counts failures', () => {
    let s = seeded();
    s = reducer(s, { type: 'POLL_ERROR', at: now + 60_000 });
    expect(s.sightings.size).toBe(1);
    expect(s.consecutiveFailures).toBe(1);
    s = reducer(s, {
      type: 'POLL_SUCCESS',
      sightings: [mk('A', 1)],
      at: now + 120_000,
    });
    expect(s.consecutiveFailures).toBe(0);
  });

  it('BACKFILL_SUCCESS merges history without touching poll bookkeeping', () => {
    let s = seeded();
    s = reducer(s, { type: 'POLL_ERROR', at: now + 30_000 });
    const before = {
      lastSuccessAt: s.lastSuccessAt,
      failures: s.consecutiveFailures,
      newIds: s.newIds,
    };
    s = reducer(s, {
      type: 'BACKFILL_SUCCESS',
      sightings: [mk('A', 1), mk('OLD-1', 90)],
      at: now + 60_000,
    });
    expect(s.sightings.size).toBe(2); // exact-id overlap with the poll: one A
    expect(s.lastSuccessAt).toBe(before.lastSuccessAt);
    expect(s.consecutiveFailures).toBe(before.failures);
    expect(s.newIds).toBe(before.newIds);
  });

  it('window changes and selection round-trip', () => {
    let s = seeded();
    s = reducer(s, { type: 'SET_WINDOW', hours: 24 });
    expect(s.windowHours).toBe(24);
    s = reducer(s, { type: 'SELECT', id: 'A' });
    expect(s.selectedId).toBe('A');
    s = reducer(s, { type: 'CLEAR_NEW' });
    expect(s.newIds).toEqual([]);
  });

  it('SET_VIEW switches the board face and clears map-anchored selection', () => {
    let s = seeded();
    s = reducer(s, { type: 'SELECT', id: 'A' });
    s = reducer(s, { type: 'SET_VIEW', view: 'today' });
    expect(s.boardView).toBe('today');
    expect(s.selectedId).toBeNull();
    expect(s.selectedHydroId).toBeNull();
    s = reducer(s, { type: 'SET_VIEW', view: 'map' });
    expect(s.boardView).toBe('map');
  });

  it('FOCUS_SPECIES fits the group: pings ids, clears selection, bumps mapFocus', () => {
    let s = seeded();
    s = reducer(s, { type: 'SELECT', id: 'A' });
    s = reducer(s, {
      type: 'FOCUS_SPECIES',
      ids: ['A', 'B'],
      points: [
        [-122.4, 47.6],
        [-122.5, 47.7],
      ],
    });
    expect(s.selectedId).toBeNull();
    expect(s.highlightIds).toEqual(['A', 'B']);
    expect(s.mapFocus?.seq).toBe(1);
    expect(s.mapFocus?.points).toHaveLength(2);
    s = reducer(s, { type: 'CLEAR_HIGHLIGHT' });
    expect(s.highlightIds).toEqual([]);
    expect(s.mapFocus?.seq).toBe(1); // camera cue stays; only rings clear
  });
});

describe('selectors', () => {
  it('visibleSightings filters by window and sorts newest first', () => {
    let s = initialState(now);
    s = reducer(s, {
      type: 'POLL_SUCCESS',
      sightings: [mk('OLD', 100), mk('MID', 30), mk('NEW', 1)],
      at: now,
    });
    // OLD (100h) sits outside 3d but inside 7d.
    s = { ...s, windowHours: 168 };
    expect(visibleSightings(s).map((x) => x.id)).toEqual(['NEW', 'MID', 'OLD']);
    s = { ...s, windowHours: 72 };
    expect(visibleSightings(s).map((x) => x.id)).toEqual(['NEW', 'MID']);
    s = { ...s, windowHours: 24 };
    expect(visibleSightings(s).map((x) => x.id)).toEqual(['NEW']);
  });

  it('visibleSightings collapses near-dupes at display time (FR-8)', () => {
    let s = initialState(now);
    // Same spot, 5 minutes apart → one animal, two witnesses.
    const a = { ...mk('A', 1), trusted: 2 };
    const b = { ...mk('B', 1), epochMs: a.epochMs - 5 * 60_000 };
    s = reducer(s, { type: 'POLL_SUCCESS', sightings: [a, b], at: now });
    const visible = visibleSightings(s);
    expect(s.sightings.size).toBe(2); // store keeps every raw report
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('A');
    expect(visible[0].reportCount).toBe(2);
  });

  it('decay fades and shrinks with age', () => {
    const fresh = decay(mk('A', 0), now, 72);
    const old = decay(mk('B', 71), now, 72);
    expect(fresh.opacity).toBeCloseTo(1);
    expect(fresh.scale).toBeCloseTo(1);
    expect(old.opacity).toBeLessThan(0.3);
    expect(old.scale).toBeLessThan(0.65);
    expect(decay(mk('C', 500), now, 72).opacity).toBeCloseTo(0.25);
    // Marker body floors much higher — plates go ghostly below ~0.8.
    expect(fresh.markerOpacity).toBeCloseTo(1);
    expect(old.markerOpacity).toBeGreaterThan(0.8);
    expect(decay(mk('C', 500), now, 72).markerOpacity).toBeCloseTo(0.85);
  });

  it('seenInWindow groups by species in the active window, newest first', () => {
    const localNoon = new Date(2026, 6, 13, 12).getTime();
    const at = (ageHours: number, id: string, species?: Sighting['species']) => ({
      ...mk(id, 0),
      epochMs: localNoon - ageHours * 3_600_000,
      ...(species ? { species } : {}),
    });
    let s = initialState(localNoon);
    s = reducer(s, {
      type: 'POLL_SUCCESS',
      sightings: [
        at(1, 'ORCA-NEW'),
        at(3, 'ORCA-OLD'),
        at(2, 'HUMP', 'humpback'),
        at(30, 'OLDER'), // outside 24h, inside 72h
      ],
      at: localNoon,
    });
    s = { ...s, windowHours: 24, nowMs: localNoon };

    const in24 = seenInWindow(s);
    expect(in24.map((g) => g.species)).toEqual(['orca', 'humpback']);
    expect(in24[0].count).toBe(2);
    expect(in24[0].latest.id).toBe('ORCA-NEW');
    expect(visibleSightings(s)).toHaveLength(3);

    s = { ...s, windowHours: 72 };
    const in72 = seenInWindow(s);
    expect(in72.map((g) => g.species)).toEqual(['orca', 'humpback']);
    expect(in72.find((g) => g.species === 'orca')!.count).toBe(3);
    expect(visibleSightings(s)).toHaveLength(4);
    expect(windowTitle(72)).toBe('Past 3 Days');
    expect(windowTitle(24)).toBe('Past 24 Hours');
    expect(windowTitle(168)).toBe('Past 7 Days');
  });

  it('seenInWindow is empty when the window has no sightings', () => {
    const localNoon = new Date(2026, 6, 13, 12).getTime();
    let s = initialState(localNoon);
    expect(seenInWindow(s)).toEqual([]);
    s = reducer(s, {
      type: 'POLL_SUCCESS',
      sightings: [{ ...mk('OLD', 0), epochMs: localNoon - 100 * 3_600_000 }],
      at: localNoon,
    });
    s = { ...s, windowHours: 72, nowMs: localNoon };
    expect(seenInWindow(s)).toEqual([]);
  });

  it('isStale trips after staleAfterMs without a successful poll', () => {
    let s = seeded();
    expect(isStale(s)).toBe(false);
    s = reducer(s, { type: 'TICK', now: now + CONFIG.staleAfterMs + 1 });
    expect(isStale(s)).toBe(true);
  });
});
