// ─────────────────────────────────────────────────────────────────────────────
//  engine/transitions.js — transition family for Sequence `in:` slots.
//  Each factory returns { dur, fn(ctx, A, B, p, info) } where A = outgoing layer,
//  B = incoming layer (both full-frame canvases), p = 0..1 linear progress.
//
//  The film's TRANSITION LANGUAGE (docs/BIBLE.md §Edit):
//    motivated, content-linked transitions only. Default is the HARD CUT.
//    Signature families: circle/porthole iris · water-surface wipe · ink bleed ·
//    line wipe (the red border line) · zoom-through · light flash · rack blur.
//  Wrap any transition in TR.fromPrev(...) for the FIRST shot of a segment to
//  transition out of the previous segment's last frame.
// ─────────────────────────────────────────────────────────────────────────────
import * as Ease from './ease.js';
import { clamp01, lerp, noise2, noise3, TAU, rgba } from './math.js';

const W = 1920, H = 1080;
const mk = (dur, fn, extra = {}) => ({ dur, fn, ...extra });

/** mark a transition as allowed to pull the previous SEGMENT as outgoing image */
export const fromPrev = (tr) => ({ ...tr, fromPrev: true });

export const cut = () => null;

export const fade = ({ dur = 0.5, ease = Ease.std } = {}) => mk(dur, (ctx, A, B, p) => {
  ctx.drawImage(A, 0, 0); ctx.globalAlpha = ease(p); ctx.drawImage(B, 0, 0);
});

/** dip through a colour (paper, ink, white) */
export const dip = ({ dur = 0.6, color = '#0b1620' } = {}) => mk(dur, (ctx, A, B, p) => {
  if (p < 0.5) { ctx.drawImage(A, 0, 0); ctx.globalAlpha = Ease.sineIn(p * 2); }
  else { ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1 - Ease.sineOut((p - 0.5) * 2); }
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
});

/** exposure flash cut — impacts, lightning, camera flashes */
export const flash = ({ dur = 0.35, color = [1, 0.97, 0.9], peak = 0.85 } = {}) => mk(dur, (ctx, A, B, p, { E }) => {
  ctx.drawImage(p < 0.25 ? A : B, 0, 0);
  const k = p < 0.25 ? p / 0.25 : 1 - Ease.cubicOut((p - 0.25) / 0.75);
  E.post.flash = Math.max(E.post.flash, k * peak); E.post.flashColor = color;
});

/** rack-focus / defocus transition (uses post blur) */
export const blur = ({ dur = 0.7 } = {}) => mk(dur, (ctx, A, B, p, { E }) => {
  const k = Math.sin(p * Math.PI);
  ctx.drawImage(A, 0, 0); ctx.globalAlpha = Ease.inOut(p); ctx.drawImage(B, 0, 0);
  E.post.blur = Math.max(E.post.blur, k * 14);
});

/** linear wipe with optional graphic edge line (e.g. the red border line) */
export const wipe = ({ dur = 0.6, angle = 0, ease = Ease.inOut, feather = 0, line = null, lineWidth = 6 } = {}) => mk(dur, (ctx, A, B, p) => {
  const e = ease(p);
  ctx.drawImage(A, 0, 0);
  const diag = Math.hypot(W, H);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const pos = -diag / 2 + e * (diag + feather * 2) - feather;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.rotate(angle);
  ctx.beginPath(); ctx.rect(-diag, -diag, diag + pos, diag * 2); ctx.restore();
  ctx.save(); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  if (line && e > 0 && e < 1) {
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(angle);
    ctx.fillStyle = line; ctx.fillRect(pos - lineWidth / 2, -diag, lineWidth, diag * 2);
    ctx.restore();
  }
  void dx; void dy;
});

/** iris / porthole reveal centred at x,y. ring: stroke colour of the porthole rim */
export const circle = ({ dur = 0.7, x = W / 2, y = H / 2, ease = Ease.inOut, ring = null, ringWidth = 18, invert = false } = {}) => mk(dur, (ctx, A, B, p) => {
  const e = ease(p);
  const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.02;
  if (!invert) {
    ctx.drawImage(A, 0, 0);
    const r = e * R;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
    if (ring && r > 1) { ctx.strokeStyle = ring; ctx.lineWidth = ringWidth * (1 - e * 0.5); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
  } else { // outgoing closes to a point
    ctx.drawImage(B, 0, 0);
    const r = (1 - e) * R;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.clip(); ctx.drawImage(A, 0, 0); ctx.restore();
    if (ring && r > 1) { ctx.strokeStyle = ring; ctx.lineWidth = ringWidth; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
  }
});

/** camera push: both images slide (shared axis), with smear */
export const push = ({ dur = 0.55, dir = 'left', ease = Ease.inOut, smear = true } = {}) => mk(dur, (ctx, A, B, p) => {
  const e = ease(p);
  const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  const ox = v[0] * W * e, oy = v[1] * H * e;
  const speed = Math.sin(p * Math.PI);
  const draw = (img, x, y) => {
    if (smear && speed > 0.15) {
      const n = 5; ctx.globalAlpha = 1 / n * 1.6;
      for (let k = 0; k < n; k++) { const s = (k / (n - 1) - 0.5) * 60 * speed; ctx.drawImage(img, x + v[0] * s, y + v[1] * s); }
      ctx.globalAlpha = 1;
    } else ctx.drawImage(img, x, y);
  };
  draw(A, ox, oy); draw(B, ox - v[0] * W, oy - v[1] * H);
});

/** whip-pan: very fast directional blur swap */
export const whip = ({ dur = 0.4, dir = 'left' } = {}) => mk(dur, (ctx, A, B, p) => {
  const v = { left: -1, right: 1 }[dir] || -1;
  const img = p < 0.5 ? A : B;
  const k = Math.sin(p * Math.PI);
  const off = (p < 0.5 ? Ease.expoIn(p * 2) : -(1 - Ease.expoOut((p - 0.5) * 2))) * W * 0.35 * v;
  const n = 9;
  ctx.globalAlpha = 1;
  ctx.drawImage(img, off, 0);
  for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.18 * k; ctx.drawImage(img, off + (i - n / 2) * 70 * k * v, 0); }
});

/** zoom-through: outgoing rushes past the camera toward (x,y); incoming settles from behind */
export const zoomThrough = ({ dur = 0.6, x = W / 2, y = H / 2, ease = Ease.expoIn } = {}) => mk(dur, (ctx, A, B, p, { E }) => {
  const s1 = 1 + ease(Math.min(1, p * 1.25)) * 5;
  const s2 = lerp(0.6, 1, Ease.expoOut(clamp01((p - 0.35) / 0.65)));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s2, s2); ctx.translate(-W / 2, -H / 2); ctx.drawImage(B, 0, 0); ctx.restore();
  const a = 1 - Ease.cubicIn(clamp01((p - 0.2) / 0.6));
  if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s1, s1); ctx.translate(-x, -y); ctx.drawImage(A, 0, 0); ctx.restore(); }
  E.post.blur = Math.max(E.post.blur, Math.sin(p * Math.PI) * 6);
});

/** organic ink-bleed reveal (paper / document world) */
export const ink = ({ dur = 0.9, seed = 1, scale = 3.2, color = null } = {}) => mk(dur, (ctx, A, B, p) => {
  const mask = noiseMask(p, seed, scale, 0.18, 'ink');
  ctx.drawImage(A, 0, 0);
  const L = tmp(); L.ctx.clearRect(0, 0, W, H); L.ctx.drawImage(B, 0, 0);
  L.ctx.globalCompositeOperation = 'destination-in'; L.ctx.drawImage(mask, 0, 0, W, H); L.ctx.globalCompositeOperation = 'source-over';
  if (color) { ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9; ctx.filter = 'blur(6px)'; ctx.drawImage(mask, 0, 0, W, H); ctx.restore(); }
  ctx.drawImage(L.canvas, 0, 0);
});

/** water-surface wipe: a wavy waterline sweeps up (or down), with foam lip */
export const water = ({ dur = 0.8, up = true, foam = 'rgba(235,245,245,0.9)', seed = 3, amp = 38 } = {}) => mk(dur, (ctx, A, B, p, { t }) => {
  const e = Ease.inOut(p);
  const y0 = up ? lerp(H + amp * 2, -amp * 2, e) : lerp(-amp * 2, H + amp * 2, e);
  const path = new Path2D();
  const pts = [];
  for (let x = 0; x <= W; x += 24) {
    const yy = y0 + Math.sin(x * 0.006 + t * 3 + seed) * amp * 0.6 + noise2(x * 0.004, t * 1.5 + seed) * amp;
    pts.push([x, yy]);
  }
  if (up) { path.moveTo(0, H); pts.forEach(([x, y]) => path.lineTo(x, y)); path.lineTo(W, H); }
  else { path.moveTo(0, 0); pts.forEach(([x, y]) => path.lineTo(x, y)); path.lineTo(W, 0); }
  path.closePath();
  ctx.drawImage(A, 0, 0);
  ctx.save(); ctx.clip(path); ctx.drawImage(B, 0, 0); ctx.restore();
  // foam lip
  ctx.save(); ctx.strokeStyle = foam; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = [9, 4, 2][k]; ctx.globalAlpha = [0.85, 0.5, 0.35][k] * Math.sin(p * Math.PI);
    ctx.beginPath(); pts.forEach(([x, y], i) => { const yy = y + (up ? k * 10 : -k * 10) + noise2(x * 0.03, t * 4 + k) * 4; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke();
  }
  ctx.restore();
});

/** light leak burn: warm additive bloom sweeps across while crossfading */
export const lightLeak = ({ dur = 0.9, color = '#ffb35c', x0 = -0.2, x1 = 1.2 } = {}) => mk(dur, (ctx, A, B, p, { E }) => {
  ctx.drawImage(A, 0, 0); ctx.globalAlpha = Ease.inOut(clamp01((p - 0.25) / 0.5)); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
  const cx = lerp(x0, x1, Ease.std(p)) * W; const k = Math.sin(p * Math.PI);
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(cx, H * 0.45, 0, cx, H * 0.45, W * 0.7);
  g.addColorStop(0, rgba(color, 0.95 * k)); g.addColorStop(0.4, rgba(color, 0.45 * k)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  E.post.exposure += k * 0.35;
});

/** graphic slices (venetian) — for typographic / infographic hand-offs */
export const slices = ({ dur = 0.6, n = 8, vertical = false, stagger = 0.4 } = {}) => mk(dur, (ctx, A, B, p) => {
  ctx.drawImage(A, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * stagger; const e = Ease.out(clamp01((p - d) / (1 - stagger)));
    if (e <= 0) continue;
    ctx.save(); ctx.beginPath();
    if (vertical) { const w = W / n; ctx.rect(i * w, 0, w, H * e); }
    else { const h = H / n; ctx.rect(0, i * h, W * e, h + 1); }
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  }
});

/** signal glitch — RGB split + block displacement (state broadcast / KGB / radio) */
export const glitch = ({ dur = 0.45, seed = 7 } = {}) => mk(dur, (ctx, A, B, p, { E, t }) => {
  const img = p < 0.5 ? A : B; const k = Math.sin(p * Math.PI);
  ctx.drawImage(img, 0, 0);
  const f = Math.floor(t * 30);
  for (let i = 0; i < 14; i++) {
    const r = noise2(i * 3.1 + seed, f * 0.77);
    if (Math.abs(r) < 0.25) continue;
    const y = Math.floor(((noise2(i * 1.7, f * 0.31 + seed) + 1) / 2) * H);
    const h = 8 + Math.abs(noise2(i, f)) * 90;
    const dx = r * 160 * k;
    ctx.drawImage(img, 0, y, W, h, dx, y, W, h);
  }
  E.post.ca += 0.012 * k;
});

/** halftone dissolve: dots grow to reveal (print motif) */
export const halftone = ({ dur = 0.8, cell = 26, color = null } = {}) => mk(dur, (ctx, A, B, p) => {
  ctx.drawImage(A, 0, 0);
  const L = tmp(); const c = L.ctx; c.clearRect(0, 0, W, H);
  c.fillStyle = '#000';
  const e = Ease.inOut(p);
  for (let y = 0; y < H + cell; y += cell) for (let x = 0; x < W + cell; x += cell) {
    const local = clamp01(e * 1.6 - ((x / W) * 0.4 + (y / H) * 0.2));
    const r = local * cell * 0.75;
    if (r > 0.3) { c.beginPath(); c.arc(x + ((y / cell) % 2 ? cell / 2 : 0), y, r, 0, TAU); c.fill(); }
  }
  c.globalCompositeOperation = 'source-in'; c.drawImage(B, 0, 0); c.globalCompositeOperation = 'source-over';
  if (color) { ctx.fillStyle = color; }
  ctx.drawImage(L.canvas, 0, 0);
});

/** custom-mask transition: maskFn(ctx, p) draws an opaque shape where B shows */
export const mask = ({ dur = 0.7, ease = Ease.inOut, maskFn } = {}) => mk(dur, (ctx, A, B, p, info) => {
  ctx.drawImage(A, 0, 0);
  const L = tmp(); L.ctx.clearRect(0, 0, W, H); L.ctx.save(); maskFn(L.ctx, ease(p), info); L.ctx.restore();
  L.ctx.globalCompositeOperation = 'source-in'; L.ctx.drawImage(B, 0, 0); L.ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(L.canvas, 0, 0);
});

/** custom: full control (fn receives A,B canvases) */
export const custom = (dur, fn, extra) => mk(dur, fn, extra);

// ── internals ───────────────────────────────────────────────────────────────
let _tmp = null;
function tmp() {
  if (!_tmp) { const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; _tmp = { canvas, ctx: canvas.getContext('2d') }; }
  _tmp.ctx.setTransform(1, 0, 0, 1, 0, 0); _tmp.ctx.globalAlpha = 1; _tmp.ctx.filter = 'none';
  return _tmp;
}
const _masks = new Map();
/** low-res noise threshold mask (smooth-upscaled) — organic reveals */
export function noiseMask(p, seed = 1, scale = 3, soft = 0.15, kind = 'ink') {
  const mw = 320, mh = 180;
  let m = _masks.get(kind);
  if (!m) { const canvas = document.createElement('canvas'); canvas.width = mw; canvas.height = mh; m = { canvas, ctx: canvas.getContext('2d'), img: null }; _masks.set(kind, m); }
  if (!m.img) m.img = m.ctx.createImageData(mw, mh);
  const d = m.img.data;
  const thr = lerp(-0.75, 1.05, p);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const nx = (x / mw) * scale * (16 / 9), ny = (y / mh) * scale;
    let n = noise3(nx, ny, seed * 1.37) * 0.65 + noise3(nx * 2.3, ny * 2.3, seed + 4.1) * 0.3 + noise3(nx * 6, ny * 6, seed + 9) * 0.12;
    n = n * 0.5 + 0.5;
    const a = clamp01((thr - n) / soft + 0.5);
    const i = (y * mw + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a * 255;
  }
  m.ctx.putImageData(m.img, 0, 0);
  return m.canvas;
}
