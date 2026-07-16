import { useAppDispatch, useAppState } from '../state/store';
import { seenToday, timeAgo } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { SpeciesArtImg } from './SpeciesArtImg';

function dateLabel(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * The fullscreen seen-today collage — the AvianVisitors nod made whole:
 * one large illustrated plate per species observed since local midnight.
 * Clicking a card returns to the map with that species' latest sighting
 * selected ("show me where").
 */
export function TodayBoard() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const today = seenToday(state);
  const fresh = new Set(state.newIds);

  return (
    <div className="today-board">
      <header className="today-board__header">
        <h1 className="today-board__title">Seen in the Salish Sea today</h1>
        <span className="today-board__date">{dateLabel(state.nowMs)}</span>
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
        <div className="today-board__grid">
          {today.map((g) => (
            <button
              key={g.species}
              type="button"
              className={`today-card${
                g.latest.mergedIds.concat(g.latest.id).some((id) => fresh.has(id))
                  ? ' is-new'
                  : ''
              }`}
              onClick={() => {
                dispatch({ type: 'SET_VIEW', view: 'map' });
                dispatch({ type: 'SELECT', id: g.latest.id });
              }}
              title="Show on the map"
            >
              <span className="today-card__frame">
                <SpeciesArtImg species={g.species} variant="collage" base="today-card" />
              </span>
              <span className="today-card__species">
                {SPECIES_LABEL[g.species]}
              </span>
              <span className="today-card__meta">
                {g.count === 1 ? '1 sighting' : `${g.count} sightings`}
                {g.reportCount > g.count && ` · ${g.reportCount} reports`}
              </span>
              <span className="today-card__meta">
                {g.latest.region ?? 'Salish Sea'} ·{' '}
                {timeAgo(g.latestMs, state.nowMs)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
