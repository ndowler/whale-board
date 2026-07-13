import { describe, expect, it } from 'vitest';
import { parseComment } from './commentParse';

describe('parseComment', () => {
  const cases: Array<
    [
      string,
      {
        ecotype: 'biggs' | 'srkw' | null;
        pods?: string[];
        individuals?: string[];
      },
    ]
  > = [
    [
      "[Orca Network] Biggs T46Bs southbound past Point No Point",
      { ecotype: 'biggs', pods: ['T46B'] },
    ],
    ['J pod northbound in Haro Strait', { ecotype: 'srkw', pods: ['J'] }],
    ['K-pod spread across the strait', { ecotype: 'srkw', pods: ['K'] }],
    ['SRKW heading north', { ecotype: 'srkw', pods: [] }],
    ['Southern Residents past Vashon, L pod called in', { ecotype: 'srkw', pods: ['L'] }],
    ['2 transients milling', { ecotype: 'biggs', pods: [] }],
    ["Bigg's T137A2 group past Marrowstone", { ecotype: 'biggs', pods: ['T137A2'] }],
    ['T65As in Case Inlet', { ecotype: 'biggs', pods: ['T65A'] }],
    [
      "Humpback BCX2077 'Neowise' lunge feeding",
      { ecotype: null, individuals: ['BCX2077'] },
    ],
    ['CRC-56 feeding off Whidbey', { ecotype: null, individuals: ['CRC56'] }],
    ['BCY0324 with two others', { ecotype: null, individuals: ['BCY0324'] }],
    ['J59 traveling with J37', { ecotype: 'srkw', individuals: ['J37', 'J59'] }],
    ['Large blow seen from shore', { ecotype: null, pods: [], individuals: [] }],
    ['', { ecotype: null, pods: [], individuals: [] }],
  ];

  it.each(cases)('parses %j', (comment, expected) => {
    const r = parseComment(comment);
    expect(r.ecotype).toBe(expected.ecotype);
    if (expected.pods) expect(r.pods).toEqual(expected.pods);
    if (expected.individuals) expect(r.individuals).toEqual(expected.individuals);
  });

  it('is safe on null/undefined', () => {
    expect(parseComment(null)).toEqual({ ecotype: null, pods: [], individuals: [] });
    expect(parseComment(undefined)).toEqual({
      ecotype: null,
      pods: [],
      individuals: [],
    });
  });

  it('strips leading source tags before parsing', () => {
    const r = parseComment('[Orca Network] [relay] T18s off Lime Kiln');
    expect(r.pods).toEqual(['T18']);
    expect(r.ecotype).toBe('biggs');
  });
});
