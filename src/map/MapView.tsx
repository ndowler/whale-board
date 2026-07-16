import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { GeoProjection } from 'd3-geo';
import { CONFIG } from '../config';
import { chartPlacement, graticulePathD, makePath, makeProjection } from './projection';
import { LandLayer } from './LandLayer';

export interface MapFrame {
  projection: GeoProjection;
  width: number;
  height: number;
  /** Live zoom/pan applied to the projected layers, so HTML overlays
   * (popovers) can track markers that live inside the scaled SVG group. */
  transform: { k: number; x: number; y: number };
}

interface MapViewProps {
  /** SVG layers that need the projection (glows, markers, labels). */
  children?: (frame: MapFrame) => ReactNode;
  /** HTML positioned over the SVG (popovers) — same projection frame. */
  overlay?: (frame: MapFrame) => ReactNode;
}

/**
 * Owns the map SVG: sizes to its container via ResizeObserver, builds the
 * projection, and paints the water + stylized landmass beneath whatever
 * projected layers the caller renders.
 */
// The default frame now crops the Sound (cover-blend fit) — allow zooming
// out below 1 so the whole channel is still reachable.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;

interface Transform {
  k: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

export function MapView({ children, overlay }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const pan = useRef<{ x: number; y: number; dragging: boolean } | null>(null);

  // Cursor position relative to the SVG's top-left, so zoom anchors on the
  // pointer and pan deltas are in the same pixel space as the projection.
  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const zoomAt = useCallback((deltaY: number, px: number, py: number) => {
    setTransform((t) => {
      const k = clampZoom(t.k * Math.exp(-deltaY * 0.0015));
      if (k === t.k) return t;
      // Keep the world point under the cursor fixed while scaling.
      const ratio = k / t.k;
      return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
    });
  }, []);

  // React registers onWheel as a passive listener, so preventDefault there is a
  // no-op (page would still scroll). Bind natively with passive:false.
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = localPoint(e.clientX, e.clientY);
      zoomAt(e.deltaY, x, y);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [localPoint, zoomAt, size]);

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Record the origin but don't capture yet — a stationary press must stay a
    // click so markers can still be selected. Capture begins on first drag.
    pan.current = { x: e.clientX, y: e.clientY, dragging: false };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.dragging && Math.hypot(dx, dy) < 4) return; // ignore click jitter
    if (!p.dragging) {
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    pan.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const resetZoom = useCallback(() => setTransform(IDENTITY), []);

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

  // Children render inside the scaled <g> and project into the group's own
  // coordinate space, but their frame still carries the live transform so
  // size-in-screen-pixels ornaments (markers, hydrophones) can counter-scale
  // under zoom. The HTML overlay uses it to track markers from outside the SVG.
  const base = useMemo(() => {
    if (!size) return null;
    return { projection: makeProjection(size.width, size.height), ...size };
  }, [size]);

  const frame = useMemo<MapFrame | null>(
    () => (base ? { ...base, transform } : null),
    [base, transform],
  );

  const path = useMemo(() => (base ? makePath(base.projection) : null), [base]);
  const chart = useMemo(
    () =>
      base && CONFIG.mapArt === 'chart' ? chartPlacement(base.projection) : null,
    [base],
  );
  const graticule = useMemo(
    () => (path && chart ? graticulePathD(path) : null),
    [path, chart],
  );

  // The raster's texture pixels turn to mush under deep zoom — ease it back
  // and let the crisp vector coastline/contours/graticule carry the view.
  const chartOpacity = Math.max(0.45, Math.min(1, 1 - (transform.k - 1.6) * 0.12));

  return (
    <div ref={containerRef} className="map">
      {frame && path && (
        <svg
          ref={svgRef}
          className="map__svg"
          width={frame.width}
          height={frame.height}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label="Map of the Salish Sea with recent whale sightings"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={resetZoom}
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          <defs>
            {/* Deep-center water and a corner vignette, both screen-space —
                the zoom group scales inside them so pan/zoom stays cheap. */}
            <radialGradient id="water-depth" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#0d1b29" />
              <stop offset="100%" stopColor="#071019" />
            </radialGradient>
            <radialGradient id="map-vignette" cx="50%" cy="50%" r="72%">
              <stop offset="0%" stopColor="#04090e" stopOpacity="0" />
              <stop offset="62%" stopColor="#04090e" stopOpacity="0" />
              <stop offset="100%" stopColor="#04090e" stopOpacity="0.62" />
            </radialGradient>
          </defs>
          <rect
            className="map__water"
            width={frame.width}
            height={frame.height}
            fill="url(#water-depth)"
          />
          <g
            className={chart ? 'map__inner map__inner--chart' : 'map__inner'}
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
          >
            {chart && (
              <image
                className="map__chart"
                href={`${import.meta.env.BASE_URL}art/map-chart.webp`}
                x={chart.x}
                y={chart.y}
                width={chart.width}
                height={chart.height}
                preserveAspectRatio="none"
                opacity={chartOpacity}
              />
            )}
            {graticule && <path className="map__graticule" d={graticule} />}
            <LandLayer path={path} />
            {children?.(frame)}
          </g>
          <rect
            className="map__vignette"
            width={frame.width}
            height={frame.height}
            fill="url(#map-vignette)"
          />
          <image
            className="map__compass"
            href={`${import.meta.env.BASE_URL}art/decor/compass.png`}
            x={18}
            y={frame.height - 108}
            width={90}
            height={90}
          />
        </svg>
      )}
      {frame && overlay?.({ ...frame, transform })}
    </div>
  );
}
