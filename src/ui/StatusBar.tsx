import { useAppDispatch, useAppState } from '../state/store';
import { clockLabel, isStale } from '../state/selectors';
import { WindowSelector } from './WindowSelector';

interface StatusBarProps {
  onToggleChime: () => void;
  onToggleKiosk: () => void;
}

/**
 * The board's only chrome: window selector, chime + kiosk toggles, and the
 * unobtrusive stale indicator. Never modal, never covers the map meaningfully.
 */
export function StatusBar({ onToggleChime, onToggleKiosk }: StatusBarProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const stale = isStale(state);
  const onToday = state.boardView === 'today';

  return (
    <div className="statusbar">
      {stale && (
        <span className="statusbar__stale" role="status">
          <span className="statusbar__pulse" aria-hidden="true" />
          {state.lastSuccessAt
            ? `reconnecting — last updated ${clockLabel(state.lastSuccessAt)}`
            : 'connecting…'}
        </span>
      )}
      <span className="statusbar__controls">
        <WindowSelector />
        <button
          type="button"
          className={`statusbar__button${onToday ? ' is-active' : ''}`}
          onClick={() =>
            dispatch({ type: 'SET_VIEW', view: onToday ? 'map' : 'today' })
          }
          aria-pressed={onToday}
          title={onToday ? 'Back to the map' : 'Sea creatures seen today'}
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
