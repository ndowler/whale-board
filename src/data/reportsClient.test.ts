import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { fetchReports } from './reportsClient';

// Vitest runs with dataMode 'fixture' (DEV), so this exercises the same
// path the dev board uses: committed sample, shifted stamps, channel tag.
describe('fetchReports (fixture mode)', () => {
  it('serves relay reports as facebook-channel sightings with fresh stamps', async () => {
    const sightings = await fetchReports(new AbortController().signal);
    expect(sightings.length).toBeGreaterThan(0);
    for (const s of sightings) {
      expect(s.channel).toBe('facebook');
      expect(s.id.startsWith('fb-')).toBe(true);
      // Shifted into the retention window — newest ~40 min old.
      expect(Date.now() - s.epochMs).toBeLessThan(CONFIG.maxAgeMs);
      expect(Date.now() - s.epochMs).toBeGreaterThan(0);
      // The relay Worker stores the group name as the source entity.
      expect(s.sourceEntity).not.toBe('');
    }
  });

  it('runs relay records through the shared species/comment pipeline', async () => {
    const sightings = await fetchReports(new AbortController().signal);
    const biggs = sightings.find((s) => s.id === 'fb-fixture-1');
    expect(biggs?.species).toBe('orca_biggs');
    expect(biggs?.pods).toContain('T65A');
    const humpback = sightings.find((s) => s.id === 'fb-fixture-2');
    expect(humpback?.species).toBe('humpback');
    expect(humpback?.region).not.toBeNull();
  });
});
