import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { CONFIG, type WindowHours } from '../config';
import type { AcousticDetection, Hydrophone, Sighting } from '../types';
import { mergeSightings } from '../data/normalize';

/** The two faces of the board: the map, or the seen-today collage. */
export type BoardView = 'map' | 'today';

export interface AppState {
  sightings: ReadonlyMap<string, Sighting>;
  /** Ids that arrived in the latest poll — wear the arrival treatment. */
  newIds: readonly string[];
  /**
   * Sightings briefly wearing the sonar ping (e.g. after tapping a
   * seen-today species). Independent of newIds so poll arrivals and
   * manual focus can overlap cleanly.
   */
  highlightIds: readonly string[];
  /** Camera cue for MapView — bump seq to re-fit even to the same points. */
  mapFocus: { seq: number; points: readonly [number, number][] } | null;
  lastSuccessAt: number | null;
  consecutiveFailures: number;
  /** Acoustic bridge: hydrophone nodes + recent whale detections. */
  hydrophones: readonly Hydrophone[];
  detections: readonly AcousticDetection[];
  windowHours: WindowHours;
  selectedId: string | null;
  selectedHydroId: string | null;
  chimeOn: boolean;
  kiosk: boolean;
  boardView: BoardView;
  /** UI clock, advanced by TICK — drives decay, time-ago, staleness. */
  nowMs: number;
}

export type Action =
  | { type: 'POLL_SUCCESS'; sightings: Sighting[]; at: number }
  | { type: 'BACKFILL_SUCCESS'; sightings: Sighting[]; at: number }
  | { type: 'POLL_ERROR'; at: number }
  | {
      type: 'ACOUSTIC_SUCCESS';
      hydrophones: Hydrophone[];
      detections: AcousticDetection[];
      at: number;
    }
  | { type: 'TICK'; now: number }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SELECT_HYDRO'; id: string | null }
  | { type: 'SET_WINDOW'; hours: WindowHours }
  | { type: 'CLEAR_NEW' }
  | {
      type: 'FOCUS_SPECIES';
      /** Visible sighting ids of this species — ping targets. */
      ids: readonly string[];
      /** [lng, lat] points for the map to fit. */
      points: readonly [number, number][];
    }
  | { type: 'CLEAR_HIGHLIGHT' }
  | { type: 'SET_CHIME'; on: boolean }
  | { type: 'SET_KIOSK'; on: boolean }
  | { type: 'SET_VIEW'; view: BoardView };

const CHIME_KEY = 'whaleboard.chime';
const VIEW_KEY = 'whaleboard.view';

export function initialState(nowMs: number): AppState {
  let chimeOn = CONFIG.chimeDefaultOn;
  let boardView: BoardView = 'map';
  try {
    const stored = localStorage.getItem(CHIME_KEY);
    if (stored !== null) chimeOn = stored === 'true';
    const view = localStorage.getItem(VIEW_KEY);
    if (view === 'map' || view === 'today') boardView = view;
  } catch {
    // storage unavailable (private mode etc.) — keep the defaults
  }
  return {
    sightings: new Map(),
    newIds: [],
    highlightIds: [],
    mapFocus: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    hydrophones: [],
    detections: [],
    windowHours: CONFIG.defaultWindowHours,
    selectedId: null,
    selectedHydroId: null,
    chimeOn,
    kiosk: false,
    boardView,
    nowMs,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'POLL_SUCCESS': {
      const { next, addedIds } = mergeSightings(
        state.sightings,
        action.sightings,
        action.at,
      );
      // The very first poll populates the whole board — that's a refresh,
      // not an arrival; only later polls animate.
      const isFirst = state.lastSuccessAt === null;
      return {
        ...state,
        sightings: next,
        newIds: isFirst ? [] : addedIds,
        lastSuccessAt: action.at,
        consecutiveFailures: 0,
        nowMs: action.at,
      };
    }
    case 'BACKFILL_SUCCESS': {
      // History from the token-gated full feed (via the proxy Worker).
      // It is not an arrival and not a poll: newIds, lastSuccessAt, and
      // consecutiveFailures stay untouched so it can never animate arrivals
      // or mask /current staleness.
      const { next } = mergeSightings(state.sightings, action.sightings, action.at);
      return { ...state, sightings: next };
    }
    case 'POLL_ERROR':
      // Last-good data is never cleared on failure.
      return {
        ...state,
        consecutiveFailures: state.consecutiveFailures + 1,
        nowMs: action.at,
      };
    case 'ACOUSTIC_SUCCESS': {
      // Acoustic data is decorative — failures are silent and detections
      // simply age out; only rows still inside the heard window are kept.
      const floor = action.at - CONFIG.acoustic.heardWindowMs;
      return {
        ...state,
        hydrophones: action.hydrophones,
        detections: action.detections.filter((d) => d.epochMs >= floor),
      };
    }
    case 'TICK':
      return { ...state, nowMs: action.now };
    case 'SELECT':
      return { ...state, selectedId: action.id, selectedHydroId: null };
    case 'SELECT_HYDRO':
      return { ...state, selectedHydroId: action.id, selectedId: null };
    case 'SET_WINDOW':
      return { ...state, windowHours: action.hours };
    case 'CLEAR_NEW':
      return state.newIds.length === 0 ? state : { ...state, newIds: [] };
    case 'FOCUS_SPECIES':
      // Overview mode: clear the single-sighting popover so the fitted
      // frame and sonar rings can read as a group.
      return {
        ...state,
        selectedId: null,
        selectedHydroId: null,
        highlightIds: action.ids,
        mapFocus: {
          seq: (state.mapFocus?.seq ?? 0) + 1,
          points: action.points,
        },
      };
    case 'CLEAR_HIGHLIGHT':
      return state.highlightIds.length === 0
        ? state
        : { ...state, highlightIds: [] };
    case 'SET_CHIME':
      return { ...state, chimeOn: action.on };
    case 'SET_KIOSK':
      return { ...state, kiosk: action.on };
    case 'SET_VIEW':
      // Popovers are map-anchored; a stale selection must not survive the
      // switch (or reappear on the way back).
      return {
        ...state,
        boardView: action.view,
        selectedId: null,
        selectedHydroId: null,
        highlightIds: [],
      };
  }
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, Date.now(), initialState);

  useEffect(() => {
    try {
      localStorage.setItem(CHIME_KEY, String(state.chimeOn));
    } catch {
      // best effort
    }
  }, [state.chimeOn]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, state.boardView);
    } catch {
      // best effort
    }
  }, [state.boardView]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const s = useContext(StateContext);
  if (!s) throw new Error('useAppState outside StoreProvider');
  return s;
}

export function useAppDispatch(): Dispatch<Action> {
  const d = useContext(DispatchContext);
  if (!d) throw new Error('useAppDispatch outside StoreProvider');
  return d;
}
