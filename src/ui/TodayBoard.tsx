import type { CSSProperties } from 'react';
import { useAppDispatch, useAppState } from '../state/store';
import { seenToday, timeAgo } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import type { SpeciesId } from '../types';
import { SpeciesArtImg } from './SpeciesArtImg';

function dateLabel(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Relative cutout width per species so real-world scale reads across the
 * collage — a blue whale should dwarf a harbor porpoise. Unlisted species
 * render at 1.
 */
const SPECIES_SCALE: Partial<Record<SpeciesId, number>> = {
  blue_whale: 1.35,
  fin_whale: 1.25,
  humpback: 1.15,
  gray_whale: 1.12,
  minke: 0.95,
  unknown_cetacean: 0.9,
  unspecified: 0.85,
  pacific_white_sided_dolphin: 0.75,
  dalls_porpoise: 0.7,
  harbor_porpoise: 0.65,
};

/** FNV-1a → 0..1. Deterministic per species, so the scatter never jumps
    between renders or polling ticks. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface Placement {
  /** Center, as % of the collage box. */
  x: number;
  y: number;
  /** Width as % of the collage box. */
  w: number;
  /** Tilt in degrees. */
  rot: number;
  z: number;
}

const GOLDEN_ANGLE = 2.399963;

/**
 * The AvianVisitors-style organic cluster: the newest species sits large in
 * the middle, the rest spiral outward on a golden-angle ellipse with
 * per-species jitter. Deterministic — same species set, same collage.
 */
function collagePlacements(species: SpeciesId[]): Placement[] {
  const n = species.length;
  return species.map((sp, i) => {
    const jA = hash01(sp);
    const jB = hash01(`${sp}:b`);
    const jC = hash01(`${sp}:c`);
    const scale = SPECIES_SCALE[sp] ?? 1;
    if (i === 0) {
      return {
        x: 50 + (jA - 0.5) * 6,
        y: 48 + (jB - 0.5) * 8,
        w: 24 * scale,
        rot: (jC - 0.5) * 10,
        z: n + 1,
      };
    }
    const angle = i * GOLDEN_ANGLE + (jA - 0.5) * 0.8;
    const ring = Math.sqrt((i + 0.5) / n);
    const x = 50 + 36 * ring * Math.cos(angle) + (jB - 0.5) * 4;
    const y = 50 + 32 * ring * Math.sin(angle) + (jC - 0.5) * 5;
    return {
      x: Math.min(88, Math.max(12, x)),
      y: Math.min(84, Math.max(16, y)),
      w: (17 - 4 * ring) * scale * (0.92 + jB * 0.16),
      rot: (jA - 0.5) * 16,
      z: n - i,
    };
  });
}

/**
 * The fullscreen seen-today collage — the AvianVisitors nod made whole:
 * transparent cutout plates scattered in an organic cluster, one per
 * species observed since local midnight. Clicking a cutout returns to the
 * map with that species' latest sighting selected ("show me where").
 */
export function TodayBoard() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const today = seenToday(state);
  const fresh = new Set(state.newIds);
  const placements = collagePlacements(today.map((g) => g.species));

  return (
    <div className="today-board">
      <header className="today-board__header">
        <p className="today-board__kicker">
          the salish sea · {dateLabel(state.nowMs)}
        </p>
        <h1 className="today-board__title">Seen Today</h1>
      </header>
      {today.length === 0 ? (
        <div className="empty" role="status">
          <svg className="empty__waves" viewBox="0 0 120 24" aria-hidden="true">
            <path d="M4,14 Q16,6 28,14 T52,14" />
            <path d="M64,16 Q76,8 88,16 T112,16" />
          </svg>
          <div className="empty__title">The sea is quiet</div>
          <div className="empty__sub">No sightings yet today</div>
        </div>
      ) : (
        <div className="today-collage">
          {today.map((g, i) => {
            const p = placements[i];
            const isNew = g.latest.mergedIds
              .concat(g.latest.id)
              .some((id) => fresh.has(id));
            const sightings =
              g.count === 1 ? '1 sighting' : `${g.count} sightings`;
            return (
              <button
                key={g.species}
                type="button"
                className={`today-collage__item${isNew ? ' is-new' : ''}`}
                style={
                  {
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.w}%`,
                    zIndex: p.z,
                    '--rot': `${p.rot}deg`,
                  } as CSSProperties
                }
                onClick={() => {
                  dispatch({ type: 'SET_VIEW', view: 'map' });
                  dispatch({ type: 'SELECT', id: g.latest.id });
                }}
                aria-label={`${SPECIES_LABEL[g.species]}, ${sightings}, ${timeAgo(g.latestMs, state.nowMs)} — show on the map`}
                title={`${SPECIES_LABEL[g.species]} · ${sightings} · ${
                  g.latest.region ?? 'Salish Sea'
                } · ${timeAgo(g.latestMs, state.nowMs)}`}
              >
                <SpeciesArtImg
                  species={g.species}
                  variant="plate"
                  base="today-collage-item"
                />
                {g.count > 1 && (
                  <span className="today-collage__count">{g.count}</span>
                )}
                <span className="today-collage__name">
                  {SPECIES_LABEL[g.species]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
