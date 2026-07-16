import { describe, expect, it } from 'vitest';
import {
  coerceNumber,
  inBbox,
  mergeSightings,
  normalizeBatch,
  normalizeRecord,
  parseCreatedUtc,
  withinWindow,
} from './normalize';
import { CONFIG } from '../config';
import type { RawSighting, Sighting } from '../types';
import fixture from './fixtures/acartia-current.json';

const base: RawSighting = {
  ssemmi_id: 'SPOTTER 1',
  created: '2026-07-13 08:00:00',
  type: 'Orca',
  latitude: '47.6',
  longitude: '-122.45',
  no_sighted: '3',
  trusted: 1,
  data_source_comments: '',
  data_source_entity: 'orcanetwork',
};

describe('coerceNumber', () => {
  it.each([
    [47.6, 47.6],
    ['47.6', 47.6],
    [' -122.45 ', -122.45],
    ['3', 3],
    [0, 0],
    ['', null],
    ['unknown', null],
    [null, null],
    [undefined, null],
    [NaN, null],
    [Infinity, null],
    [{}, null],
  ])('coerces %j → %j', (input, expected) => {
    expect(coerceNumber(input)).toBe(expected);
  });
});

describe('parseCreatedUtc', () => {
  it('treats naive "YYYY-MM-DD HH:MM:SS" as UTC, not local time', () => {
    expect(parseCreatedUtc('2026-07-10 14:03:22')).toBe(
      Date.UTC(2026, 6, 10, 14, 3, 22),
    );
  });

  it('accepts the T-separated naive form', () => {
    expect(parseCreatedUtc('2026-07-10T14:03:22')).toBe(
      Date.UTC(2026, 6, 10, 14, 3, 22),
    );
  });

  it('accepts explicit zone designators', () => {
    expect(parseCreatedUtc('2026-07-10T14:03:22Z')).toBe(
      Date.UTC(2026, 6, 10, 14, 3, 22),
    );
    expect(parseCreatedUtc('2026-07-10T14:03:22+00:00')).toBe(
      Date.UTC(2026, 6, 10, 14, 3, 22),
    );
  });

  it('accepts date-only and minute-precision forms', () => {
    expect(parseCreatedUtc('2026-07-10')).toBe(Date.UTC(2026, 6, 10));
    expect(parseCreatedUtc('2026-07-10 14:03')).toBe(Date.UTC(2026, 6, 10, 14, 3));
  });

  it('rejects garbage', () => {
    expect(parseCreatedUtc('yesterday')).toBeNull();
    expect(parseCreatedUtc('')).toBeNull();
    expect(parseCreatedUtc(1234)).toBeNull();
    expect(parseCreatedUtc(undefined)).toBeNull();
  });
});

describe('inBbox', () => {
  it('accepts Salish Sea points and rejects Monterey', () => {
    expect(inBbox(47.6, -122.45, CONFIG.bbox)).toBe(true);
    expect(inBbox(36.6, -121.9, CONFIG.bbox)).toBe(false);
  });
});

describe('normalizeRecord', () => {
  it('normalizes a healthy record with string coords', () => {
    const s = normalizeRecord(base)!;
    expect(s.id).toBe('SPOTTER 1');
    expect(s.lat).toBe(47.6);
    expect(s.lng).toBe(-122.45);
    expect(s.count).toBe(3);
    expect(s.species).toBe('orca');
    expect(s.epochMs).toBe(Date.UTC(2026, 6, 13, 8));
    expect(s.mergedIds).toEqual([]);
    expect(s.reportCount).toBe(1);
  });

  it('drops records that cannot be displayed', () => {
    expect(normalizeRecord({ ...base, ssemmi_id: '' })).toBeNull();
    expect(normalizeRecord({ ...base, ssemmi_id: undefined })).toBeNull();
    expect(normalizeRecord({ ...base, created: 'unknown' })).toBeNull();
    expect(normalizeRecord({ ...base, latitude: 'unknown' })).toBeNull();
    expect(normalizeRecord({ ...base, latitude: '36.6', longitude: '-121.9' })).toBeNull();
    expect(normalizeRecord({ ...base, latitude: 0, longitude: 0 })).toBeNull();
    expect(normalizeRecord({ ...base, trusted: 0 })).toBeNull();
    expect(normalizeRecord({ ...base, trusted: '0' })).toBeNull();
  });

  it('shows trusted 1 and 2, treating trusted as a level not a boolean', () => {
    expect(normalizeRecord({ ...base, trusted: 1 })).not.toBeNull();
    expect(normalizeRecord({ ...base, trusted: 2 })).not.toBeNull();
    expect(normalizeRecord({ ...base, trusted: '2' })?.trusted).toBe(2);
  });

  it('promotes generic Orca by comment ecotype, but never guesses', () => {
    const biggs = normalizeRecord({
      ...base,
      data_source_comments: '[Orca Network] Biggs T46Bs southbound',
    })!;
    expect(biggs.species).toBe('orca_biggs');
    expect(biggs.ecotype).toBe('biggs');
    expect(biggs.pods).toEqual(['T46B']);

    const srkw = normalizeRecord({
      ...base,
      data_source_comments: 'J pod northbound',
    })!;
    expect(srkw.species).toBe('orca_srkw');

    const bare = normalizeRecord(base)!;
    expect(bare.species).toBe('orca');
    expect(bare.ecotype).toBeNull();
  });

  it('coerces empty/missing count to null', () => {
    expect(normalizeRecord({ ...base, no_sighted: '' })?.count).toBeNull();
    expect(normalizeRecord({ ...base, no_sighted: null })?.count).toBeNull();
  });

  it('warns once per novel species string', () => {
    const warnings: string[] = [];
    normalizeRecord({ ...base, type: 'Cadborosaurus' }, (m) => warnings.push(m));
    normalizeRecord({ ...base, type: 'Cadborosaurus' }, (m) => warnings.push(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Cadborosaurus');
  });

  it('derives a region label', () => {
    expect(normalizeRecord(base)?.region).toBe('Central Puget Sound');
  });
});

describe('normalizeBatch (against the committed fixture)', () => {
  it('survives the full fixture and applies every drop rule', () => {
    const result = normalizeBatch(fixture);
    const ids = result.map((s) => s.id);

    // Dropped: bad latitude, out-of-bbox, trusted:0, missing id.
    expect(ids).not.toContain('SPOTTER 251867');
    expect(ids).not.toContain('SPOTTER 251865');
    expect(ids).not.toContain('SPOTTER 251863');
    expect(ids).not.toContain('');

    // Batch-deduped: the duplicate ssemmi_id keeps the newer record.
    const dup = result.filter((s) => s.id === 'SPOTTER 251921');
    expect(dup).toHaveLength(1);
    expect(dup[0].epochMs).toBe(Date.UTC(2026, 6, 13, 9, 5));
    expect(dup[0].trusted).toBe(2);

    // 32 raw − 4 dropped − 1 dup merged = 27 distinct sightings.
    expect(result).toHaveLength(27);
  });

  it('returns [] for a non-array payload instead of throwing', () => {
    const warnings: string[] = [];
    expect(normalizeBatch({ error: 'nope' }, (m) => warnings.push(m))).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('a malformed record never blanks the batch', () => {
    const result = normalizeBatch([base, null, 42, 'junk']);
    expect(result).toHaveLength(1);
  });
});

describe('mergeSightings', () => {
  const now = Date.UTC(2026, 6, 13, 12);
  const mk = (id: string, epochMs: number): Sighting => ({
    ...(normalizeRecord({ ...base, ssemmi_id: id })! as Sighting),
    epochMs,
  });

  it('reports genuinely new ids and keeps existing ones', () => {
    const a = mk('A', now - 1000);
    const prev = new Map([[a.id, a]]);
    const { next, addedIds } = mergeSightings(prev, [a, mk('B', now - 2000)], now);
    expect(addedIds).toEqual(['B']);
    expect(next.size).toBe(2);
  });

  it('clamps future timestamps to now', () => {
    const { next } = mergeSightings(new Map(), [mk('F', now + 3_600_000)], now);
    expect(next.get('F')!.epochMs).toBe(now);
  });

  it('prunes entries older than maxAge on both sides', () => {
    const old = mk('OLD', now - CONFIG.maxAgeMs - 1);
    const prevStale = mk('STALE', now - CONFIG.maxAgeMs - 1);
    const prev = new Map([[prevStale.id, prevStale]]);
    const { next, addedIds } = mergeSightings(prev, [old, mk('NEW', now)], now);
    expect(next.has('OLD')).toBe(false);
    expect(next.has('STALE')).toBe(false);
    expect(next.has('NEW')).toBe(true);
    expect(addedIds).toEqual(['NEW']);
  });
});

describe('withinWindow', () => {
  const now = Date.UTC(2026, 6, 13, 12);
  it('bounds by window hours', () => {
    const s = { epochMs: now - 25 * 3_600_000 } as Sighting;
    expect(withinWindow(s, now, 24)).toBe(false);
    expect(withinWindow(s, now, 72)).toBe(true);
  });
});
