import { useEffect, useState } from 'react';
import { useAppDispatch, useAppState } from '../state/store';
import { clockLabel, isStale, windowTitle } from '../state/selectors';
import { WindowSelector } from './WindowSelector';

interface StatusBarProps {
  onToggleChime: () => void;
  onToggleKiosk: () => void;
}

/**
 * The board's only chrome: window selector, chime + kiosk toggles, and the
 * unobtrusive stale indicator. Never modal, never covers the map meaningfully.
 * On narrow screens the controls collapse behind a roll-out toggle so the
 * wordmark stays readable.
 */
export function StatusBar({ onToggleChime, onToggleKiosk }: StatusBarProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const stale = isStale(state);
  const onToday = state.boardView === 'today';
  const [isNarrow, setIsNarrow] = useState(false);
  const [rolledOut, setRolledOut] = useState(false);
  const controlsHidden = isNarrow && !rolledOut;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => {
      setIsNarrow(mq.matches);
      if (!mq.matches) setRolledOut(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <div className={`statusbar${rolledOut ? ' is-rolled-out' : ''}`}>
      {stale && (
        <span className="statusbar__stale" role="status">
          <span className="statusbar__pulse" aria-hidden="true" />
          {state.lastSuccessAt
            ? `reconnecting — last updated ${clockLabel(state.lastSuccessAt)}`
            : 'connecting…'}
        </span>
      )}
      <button
        type="button"
        className="statusbar__roll"
        onClick={() => setRolledOut((v) => !v)}
        aria-expanded={rolledOut}
        aria-controls="statusbar-controls"
        title={rolledOut ? 'Hide controls' : 'Show controls'}
      >
        {rolledOut ? '✕' : '⋯'}
      </button>
      <span
        id="statusbar-controls"
        className="statusbar__controls"
        {...(controlsHidden ? { inert: true } : {})}
      >
        <WindowSelector />
        <button
          type="button"
          className={`statusbar__button${onToday ? ' is-active' : ''}`}
          onClick={() =>
            dispatch({ type: 'SET_VIEW', view: onToday ? 'map' : 'today' })
          }
          aria-pressed={onToday}
          title={
            onToday
              ? 'Back to the map'
              : `Sea creatures — ${windowTitle(state.windowHours)}`
          }
        >
          {onToday ? '⊙' : '▦'}
        </button>
        <button
          type="button"
          className={`statusbar__button${state.chimeOn ? ' is-active' : ''}`}
          onClick={onToggleChime}
          aria-pressed={state.chimeOn}
          title={state.chimeOn ? 'Arrival chime on' : 'Arrival chime off (default)'}
        >
          {state.chimeOn ? '♫' : '♪'}
        </button>
        <button
          type="button"
          className="statusbar__button"
          onClick={onToggleKiosk}
          title="Fullscreen ambient mode"
        >
          ⛶
        </button>
      </span>
    </div>
  );
}
