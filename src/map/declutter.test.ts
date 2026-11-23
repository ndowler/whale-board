import { describe, expect, it } from 'vitest';
import { declutter } from './declutter';

describe('declutter', () => {
  it('leaves well-separated markers alone', () => {
    expect(declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 500, y: 0 }], 100).size).toBe(0);
  });
  it('moves the later of two stacked markers until clear of all others', () => {
    const anchors = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
      { id: 'c', x: 0, y: 0 },
    ];
    const off = declutter(anchors, 100);
    expect(off.has('a')).toBe(false);
    const pos = anchors.map((a) => {
      const o = off.get(a.id) ?? [0, 0];
      return [a.x + o[0], a.y + o[1]];
    });
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++)
        expect(Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])).toBeGreaterThanOrEqual(99.9);
  });
  it('never moves fixed anchors, even when listed later', () => {
    const off = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'h', x: 10, y: 0, fixed: true }], 100);
    expect(off.has('h')).toBe(false);
    expect(off.has('a')).toBe(true);
  });
});
