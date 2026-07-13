import type { SpeciesId } from '../../types';

export function markerHref(species: SpeciesId): string {
  return `#sp-${species}`;
}

/**
 * Original hand-authored silhouettes (no third-party assets, no license
 * baggage). One <symbol> per species/ecotype, all facing left in a
 * 100×60 box; bodies use currentColor so CSS themes each species, and
 * `.sp-patch` cuts dark accents (eye patches, flank blazes) out of the body.
 *
 * Rendered once, invisibly, at the app root; markers and rail cards
 * reference the symbols with <use>.
 */
// <use> clones live in a shadow tree CSS selectors can't reach; fill and
// custom properties inherit through it, so patches take their color from
// the --sp-patch variable set at the marker/card site.
const PATCH_STYLE = { fill: 'var(--sp-patch, #0a1622)' } as const;

export function SpeciesSprite() {
  return (
    <svg className="species-sprite" aria-hidden="true" focusable="false">
      <defs>
        {/* Southern Resident orca — tall falcate dorsal with a curved tip */}
        <symbol id="sp-orca_srkw" viewBox="0 0 100 60">
          <path d="M8,35 C10,27 19,21 31,20 L43,20 C44,12 45,5 51,2 C51,11 55,17 59,21 C69,22 77,24 82,28 C86,24 90,21 94,20 C93,26 92,29 90,31 C92,33 94,37 95,40 C90,39 86,36 82,33 C74,38 62,42 50,43 C45,49 38,52 33,50 C34,47 36,44 39,42 C26,41 12,41 8,35 Z" />
          <path style={PATCH_STYLE} d="M21,27 C25,24.5 30,25 33,27.5 C30,29.5 24,29.5 21,27 Z" />
        </symbol>
        {/* Bigg's orca — straighter, pointier dorsal */}
        <symbol id="sp-orca_biggs" viewBox="0 0 100 60">
          <path d="M8,35 C10,27 19,21 31,20 L43,20 C44,13 46,6 49,1 C52,9 56,16 60,21 C70,22 77,24 82,28 C86,24 90,21 94,20 C93,26 92,29 90,31 C92,33 94,37 95,40 C90,39 86,36 82,33 C74,38 62,42 50,43 C45,49 38,52 33,50 C34,47 36,44 39,42 C26,41 12,41 8,35 Z" />
          <path style={PATCH_STYLE} d="M21,27 C25,24.5 30,25 33,27.5 C30,29.5 24,29.5 21,27 Z" />
        </symbol>
        {/* Orca, ecotype unreported */}
        <symbol id="sp-orca" viewBox="0 0 100 60">
          <path d="M8,35 C10,27 19,21 31,20 L44,20 C45,13 47,7 51,3 C52,10 55,17 59,21 C69,22 77,24 82,28 C86,24 90,21 94,20 C93,26 92,29 90,31 C92,33 94,37 95,40 C90,39 86,36 82,33 C74,38 62,42 50,43 C45,49 38,52 33,50 C34,47 36,44 39,42 C26,41 12,41 8,35 Z" />
          <path style={PATCH_STYLE} d="M21,27 C25,24.5 30,25 33,27.5 C30,29.5 24,29.5 21,27 Z" />
        </symbol>
        {/* Humpback — knobby head, long pale pectoral, humped stubby dorsal */}
        <symbol id="sp-humpback" viewBox="0 0 100 60">
          <path d="M5,34 C7,29 13,25 22,23 C38,19 56,18 68,21 C70,18 73,17 76,17 C75,20 74,22 73,24 C78,25 83,26 86,27 C88,24 91,21 94,20 C93,25 92,28 91,30 C93,32 95,35 96,38 C92,37 88,35 85,33 C77,37 64,40 52,40 C44,44 32,46 24,44 C30,41 35,39 40,38 C26,39 10,39 5,34 Z" />
          <path style={PATCH_STYLE} d="M28,40 C22,45 15,49 9,49 C13,44 19,40 26,38 Z" />
        </symbol>
        {/* Gray whale — no dorsal fin; low hump then knuckles on the tailstock */}
        <symbol id="sp-gray_whale" viewBox="0 0 100 60">
          <path d="M7,35 C10,29 18,26 30,25 C46,23 60,24 68,27 C70,25.5 72,27 71,28.5 C73,27 75.5,28.5 74,30 C76,28.8 78.5,30.2 77,31.8 C80,31 83,31 85,31.5 C88,28 91,25 94,24 C93,29 92,32 91,34 C93,36 95,39 95,42 C91,41 87,39 84,36 C74,41 58,43 46,42 C40,46 33,48 27,46 C30,43 33,41 37,40 C24,40 11,40 7,35 Z" />
          <path style={PATCH_STYLE} d="M20,30 C23,29 26,30 27,31.5 C25,33 21,32.5 20,30 Z" />
        </symbol>
        {/* Blue whale — very long, broad flat head, tiny dorsal far back */}
        <symbol id="sp-blue_whale" viewBox="0 0 100 60">
          <path d="M3,33 C6,29 14,27 26,26 C44,24.5 62,25 74,27 C76,25 78,24 80,24 C79,26 78,27.5 77,29 C80,29.5 83,30 85,30.5 C88,27 91,25 94,24 C93,28 92,31 91,33 C93,35 94,38 95,41 C91,40 87,38 84,35 C74,39 56,41 42,40 C34,43 26,44 20,42 C25,39 30,38 35,37 C21,37 7,37 3,33 Z" />
          <path style={PATCH_STYLE} d="M17,29.5 C19,28.8 21,29.3 22,30.5 C20,31.6 17.5,31.2 17,29.5 Z" />
        </symbol>
        {/* Fin whale — sleek with a prominent falcate dorsal set well back */}
        <symbol id="sp-fin_whale" viewBox="0 0 100 60">
          <path d="M4,33 C7,29 15,26.5 27,26 C43,25 58,25 68,26.5 C70,21 73,17 77,15 C76,19 75.5,23 76,27.5 C79,28 82,29 84,30 C87,27 90,25 93,24 C92,28 91,31 90,33 C92,35 94,38 95,41 C91,40 87,38 83,35 C73,39 56,41 43,40 C35,43 27,44 21,42 C26,39 31,38 36,37 C22,37 8,37 4,33 Z" />
          <path style={PATCH_STYLE} d="M17,29.5 C19,28.8 21,29.3 22,30.5 C20,31.6 17.5,31.2 17,29.5 Z" />
        </symbol>
        {/* Minke — small, pointed rostrum, falcate mid-back dorsal */}
        <symbol id="sp-minke" viewBox="0 0 100 60">
          <path d="M10,35 C16,30 24,27.5 33,27 L52,26.5 C54,21 57,17.5 61,16 C60,20 59.5,23.5 60,27 C66,27.5 72,28.5 76,30 C80,27 84,25 88,24 C87,28 86,31 85,33 C87,35 89,38 90,41 C86,40 82,38 79,35 C70,39 56,41 45,40 C38,43 31,44 25,42.5 C29,40 33,38.5 38,37.5 C26,38 14,38.5 10,35 Z" />
          <path style={PATCH_STYLE} d="M40,33 C44,32 48,32.5 50,34 C47,35.5 42,35 40,33 Z" />
        </symbol>
        {/* Harbor porpoise — small and chunky, low triangular dorsal */}
        <symbol id="sp-harbor_porpoise" viewBox="0 0 100 60">
          <path d="M16,36 C20,30 28,26.5 38,26 L47,26 C49,22.5 52,20 56,19 C55,21.5 54.5,24 55,26.5 C62,27 69,29 73,31.5 C77,29 81,27.5 85,27 C84,30 83,32.5 82,34.5 C84,36.5 85,39 86,41.5 C82,41 78,39.5 75,37 C67,41 54,42.5 44,41.5 C38,44 32,44.5 27,43 C30,41 34,39.5 38,38.5 C29,39 20,39.5 16,36 Z" />
          <path style={PATCH_STYLE} d="M30,32 C33,31 36,31.5 38,33 C35,34.5 31,34 30,32 Z" />
        </symbol>
        {/* Dall's porpoise — deep stocky body with a bold white flank blaze */}
        <symbol id="sp-dalls_porpoise" viewBox="0 0 100 60">
          <path d="M14,35 C18,28 27,24 38,23.5 L48,24 C50,20.5 53,18 57,17 C56,19.5 55.5,22 56,24.5 C64,25.5 71,28 75,31 C79,28.5 83,27 87,26.5 C86,29.5 85,32 84,34 C86,36 87,38.5 88,41 C84,40.5 80,39 77,36.5 C68,41 54,43 43,42 C37,45 30,45.5 25,44 C28,41.5 32,40 36,39 C27,39.5 18,39 14,35 Z" />
          <path style={PATCH_STYLE} d="M44,31 C52,29 62,29.5 68,32.5 C63,36.5 52,38 44,36 C42,34.5 42,32.5 44,31 Z" />
        </symbol>
        {/* Pacific white-sided dolphin — tall bicolor dorsal, flank stripe */}
        <symbol id="sp-pacific_white_sided_dolphin" viewBox="0 0 100 60">
          <path d="M8,36 C13,31 22,28 32,27.5 L45,27 C46,20 48,13 53,9 C53,15 53.5,21 55,26.5 C63,27 70,29 74,31.5 C78,29 82,27.5 86,27 C85,30 84,32.5 83,34.5 C85,36.5 86,39 87,41.5 C83,41 79,39.5 76,37 C67,41 53,43 42,42 C36,45 29,45.5 24,44 C27,41.5 31,40 35,39 C25,39.5 13,39.5 8,36 Z" />
          <path style={PATCH_STYLE} d="M30,31 C42,29.5 58,30 68,33 C58,35 42,35 30,33.5 C28.5,32.7 28.5,31.8 30,31 Z" />
        </symbol>
        {/* Species not reported — a respectful fluke-up dive */}
        <symbol id="sp-unspecified" viewBox="0 0 100 60">
          <path d="M50,6 C44,14 40,24 38,36 C33,34 28,34 24,37 C29,39 34,41 38,44 C42,42 46,41 50,41.5 C54,41 58,42 62,44 C66,41 71,39 76,37 C72,34 67,34 62,36 C60,24 56,14 50,6 Z" />
          <path style={PATCH_STYLE} d="M20,50 C26,46.5 33,46.5 39,50 C33,52.5 26,52.5 20,50 Z M61,50 C67,46.5 74,46.5 80,50 C74,52.5 67,52.5 61,50 Z" />
        </symbol>
        {/* Unknown cetacean — surfacing back and blow */}
        <symbol id="sp-unknown_cetacean" viewBox="0 0 100 60">
          <path d="M28,46 C34,36 44,31 54,31 C64,31 72,37 76,46 Z" />
          <path style={PATCH_STYLE} d="M49,28 C46,21 41,15 35,12 C42,13 48,17 51,23 C54,17 60,13 67,12 C61,15 56,21 53,28 C52,29.5 50,29.5 49,28 Z" />
        </symbol>
      </defs>
    </svg>
  );
}
