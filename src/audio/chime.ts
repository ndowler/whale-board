/**
 * A soft two-note arrival chime synthesized in WebAudio — no asset file.
 * The AudioContext is created lazily from the chime-toggle gesture, which
 * satisfies autoplay policies.
 */
let ctx: AudioContext | null = null;

export function ensureAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  void ctx?.resume();
}

export function playChime() {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  for (const [freq, start] of [
    [659.25, 0], // E5
    [987.77, 0.22], // B5
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(0.08, t0 + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + 1);
  }
}
