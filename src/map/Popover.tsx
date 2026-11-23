import type { Sighting } from '../types';
import { SPECIES_LABEL } from '../data/species';
import type { MapFrame } from './MapView';
import { clockLabel, timeAgo } from '../state/selectors';
import { podLine } from '../ui/podLine';
import { COMPASS_LABEL, type Track } from '../data/tracks';

interface PopoverProps {
  sighting: Sighting;
  /** Set when the sighting is the head of a linked group track. */
  track?: Track | null;
  frame: MapFrame;
  nowMs: number;
}

/**
 * Detail card anchored to the selected sighting's projected position —
 * an HTML overlay, not a foreignObject, so text lays out normally.
 */
export function Popover({ sighting: s, track = null, frame, nowMs }: PopoverProps) {
  const p = frame.projection([s.lng, s.lat]);
  if (!p) return null;

  // Marker lives inside the zoomed/panned SVG group; mirror that transform so
  // the popover stays pinned to it. IDENTITY when the map isn't zoomed.
  const { k, x: tx, y: ty } = frame.transform;
  const sx = tx + p[0] * k;
  const sy = ty + p[1] * k;

  const flipY = sy < 190;
  const x = Math.min(Math.max(sx, 140), frame.width - 140);

  const pods = track && track.pods.length ? track.pods.join(' + ') : podLine(s);
  const comment = s.comment.replace(/^\s*(\[[^\]]*\]\s*)+/, '').trim();

  return (
    <div
      className={`popover${flipY ? ' popover--below' : ''}`}
      style={{ left: x, top: sy }}
      role="dialog"
      aria-label={`Sighting details: ${SPECIES_LABEL[s.species]}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="popover__head">
        <div className="popover__title">
          <span className="popover__species">{SPECIES_LABEL[s.species]}</span>
          {pods && <span className="popover__id">{pods}</span>}
        </div>
        <time className="popover__age" title={clockLabel(s.epochMs)}>
          {timeAgo(s.epochMs, nowMs)}
        </time>
      </div>

      <dl className="popover__facts">
        {s.count !== null && (
          <div className="popover__fact">
            <dt>Count</dt>
            <dd>
              {s.count} {s.count === 1 ? 'animal' : 'animals'}
            </dd>
          </div>
        )}
        <div className="popover__fact">
          <dt>Area</dt>
          <dd>{s.region ?? 'Salish Sea'}</dd>
        </div>
        {track && (
          <>
            <div className="popover__fact">
              <dt>Track</dt>
              <dd>
                {track.points.length} sightings · {track.reportCount} reports
              </dd>
            </div>
            <div className="popover__fact">
              <dt>First seen</dt>
              <dd>{clockLabel(track.firstMs)}</dd>
            </div>
            <div className="popover__fact">
              <dt>Last seen</dt>
              <dd>{clockLabel(track.lastMs)}</dd>
            </div>
            {track.statedHeading && (
              <div className="popover__fact">
                <dt>Heading</dt>
                <dd>{COMPASS_LABEL[track.statedHeading]}</dd>
              </div>
            )}
            <div className="popover__fact">
              <dt>Moved</dt>
              <dd>{track.distanceKm.toFixed(1)} km</dd>
            </div>
          </>
        )}
        {!track && s.reportCount > 1 && (
          <div className="popover__fact">
            <dt>Reports</dt>
            <dd>{s.reportCount}</dd>
          </div>
        )}
      </dl>

      {comment && <p className="popover__note">{comment}</p>}

      <div className="popover__foot">
        <span>{clockLabel(s.epochMs)} · approx. position</span>
        <span className="popover__source">
          {s.sourceEntity || 'unknown source'} · via Acartia
        </span>
      </div>
    </div>
  );
}
