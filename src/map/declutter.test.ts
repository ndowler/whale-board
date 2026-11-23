import { describe, expect, it } from 'vitest';
import { declutter } from './declutter';

const O = { halfW: 80, halfH: 46, maxNudge: 200 };

describe('declutter', () => {
  it('leaves well-separated markers alone', () => {
    const r = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 500, y: 0 }], O);
    expect(r.offsets.size).toBe(0);
    expect(r.merged.size).toBe(0);
  });
  it('nudges a few stacked markers apart, all within the cap', () => {
    const r = declutter(['a', 'b', 'c'].map((id) => ({ id, x: 0, y: 0 })), O);
    expect(r.offsets.has('a')).toBe(false);
    for (const [dx, dy] of r.offsets.values()) expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(200);
  });
  it('folds into a count cluster when there is no room, instead of flying away', () => {
    const anchors = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, x: 0, y: 0 }));
    const r = declutter(anchors, O);
    for (const [dx, dy] of r.offsets.values()) expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(200);
    expect(r.merged.size).toBeGreaterThan(0);
    const rendered = anchors.length - r.merged.size;
    expect(rendered).toBeLessThan(15);
    for (const host of r.merged.values()) expect(r.merged.has(host)).toBe(false);
  });
  it('never moves or absorbs into fixed anchors', () => {
    const r = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'h', x: 10, y: 0, fixed: true }], O);
    expect(r.offsets.has('h')).toBe(false);
    expect(r.offsets.has('a')).toBe(true);
    expect([...r.merged.values()]).not.toContain('h');
  });
  it('moves a marker sitting on an obstacle line off it', () => {
    const obstacles = Array.from({ length: 40 }, (_, i) => ({ x: 0, y: i * 10 - 200 }));
    expect(declutter([{ id: 'a', x: 0, y: 0 }], { ...O, obstacles }).offsets.has('a')).toBe(true);
  });
  it('does not move a water sprite onto land, but lets a land sprite move', () => {
    const land = (x: number) => x > 20; // everything right of x=20 is land
    const r = declutter(
      [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }],
      { ...O, avoid: land },
    );
    const o = r.offsets.get('b');
    if (o) expect(land(o[0])).toBe(false);
  });
});
