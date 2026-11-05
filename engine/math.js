// ─────────────────────────────────────────────────────────────────────────────
//  engine/math.js — deterministic math toolkit
//  Everything here is PURE: same input → same output. Never use Math.random()
//  in render code; use rng(seed) / hash() / noise*() instead.
// ─────────────────────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
/** remap v from [a,b] to [c,d] (clamped by default) */
export const remap = (v, a, b, c, d, doClamp = true) => {
  let t = invLerp(a, b, v);
  if (doClamp) t = clamp01(t);
  return c + (d - c) * t;
};
/** progress of time t inside window [t0, t0+dur] → 0..1 clamped */
export const prog = (t, t0, dur) => clamp01((t - t0) / (dur || 1e-6));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);
export const mod = (a, n) => ((a % n) + n) % n;
export const sign = (x) => (x < 0 ? -1 : 1);
export const deg = (r) => (r * 180) / PI;
export const rad = (d) => (d * PI) / 180;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleLerp = (a, b, t) => { let d = mod(b - a + PI, TAU) - PI; return a + d * t; };
/** pulse: 0→1→0 within [t0, t0+dur] using sin */
export const pulse = (t, t0, dur) => { const p = prog(t, t0, dur); return Math.sin(p * PI); };
/** triangle wave 0..1 */
export const tri = (x) => 1 - Math.abs(fract(x) * 2 - 1);
/** frame-quantize a time (useful for stepped / on-twos animation) */
export const onTwos = (t, fps = 12) => Math.floor(t * fps) / fps;

// ── hashing / RNG ───────────────────────────────────────────────────────────
/** integer hash → [0,1) */
export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
export const hash3 = (a, b, c) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791));
/** string → 32-bit seed */
export function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** mulberry32 seeded RNG. rng(seed)() → [0,1). Extra helpers attached. */
export function rng(seed = 1) {
  let a = (typeof seed === 'string' ? seedOf(seed) : seed) >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  r.gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  return r;
}

// ── value / gradient noise (fast, deterministic) ─────────────────────────────
const PERM = new Uint8Array(512);
(() => { const r = rng(1337); const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; })();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad1 = (h, x) => ((h & 1) ? -x : x) * ((h & 2) ? 1 : 0.5 + (h & 4) * 0.125);
const grad2 = (h, x, y) => { const u = (h & 1) ? x : y, v = (h & 1) ? y : x; return ((h & 2) ? -u : u) + ((h & 4) ? -v : v) * 0.5; };
const grad3 = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };

/** 1D gradient noise, ~[-1,1] */
export function noise1(x) {
  const X = Math.floor(x) & 255; x -= Math.floor(x);
  const u = fade(x);
  return lerp(grad1(PERM[X], x), grad1(PERM[X + 1], x - 1), u) * 1.6;
}
/** 2D Perlin noise, ~[-1,1] */
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = PERM[X] + Y, b = PERM[X + 1] + Y;
  return lerp(lerp(grad2(PERM[a], x, y), grad2(PERM[b], x - 1, y), u),
              lerp(grad2(PERM[a + 1], x, y - 1), grad2(PERM[b + 1], x - 1, y - 1), u), v) * 1.4;
}
/** 3D Perlin noise, ~[-1,1] */
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  return lerp(lerp(lerp(grad3(PERM[AA], x, y, z), grad3(PERM[BA], x - 1, y, z), u),
                   lerp(grad3(PERM[AB], x, y - 1, z), grad3(PERM[BB], x - 1, y - 1, z), u), v),
              lerp(lerp(grad3(PERM[AA + 1], x, y, z - 1), grad3(PERM[BA + 1], x - 1, y, z - 1), u),
                   lerp(grad3(PERM[AB + 1], x, y - 1, z - 1), grad3(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
/** fractal brownian motion over noise2 */
export function fbm2(x, y, oct = 4, lac = 2, gain = 0.5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= lac; a *= gain; }
  return s;
}
export function fbm3(x, y, z, oct = 4, lac = 2, gain = 0.5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= lac; a *= gain; }
  return s;
}
/** smooth wobble for "alive" values: wob(t, speed, seed) ∈ [-1,1] */
export const wob = (t, speed = 1, seed = 0) => noise2(t * speed, seed * 17.13 + 0.5);

// ── springs (analytic, deterministic) ────────────────────────────────────────
/**
 * Damped spring response from 0 → 1 for a step input at t=0.
 * freq: natural frequency in Hz (2–6 typical), zeta: damping ratio (0.3 bouncy … 1 critical).
 * Returns value that overshoots when zeta < 1. t in seconds (t<0 → 0).
 */
export function spring(t, freq = 3, zeta = 0.5) {
  if (t <= 0) return 0;
  const w = TAU * freq;
  if (zeta < 1) {
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}
/** spring between two values, starting at t0 */
export const springTo = (t, t0, from, to, freq = 3, zeta = 0.5) => from + (to - from) * spring(t - t0, freq, zeta);
/** damped oscillation (impulse response) — for jiggles / secondary motion, starts at t0 */
export function jiggle(t, t0, amp = 1, freq = 4, decay = 4) {
  const d = t - t0; if (d < 0) return 0;
  return amp * Math.sin(TAU * freq * d) * Math.exp(-decay * d);
}

// ── keyframes ────────────────────────────────────────────────────────────────
/**
 * Keyframe interpolation.  keys: [[time, value, easeFn?], ...]  (sorted by time)
 * value can be a number or an array of numbers. The ease on a key applies to the
 * segment ARRIVING at that key.
 */
export function kf(t, keys, defaultEase) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      let p = (t - k0[0]) / (k1[0] - k0[0]);
      const e = k1[2] || defaultEase;
      if (e) p = e(p);
      const a = k0[1], b = k1[1];
      if (Array.isArray(a)) return a.map((v, j) => v + (b[j] - v) * p);
      return a + (b - a) * p;
    }
  }
  return last[1];
}

// ── geometry helpers ─────────────────────────────────────────────────────────
export function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
/** Catmull-Rom through points, returns dense polyline */
export function catmull(points, segs = 12, closed = false) {
  const out = []; const n = points.length;
  const P = (i) => closed ? points[mod(i, n)] : points[clamp(i, 0, n - 1)];
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < segs; s++) {
      const t = s / segs, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}
/** cumulative lengths of a polyline */
export function polyLengths(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}
/** point + tangent angle at fraction f (0..1) along polyline */
export function polyAt(pts, f, lens = polyLengths(pts)) {
  const total = lens[lens.length - 1]; const d = clamp01(f) * total;
  let i = 1; while (i < lens.length - 1 && lens[i] < d) i++;
  const seg = lens[i] - lens[i - 1] || 1e-6; const k = (d - lens[i - 1]) / seg;
  const a = pts[i - 1], b = pts[i];
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
/** sub-polyline from 0..f (for "draw-on" line animation) */
export function polySlice(pts, f0, f1, lens = polyLengths(pts)) {
  const total = lens[lens.length - 1]; const d0 = clamp01(f0) * total, d1 = clamp01(f1) * total;
  const out = [];
  const a = polyAt(pts, f0, lens); out.push([a.x, a.y]);
  for (let i = 1; i < pts.length - 1; i++) if (lens[i] > d0 && lens[i] < d1) out.push(pts[i]);
  const b = polyAt(pts, f1, lens); out.push([b.x, b.y]);
  return out;
}

// ── colour ───────────────────────────────────────────────────────────────────
/** '#rrggbb' → [r,g,b] 0..255 */
export function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (c, a = 1) => {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
};
/** mix two colours (hex or rgb arrays) → css rgba string */
export function mixColor(c1, c2, t, a = 1) {
  const A = typeof c1 === 'string' ? hex(c1) : c1, B = typeof c2 === 'string' ? hex(c2) : c2;
  return rgba([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)], a);
}
/** multiply brightness of a colour (0..2) → rgba string */
export function shade(c, k, a = 1) {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  if (k <= 1) return rgba([r * k, g * k, b * k], a);
  const t = k - 1; return rgba([lerp(r, 255, t), lerp(g, 255, t), lerp(b, 255, t)], a);
}
/** OKLCH → css string (browsers support oklch() natively in canvas) */
export const oklch = (l, c, h, a = 1) => `oklch(${l} ${c} ${h} / ${a})`;
