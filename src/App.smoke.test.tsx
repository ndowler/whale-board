import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
        // Minutes old, not hours — keeps the "seen today" tally deterministic
        // even when the suite runs just after local midnight.
        created: new Date(Date.now() - 20 * 60_000).toISOString(),
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
  it('renders map markers, the seen-today views, and attribution', async () => {
    render(<App />);

    // Sightings appear as map markers (role=button with species aria-label).
    const markers = await screen.findAllByRole('button', {
      name: 'Orca — Southern Resident',
    });
    expect(markers.length).toBeGreaterThanOrEqual(1);

    // The seen-today panel tallies both species (fixtures are minutes old).
    expect(screen.getByText('Seen today')).toBeTruthy();
    expect(
      screen.getByTitle(/^Orca — Southern Resident —/),
    ).toBeTruthy();
    expect(screen.getByTitle(/^Humpback Whale —/)).toBeTruthy();

    // `v` flips to the fullscreen collage; species + region copy render.
    fireEvent.keyDown(window, { key: 'v' });
    expect(
      await screen.findByText('Seen in the Salish Sea today'),
    ).toBeTruthy();
    expect(screen.getByText('Orca — Southern Resident')).toBeTruthy();
    expect(screen.getAllByText(/Haro Strait/).length).toBeGreaterThan(0);

    // Escape returns to the map.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('Seen today')).toBeTruthy();

    // Attribution + disclaimer are always on screen.
    expect(screen.getByText(/Acartia Data Cooperative/)).toBeTruthy();
    expect(screen.getByText(/not a navigation or safety tool/)).toBeTruthy();
  });
});
