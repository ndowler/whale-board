import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
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
  /**
   * When `seq` bumps, ease the camera to fit `points` ([lng, lat]).
   * Wheel/pan stay instant; only this programmatic fit animates.
   */
  focus?: { seq: number; points: readonly [number, number][] } | null;
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
/** Soft cap so a tight cluster still shows neighborhood context. */
const FIT_MAX_ZOOM = 2.4;
/** Button / keyboard zoom step as a multiplicative factor. */
const ZOOM_STEP = 1.35;
const PAN_STEP = 48;

interface Transform {
  k: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Scale around a local (SVG) point, keeping that world point under the finger/cursor. */
function scaleAround(t: Transform, nextK: number, px: number, py: number): Transform {
  const k = clampZoom(nextK);
  if (k === t.k) return t;
  const ratio = k / t.k;
  return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
}

/** Fit projected points into the viewport with padding (room for chrome). */
function fitTransform(
  projected: readonly [number, number][],
  width: number,
  height: number,
): Transform {
  if (projected.length === 0) return IDENTITY;

  const pad = { t: 72, r: 130, b: 56, l: 56 };
  const vw = Math.max(1, width - pad.l - pad.r);
  const vh = Math.max(1, height - pad.t - pad.b);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of projected) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Coincident / single points get a gentle zoom-in rather than a max crop.
  const bw = Math.max(maxX - minX, 36);
  const bh = Math.max(maxY - minY, 36);
  const k = clampZoom(Math.min(FIT_MAX_ZOOM, Math.min(vw / bw, vh / bh)));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    k,
    x: pad.l + vw / 2 - cx * k,
    y: pad.t + vh / 2 - cy * k,
  };
}

export function MapView({ children, overlay, focus }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [animating, setAnimating] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const pan = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const pinch = useRef<{
    dist: number;
    mid: Point;
    transform: Transform;
  } | null>(null);
  const transformRef = useRef(transform);
  const focusSeqRef = useRef(0);

  transformRef.current = transform;

  // Cursor position relative to the SVG's top-left, so zoom anchors on the
  // pointer and pan deltas are in the same pixel space as the projection.
  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const zoomAt = useCallback((deltaY: number, px: number, py: number) => {
    setAnimating(false);
    setTransform((t) => scaleAround(t, t.k * Math.exp(-deltaY * 0.0015), px, py));
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!size) return;
      setAnimating(false);
      const cx = size.width / 2;
      const cy = size.height / 2;
      setTransform((t) => scaleAround(t, t.k * factor, cx, cy));
    },
    [size],
  );

  const beginPinch = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    pan.current = null;
    pinch.current = {
      dist: Math.max(1, dist(pts[0], pts[1])),
      mid: midpoint(pts[0], pts[1]),
      transform: transformRef.current,
    };
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

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      setAnimating(false);
      pointers.current.set(e.pointerId, localPoint(e.clientX, e.clientY));

      if (pointers.current.size >= 2) {
        // Capture both fingers so the gesture survives leaving the SVG bounds.
        e.currentTarget.setPointerCapture(e.pointerId);
        beginPinch();
        return;
      }

      // Record the origin but don't capture yet — a stationary press must stay a
      // click so markers can still be selected. Capture begins on first drag.
      pinch.current = null;
      pan.current = { x: e.clientX, y: e.clientY, dragging: false };
    },
    [beginPinch, localPoint],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, localPoint(e.clientX, e.clientY));

      const pinchState = pinch.current;
      if (pinchState && pointers.current.size >= 2) {
        const pts = [...pointers.current.values()];
        const d = Math.max(1, dist(pts[0], pts[1]));
        const mid = midpoint(pts[0], pts[1]);
        const k = clampZoom(pinchState.transform.k * (d / pinchState.dist));
        const t0 = pinchState.transform;
        const m0 = pinchState.mid;
        // World point that sat under the start midpoint — keep it under the live mid.
        const wx = (m0.x - t0.x) / t0.k;
        const wy = (m0.y - t0.y) / t0.k;
        setTransform({ k, x: mid.x - wx * k, y: mid.y - wy * k });
        return;
      }

      const p = pan.current;
      if (!p || pointers.current.size !== 1) return;
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
    },
    [localPoint],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      pointers.current.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);

      if (pointers.current.size >= 2) {
        beginPinch();
        return;
      }

      pinch.current = null;

      if (pointers.current.size === 1) {
        // Hand off to one-finger pan from the remaining touch.
        const remaining = [...pointers.current.values()][0];
        const rect = svgRef.current?.getBoundingClientRect();
        pan.current = {
          x: (rect?.left ?? 0) + remaining.x,
          y: (rect?.top ?? 0) + remaining.y,
          dragging: false,
        };
        return;
      }

      pan.current = null;
    },
    [beginPinch],
  );

  const resetZoom = useCallback(() => {
    setAnimating(false);
    setTransform(IDENTITY);
  }, []);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      // Don't steal keys from the zoom buttons / other controls inside the map.
      if (target && target !== e.currentTarget && target.tagName === 'BUTTON') return;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomBy(ZOOM_STEP);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomBy(1 / ZOOM_STEP);
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setAnimating(false);
          setTransform((t) => ({ ...t, x: t.x + PAN_STEP }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setAnimating(false);
          setTransform((t) => ({ ...t, x: t.x - PAN_STEP }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setAnimating(false);
          setTransform((t) => ({ ...t, y: t.y + PAN_STEP }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setAnimating(false);
          setTransform((t) => ({ ...t, y: t.y - PAN_STEP }));
          break;
        default:
          break;
      }
    },
    [resetZoom, zoomBy],
  );

  // Programmatic species focus — project points, fit, ease via CSS class.
  useLayoutEffect(() => {
    if (!focus || !size || focus.seq === focusSeqRef.current) return;
    focusSeqRef.current = focus.seq;
    const projection = makeProjection(size.width, size.height);
    const projected: [number, number][] = [];
    for (const [lng, lat] of focus.points) {
      const p = projection([lng, lat]);
      if (p) projected.push([p[0], p[1]]);
    }
    setAnimating(true);
    setTransform(fitTransform(projected, size.width, size.height));
    const t = window.setTimeout(() => setAnimating(false), 560);
    return () => window.clearTimeout(t);
  }, [focus, size]);

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
  const atMinZoom = transform.k <= MIN_ZOOM;
  const atMaxZoom = transform.k >= MAX_ZOOM;

  return (
    <div
      ref={containerRef}
      className="map"
      tabIndex={0}
      role="region"
      aria-label="Interactive map of the Salish Sea with recent whale sightings. Pinch, scroll, or use the zoom controls to explore."
      onKeyDown={onKeyDown}
    >
      {frame && path && (
        <svg
          ref={svgRef}
          className="map__svg"
          width={frame.width}
          height={frame.height}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
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
            className={
              (chart ? 'map__inner map__inner--chart' : 'map__inner') +
              (animating ? ' is-animating' : '')
            }
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
          >
            {chart && (
              <image
                className="map__chart"
                href={`${import.meta.env.BASE_URL}art/raw-chart.webp`}
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
            y={frame.height - 130}
            width={90}
            height={90}
          />
        </svg>
      )}
      <div className="map__zoom" role="group" aria-label="Map zoom">
        <button
          type="button"
          className="map__zoom-btn"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={atMaxZoom}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          className="map__zoom-btn"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={atMinZoom}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          −
        </button>
        <button
          type="button"
          className="map__zoom-btn map__zoom-btn--reset"
          aria-label="Reset map view"
          title="Reset view"
          onClick={resetZoom}
        >
          ⊙
        </button>
      </div>
      {frame && overlay?.({ ...frame, transform })}
    </div>
  );
}
