import { describe, expect, it } from 'vitest';
import { collapseNearDupes, haversineKm } from './dedupe';
import type { Sighting, SpeciesId } from '../types';

const now = Date.UTC(2026, 6, 13, 12);
const OPTS = { distanceKm: 0.5, windowMs: 15 * 60_000 };

// ~0.001° latitude ≈ 111 m; longitude scaled by cos(47.6°) ≈ 75 m per 0.001°.
const BASE_LAT = 47.6;
const BASE_LNG = -122.45;

function mk(id: string, over: Partial<Sighting> = {}): Sighting {
  return {
    id,
    epochMs: now,
    species: 'orca' as SpeciesId,
    ecotype: null,
    pods: [],
    individuals: [],
    lat: BASE_LAT,
    lng: BASE_LNG,
    count: null,
    trusted: 1,
    comment: '',
    sourceEntity: 'test',
    region: null,
    mergedIds: [],
    reportCount: 1,
    ...over,
  };
}

describe('haversineKm', () => {
  it('matches a known pair', () => {
    // Seattle → Tacoma is ~40 km.
    expect(haversineKm(47.6062, -122.3321, 47.2529, -122.4443)).toBeCloseTo(40, -1);
    expect(haversineKm(47.6, -122.45, 47.6, -122.45)).toBe(0);
  });
});

describe('collapseNearDupes', () => {
  it('passes empty and singleton input through', () => {
    expect(collapseNearDupes([], OPTS)).toEqual([]);
    const one = [mk('A')];
    expect(collapseNearDupes(one, OPTS)).toEqual(one);
  });

  it('merges same species at ~400 m and 10 min apart', () => {
    const a = mk('A', { trusted: 2 });
    const b = mk('B', {
      lat: BASE_LAT + 0.0036, // ~400 m north
      epochMs: now - 10 * 60_000,
    });
    const out = collapseNearDupes([a, b], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('A');
    expect(out[0].mergedIds).toEqual(['B']);
    expect(out[0].reportCount).toBe(2);
  });

  it('keeps reports separate beyond the distance threshold (~600 m)', () => {
    const out = collapseNearDupes([mk('A'), mk('B', { lat: BASE_LAT + 0.0054 })], OPTS);
    expect(out).toHaveLength(2);
  });

  it('keeps reports separate beyond the time threshold (16 min)', () => {
    const out = collapseNearDupes(
      [mk('A'), mk('B', { epochMs: now - 16 * 60_000 })],
      OPTS,
    );
    expect(out).toHaveLength(2);
  });

  it('never merges different species', () => {
    const out = collapseNearDupes([mk('A'), mk('B', { species: 'humpback' })], OPTS);
    expect(out).toHaveLength(2);
  });

  it('never merges conflicting orca ecotypes', () => {
    const out = collapseNearDupes(
      [
        mk('A', { species: 'orca_biggs', ecotype: 'biggs' }),
        mk('B', { species: 'orca_srkw', ecotype: 'srkw' }),
      ],
      OPTS,
    );
    expect(out).toHaveLength(2);
  });

  it('higher trusted wins and keeps its own position and id', () => {
    const winner = mk('W', { trusted: 2, lat: BASE_LAT + 0.001 });
    const loser = mk('L', { trusted: 1, epochMs: now + 5 * 60_000 });
    const out = collapseNearDupes([loser, winner], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('W');
    expect(out[0].lat).toBe(BASE_LAT + 0.001);
  });

  it('generic orca absorbs an ecotyped report and upgrades', () => {
    const generic = mk('A', { trusted: 2 });
    const biggs = mk('B', {
      species: 'orca_biggs',
      ecotype: 'biggs',
      pods: ['T46B'],
    });
    const out = collapseNearDupes([generic, biggs], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('A');
    expect(out[0].species).toBe('orca_biggs');
    expect(out[0].ecotype).toBe('biggs');
    expect(out[0].pods).toEqual(['T46B']);
  });

  it('unions pods/individuals and takes max count', () => {
    const a = mk('A', { trusted: 2, pods: ['J'], count: 3 });
    const b = mk('B', { pods: ['J', 'K'], individuals: ['J35'], count: 7 });
    const out = collapseNearDupes([a, b], OPTS);
    expect(out).toHaveLength(1);
    expect([...out[0].pods].sort()).toEqual(['J', 'K']);
    expect(out[0].individuals).toEqual(['J35']);
    expect(out[0].count).toBe(7);
  });

  it('does not chain transitively: A~B, B~C, A!~C → two clusters', () => {
    // A (seed, best) absorbs B (400 m away); C is 800 m from A so it seeds
    // its own cluster even though it is only 400 m from B.
    const a = mk('A', { trusted: 2 });
    const b = mk('B', { lat: BASE_LAT + 0.0036 });
    const c = mk('C', { lat: BASE_LAT + 0.0072 });
    const out = collapseNearDupes([a, b, c], OPTS);
    expect(out).toHaveLength(2);
    const ids = out.map((s) => s.id).sort();
    expect(ids).toEqual(['A', 'C']);
  });
});
