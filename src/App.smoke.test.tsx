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
        // Minutes old — stays inside every freshness window.
        created: new Date(Date.now() - 20 * 60_000).toISOString(),
        type: 'Humpback',
        latitude: 48.249,
        longitude: -123.2988,
        no_sighted: 1,
        trusted: 2,
        data_source_comments: '',
        data_source_entity: 'orcanetwork',
      },
      {
        ssemmi_id: 'SMOKE 3',
        // Second humpback far enough away not to dedupe — verifies tab shows total sightings (3), not species count (2).
        created: new Date(Date.now() - 10 * 60_000).toISOString(),
        type: 'Humpback',
        latitude: 47.62,
        longitude: -122.46,
        no_sighted: 2,
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

    // The species drawer tallies both species (fixtures are minutes old).
    // Default window is 72h → "Past 3 Days" (header), tab shows actual sighting count.
    expect(screen.getAllByText('Past 3 Days').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: /3\s*Sightings/i }),
    ).toBeTruthy();
    const srkwChip = screen.getByTitle(/^Orca — Southern Resident —/);
    expect(srkwChip.textContent).toContain('Southern Resident');
    const humpChip = screen.getByTitle(/^Humpback Whale —/);
    expect(humpChip.textContent).toContain('Humpback');

    // Feed shows recent sightings with pod + area, and filters on chip click.
    expect(screen.getByText(/· J$/)).toBeTruthy();
    expect(screen.getAllByText(/Haro Strait/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(humpChip);
    expect(screen.queryByText(/· J$/)).toBeNull();
    // Clicking the active chip clears the filter.
    fireEvent.click(humpChip);
    expect(screen.getByText(/· J$/)).toBeTruthy();

    // Clicking a feed row selects the sighting and opens its popover.
    fireEvent.click(screen.getByText(/· J$/).closest('button')!);
    expect(
      screen.getByRole('dialog', { name: /Sighting details: Orca — Southern Resident/ }),
    ).toBeTruthy();

    // `v` flips to the fullscreen collage; species + region copy render.
    fireEvent.keyDown(window, { key: 'v' });
    expect(await screen.findByRole('heading', { name: 'Past 3 Days' })).toBeTruthy();
    expect(screen.getByText('Orca — Southern Resident')).toBeTruthy();
    expect(screen.getAllByTitle(/Haro Strait/).length).toBeGreaterThan(0);

    // Escape returns to the map.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      (await screen.findAllByText('Past 3 Days')).length,
    ).toBeGreaterThanOrEqual(1);

    // Attribution + disclaimer sit on the map overlay.
    expect(screen.getByText(/Acartia Data Cooperative/)).toBeTruthy();
    expect(screen.getByText(/not a navigation or safety tool/)).toBeTruthy();
  });
});
