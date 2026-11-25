import { describe, expect, it } from 'vitest';
import { clusterGlow, clusterMarkers } from './cluster';
import type { Sighting, SpeciesId } from '../types';

function mk(id: string, lng: number, lat: number, species: SpeciesId = 'orca'): Sighting {
  return {
    id,
    epochMs: 1_700_000_000_000,
    species,
    ecotype: null,
    pods: [],
    individuals: [],
    lat,
    lng,
    count: null,
    trusted: 1,
    comment: '',
    sourceEntity: 'test',
    region: null,
    mergedIds: [],
    reportCount: 1,
  };
}

// Identity projection so lng/lat act directly as SVG px.
const idProject = ([x, y]: [number, number]): [number, number] => [x, y];

describe('clusterMarkers', () => {
  it('merges same-species sightings within screen radius and splits on zoom', () => {
    const sightings = [mk('new', 0, 0), mk('near', 40, 0), mk('far', 120, 0)];

    const zoomedOut = clusterMarkers(sightings, idProject, 1, 58);
    expect(zoomedOut.map((c) => [c.lead.id, c.items.length])).toEqual([
      ['new', 2],
      ['far', 1],
    ]);

    // At 2x zoom, 40 SVG px becomes 80 screen px (> 58) — splits apart.
    const zoomedIn = clusterMarkers(sightings, idProject, 2, 58);
    expect(zoomedIn.map((c) => [c.lead.id, c.items.length])).toEqual([
      ['new', 1],
      ['near', 1],
      ['far', 1],
    ]);
  });

  it('never merges different species even at identical coordinates', () => {
    const sightings = [mk('a', 10, 10, 'orca_srkw'), mk('b', 10, 10, 'orca_biggs')];
    const clusters = clusterMarkers(sightings, idProject, 1, 58);
    expect(clusters).toHaveLength(2);
  });

  it('reuses clusters while sightings, projection, and zoom stay the same', () => {
    const sightings = [mk('a', 0, 0), mk('b', 30, 0)];
    const first = clusterMarkers(sightings, idProject, 1);
    expect(clusterMarkers(sightings, idProject, 1)).toBe(first);
    expect(clusterMarkers(sightings, idProject, 2)).not.toBe(first);
    expect(clusterMarkers([...sightings], idProject, 1)).not.toBe(first);
  });
});

describe('clusterGlow', () => {
  it('leaves a single sighting unchanged and caps a dense cluster', () => {
    expect(clusterGlow(10, 0.5, 1)).toEqual({ r: 10, opacity: 0.5 });
    const pair = clusterGlow(10, 0.8, 2);
    expect(pair.r).toBeCloseTo(10 * 1.12);
    expect(pair.opacity).toBeCloseTo(0.8 * 1.18);
    const packed = clusterGlow(10, 0.9, 2 ** 20);
    expect(packed.r).toBeCloseTo(10 * 1.45);
    expect(packed.opacity).toBe(1);
  });
});
