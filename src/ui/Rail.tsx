import { useEffect, useRef } from 'react';
import { CONFIG } from '../config';
import type { Sighting } from '../types';
import { SightingCard } from './SightingCard';

interface RailProps {
  sightings: Sighting[];
  nowMs: number;
  selectedId: string | null;
  newIds: readonly string[];
  onSelect: (id: string | null) => void;
}

/** The illustrated recent-sightings feed — newest first, linked to the map. */
export function Rail({ sightings, nowMs, selectedId, newIds, onSelect }: RailProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const fresh = new Set(newIds);
  const cards = sightings.slice(0, CONFIG.railMaxCards);

  // Selecting a marker on the map brings its card into view.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    listRef.current
      .querySelector(`[data-sighting-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <aside className="rail" aria-label="Recent sightings">
      <h2 className="rail__title">Recent sightings</h2>
      <div className="rail__list" ref={listRef}>
        {cards.map((s) => (
          <SightingCard
            key={s.id}
            sighting={s}
            nowMs={nowMs}
            selected={s.id === selectedId}
            isNew={fresh.has(s.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}
