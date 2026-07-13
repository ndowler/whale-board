import { CONFIG, type WindowHours } from '../config';
import { useAppDispatch, useAppState } from '../state/store';

const LABEL: Record<WindowHours, string> = { 24: '24h', 72: '3d', 168: '7d' };

export function WindowSelector() {
  const { windowHours } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <div className="window-selector" role="group" aria-label="Freshness window">
      {CONFIG.windowOptions.map((h) => (
        <button
          key={h}
          type="button"
          className={`window-selector__option${h === windowHours ? ' is-active' : ''}`}
          aria-pressed={h === windowHours}
          onClick={() => dispatch({ type: 'SET_WINDOW', hours: h })}
        >
          {LABEL[h]}
        </button>
      ))}
    </div>
  );
}
