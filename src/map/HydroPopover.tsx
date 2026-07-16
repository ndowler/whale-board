import { CONFIG } from '../config';
import type { Hydrophone } from '../types';
import type { HydroStatus } from '../state/selectors';
import { timeAgo } from '../state/selectors';
import type { MapFrame } from './MapView';

interface HydroPopoverProps {
  hydrophone: Hydrophone;
  status: HydroStatus | undefined;
  frame: MapFrame;
  nowMs: number;
}

/** Detail popover for a hydrophone node — acoustic sibling of Popover. */
export function HydroPopover({ hydrophone: h, status, frame, nowMs }: HydroPopoverProps) {
  const p = frame.projection([h.lng, h.lat]);
  if (!p) return null;

  const { k, x: tx, y: ty } = frame.transform;
  const sx = tx + p[0] * k;
  const sy = ty + p[1] * k;
  const flipY = sy < 190;
  const x = Math.min(Math.max(sx, 140), frame.width - 140);

  const heardLine = status?.lastHeardMs
    ? `Whales heard ${timeAgo(status.lastHeardMs, nowMs)}${status.humanConfirmed ? ' · listener confirmed' : ' · AI detection'}`
    : h.online
      ? 'Listening — nothing heard recently'
      : 'Hydrophone offline';

  return (
    <div
      className={`popover${flipY ? ' popover--below' : ''}`}
      style={{ left: x, top: sy }}
      role="dialog"
      aria-label={`Hydrophone details: ${h.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="popover__species">{h.name}</div>
      <div className="popover__meta">
        <span>{heardLine}</span>
      </div>
      <div className="popover__foot">
        <span>Orcasound hydrophone · detections via OrcaHello AI + listeners</span>
        <a
          className="popover__listen"
          href={CONFIG.acoustic.listenUrl(h.slug)}
          target="_blank"
          rel="noreferrer"
        >
          Listen live ↗
        </a>
      </div>
    </div>
  );
}
