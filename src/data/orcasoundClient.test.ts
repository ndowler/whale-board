import { describe, expect, it } from 'vitest';
import { normalizeAcoustic } from './orcasoundClient';
import { initialState, reducer } from '../state/store';
import { hydroStatuses } from '../state/selectors';
import { CONFIG } from '../config';
import type { AcousticDetection, Hydrophone } from '../types';
import fixture from './fixtures/orcasound-acoustic.json';

const now = Date.UTC(2026, 6, 13, 12);

const feed = (id: string, over: Partial<Hydrophone> = {}) => ({
  id,
  name: `Node ${id}`,
  slug: id,
  lat: 47.5,
  lng: -122.4,
  online: true,
  ...over,
});

const det = (
  id: string,
  feedId: string,
  ageMs: number,
  source: 'MACHINE' | 'HUMAN' = 'MACHINE',
): AcousticDetection => ({ id, feedId, epochMs: now - ageMs, source });

describe('normalizeAcoustic', () => {
  it('parses the committed fixture', () => {
    const { hydrophones, detections } = normalizeAcoustic(fixture);
    expect(hydrophones.length).toBeGreaterThanOrEqual(7);
    expect(detections.length).toBeGreaterThan(50);
    for (const h of hydrophones) {
      expect(Number.isFinite(h.lat)).toBe(true);
      expect(Number.isFinite(h.lng)).toBe(true);
      expect(h.slug).toBeTruthy();
    }
    for (const d of detections) {
      expect(d.feedId).toMatch(/^feed_/);
      expect(Number.isFinite(d.epochMs)).toBe(true);
    }
  });

  it('drops malformed rows instead of throwing', () => {
    const { hydrophones, detections } = normalizeAcoustic({
      data: {
        feeds: [
          { id: 'f1', name: 'ok', slug: 'ok', latLng: { lat: '47.1', lng: '-122.2' } },
          { id: 'f2', slug: 'no-coords', latLng: { lat: 'nope', lng: null } },
          { id: 'f3', slug: 'hidden', visible: false, latLng: { lat: 47, lng: -122 } },
          null,
        ],
        detections: {
          results: [
            { id: 'd1', feedId: 'f1', timestamp: '2026-07-13T10:00:00Z', source: 'HUMAN' },
            { id: 'd2', feedId: 'f1', timestamp: 'garbage' },
            { id: 'd3', timestamp: '2026-07-13T10:00:00Z' },
          ],
        },
      },
    });
    expect(hydrophones.map((h) => h.id)).toEqual(['f1']);
    expect(hydrophones[0].lat).toBeCloseTo(47.1);
    expect(detections.map((d) => d.id)).toEqual(['d1']);
    expect(detections[0].source).toBe('HUMAN');
  });

  it('survives an empty or error payload', () => {
    expect(normalizeAcoustic(null)).toEqual({ hydrophones: [], detections: [] });
    expect(normalizeAcoustic({ errors: [{ message: 'boom' }] })).toEqual({
      hydrophones: [],
      detections: [],
    });
  });
});

describe('ACOUSTIC_SUCCESS + hydroStatuses', () => {
  it('retains only detections inside the heard window', () => {
    let s = initialState(now);
    s = reducer(s, {
      type: 'ACOUSTIC_SUCCESS',
      hydrophones: [feed('f1')],
      detections: [
        det('fresh', 'f1', 5 * 60_000),
        det('stale', 'f1', CONFIG.acoustic.heardWindowMs + 60_000),
      ],
      at: now,
    });
    expect(s.detections.map((d) => d.id)).toEqual(['fresh']);
  });

  it('derives idle / heard / hot per hydrophone', () => {
    let s = initialState(now);
    s = reducer(s, {
      type: 'ACOUSTIC_SUCCESS',
      hydrophones: [feed('hot'), feed('heard'), feed('idle')],
      detections: [
        det('d1', 'hot', 10 * 60_000),
        det('d2', 'heard', 2 * 3_600_000, 'HUMAN'),
      ],
      at: now,
    });
    const st = hydroStatuses(s);
    expect(st.get('hot')).toMatchObject({ hot: true, heard: true });
    expect(st.get('heard')).toMatchObject({
      hot: false,
      heard: true,
      humanConfirmed: true,
    });
    expect(st.get('idle')).toMatchObject({
      hot: false,
      heard: false,
      lastHeardMs: null,
    });
  });

  it('selecting a hydrophone clears the sighting selection and vice versa', () => {
    let s = initialState(now);
    s = reducer(s, { type: 'SELECT', id: 'A' });
    s = reducer(s, { type: 'SELECT_HYDRO', id: 'f1' });
    expect(s.selectedId).toBeNull();
    expect(s.selectedHydroId).toBe('f1');
    s = reducer(s, { type: 'SELECT', id: 'B' });
    expect(s.selectedHydroId).toBeNull();
    expect(s.selectedId).toBe('B');
  });
});
