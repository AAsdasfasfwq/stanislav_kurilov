// ─────────────────────────────────────────────────────────────────────────────
//  engine/audio/theory.js — notes, chords, scales, rhythm grid, leitmotifs.
// ─────────────────────────────────────────────────────────────────────────────
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'D4' / 'F#3' / 'Bb2' → MIDI number */
export function midi(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(n.trim());
  if (!m) throw new Error('bad note ' + n);
  return 12 * (parseInt(m[3], 10) + 1) + NAMES[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const hz = (m) => 440 * Math.pow(2, (midi(m) - 69) / 12);

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11], wholeTone: [0, 2, 4, 6, 8, 10], pentaMinor: [0, 3, 5, 7, 10],
  pentaMajor: [0, 2, 4, 7, 9], hijaz: [0, 1, 4, 5, 7, 8, 10], diminished: [0, 2, 3, 5, 6, 8, 9, 11],
};
/** degree (0-based, can exceed 7) in scale from root → midi */
export function deg(root, scale, d) {
  const s = SCALES[scale] || scale; const r = midi(root);
  const o = Math.floor(d / s.length); const i = ((d % s.length) + s.length) % s.length;
  return r + o * 12 + s[i];
}
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], 5: [0, 7], maj9: [0, 4, 7, 11, 14], '7sus4': [0, 5, 7, 10],
};
/** chord('Dm7', 3) → midi array. Root can be 'F#', 'Bb'. Slash bass: 'C/E'. */
export function chord(name, octave = 4) {
  const [main, bassName] = name.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  const root = midi(m[1] + octave); const q = QUAL[m[2]] ?? QUAL[''];
  const notes = q.map((i) => root + i);
  if (bassName) notes.unshift(midi(bassName + (octave - 1)));
  return notes;
}
/** spread a chord into an open voicing across ranges */
export function voice(notes, { low = 48, high = 76 } = {}) {
  return notes.map((n) => { while (n < low) n += 12; while (n > high) n -= 12; return n; }).sort((a, b) => a - b);
}
/** tempo grid: beat(i) / bar(i) → seconds (global), starting at t0 */
export function grid(bpm, t0 = 0, beatsPerBar = 4) {
  const spb = 60 / bpm;
  return { spb, beat: (b) => t0 + b * spb, bar: (n, b = 0) => t0 + (n * beatsPerBar + b) * spb, bpm, t0, beatsPerBar };
}

/**
 * LEITMOTIFS — recurring musical ideas of the film (use, vary, transpose).
 *   [semitone offset from root, duration in beats]
 *  FREEDOM  — Kurilov's theme: a rising fifth, a hopeful raised sixth (dorian), stepwise descent home.
 *             "the man who belongs to the ocean". Root D. Strings / piano / choir / solo horn.
 *  SYSTEM   — the State: grinding semitone ostinato in low register (bassoon/low brass/synth).
 *  OCEAN    — slow rising minor-ninth arpeggio, the endless water (pads, harp, glass).
 *  WATCH    — 2-note tick motif for surveillance / KGB / ticking plans (pizzicato / clock).
 */
export const MOTIFS = {
  FREEDOM: [[0, 1], [7, 1.5], [9, 0.5], [7, 1], [5, 1], [3, 1.5], [2, 0.5], [0, 2]],
  FREEDOM_SHORT: [[0, 1], [7, 1.5], [9, 0.5], [7, 2]],
  SYSTEM: [[0, 0.5], [1, 0.5], [0, 0.5], [-1, 0.5]],
  OCEAN: [[0, 1], [3, 1], [7, 1], [10, 1], [14, 4]],
  WATCH: [[0, 0.5], [6, 0.5]],
};
/** play a motif with any instrument callback: fn(time, midiNote, durSeconds, index) */
export function playMotif(motif, root, t0, bpm, fn, { transpose = 0, durScale = 1 } = {}) {
  const spb = 60 / bpm; let t = t0;
  motif.forEach(([semi, beats], i) => { fn(t, midi(root) + semi + transpose, beats * spb * durScale, i); t += beats * spb; });
  return t;
}
