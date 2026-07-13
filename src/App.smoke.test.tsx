import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./data/acartiaClient', () => ({
  fetchSightings: vi.fn().mockImplementation(() =>
    Promise.resolve([
      {
        ssemmi_id: 'SMOKE 1',
        created: new Date(Date.now() - 30 * 60_000).toISOString(),
        type: 'Orca',
        latitude: '48.5165',
        longitude: '-123.1702',
        no_sighted: '4',
        trusted: 1,
        data_source_comments: 'J pod northbound',
        data_source_entity: 'orcanetwork',
      },
      {
        ssemmi_id: 'SMOKE 2',
        created: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        type: 'Humpback',
        latitude: 48.249,
        longitude: -123.2988,
        no_sighted: 1,
        trusted: 2,
        data_source_comments: '',
        data_source_entity: 'orcanetwork',
      },
    ]),
  ),
}));

beforeAll(() => {
  // jsdom reports zero-size boxes; the map needs a real-looking container.
  Element.prototype.getBoundingClientRect = () =>
    ({
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
});

describe('App smoke', () => {
  it('renders map markers, rail cards, and attribution from a poll', async () => {
    render(<App />);

    // Both sightings appear as rail cards…
    expect(
      await screen.findByText('Orca — Southern Resident'),
    ).toBeTruthy();
    expect(await screen.findByText('Humpback Whale')).toBeTruthy();

    // …and as map markers (role=button with species aria-label).
    const markers = await screen.findAllByRole('button', {
      name: 'Orca — Southern Resident',
    });
    expect(markers.length).toBeGreaterThanOrEqual(1);

    // Region derivation flows through to the card copy.
    expect(screen.getAllByText(/Haro Strait/).length).toBeGreaterThan(0);

    // Attribution + disclaimer are always on screen.
    expect(screen.getByText(/Acartia Data Cooperative/)).toBeTruthy();
    expect(screen.getByText(/not a navigation or safety tool/)).toBeTruthy();
  });
});
