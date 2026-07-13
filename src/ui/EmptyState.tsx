import type { WindowHours } from '../config';

const WINDOW_PHRASE: Record<WindowHours, string> = {
  24: 'the last 24 hours',
  72: 'the last 3 days',
  168: 'the last 7 days',
};

/**
 * Quiet water is a frequent, legitimate state (the feed lags hours behind
 * the water) — it must read as deliberate calm, never as a broken screen.
 */
export function EmptyState({ windowHours }: { windowHours: WindowHours }) {
  return (
    <div className="empty" role="status">
      <svg className="empty__waves" viewBox="0 0 120 24" aria-hidden="true">
        <path d="M4,14 Q16,6 28,14 T52,14" />
        <path d="M64,16 Q76,8 88,16 T112,16" />
      </svg>
      <div className="empty__title">Quiet water</div>
      <div className="empty__sub">
        No whales reported in {WINDOW_PHRASE[windowHours]}
      </div>
    </div>
  );
}
