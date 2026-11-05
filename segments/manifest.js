// ─────────────────────────────────────────────────────────────────────────────
//  segments/manifest.js — who owns which seconds of the film.
//  Each segment is built by ONE author end-to-end (picture, music, sound design).
//  Boundaries sit in natural breath pauses of the voice-over.
//  A segment must render correctly for t ∈ [start, end + TAIL] (the TAIL lets the
//  NEXT segment transition out of it) — see docs/API.md §Hand-off.
// ─────────────────────────────────────────────────────────────────────────────
export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const TAIL = 1.5;            // seconds a segment must keep rendering after its end
export const DURATION = 1226.0;     // VO ends at 1220.54 s; 5.5 s outro

export const SEGMENTS = [
  { id: 's1', start: 0.0,     end: 170.5,   title: 'Cold open · the liner · who he was' },
  { id: 's2', start: 170.5,   end: 342.4,   title: 'Cousteau · the ban · the cruise · the plan' },
  { id: 's3', start: 342.4,   end: 522.4,   title: 'Navigation · the hull · the storm · THE JUMP' },
  { id: 's4', start: 522.4,   end: 690.1,   title: 'Alone · first night · bioluminescence · 62 miles' },
  { id: 's5', start: 690.1,   end: 868.8,   title: 'Sun · salt · thirst · hallucinations · 60 hours' },
  { id: 's6', start: 868.8,   end: 1048.08, title: 'Siargao · the reef · ashore · captured' },
  { id: 's7', start: 1048.08, end: DURATION, title: 'Jail · erased · asylum · new life · the lake · legacy' },
];

export const segmentAt = (t) => SEGMENTS.find((s) => t >= s.start && t < s.end) || SEGMENTS[SEGMENTS.length - 1];
