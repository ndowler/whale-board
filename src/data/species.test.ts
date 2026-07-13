import { describe, expect, it } from 'vitest';
import { mapSpecies } from './species';

describe('mapSpecies', () => {
  it('maps observed live-feed values', () => {
    expect(mapSpecies('Orca').species).toBe('orca');
    expect(mapSpecies('Humpback').species).toBe('humpback');
    expect(mapSpecies('Blue Whale').species).toBe('blue_whale');
    expect(mapSpecies('Fin Whale').species).toBe('fin_whale');
    expect(mapSpecies('Minke Whale').species).toBe('minke');
    expect(mapSpecies('Harbor Porpoise').species).toBe('harbor_porpoise');
    expect(mapSpecies('Pacific White-sided Dolphin').species).toBe(
      'pacific_white_sided_dolphin',
    );
    expect(mapSpecies("Dall's Porpoise").species).toBe('dalls_porpoise');
  });

  it('merges the observed label drift: "Gray" and "Gray Whale"', () => {
    expect(mapSpecies('Gray').species).toBe('gray_whale');
    expect(mapSpecies('Gray Whale').species).toBe('gray_whale');
    expect(mapSpecies('grey whale').species).toBe('gray_whale');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(mapSpecies('  ORCA  ').species).toBe('orca');
    expect(mapSpecies('killer whale').species).toBe('orca');
  });

  it('treats Unspecified as a real category, not an error', () => {
    const r = mapSpecies('Unspecified');
    expect(r.species).toBe('unspecified');
    expect(r.matched).toBe(true);
  });

  it('falls back by substring for decorated strings', () => {
    expect(mapSpecies('Humpback Whale (mother/calf)').species).toBe('humpback');
    expect(mapSpecies('Probable Minke').species).toBe('minke');
  });

  it('routes novel strings to unknown_cetacean with matched:false', () => {
    const r = mapSpecies('Sea Serpent');
    expect(r.species).toBe('unknown_cetacean');
    expect(r.matched).toBe(false);
  });

  it('treats empty/non-string as unspecified', () => {
    expect(mapSpecies('').species).toBe('unspecified');
    expect(mapSpecies(undefined).species).toBe('unspecified');
    expect(mapSpecies(null).species).toBe('unspecified');
    expect(mapSpecies(undefined).matched).toBe(false);
  });
});
