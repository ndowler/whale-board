import { describe, expect, it } from 'vitest';
import { regionFor, ZONES } from './regions';

describe('regionFor', () => {
  it.each([
    [47.576, -122.44, 'Central Puget Sound'], // off Alki Point
    [47.302, -122.541, 'South Puget Sound'], // off Point Defiance
    [48.516, -123.17, 'Haro Strait'], // off Lime Kiln
    [47.912, -122.527, 'Admiralty Inlet'], // off Point No Point
    [47.671, -122.822, 'Hood Canal'], // Dabob-ish
    [48.19, -122.5, 'Possession Sound & Whidbey Basin'], // Saratoga Passage
    [48.25, -123.3, 'Strait of Juan de Fuca'],
    [48.612, -122.94, 'San Juan Islands'], // San Juan Channel
    [48.44, -122.669, 'Rosario Strait'],
    [48.72, -122.551, 'Bellingham Bay'],
    [48.991, -123.34, 'Boundary Pass & Gulf Islands'],
    [49.14, -123.4, 'Strait of Georgia'],
  ])('(%f, %f) → %s', (lat, lng, expected) => {
    expect(regionFor(lat, lng)).toBe(expected);
  });

  it('returns null outside every zone', () => {
    expect(regionFor(36.6, -121.9)).toBeNull(); // Monterey
    expect(regionFor(0, 0)).toBeNull();
  });

  it('every zone has a name and a label anchor inside itself', () => {
    for (const z of ZONES) {
      expect(z.name.length).toBeGreaterThan(0);
      const [lng, lat] = z.labelAnchor;
      expect(regionFor(lat, lng)).toBeTruthy();
    }
  });
});
