import type { Track } from '../data/tracks';
import type { WindowHours } from '../config';
import type { MapFrame } from './MapView';

interface TrackLayerProps {
  tracks: Track[];
  frame: MapFrame;
  nowMs: number;
  windowHours: WindowHours;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

type Pt = [number, number];

/** Catmull-Rom → cubic bezier control points for the segment p1→p2. */
function segmentPath(p0: Pt, p1: Pt, p2: Pt, p3: Pt): string {
  const t = 0.5 / 3;
  const c1: Pt = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
  const c2: Pt = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
  return `M${p1[0]},${p1[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
}

/**
 * Movement paths for confidently-linked groups: a smoothed line that fades
 * old → new, small dots at earlier report positions, and a chevron mid-hop
 * pointing the way they went. The sprite itself is drawn by MarkerLayer at
 * the head. Stroke widths counter-scale with zoom like the markers do.
 */
export function TrackLayer({
  tracks,
  frame,
  nowMs,
  windowHours,
  selectedId,
  onSelect,
}: TrackLayerProps) {
  const damp = 1 / Math.max(1, frame.transform.k);
  const windowMs = windowHours * 3_600_000;
  return (
    <g className="tracks">
      {tracks.map((t) => {
        const pts = t.points
          .map((s) => frame.projection([s.lng, s.lat]) as Pt | null)
          .filter((p): p is Pt => p !== null);
        if (pts.length < 2) return null;
        const selected = t.id === selectedId;
        const n = pts.length - 1;
        const age = Math.min(1, Math.max(0, (nowMs - t.lastMs) / windowMs));
        const base = 1 - 0.55 * age;
        const sw = (selected ? 7 : 5) * damp;
        const select = (e: { stopPropagation(): void }) => {
          e.stopPropagation();
          onSelect(selected ? null : t.id);
        };
        const segs = pts.slice(1).map((p, i) => {
          const a = pts[i];
          return {
            a,
            b: p,
            d: segmentPath(pts[Math.max(0, i - 1)], a, p, pts[Math.min(n, i + 2)]),
            op: base * (0.28 + 0.72 * ((i + 1) / n)),
          };
        });
        return (
          <g
            key={t.id}
            className={`track track--${t.species}${selected ? ' track--selected' : ''}`}
            role="button"
            tabIndex={-1}
            aria-label={`Movement track, ${t.points.length} reports`}
            onClick={select}
            onMouseEnter={() => onSelect(t.id)}
          >
            {/* fat invisible stroke = comfortable tap target */}
            {segs.map((s, i) => (
              <path key={`h${i}`} d={s.d} className="track__hit" strokeWidth={26 * damp} />
            ))}
            {segs.map((s, i) => (
              <path
                key={`l${i}`}
                d={s.d}
                className="track__line"
                strokeWidth={sw}
                opacity={s.op}
              />
            ))}
            {pts.slice(0, -1).map((p, i) => (
              <circle
                key={`d${i}`}
                className="track__dot"
                cx={p[0]}
                cy={p[1]}
                r={8 * damp}
                opacity={base * (0.35 + 0.65 * (i / n))}
              />
            ))}
            {segs.map((s, i) => {
              const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
              if (len < 70 * damp) return null;
              const mx = (s.a[0] + s.b[0]) / 2;
              const my = (s.a[1] + s.b[1]) / 2;
              const ang = (Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180) / Math.PI;
              const c = 13 * damp;
              return (
                <path
                  key={`c${i}`}
                  className="track__chevron"
                  d={`M${-c * 0.6},${-c} L${c * 0.6},0 L${-c * 0.6},${c}`}
                  strokeWidth={4 * damp}
                  opacity={Math.min(1, s.op + 0.15)}
                  transform={`translate(${mx},${my}) rotate(${ang})`}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
