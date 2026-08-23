/**
 * Curated drop-pin spots for the entry form — the places Facebook group
 * posts actually name. Coordinates sit mid-water off the named landmark;
 * the board treats every position as approximate (>1 km observer error),
 * so "off Point No Point" is exactly as precise as the source post.
 * All points fall inside the board's Salish Sea ingest bbox.
 */
export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export const PLACES: readonly Place[] = [
  { name: 'Budd Inlet (Olympia)', lat: 47.08, lng: -122.91 },
  { name: 'Case Inlet', lat: 47.27, lng: -122.85 },
  { name: 'Carr Inlet', lat: 47.29, lng: -122.7 },
  { name: 'Tacoma Narrows', lat: 47.27, lng: -122.55 },
  { name: 'Point Defiance / Dalco Passage', lat: 47.317, lng: -122.525 },
  { name: 'Colvos Passage', lat: 47.407, lng: -122.53 },
  { name: 'Point Robinson (Vashon)', lat: 47.388, lng: -122.36 },
  { name: 'Restoration Point (Bainbridge)', lat: 47.578, lng: -122.48 },
  { name: 'Alki Point', lat: 47.576, lng: -122.44 },
  { name: 'Elliott Bay', lat: 47.605, lng: -122.38 },
  { name: 'West Point (Discovery Park)', lat: 47.662, lng: -122.44 },
  { name: 'Edmonds', lat: 47.812, lng: -122.41 },
  { name: 'Kingston ferry lanes', lat: 47.8, lng: -122.44 },
  { name: 'Point No Point', lat: 47.912, lng: -122.52 },
  { name: 'Mukilteo / Possession Sound', lat: 47.949, lng: -122.31 },
  { name: 'Hood Canal', lat: 47.75, lng: -122.73 },
  { name: 'Marrowstone Point', lat: 48.102, lng: -122.68 },
  { name: 'Admiralty Inlet', lat: 48.17, lng: -122.75 },
  { name: 'Port Townsend', lat: 48.12, lng: -122.77 },
  { name: 'Saratoga Passage', lat: 48.15, lng: -122.49 },
  { name: 'Deception Pass', lat: 48.406, lng: -122.65 },
  { name: 'Strait of Juan de Fuca (mid)', lat: 48.25, lng: -123.2 },
  { name: 'Rosario Strait', lat: 48.58, lng: -122.75 },
  { name: 'San Juan Channel', lat: 48.55, lng: -122.99 },
  { name: 'Haro Strait / Lime Kiln', lat: 48.516, lng: -123.15 },
  { name: 'Boundary Pass', lat: 48.72, lng: -123.05 },
  { name: 'Bellingham Bay', lat: 48.72, lng: -122.55 },
];
