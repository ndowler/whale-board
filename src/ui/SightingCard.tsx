import { useState } from 'react';
import type { Sighting, SpeciesId } from '../types';
import { SPECIES_LABEL } from '../data/species';
import { markerHref } from '../assets/species/SpeciesSprite';
import { plateArtUrl, usePlates } from '../assets/species/art';
import { timeAgo } from '../state/selectors';

/** Card art: the M4 plate illustration, silhouette as fallback. */
function CardArt({ species }: { species: SpeciesId }) {
  const [failed, setFailed] = useState(false);
  if (!usePlates() || failed)
    return (
      <svg
        className={`card__art card__art--${species}`}
        viewBox="0 0 100 60"
        aria-hidden="true"
      >
        <use href={markerHref(species)} />
      </svg>
    );
  return (
    <img
      className="card__art card__art--plate"
      src={plateArtUrl(species)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

interface SightingCardProps {
  sighting: Sighting;
  nowMs: number;
  selected: boolean;
  isNew: boolean;
  onSelect: (id: string | null) => void;
}

export function podLine(s: Sighting): string | null {
  if (s.pods.length > 0) return s.pods.join(', ');
  if (s.individuals.length > 0) return s.individuals.join(', ');
  if (s.ecotype === 'biggs') return "Bigg's";
  if (s.ecotype === 'srkw') return 'Southern Resident';
  return null;
}

export function SightingCard({
  sighting: s,
  nowMs,
  selected,
  isNew,
  onSelect,
}: SightingCardProps) {
  const pods = podLine(s);
  return (
    <button
      type="button"
      className={`card${selected ? ' is-selected' : ''}${isNew ? ' is-new' : ''}`}
      onClick={() => onSelect(selected ? null : s.id)}
      data-sighting-id={s.id}
    >
      <CardArt species={s.species} />
      <span className="card__text">
        <span className="card__species">{SPECIES_LABEL[s.species]}</span>
        <span className="card__meta">
          {pods && <span className="card__pods">{pods} · </span>}
          {s.count !== null && s.count > 1 && `${s.count} · `}
          {s.region ?? 'Salish Sea'}
          {s.reportCount > 1 && ` · ${s.reportCount} reports`}
        </span>
        <span className="card__time">{timeAgo(s.epochMs, nowMs)}</span>
      </span>
    </button>
  );
}
