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

export interface AppState {
  sightings: ReadonlyMap<string, Sighting>;
  /** Ids that arrived in the latest poll — wear the arrival treatment. */
  newIds: readonly string[];
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
  | { type: 'SET_CHIME'; on: boolean }
  | { type: 'SET_KIOSK'; on: boolean };

const CHIME_KEY = 'whaleboard.chime';

export function initialState(nowMs: number): AppState {
  let chimeOn = CONFIG.chimeDefaultOn;
  try {
    const stored = localStorage.getItem(CHIME_KEY);
    if (stored !== null) chimeOn = stored === 'true';
  } catch {
    // storage unavailable (private mode etc.) — keep the default
  }
  return {
    sightings: new Map(),
    newIds: [],
    lastSuccessAt: null,
    consecutiveFailures: 0,
    hydrophones: [],
    detections: [],
    windowHours: CONFIG.defaultWindowHours,
    selectedId: null,
    selectedHydroId: null,
    chimeOn,
    kiosk: false,
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
    case 'SET_CHIME':
      return { ...state, chimeOn: action.on };
    case 'SET_KIOSK':
      return { ...state, kiosk: action.on };
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
