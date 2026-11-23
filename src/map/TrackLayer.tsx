import type { Track } from '../data/tracks';
import { trackGeometry } from '../data/trackGeometry';
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

const polyD = (pts: Pt[]) => 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L');

/** Point + heading at the middle of a polyline (by vertex count; dense so fine). */
function midOf(pts: Pt[]): { x: number; y: number; ang: number; len: number } {
  const m = Math.floor(pts.length / 2);
  const a = pts[Math.max(0, m - 1)];
  const b = pts[Math.min(pts.length - 1, m + 1)];
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return {
    x: pts[m][0],
    y: pts[m][1],
    ang: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
    len,
  };
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
        const geo = trackGeometry(t);
        const hops = geo.hops.map((h) =>
          h.map((q) => frame.projection(q) as Pt | null).filter((p): p is Pt => p !== null),
        );
        const dots = geo.nodes
          .map((q) => frame.projection(q) as Pt | null)
          .filter((p): p is Pt => p !== null);
        if (hops.length < 1 || hops.some((h) => h.length < 2)) return null;
        const selected = t.id === selectedId;
        const n = hops.length;
        const age = Math.min(1, Math.max(0, (nowMs - t.lastMs) / windowMs));
        const base = 1 - 0.55 * age;
        const sw = (selected ? 7 : 5) * damp;
        const select = (e: { stopPropagation(): void }) => {
          e.stopPropagation();
          onSelect(selected ? null : t.id);
        };
        const segs = hops.map((h, i) => ({
          d: polyD(h),
          mid: midOf(h),
          op: base * (0.28 + 0.72 * ((i + 1) / n)),
        }));
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
            {dots.slice(0, -1).map((p, i) => (
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
              if (s.mid.len < 70 * damp) return null;
              const mx = s.mid.x;
              const my = s.mid.y;
              const ang = s.mid.ang;
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
