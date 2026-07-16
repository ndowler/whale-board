import type { Hydrophone } from '../types';
import type { HydroStatus } from '../state/selectors';
import type { MapFrame } from './MapView';

interface HydrophoneLayerProps {
  hydrophones: readonly Hydrophone[];
  statuses: Map<string, HydroStatus>;
  frame: MapFrame;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * The acoustic layer: one small hydrophone node per Orcasound feed.
 * Idle nodes are near-invisible furniture; a whale-category detection
 * lights the node ("heard"), and a detection in the last half hour makes
 * it "hot" — expanding sonar rings, the heard-orca counterpart of a
 * sighting's arrival ping.
 */
export function HydrophoneLayer({
  hydrophones,
  statuses,
  frame,
  selectedId,
  onSelect,
}: HydrophoneLayerProps) {
  return (
    <g className="hydros">
      {hydrophones.map((h) => {
        const p = frame.projection([h.lng, h.lat]);
        if (!p) return null;
        const s = statuses.get(h.id);
        const cls = [
          'hydro',
          s?.hot ? 'hydro--hot' : s?.heard ? 'hydro--heard' : 'hydro--idle',
          selectedId === h.id ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={h.id}
            className={cls}
            transform={`translate(${p[0]}, ${p[1]})`}
            role="button"
            tabIndex={0}
            aria-label={`Hydrophone: ${h.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selectedId === h.id ? null : h.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(selectedId === h.id ? null : h.id);
              }
            }}
          >
            {s?.hot && (
              <>
                <circle className="hydro__ring hydro__ring--a" r={6} />
                <circle className="hydro__ring hydro__ring--b" r={6} />
              </>
            )}
            {/* generous invisible hit area — the glyph itself is tiny */}
            <circle className="hydro__hit" r={11} />
            <circle className="hydro__dot" r={2.6} />
            {/* listening arcs, the hydrophone glyph */}
            <path className="hydro__arc" d="M -4.6 -3.4 A 5.8 5.8 0 0 1 4.6 -3.4" />
            <path className="hydro__arc" d="M -7 -5.4 A 9 9 0 0 1 7 -5.4" />
          </g>
        );
      })}
    </g>
  );
}
