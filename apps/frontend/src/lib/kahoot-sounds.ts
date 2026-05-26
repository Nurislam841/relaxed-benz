'use client';

/**
 * Kahoot sound effects without bundling MP3 files.
 *
 * Why Web Audio API instead of <audio src=...>:
 *   - No asset hosting / copyright concerns. Diploma demo works offline,
 *     no licensing footnote needed.
 *   - Deterministic. The same chord progression always plays the same
 *     way; no MP3 decode lag on slow connections.
 *   - Tiny. Zero bytes shipped beyond this file's ~3KB.
 *
 * Browser autoplay policy:
 *   - Modern browsers block AudioContext until the page receives a user
 *     gesture (click, key, touch). We lazy-create the context in the
 *     first play call so that always happens AFTER the student has
 *     clicked "Join", which counts as a gesture.
 *   - If creation throws / suspends, every call is a silent no-op so
 *     gameplay never breaks.
 *
 * The exported API is a small object so a single `import { sounds }`
 * gives callers everything: SFX (win/lose) + the background loop +
 * the mute toggle.
 */

let ctx: AudioContext | null = null;
let bgGain: GainNode | null = null;
let bgOscs: OscillatorNode[] = [];
let bgIntervalId: ReturnType<typeof setInterval> | null = null;
let muted = false;

/**
 * Persisted across reloads so a student who hates the music doesn't
 * have to mute it every time the host starts a new question.
 */
const MUTE_KEY = 'kahoot-muted';
if (typeof window !== 'undefined') {
  muted = window.localStorage?.getItem(MUTE_KEY) === '1';
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Play a short sequence of notes with a soft envelope. Shared by win/lose. */
function playNotes(notes: { freq: number; at: number; dur: number; gain?: number; type?: OscillatorType }[]) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.15;
    // Attack-decay envelope so notes don't pop on start/stop.
    g.gain.setValueAtTime(0, now + n.at);
    g.gain.linearRampToValueAtTime(peak, now + n.at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur);
    osc.connect(g).connect(c.destination);
    osc.start(now + n.at);
    osc.stop(now + n.at + n.dur + 0.05);
  }
}

/** Bright ascending major-triad arpeggio (C5–E5–G5–C6) — "you got it". */
function playWin() {
  playNotes([
    { freq: 523.25, at: 0.0, dur: 0.12, gain: 0.18, type: 'triangle' }, // C5
    { freq: 659.25, at: 0.1, dur: 0.12, gain: 0.18, type: 'triangle' }, // E5
    { freq: 783.99, at: 0.2, dur: 0.18, gain: 0.2, type: 'triangle' }, // G5
    { freq: 1046.5, at: 0.36, dur: 0.32, gain: 0.22, type: 'triangle' }, // C6
  ]);
}

/** Two-note descending minor — short "nope". */
function playLose() {
  playNotes([
    { freq: 311.13, at: 0.0, dur: 0.18, gain: 0.22, type: 'sawtooth' }, // Eb4
    { freq: 233.08, at: 0.18, dur: 0.34, gain: 0.22, type: 'sawtooth' }, // Bb3
  ]);
}

/**
 * Low-volume background loop. A two-bar ambient-pad pattern that loops
 * every ~6 seconds, mixed quiet enough to sit behind voice / question
 * text without being annoying.
 */
function startBackground() {
  if (muted) return;
  if (bgIntervalId) return; // already running
  const c = getCtx();
  if (!c) return;

  // Master gain for background, separate from SFX so we can fade.
  bgGain = c.createGain();
  bgGain.gain.value = 0.04; // intentionally subtle — quiz is not a rave
  bgGain.connect(c.destination);

  const PATTERN: { freq: number; at: number; dur: number }[] = [
    // C minor pad-ish loop (Cm → Gm → Bb → Eb) — chill, not distracting.
    { freq: 130.81, at: 0.0, dur: 1.4 }, // C3
    { freq: 196.0, at: 0.0, dur: 1.4 }, // G3 (root + fifth = "warmth")
    { freq: 196.0, at: 1.5, dur: 1.4 }, // G3
    { freq: 246.94, at: 1.5, dur: 1.4 }, // B3
    { freq: 233.08, at: 3.0, dur: 1.4 }, // Bb3
    { freq: 311.13, at: 3.0, dur: 1.4 }, // Eb4
    { freq: 155.56, at: 4.5, dur: 1.4 }, // Eb3
    { freq: 207.65, at: 4.5, dur: 1.4 }, // Ab3
  ];
  const LOOP_MS = 6000;

  const fire = () => {
    if (!c || !bgGain || muted) return;
    const now = c.currentTime;
    for (const n of PATTERN) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0, now + n.at);
      g.gain.linearRampToValueAtTime(1, now + n.at + 0.4);
      g.gain.linearRampToValueAtTime(0, now + n.at + n.dur);
      osc.connect(g).connect(bgGain);
      osc.start(now + n.at);
      osc.stop(now + n.at + n.dur + 0.05);
      bgOscs.push(osc);
    }
    // Trim oscillator list so we don't grow it forever.
    if (bgOscs.length > 100) bgOscs = bgOscs.slice(-50);
  };

  fire();
  bgIntervalId = setInterval(fire, LOOP_MS);
}

function stopBackground() {
  if (bgIntervalId) {
    clearInterval(bgIntervalId);
    bgIntervalId = null;
  }
  if (bgGain && ctx) {
    // Quick fade so we don't pop the speakers on a hard stop.
    const now = ctx.currentTime;
    try {
      bgGain.gain.linearRampToValueAtTime(0, now + 0.15);
    } catch {
      /* ignored */
    }
  }
  // Don't immediately disconnect — let the ramp complete.
  setTimeout(() => {
    bgOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
    bgOscs = [];
    try {
      bgGain?.disconnect();
    } catch {
      /* ignored */
    }
    bgGain = null;
  }, 200);
}

function setMuted(next: boolean) {
  muted = next;
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem(MUTE_KEY, next ? '1' : '0');
  }
  if (next) stopBackground();
}

function isMuted() {
  return muted;
}

export const sounds = {
  playWin,
  playLose,
  startBackground,
  stopBackground,
  setMuted,
  isMuted,
};
