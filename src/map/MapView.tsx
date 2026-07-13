import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GeoProjection } from 'd3-geo';
import { makePath, makeProjection } from './projection';
import { LandLayer } from './LandLayer';

export interface MapFrame {
  projection: GeoProjection;
  width: number;
  height: number;
}

interface MapViewProps {
  /** Layers that need the projection (glows, markers, labels). */
  children?: (frame: MapFrame) => ReactNode;
}

/**
 * Owns the map SVG: sizes to its container via ResizeObserver, builds the
 * projection, and paints the water + stylized landmass beneath whatever
 * projected layers the caller renders.
 */
export function MapView({ children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frame = useMemo<MapFrame | null>(() => {
    if (!size) return null;
    return {
      projection: makeProjection(size.width, size.height),
      ...size,
    };
  }, [size]);

  const path = useMemo(() => (frame ? makePath(frame.projection) : null), [frame]);

  return (
    <div ref={containerRef} className="map">
      {frame && path && (
        <svg
          className="map__svg"
          width={frame.width}
          height={frame.height}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label="Map of the Salish Sea with recent whale sightings"
        >
          <rect className="map__water" width={frame.width} height={frame.height} />
          <LandLayer path={path} />
          {children?.(frame)}
        </svg>
      )}
    </div>
  );
}
