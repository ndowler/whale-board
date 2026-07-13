import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePollingLoop } from './usePollingLoop';
import { CONFIG } from '../config';
import type { Action } from '../state/store';

const fetchSightings = vi.hoisted(() => vi.fn());
vi.mock('./acartiaClient', () => ({ fetchSightings }));

describe('usePollingLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchSightings.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls immediately, then on the regular interval', async () => {
    fetchSightings.mockResolvedValue([]);
    const dispatch = vi.fn();
    renderHook(() => usePollingLoop(dispatch));

    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(fetchSightings).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'POLL_SUCCESS' }),
    );

    await act(() => vi.advanceTimersByTimeAsync(CONFIG.pollIntervalMs + 50));
    expect(fetchSightings).toHaveBeenCalledTimes(2);
  });

  it('walks the backoff ladder on failures and sticks at its end', async () => {
    fetchSightings.mockRejectedValue(new Error('down'));
    const dispatch = vi.fn();
    renderHook(() => usePollingLoop(dispatch));

    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(fetchSightings).toHaveBeenCalledTimes(1);

    for (let i = 0; i < CONFIG.backoffMs.length; i++) {
      await act(() => vi.advanceTimersByTimeAsync(CONFIG.backoffMs[i] + 50));
      expect(fetchSightings).toHaveBeenCalledTimes(i + 2);
    }
    // Stays at the last rung.
    const last = CONFIG.backoffMs[CONFIG.backoffMs.length - 1];
    await act(() => vi.advanceTimersByTimeAsync(last + 50));
    expect(fetchSightings).toHaveBeenCalledTimes(CONFIG.backoffMs.length + 2);

    const types = dispatch.mock.calls.map((c) => (c[0] as Action).type);
    expect(types.every((t) => t === 'POLL_ERROR')).toBe(true);
  });

  it('recovers the normal cadence after a success', async () => {
    fetchSightings.mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    const dispatch = vi.fn();
    renderHook(() => usePollingLoop(dispatch));

    await act(() => vi.advanceTimersByTimeAsync(10)); // fail #1
    await act(() => vi.advanceTimersByTimeAsync(CONFIG.backoffMs[0] + 50)); // success
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'POLL_SUCCESS' }),
    );
    await act(() => vi.advanceTimersByTimeAsync(CONFIG.pollIntervalMs + 50));
    expect(fetchSightings).toHaveBeenCalledTimes(3);
  });

  it('stops polling and aborts on unmount', async () => {
    let seenSignal: AbortSignal | null = null;
    fetchSightings.mockImplementation((signal: AbortSignal) => {
      seenSignal = signal;
      return new Promise(() => {}); // hang forever
    });
    const dispatch = vi.fn();
    const { unmount } = renderHook(() => usePollingLoop(dispatch));

    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(fetchSightings).toHaveBeenCalledTimes(1);
    unmount();
    expect(seenSignal!.aborted).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(CONFIG.pollIntervalMs * 3));
    expect(fetchSightings).toHaveBeenCalledTimes(1);
  });
});
