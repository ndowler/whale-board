import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppState } from '../state/store';
import {
  seenInWindow,
  speciesFocusAction,
  timeAgo,
  visibleSightings,
  visibleTracks,
  windowEmptyLabel,
  windowTitle,
} from '../state/selectors';
import { SPECIES_LABEL, SPECIES_SHORT_LABEL } from '../data/species';
import type { Sighting, SpeciesId } from '../types';
import type { Track } from '../data/tracks';
import { podLine } from './podLine';
import { SpeciesArtImg } from './SpeciesArtImg';
import { WindowSelector } from './WindowSelector';

const INITIAL_FEED_LIMIT = 25;
const FRESH_MS = 3 * 3_600_000;

interface FeedItem {
  id: string;
  sighting: Sighting;
  track: Track | null;
  epochMs: number;
}

/** Pod/ID subtitle, omitting ecotype labels already in SPECIES_SHORT_LABEL. */
function rowSubtitle(s: Sighting, track: Track | null): string | null {
  const pods = track && track.pods.length ? track.pods.join(' + ') : podLine(s);
  if (!pods) return null;
  if (
    (s.species === 'orca_biggs' && pods === "Bigg's") ||
    (s.species === 'orca_srkw' && pods === 'Southern Resident')
  ) {
    return null;
  }
  return pods;
}

/**
 * Right-edge sightings drawer — labeled species filter chips on top and a
 * chronological feed of recent sightings/tracks underneath. Clicking a chip
 * filters the feed and focuses that species on the map; clicking a row pans
 * to that sighting and opens its detail popover.
 */
export function TodayPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const visible = visibleSightings(state);
  const groups = seenInWindow(state);
  const { tracks, singles } = visibleTracks(state);
  const title = windowTitle(state.windowHours);
  const [open, setOpen] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesId | null>(null);
  const [showAll, setShowAll] = useState(false);
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

  const activeSpecies =
    speciesFilter && groups.some((g) => g.species === speciesFilter)
      ? speciesFilter
      : null;

  const feed: FeedItem[] = [
    ...tracks.map((t) => ({
      id: t.id,
      sighting: t.head,
      track: t,
      epochMs: t.lastMs,
    })),
    ...singles.map((s) => ({
      id: s.id,
      sighting: s,
      track: null,
      epochMs: s.epochMs,
    })),
  ].sort((a, b) => b.epochMs - a.epochMs);

  const filteredFeed = activeSpecies
    ? feed.filter((item) => item.sighting.species === activeSpecies)
    : feed;
  const displayed = showAll
    ? filteredFeed
    : filteredFeed.slice(0, INITIAL_FEED_LIMIT);

  const totalCount = visible.length;

  return (
    <aside
      ref={rootRef}
      className={`today-panel${open ? ' is-open' : ''}`}
      aria-label={`Sightings — ${title}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="today-panel__tab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? `Hide ${title}` : `Show ${title}`}
      >
        <span className="today-panel__tab-count">{totalCount}</span>
        <span className="today-panel__tab-label">
          {totalCount === 1 ? 'Sighting' : 'Sightings'}
        </span>
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
          <>
            <div className="today-panel__chips" role="group" aria-label="Filter by species">
              {groups.map((g) => {
                const active = activeSpecies === g.species;
                return (
                  <button
                    key={g.species}
                    type="button"
                    className={`today-panel__chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setShowAll(false);
                      if (active) {
                        setSpeciesFilter(null);
                      } else {
                        setSpeciesFilter(g.species);
                        dispatch(speciesFocusAction(state, g.species));
                      }
                    }}
                    title={`${SPECIES_LABEL[g.species]} — ${timeAgo(g.latestMs, state.nowMs)}`}
                  >
                    <SpeciesArtImg species={g.species} variant="plate" base="chip" />
                    <span className="today-panel__chip-name">
                      {SPECIES_SHORT_LABEL[g.species]}
                    </span>
                    <span className="today-panel__count">{g.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="today-panel__feed-head">
              <span className="today-panel__feed-label">
                Most recent · {filteredFeed.length}
              </span>
              {activeSpecies && (
                <button
                  type="button"
                  className="today-panel__clear"
                  onClick={() => {
                    setSpeciesFilter(null);
                    setShowAll(false);
                  }}
                >
                  All species
                </button>
              )}
            </div>

            <div className="today-panel__feed" role="list">
              {displayed.map((item) => {
                const s = item.sighting;
                const sub = rowSubtitle(s, item.track);
                const selected = state.selectedId === item.id;
                const isFresh = state.nowMs - item.epochMs < FRESH_MS;
                const meta: string[] = [s.region ?? 'Salish Sea'];
                if (item.track) {
                  meta.push(`track · ${item.track.points.length} pts`);
                } else if (s.count !== null) {
                  meta.push(
                    `${s.count} ${s.count === 1 ? 'animal' : 'animals'}`,
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`today-panel__row${selected ? ' is-selected' : ''}`}
                    onClick={() => {
                      dispatch({
                        type: 'FOCUS_SIGHTING',
                        id: item.id,
                        points: [[s.lng, s.lat]],
                      });
                      if (
                        typeof window.matchMedia === 'function' &&
                        window.matchMedia('(max-width: 640px)').matches
                      ) {
                        setOpen(false);
                      }
                    }}
                  >
                    <div className="today-panel__row-top">
                      <span className="today-panel__row-species">
                        {SPECIES_SHORT_LABEL[s.species]}
                        {sub && (
                          <span className="today-panel__row-pod"> · {sub}</span>
                        )}
                      </span>
                      <time
                        className={`today-panel__row-age${isFresh ? ' is-fresh' : ''}`}
                      >
                        {timeAgo(item.epochMs, state.nowMs)}
                      </time>
                    </div>
                    <div className="today-panel__row-meta">
                      {meta.join(' · ')}
                    </div>
                  </button>
                );
              })}

              {filteredFeed.length > displayed.length && (
                <button
                  type="button"
                  className="today-panel__more"
                  onClick={() => setShowAll(true)}
                >
                  Show all {filteredFeed.length}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
