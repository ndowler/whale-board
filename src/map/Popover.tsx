import type { Sighting } from '../types';
import { SPECIES_LABEL } from '../data/species';
import type { MapFrame } from './MapView';
import { clockLabel, timeAgo } from '../state/selectors';
import { podLine } from '../ui/SightingCard';

interface PopoverProps {
  sighting: Sighting;
  frame: MapFrame;
  nowMs: number;
}

/**
 * Detail card anchored to the selected sighting's projected position —
 * an HTML overlay, not a foreignObject, so text lays out normally.
 */
export function Popover({ sighting: s, frame, nowMs }: PopoverProps) {
  const p = frame.projection([s.lng, s.lat]);
  if (!p) return null;

  const flipY = p[1] < 190;
  const x = Math.min(Math.max(p[0], 140), frame.width - 140);

  const pods = podLine(s);
  const comment = s.comment.replace(/^\s*(\[[^\]]*\]\s*)+/, '').trim();

  return (
    <div
      className={`popover${flipY ? ' popover--below' : ''}`}
      style={{ left: x, top: p[1] }}
      role="dialog"
      aria-label={`Sighting details: ${SPECIES_LABEL[s.species]}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="popover__species">{SPECIES_LABEL[s.species]}</div>
      <div className="popover__meta">
        {pods && <span>{pods}</span>}
        {s.count !== null && (
          <span>
            {s.count} {s.count === 1 ? 'animal' : 'animals'}
          </span>
        )}
        <span>{s.region ?? 'Salish Sea'}</span>
      </div>
      {comment && <div className="popover__note">{comment}</div>}
      <div className="popover__foot">
        <span>
          {timeAgo(s.epochMs, nowMs)} · {clockLabel(s.epochMs)}
        </span>
        <span className="popover__source">
          {s.sourceEntity || 'unknown source'} · via Acartia
        </span>
      </div>
      <div className="popover__hint">position approximate</div>
    </div>
  );
}
