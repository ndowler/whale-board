import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Sighting } from '../types';
import { decay } from '../state/selectors';
import { makeProjection, kmToPx } from './projection';
import { CONFIG } from '../config';
import { clusterGlow, layoutMarkers, spriteScaleFor } from './layout';
import { GlowLayer } from './GlowLayer';

function mk(id: string): Sighting {
  return {
    id,
    epochMs: Date.parse('2026-11-24T00:00:00Z'),
    species: 'orca',
    ecotype: null,
    pods: [],
    individuals: [],
    lat: 48.52,
    lng: -123.17,
    count: null,
    trusted: 1,
    comment: '',
    sourceEntity: 'test',
    region: null,
    mergedIds: [],
    reportCount: 1,
  };
}

describe('GlowLayer folded singles', () => {
  it('skips merged sightings and pings the host when a member is new or highlighted', () => {
    const width = 1400;
    const height = 800;
    const projection = makeProjection(width, height);
    const frame = {
      projection,
      width,
      height,
      transform: { k: 1, x: 12, y: 34 },
    };
    const sightings = Array.from({ length: 12 }, (_, i) => mk(`s${i}`));
    const damp = spriteScaleFor(width);
    const layout = layoutMarkers(sightings, [], projection, damp);
    expect(layout.merged.size).toBeGreaterThan(0);

    const member = [...layout.merged.keys()][0];
    const host = layout.merged.get(member)!;
    const count = layout.clusterSize.get(host)!;
    expect(count).toBeGreaterThan(1);

    const nowMs = sightings[0].epochMs + 6 * 3_600_000;
    const baseR = Math.max(8, kmToPx(projection, CONFIG.glowRadiusKm));
    const halo = clusterGlow(baseR, decay(sightings[0], nowMs, 24).opacity, count);

    const props = {
      sightings,
      tracks: [],
      frame,
      nowMs,
      windowHours: 24 as const,
      highlightSeq: 3,
    };

    const highlighted = render(
      <GlowLayer {...props} newIds={[]} highlightIds={[member]} />,
    );
    const glows = highlighted.container.querySelectorAll('.glow');
    expect(glows).toHaveLength(sightings.length - layout.merged.size);
    const hostGlow = [...glows].find((n) => Number(n.getAttribute('r')) > baseR + 1e-6);
    expect(hostGlow).toBeTruthy();
    expect(Number(hostGlow!.getAttribute('r'))).toBeCloseTo(halo.r);
    expect(Number(hostGlow!.getAttribute('opacity'))).toBeCloseTo(halo.opacity);
    expect(highlighted.container.querySelectorAll('.glow__ping')).toHaveLength(1);

    highlighted.rerender(<GlowLayer {...props} newIds={[member]} highlightIds={[]} />);
    expect(highlighted.container.querySelectorAll('.glow__ping')).toHaveLength(1);
    expect(highlighted.container.querySelectorAll('.glow')).toHaveLength(
      sightings.length - layout.merged.size,
    );
  });
});
