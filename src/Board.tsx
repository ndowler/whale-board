import { useEffect, useRef } from 'react';
import { CONFIG } from './config';
import { useAppDispatch, useAppState } from './state/store';
import { usePollingLoop, useClock } from './data/usePollingLoop';
import { visibleSightings } from './state/selectors';
import { MapView } from './map/MapView';
import { MarkerLayer } from './map/MarkerLayer';
import { GlowLayer } from './map/GlowLayer';
import { Popover } from './map/Popover';
import { Rail } from './ui/Rail';
import { StatusBar } from './ui/StatusBar';
import { EmptyState } from './ui/EmptyState';
import { useKiosk } from './kiosk/useKiosk';
import { AttributionFooter } from './ui/AttributionFooter';
import { SpeciesSprite } from './assets/species/SpeciesSprite';
import { ensureAudio, playChime } from './audio/chime';

export function Board() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  usePollingLoop(dispatch);
  useClock(dispatch);
  const { toggle: toggleKiosk } = useKiosk(state.kiosk, dispatch);

  const visible = visibleSightings(state);
  const selected = state.selectedId
    ? (state.sightings.get(state.selectedId) ?? null)
    : null;

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

  return (
    <div className={`app${state.kiosk ? ' app--kiosk' : ''}`}>
      <SpeciesSprite />
      <div className="app__main">
        <div className="app__map" onClick={() => dispatch({ type: 'SELECT', id: null })}>
          <MapView
            overlay={(frame) =>
              selected && (
                <Popover sighting={selected} frame={frame} nowMs={state.nowMs} />
              )
            }
          >
            {(frame) => (
              <>
                <GlowLayer
                  sightings={visible}
                  frame={frame}
                  nowMs={state.nowMs}
                  windowHours={state.windowHours}
                  newIds={state.newIds}
                />
                <MarkerLayer
                sightings={visible}
                frame={frame}
                nowMs={state.nowMs}
                windowHours={state.windowHours}
                selectedId={state.selectedId}
                newIds={state.newIds}
                onSelect={(id) => dispatch({ type: 'SELECT', id })}
                />
              </>
            )}
          </MapView>
          <StatusBar
            onToggleChime={() => {
              ensureAudio();
              dispatch({ type: 'SET_CHIME', on: !state.chimeOn });
            }}
            onToggleKiosk={toggleKiosk}
          />
          {visible.length === 0 && state.lastSuccessAt !== null && (
            <EmptyState windowHours={state.windowHours} />
          )}
        </div>
        <Rail
          sightings={visible}
          nowMs={state.nowMs}
          selectedId={state.selectedId}
          newIds={state.newIds}
          onSelect={(id) => dispatch({ type: 'SELECT', id })}
        />
      </div>
      <AttributionFooter />
    </div>
  );
}
