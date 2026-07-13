import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import { CONFIG } from '../config';
import type { Action } from '../state/store';

/**
 * Ambient/kiosk hardening: fullscreen (from a user gesture), a screen wake
 * lock re-acquired whenever the tab becomes visible again, cursor auto-hide
 * after 5s idle, and a daily hygiene reload — the memory backstop for
 * unattended multi-week runs.
 */
export function useKiosk(kiosk: boolean, dispatch: Dispatch<Action>) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen denied (e.g. iframe) — still enter chromeless mode.
        dispatch({ type: 'SET_KIOSK', on: true });
      });
    }
  }, [dispatch]);

  // Fullscreen state is the source of truth (covers Esc exits).
  useEffect(() => {
    const sync = () =>
      dispatch({ type: 'SET_KIOSK', on: document.fullscreenElement !== null });
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [dispatch]);

  // Wake lock while kiosk mode is on; the platform releases it on tab hide,
  // so re-request on visibility.
  useEffect(() => {
    if (!kiosk) return;
    let disposed = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // unsupported or denied — the board still works
      }
    };
    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      void disposed;
    };
  }, [kiosk]);

  // Cursor auto-hide.
  useEffect(() => {
    if (!kiosk) return;
    let timer: ReturnType<typeof setTimeout>;
    const rearm = () => {
      document.body.classList.remove('cursor-hidden');
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.add('cursor-hidden'), 5000);
    };
    rearm();
    window.addEventListener('mousemove', rearm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', rearm);
      document.body.classList.remove('cursor-hidden');
    };
  }, [kiosk]);

  // Daily hygiene reload at a quiet hour, only while visible in kiosk mode.
  useEffect(() => {
    if (!kiosk || CONFIG.dailyReloadHour === null) return;
    const check = setInterval(() => {
      const now = new Date();
      if (
        now.getHours() === CONFIG.dailyReloadHour &&
        now.getMinutes() === 0 &&
        document.visibilityState === 'visible'
      ) {
        location.reload();
      }
    }, 60_000);
    return () => clearInterval(check);
  }, [kiosk]);

  return { toggle };
}
