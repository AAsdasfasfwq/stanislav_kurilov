// ─────────────────────────────────────────────────────────────────────────────
//  engine/ease.js — the project's easing vocabulary.
//  MOTION LANGUAGE (see docs/BIBLE.md §Motion):
//    • entrances / landings ........ E.out   (expo-out feel, cubic-bezier(0.16,1,0.3,1))
//    • on-screen repositioning ..... E.std   (cubic-bezier(0.4,0,0.2,1))
//    • exits / things leaving ...... E.in    (cubic-bezier(0.7,0,0.84,0))
//    • heroic / premium reveal ..... E.hero  (cubic-bezier(0.22,1,0.36,1))
//    • physical objects ............ springs from math.js (spring / springTo / jiggle)
//  Linear only for continuous loops (rotation, drift, conveyor).
// ─────────────────────────────────────────────────────────────────────────────

/** Build a cubic-bezier easing function identical to CSS cubic-bezier(x1,y1,x2,y2). */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return t; const d = dsx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const c = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const wrap = (f) => (t) => f(c(t));

export const linear = (t) => c(t);
// core vocabulary
export const out = bezier(0.16, 1, 0.3, 1);      // signature entrance (hard decel)
export const hero = bezier(0.22, 1, 0.36, 1);    // premium hero landing
export const std = bezier(0.4, 0, 0.2, 1);       // reposition
export const inn = bezier(0.7, 0, 0.84, 0);      // exit / accelerate away
export const inOut = bezier(0.65, 0, 0.35, 1);   // camera moves, symmetric
export const soft = bezier(0.25, 0.1, 0.25, 1);  // data, calm
export const back = bezier(0.34, 1.56, 0.64, 1); // overshoot — playful only (use rarely)
export const anticip = bezier(0.36, 0, 0.66, -0.56); // anticipation (pull back before go)

// classic families
export const quadIn = wrap((t) => t * t);
export const quadOut = wrap((t) => 1 - (1 - t) * (1 - t));
export const quadInOut = wrap((t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
export const cubicIn = wrap((t) => t * t * t);
export const cubicOut = wrap((t) => 1 - Math.pow(1 - t, 3));
export const cubicInOut = wrap((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
export const quartOut = wrap((t) => 1 - Math.pow(1 - t, 4));
export const quintOut = wrap((t) => 1 - Math.pow(1 - t, 5));
export const expoIn = wrap((t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)));
export const expoOut = wrap((t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)));
export const expoInOut = wrap((t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
export const sineIn = wrap((t) => 1 - Math.cos((t * Math.PI) / 2));
export const sineOut = wrap((t) => Math.sin((t * Math.PI) / 2));
export const sineInOut = wrap((t) => -(Math.cos(Math.PI * t) - 1) / 2);
export const circOut = wrap((t) => Math.sqrt(1 - Math.pow(t - 1, 2)));
export const circInOut = wrap((t) => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2);
export const backOut = (s = 1.70158) => wrap((t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2));
export const elasticOut = wrap((t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
export const bounceOut = wrap((t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
});
/** stepped easing (for on-twos / mechanical ticks) */
export const steps = (n) => (t) => Math.min(1, Math.floor(c(t) * n) / (n - 1 || 1));

/**
 * Convenience: eased progress inside a time window.
 *   ep(t, start, dur, E.out) → 0..1
 */
export const ep = (t, start, dur, fn = out) => fn(c((t - start) / (dur || 1e-6)));
/**
 * In-hold-out envelope: rises over `inDur` from `start`, holds, falls over `outDur` ending at `end`.
 */
export function env(t, start, end, inDur = 0.4, outDur = 0.4, fin = out, fout = inn) {
  if (t < start || t > end) return 0;
  const a = fin(c((t - start) / (inDur || 1e-6)));
  const b = 1 - fout(c((t - (end - outDur)) / (outDur || 1e-6)));
  return Math.min(a, b);
}
