import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppState } from '../state/store';
import {
  seenInWindow,
  speciesFocusAction,
  timeAgo,
  windowEmptyLabel,
  windowTitle,
} from '../state/selectors';
import { SPECIES_LABEL } from '../data/species';
import { SpeciesArtImg } from './SpeciesArtImg';
import { WindowSelector } from './WindowSelector';

/**
 * Right-edge species drawer — one illustrated chip per species observed
 * inside the active freshness window (24h / 3d / 7d). Title, chips, and
 * the embedded window selector track the same SET_WINDOW state as the map.
 */
export function TodayPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const groups = seenInWindow(state);
  const title = windowTitle(state.windowHours);
  const [open, setOpen] = useState(true);
  const rootRef = useRef<HTMLElement>(null);

  // Dismiss when the pointer lands outside the drawer (and its tab).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <aside
      ref={rootRef}
      className={`today-panel${open ? ' is-open' : ''}`}
      aria-label={`Sea creatures — ${title}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="today-panel__tab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? `Hide ${title}` : `Show ${title}`}
      >
        <span className="today-panel__tab-count">{groups.length}</span>
        <span className="today-panel__tab-label">Sightings</span>
      </button>

      <div className="today-panel__body">
        <div className="today-panel__header">
          <button
            type="button"
            className="today-panel__heading"
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'today' })}
            title={`Open the ${title.toLowerCase()} board`}
          >
            <span className="today-panel__title">{title}</span>
            <span className="today-panel__expand" aria-hidden="true">
              ⤢
            </span>
          </button>
          <WindowSelector />
        </div>
        {groups.length === 0 ? (
          <p className="today-panel__empty">
            {windowEmptyLabel(state.windowHours)}
          </p>
        ) : (
          <div className="today-panel__chips">
            {groups.map((g) => (
              <button
                key={g.species}
                type="button"
                className="today-panel__chip"
                onClick={() => dispatch(speciesFocusAction(state, g.species))}
                title={`${SPECIES_LABEL[g.species]} — ${timeAgo(g.latestMs, state.nowMs)}`}
              >
                <SpeciesArtImg species={g.species} variant="collage" base="chip" />
                {g.count > 1 && (
                  <span className="today-panel__count">{g.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
