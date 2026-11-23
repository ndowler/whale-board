import { describe, expect, it } from 'vitest';
import type { Sighting } from '../types';
import { buildTracks, parseHeading } from './tracks';

const T0 = Date.UTC(2026, 6, 7, 12, 0);
const H = 3_600_000;
let n = 0;
function mk(p: Partial<Sighting>): Sighting {
  return {
    id: `s${n++}`, epochMs: T0, species: 'orca_srkw', ecotype: 'srkw', pods: ['J'],
    individuals: [], lat: 47.6, lng: -122.4, count: 10, trusted: 1, comment: '',
    sourceEntity: '', region: null, mergedIds: [], reportCount: 1, ...p,
  };
}

describe('buildTracks', () => {
  it('chains same-pod reports into one track, newest as head', () => {
    const a = mk({ epochMs: T0, lat: 47.3, id: 'a' });
    const b = mk({ epochMs: T0 + H, lat: 47.5, id: 'b' });
    const c = mk({ epochMs: T0 + 2 * H, lat: 47.7, id: 'c', comment: 'J pod northbound' });
    const { tracks, singles } = buildTracks([c, a, b]);
    expect(singles).toHaveLength(0);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(tracks[0].head.id).toBe('c');
    expect(tracks[0].statedHeading).toBe('N');
    expect(tracks[0].reportCount).toBe(3);
  });

  it('does not merge different pods at the same spot', () => {
    const { tracks, singles } = buildTracks([
      mk({ pods: ['J'], epochMs: T0 }),
      mk({ pods: ['K'], epochMs: T0 + H }),
    ]);
    expect(tracks).toHaveLength(0);
    expect(singles).toHaveLength(2);
  });

  it('does not chain "J and K" into a J track', () => {
    const { tracks } = buildTracks([
      mk({ pods: ['J'], epochMs: T0 }),
      mk({ pods: ['J', 'K'], epochMs: T0 + H }),
    ]);
    expect(tracks).toHaveLength(0);
  });

  it('does not link reports with no explicit identity', () => {
    const { tracks, singles } = buildTracks([
      mk({ pods: [], ecotype: null, species: 'orca', epochMs: T0 }),
      mk({ pods: [], ecotype: null, species: 'orca', epochMs: T0 + H }),
    ]);
    expect(tracks).toHaveLength(0);
    expect(singles).toHaveLength(2);
  });

  it('does not link across species', () => {
    const { tracks } = buildTracks([
      mk({ species: 'humpback', ecotype: null, pods: [], individuals: ['BCX2077'] }),
      mk({ species: 'orca', ecotype: null, pods: [], individuals: ['BCX2077'], epochMs: T0 + H }),
    ]);
    expect(tracks).toHaveLength(0);
  });

  it('rejects a hop that is too fast', () => {
    // ~110 km in 30 minutes
    const { tracks, singles } = buildTracks([
      mk({ lat: 47.0, epochMs: T0 }),
      mk({ lat: 48.0, epochMs: T0 + H / 2 }),
    ]);
    expect(tracks).toHaveLength(0);
    expect(singles).toHaveLength(2);
  });

  it('rejects a gap that is too long even when slow', () => {
    const { tracks } = buildTracks([
      mk({ lat: 47.6, epochMs: T0 }),
      mk({ lat: 47.61, epochMs: T0 + 20 * H }),
    ]);
    expect(tracks).toHaveLength(0);
  });

  it('splits one pod into two tracks after an implausible jump', () => {
    const { tracks, singles } = buildTracks([
      mk({ lat: 47.3, epochMs: T0 }),
      mk({ lat: 47.4, epochMs: T0 + H }),
      mk({ lat: 48.9, epochMs: T0 + 2 * H }),
    ]);
    expect(tracks).toHaveLength(1);
    expect(singles).toHaveLength(1);
  });

  it('computes a bearing from the path when no heading is stated', () => {
    const { tracks } = buildTracks([
      mk({ lat: 47.3, epochMs: T0 }),
      mk({ lat: 47.5, epochMs: T0 + H }),
    ]);
    expect(Math.round(tracks[0].bearing!)).toBe(0);
    expect(tracks[0].statedHeading).toBeNull();
  });
});

describe('parseHeading', () => {
  it.each([
    ['J and K pods northbound spread out', 'N'],
    ['Biggs T65A5 southbound towards Point Defiance', 'S'],
    ['T65A5 eastbound', 'E'],
    ['heading west past the dock', 'W'],
    ['off Wing Point traveling southeast.', 'SE'],
    ['milling around trending south', 'S'],
    ['Biggs likely T65A5 NB and surface active', 'N'],
    ['headed north', 'N'],
    ['north-westbound', 'NW'],
  ])('%s → %s', (text, want) => expect(parseHeading(text)).toBe(want));

  it.each(['', null, undefined, 'milling in the north bay', 'Orcas milling'])(
    'no heading in %j',
    (t) => expect(parseHeading(t as string)).toBeNull(),
  );
});
