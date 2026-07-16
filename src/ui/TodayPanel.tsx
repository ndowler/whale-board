import { useAppDispatch, useAppState } from '../state/store';
import { seenToday, timeAgo } from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { SpeciesArtImg } from './SpeciesArtImg';

/**
 * The upper-right "seen today" tally — one illustrated chip per species
 * observed since local midnight. Clicking a chip jumps the map to that
 * species' latest sighting; the header expands into the fullscreen collage.
 */
export function TodayPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const today = seenToday(state);

  return (
    <aside
      className="today-panel"
      aria-label="Sea creatures seen today"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="today-panel__header"
        onClick={() => dispatch({ type: 'SET_VIEW', view: 'today' })}
        title="Open the seen-today board"
      >
        <span className="today-panel__title">Seen today</span>
        <span className="today-panel__expand" aria-hidden="true">
          ⤢
        </span>
      </button>
      {today.length === 0 ? (
        <p className="today-panel__empty">Nothing yet today</p>
      ) : (
        <div className="today-panel__chips">
          {today.map((g) => (
            <button
              key={g.species}
              type="button"
              className="today-panel__chip"
              onClick={() => dispatch({ type: 'SELECT', id: g.latest.id })}
              title={`${SPECIES_LABEL[g.species]} — ${timeAgo(g.latestMs, state.nowMs)}`}
            >
              <SpeciesArtImg species={g.species} base="chip" />
              {g.count > 1 && (
                <span className="today-panel__count">{g.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
