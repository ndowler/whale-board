import { useEffect, useRef } from 'react';
import { CONFIG } from './config';
import { useAppDispatch, useAppState } from './state/store';
import {
  usePollingLoop,
  useBackfill,
  useAcousticLoop,
  useClock,
} from './data/usePollingLoop';
import { visibleSightings, hydroStatuses } from './state/selectors';
import { MapView } from './map/MapView';
import { MarkerLayer } from './map/MarkerLayer';
import { GlowLayer } from './map/GlowLayer';
import { HydrophoneLayer } from './map/HydrophoneLayer';
import { PlaceLabels } from './map/PlaceLabels';
import { Popover } from './map/Popover';
import { HydroPopover } from './map/HydroPopover';
import { StatusBar } from './ui/StatusBar';
import { EmptyState } from './ui/EmptyState';
import { TodayPanel } from './ui/TodayPanel';
import { TodayBoard } from './ui/TodayBoard';
import { useKiosk } from './kiosk/useKiosk';
import { AttributionFooter } from './ui/AttributionFooter';
import { SpeciesSprite } from './assets/species/SpeciesSprite';
import { ensureAudio, playChime } from './audio/chime';

export function Board() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  usePollingLoop(dispatch);
  useBackfill(dispatch);
  useAcousticLoop(dispatch);
  useClock(dispatch);
  const { toggle: toggleKiosk } = useKiosk(state.kiosk, dispatch);

  const visible = visibleSightings(state);
  // Look up in the collapsed view, not the raw store — the rendered winner
  // carries the merged pods/reportCount, and an absorbed id simply closes.
  const selected = state.selectedId
    ? (visible.find((s) => s.id === state.selectedId) ?? null)
    : null;
  const hydroStatus = hydroStatuses(state);
  const selectedHydro = state.selectedHydroId
    ? (state.hydrophones.find((h) => h.id === state.selectedHydroId) ?? null)
    : null;

  // View switching: `v` toggles map/today, Escape returns to the map.
  const viewRef = useRef(state.boardView);
  viewRef.current = state.boardView;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'v' || e.key === 'V')
        dispatch({
          type: 'SET_VIEW',
          view: viewRef.current === 'map' ? 'today' : 'map',
        });
      else if (e.key === 'Escape' && viewRef.current === 'today')
        dispatch({ type: 'SET_VIEW', view: 'map' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  // Arrival treatment: chime once per batch of new ids, then retire the
  // "new" flag after the animation runs its course.
  const chimeOnRef = useRef(state.chimeOn);
  chimeOnRef.current = state.chimeOn;
  useEffect(() => {
    if (state.newIds.length === 0) return;
    if (chimeOnRef.current) playChime();
    const t = setTimeout(
      () => dispatch({ type: 'CLEAR_NEW' }),
      CONFIG.arrivalAnimMs,
    );
    return () => clearTimeout(t);
  }, [state.newIds, dispatch]);

  // Species-focus sonar rings share the arrival window, then clear.
  useEffect(() => {
    if (state.highlightIds.length === 0) return;
    const t = setTimeout(
      () => dispatch({ type: 'CLEAR_HIGHLIGHT' }),
      CONFIG.arrivalAnimMs,
    );
    return () => clearTimeout(t);
  }, [state.highlightIds, dispatch]);

  return (
    <div className={`app${state.kiosk ? ' app--kiosk' : ''}`}>
      <SpeciesSprite />
      <div className="app__main">
        {state.boardView === 'today' ? (
          <div className="app__today" key="today">
            <TodayBoard />
            <StatusBar
              onToggleChime={() => {
                ensureAudio();
                dispatch({ type: 'SET_CHIME', on: !state.chimeOn });
              }}
              onToggleKiosk={toggleKiosk}
            />
          </div>
        ) : (
          <div
            className="app__map"
            key="map"
            onClick={() => dispatch({ type: 'SELECT', id: null })}
          >
            <MapView
              focus={state.mapFocus}
              overlay={(frame) => (
                <>
                  {selected && (
                    <Popover sighting={selected} frame={frame} nowMs={state.nowMs} />
                  )}
                  {selectedHydro && (
                    <HydroPopover
                      hydrophone={selectedHydro}
                      status={hydroStatus.get(selectedHydro.id)}
                      frame={frame}
                      nowMs={state.nowMs}
                    />
                  )}
                </>
              )}
            >
              {(frame) => (
                <>
                  <PlaceLabels frame={frame} />
                  <HydrophoneLayer
                    hydrophones={state.hydrophones}
                    statuses={hydroStatus}
                    frame={frame}
                    selectedId={state.selectedHydroId}
                    onSelect={(id) => dispatch({ type: 'SELECT_HYDRO', id })}
                  />
                  <GlowLayer
                    sightings={visible}
                    frame={frame}
                    nowMs={state.nowMs}
                    windowHours={state.windowHours}
                    newIds={state.newIds}
                    highlightIds={state.highlightIds}
                    highlightSeq={state.mapFocus?.seq ?? 0}
                  />
                  <MarkerLayer
                    sightings={visible}
                    frame={frame}
                    nowMs={state.nowMs}
                    windowHours={state.windowHours}
                    selectedId={state.selectedId}
                    newIds={state.newIds}
                    highlightIds={state.highlightIds}
                    onSelect={(id) => dispatch({ type: 'SELECT', id })}
                  />
                </>
              )}
            </MapView>
            <h1 className="wordmark">Salish Sea Whale Board</h1>
            <StatusBar
              onToggleChime={() => {
                ensureAudio();
                dispatch({ type: 'SET_CHIME', on: !state.chimeOn });
              }}
              onToggleKiosk={toggleKiosk}
            />
            <TodayPanel />
            {visible.length === 0 && state.lastSuccessAt !== null && (
              <EmptyState windowHours={state.windowHours} />
            )}
            <AttributionFooter />
          </div>
        )}
      </div>
    </div>
  );
}
