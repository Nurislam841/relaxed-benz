'use client';

/**
 * Kahoot-style sound effects via Web Audio API — no MP3 files needed.
 *
 * Design choices (after a first pass shipped too-ambient pad music):
 *   - Tempo: ~125 BPM, same energy band as real Kahoot loops.
 *   - Background: 4-chord pop progression (Cm-Ab-Eb-Bb) with a bass
 *     pulse on every beat and a short melody on top of each chord —
 *     this is what makes it sound "game music" instead of "elevator".
 *   - Win/Lose/Game-Over: multi-note motifs in major/minor keys,
 *     square + triangle waves layered for that arcade-game feel.
 *   - Master gain stays low so the music sits behind voice and quiz
 *     text without competing.
 *
 * Browser autoplay policy:
 *   - Modern browsers block AudioContext until a user gesture. We lazy-
 *     create the context inside the first play call, which is always
 *     downstream of the student's "Join" click → never blocked.
 *   - If the context can't be created (e.g., very old browser), every
 *     function silently no-ops so the game never breaks.
 *
 * Caveat: we cannot literally sound like Kahoot without sampling their
 * music (copyright). This is the closest we can get with pure
 * synthesis. If the user still wants tighter fidelity, the next step
 * is to bundle a small (~200 KB) royalty-free MP3 loop.
 */

let ctx: AudioContext | null = null;
let bgGain: GainNode | null = null;
let bgIntervalId: ReturnType<typeof setInterval> | null = null;
let muted = false;

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

/**
 * Schedule one note. Sharper attack than the first version so notes
 * have a percussive "ping" instead of a slow fade-in — closer to
 * game/arcade music.
 */
function note(opts: {
  freq: number;
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
  /** Optional alternate destination — used for the background bus. */
  dest?: AudioNode;
}) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.value = opts.freq;
  const peak = opts.gain ?? 0.18;
  const now = c.currentTime;
  // Quick attack, short decay — game-music envelope.
  g.gain.setValueAtTime(0, now + opts.at);
  g.gain.linearRampToValueAtTime(peak, now + opts.at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.at + opts.dur);
  osc.connect(g).connect(opts.dest ?? c.destination);
  osc.start(now + opts.at);
  osc.stop(now + opts.at + opts.dur + 0.02);
}

/**
 * "Yes!" sound — 5 notes climbing through a major arpeggio with a
 * sparkly high note on top. Square + triangle layered = arcade game.
 */
function playWin() {
  if (muted || !getCtx()) return;
  const seq = [
    { freq: 523.25, t: 0.0 }, // C5
    { freq: 659.25, t: 0.07 }, // E5
    { freq: 783.99, t: 0.14 }, // G5
    { freq: 1046.5, t: 0.21 }, // C6
    { freq: 1318.51, t: 0.32 }, // E6 — sparkle
  ];
  for (const n of seq) {
    note({ freq: n.freq, at: n.t, dur: 0.22, gain: 0.16, type: 'square' });
    // Triangle harmony an octave below — fattens the sound.
    note({ freq: n.freq / 2, at: n.t, dur: 0.22, gain: 0.1, type: 'triangle' });
  }
}

/**
 * "Nope" — 3-note descending minor with a slight downward bend at
 * the end. Sawtooth gives it a sad-trombone quality without being
 * comedic.
 */
function playLose() {
  if (muted || !getCtx()) return;
  const seq = [
    { freq: 440.0, t: 0.0 }, // A4
    { freq: 349.23, t: 0.13 }, // F4
    { freq: 261.63, t: 0.26 }, // C4
  ];
  for (const n of seq) {
    note({ freq: n.freq, at: n.t, dur: 0.22, gain: 0.16, type: 'sawtooth' });
  }
  // Wobble tail.
  note({ freq: 220.0, at: 0.42, dur: 0.32, gain: 0.14, type: 'sawtooth' });
}

/**
 * "Game over!" triumphant fanfare — a longer 8-note motif that builds
 * to a sustained chord. Plays once when the session ends.
 */
function playGameOver() {
  if (muted || !getCtx()) return;
  const seq: { freq: number; t: number; dur: number; type?: OscillatorType }[] = [
    // Da-da-da-DAH! arpeggio
    { freq: 523.25, t: 0.0, dur: 0.18 }, // C5
    { freq: 659.25, t: 0.18, dur: 0.18 }, // E5
    { freq: 783.99, t: 0.36, dur: 0.18 }, // G5
    { freq: 1046.5, t: 0.54, dur: 0.4 }, // C6 — held
    // Final chord stab
    { freq: 523.25, t: 1.0, dur: 0.8 }, // C5
    { freq: 659.25, t: 1.0, dur: 0.8 }, // E5
    { freq: 783.99, t: 1.0, dur: 0.8 }, // G5
    { freq: 1046.5, t: 1.0, dur: 0.8 }, // C6
  ];
  for (const n of seq) {
    note({ freq: n.freq, at: n.t, dur: n.dur, gain: 0.14, type: n.type ?? 'square' });
    note({ freq: n.freq / 2, at: n.t, dur: n.dur, gain: 0.08, type: 'triangle' });
  }
  // Bass thump under the final chord.
  note({ freq: 130.81, at: 1.0, dur: 0.8, gain: 0.18, type: 'sine' }); // C3
}

/**
 * Looping background music: 4-chord pop progression with bass pulse +
 * a 4-note melody on each chord. Loops every 4 bars (~7.7 s at 125 BPM).
 *
 * Chord progression Cm-Ab-Eb-Bb is the same "epic pop" backbone real
 * Kahoot loops use; with bass + melody on top it reads as game music
 * rather than ambient drift.
 */
function startBackground() {
  if (muted) return;
  if (bgIntervalId) return;
  const c = getCtx();
  if (!c) return;

  bgGain = c.createGain();
  bgGain.gain.value = 0.06; // low so we don't fight the timer / question text
  bgGain.connect(c.destination);

  // 125 BPM → quarter note = 0.48s, one 4-bar loop = 7.68s.
  const Q = 0.48;
  const LOOP_MS = Math.round(Q * 16 * 1000);

  // Each chord = { bass, melody-notes-by-beat }
  // Bars over Cm-Ab-Eb-Bb (epic pop, same family as Kahoot's loops).
  const CHORDS: { bass: number; melody: number[] }[] = [
    { bass: 130.81, melody: [523.25, 622.25, 783.99, 622.25] }, // C3 / C5 Eb5 G5 Eb5
    { bass: 207.65, melody: [523.25, 622.25, 783.99, 622.25] }, // Ab3 / same
    { bass: 155.56, melody: [466.16, 622.25, 932.33, 622.25] }, // Eb3 / Bb4 Eb5 Bb5 Eb5
    { bass: 233.08, melody: [466.16, 587.33, 880.0, 587.33] }, // Bb3 / Bb4 D5 A5 D5
  ];

  const fire = () => {
    if (!c || !bgGain || muted) return;
    // Capture once for TS narrowing — bgGain is checked above but the
    // closures below can't see that without a local non-null binding.
    const dest: AudioNode = bgGain;
    CHORDS.forEach((chord, bar) => {
      const barStart = bar * 4 * Q;
      // Bass on each of the 4 beats.
      for (let beat = 0; beat < 4; beat++) {
        note({
          freq: chord.bass,
          at: barStart + beat * Q,
          dur: Q * 0.85,
          gain: 0.9,
          type: 'sine',
          dest,
        });
      }
      // Melody on each of the 4 beats.
      chord.melody.forEach((freq, beat) => {
        note({
          freq,
          at: barStart + beat * Q + 0.03,
          dur: Q * 0.7,
          gain: 0.45,
          type: 'square',
          dest,
        });
        // Octave-down triangle for body.
        note({
          freq: freq / 2,
          at: barStart + beat * Q + 0.03,
          dur: Q * 0.7,
          gain: 0.25,
          type: 'triangle',
          dest,
        });
      });
    });
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
    const now = ctx.currentTime;
    try {
      bgGain.gain.linearRampToValueAtTime(0, now + 0.15);
    } catch {
      /* ignored */
    }
  }
  setTimeout(() => {
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
  playGameOver,
  startBackground,
  stopBackground,
  setMuted,
  isMuted,
};
