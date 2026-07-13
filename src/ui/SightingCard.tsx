import type { Sighting } from '../types';
import { SPECIES_LABEL } from '../data/species';
import { markerHref } from '../assets/species/SpeciesSprite';
import { timeAgo } from '../state/selectors';

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
      <svg
        className={`card__art card__art--${s.species}`}
        viewBox="0 0 100 60"
        aria-hidden="true"
      >
        <use href={markerHref(s.species)} />
      </svg>
      <span className="card__text">
        <span className="card__species">{SPECIES_LABEL[s.species]}</span>
        <span className="card__meta">
          {pods && <span className="card__pods">{pods} · </span>}
          {s.count !== null && s.count > 1 && `${s.count} · `}
          {s.region ?? 'Salish Sea'}
        </span>
        <span className="card__time">{timeAgo(s.epochMs, nowMs)}</span>
      </span>
    </button>
  );
}
