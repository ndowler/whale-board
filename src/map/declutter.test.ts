import { describe, expect, it } from 'vitest';
import { declutter } from './declutter';

const O = { halfW: 80, halfH: 46 };

describe('declutter', () => {
  it('leaves well-separated markers alone', () => {
    expect(declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 500, y: 0 }], O).size).toBe(0);
  });
  it('spreads three stacked markers until no two sprites overlap', () => {
    const anchors = ['a', 'b', 'c'].map((id) => ({ id, x: 0, y: 0 }));
    const off = declutter(anchors, O);
    expect(off.has('a')).toBe(false);
    const pos = anchors.map((a) => {
      const o = off.get(a.id) ?? [0, 0];
      return [o[0], o[1]];
    });
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++)
        expect(
          ((pos[i][0] - pos[j][0]) / 160) ** 2 + ((pos[i][1] - pos[j][1]) / 92) ** 2,
        ).toBeGreaterThanOrEqual(1);
  });
  it('never moves fixed anchors', () => {
    const off = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'h', x: 10, y: 0, fixed: true }], O);
    expect(off.has('h')).toBe(false);
    expect(off.has('a')).toBe(true);
  });
  it('moves a marker sitting on an obstacle line off it', () => {
    const obstacles = Array.from({ length: 40 }, (_, i) => ({ x: 0, y: i * 10 - 200 }));
    const off = declutter([{ id: 'a', x: 0, y: 0 }], { ...O, obstacles });
    expect(off.has('a')).toBe(true);
  });
});
