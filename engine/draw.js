// ─────────────────────────────────────────────────────────────────────────────
//  engine/draw.js — illustration toolkit for Canvas 2D.
//  Goal: NOTHING FLAT. Every shape gets form-shading, a light direction, contact
//  shadow, rim light and a material texture. These helpers make that cheap.
// ─────────────────────────────────────────────────────────────────────────────
import { rng, noise2, noise3, fbm2, clamp01, lerp, TAU, hex, rgba, shade, catmull } from './math.js';

const W = 1920, H = 1080;

// ── paths ────────────────────────────────────────────────────────────────────
/** smooth closed/open path through points (Catmull-Rom → Bézier). Returns Path2D. */
export function smoothPath(pts, closed = true, tension = 0.5, path = new Path2D()) {
  const n = pts.length; if (n < 2) return path;
  const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  path.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const t = tension / 3;
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}
/** organic blob outline points (noise-perturbed ellipse) */
export function blobPoints(cx, cy, rx, ry, { n = 24, wobble = 0.15, seed = 1, rot = 0, t = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + noise3(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3, t * 0.5 + seed * 0.1) * wobble;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}
export const blob = (cx, cy, rx, ry, o) => smoothPath(blobPoints(cx, cy, rx, ry, o), true);
export function polyPath(pts, closed = true) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (closed) p.closePath(); return p; }
export function roundRectPath(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

// ── brush strokes ────────────────────────────────────────────────────────────
/**
 * Tapered, pressure-like stroke along a polyline (ink line, hair strand, rope, wake).
 * width: number or fn(u 0..1) → px.  opts.jitter adds hand-made wobble.
 */
export function brush(ctx, pts, width = 6, { color = '#111', smooth = true, jitter = 0, seed = 1, cap = true, alpha = 1 } = {}) {
  const P = smooth && pts.length > 2 ? catmull(pts, 6) : pts;
  const n = P.length; if (n < 2) return;
  const wf = typeof width === 'function' ? width : (u) => width * Math.sin(Math.min(1, u * 6) * Math.PI / 2) * Math.sin(Math.min(1, (1 - u) * 6) * Math.PI / 2 + 0.0001);
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const u = i / (n - 1);
    let w = wf(u) / 2; if (jitter) w *= 1 + noise2(i * 0.3, seed) * jitter;
    L.push([P[i][0] - dy * w, P[i][1] + dx * w]); R.push([P[i][0] + dy * w, P[i][1] - dx * w]);
  }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath();
  L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
/** quick variable-width line between two points (for limbs, ropes) */
export function taper(ctx, x0, y0, x1, y1, w0, w1, color) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  ctx.fill();
}

// ── shading: make any 2D shape read as a volume ──────────────────────────────
/**
 * Fill a Path2D as a lit volume.
 *  base: colour; light: angle (rad) the light COMES FROM (0 = from right, -π/2 = from top)
 *  form: 0..1 strength of the core shadow; spec: highlight strength; rim: rim colour or null
 *  bbox: [x,y,w,h] of the shape (needed for gradient placement)
 *  ao: darken edges (ambient occlusion feel); tex: optional texture canvas (multiply)
 */
export function volume(ctx, path, bbox, { base = '#888', light = -Math.PI * 0.75, form = 0.55, spec = 0.25, rim = null, rimWidth = 5, ao = 0.25, tex = null, texAlpha = 0.35, shadowColor = null, cel = 0 } = {}) {
  const [x, y, w, h] = bbox; const cx = x + w / 2, cy = y + h / 2; const R = Math.max(w, h) * 0.6;
  const lx = Math.cos(light), ly = Math.sin(light);
  ctx.save();
  ctx.fillStyle = base; ctx.fill(path);
  ctx.clip(path);
  // core shadow: gradient from lit side to shadow side
  const sc = shadowColor || shade(base, 0.42);
  const g = ctx.createLinearGradient(cx + lx * R, cy + ly * R, cx - lx * R, cy - ly * R);
  if (cel > 0) { // hard cel step (anime look) mixed with soft
    g.addColorStop(0, rgba(sc, 0)); g.addColorStop(0.5 - cel * 0.05, rgba(sc, 0)); g.addColorStop(0.5 + cel * 0.02, rgba(sc, form)); g.addColorStop(1, rgba(sc, form));
  } else { g.addColorStop(0, rgba(sc, 0)); g.addColorStop(0.45, rgba(sc, form * 0.25)); g.addColorStop(1, rgba(sc, form)); }
  ctx.fillStyle = g; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  // specular / key highlight
  if (spec > 0) {
    const hx = cx + lx * R * 0.45, hy = cy + ly * R * 0.45;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.75);
    hg.addColorStop(0, `rgba(255,250,240,${spec})`); hg.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = hg; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (tex) { ctx.globalAlpha = texAlpha; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tex, x, y, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  // ambient occlusion along the silhouette
  if (ao > 0) { ctx.strokeStyle = rgba(shade(base, 0.25), ao); ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.12); ctx.filter = `blur(${Math.max(2, Math.min(w, h) * 0.05)}px)`; ctx.stroke(path); ctx.filter = 'none'; }
  // rim light on the side opposite the key light (back light)
  if (rim) {
    // outline shifted TOWARD the light, clipped to the shape → crescent on the far side
    ctx.translate(lx * rimWidth, ly * rimWidth);
    ctx.strokeStyle = rim; ctx.lineWidth = rimWidth * 2; ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${(rimWidth * 0.3).toFixed(2)}px)`;
    ctx.stroke(path); ctx.filter = 'none';
  }
  ctx.restore();
}
/** contact shadow (soft ellipse) */
export function contactShadow(ctx, x, y, rx, ry, alpha = 0.45, color = '#000') {
  ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.6, rgba(color, alpha * 0.45)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
  ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
}
/** drop shadow under a path (cast on the ground plane, skewed) */
export function castShadow(ctx, path, { dx = 30, dy = 18, blur = 18, alpha = 0.35, color = '#000', skewX = 0, scaleY = 1 } = {}) {
  ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  ctx.transform(1, 0, skewX, scaleY, dx, dy); ctx.fill(path); ctx.restore();
}
/** soft radial glow / light pool */
export function glow(ctx, x, y, r, color = '#ffd28a', alpha = 0.6, mode = 'screen') {
  ctx.save(); ctx.globalCompositeOperation = mode;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.25, rgba(color, alpha * 0.5)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
/** volumetric light shafts from a point (god rays) */
export function rays(ctx, x, y, { angle = Math.PI / 2, spread = 0.6, n = 9, length = 1400, color = '#fff2cf', alpha = 0.18, t = 0, seed = 1, width = 0.05 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const a = angle + (i / (n - 1) - 0.5) * spread + noise2(i * 3.3 + seed, t * 0.15) * 0.04;
    const wdt = width * (0.6 + 0.8 * (noise2(i * 7.1 + seed, t * 0.2) * 0.5 + 0.5));
    const al = alpha * (0.4 + 0.6 * (noise2(i * 1.9 + seed, t * 0.35) * 0.5 + 0.5));
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * length, y + Math.sin(a) * length);
    g.addColorStop(0, rgba(color, al)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - wdt) * length, y + Math.sin(a - wdt) * length);
    ctx.lineTo(x + Math.cos(a + wdt) * length, y + Math.sin(a + wdt) * length); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/** engraving-style hatching inside a path (editorial illustration shading) */
export function hatch(ctx, path, bbox, { angle = -0.8, spacing = 7, width = 1.2, color = 'rgba(10,20,30,0.55)', jitter = 0.6, seed = 1, cross = false } = {}) {
  const [x, y, w, h] = bbox; const cx = x + w / 2, cy = y + h / 2; const R = Math.hypot(w, h) / 2 + 4;
  ctx.save(); ctx.clip(path); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  const pass = (ang, s) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath();
    for (let d = -R, i = 0; d <= R; d += spacing, i++) {
      const j = noise2(i * 0.7, s) * jitter * spacing;
      ctx.moveTo(-R, d + j); ctx.lineTo(R, d + j + noise2(i, s + 3) * jitter * 2);
    }
    ctx.stroke(); ctx.restore();
  };
  pass(angle, seed); if (cross) pass(angle + Math.PI / 2.4, seed + 9);
  ctx.restore();
}

// ── gradients ────────────────────────────────────────────────────────────────
export function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
export function rad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
/** full-frame vertical gradient background */
export function bgGrad(ctx, top, bottom, mid = null) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, mid ? [[0, top], [0.55, mid], [1, bottom]] : [[0, top], [1, bottom]]); ctx.fillRect(0, 0, W, H);
}

// ── perspective image mapping (cards, maps on tables, text on floors) ────────
function homography(src, dst) { // 4 pts → 3x3
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // gaussian elimination
  for (let c = 0; c < 8; c++) {
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
const applyH = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
/**
 * Draw an image (canvas) mapped onto an arbitrary quad [tl, tr, br, bl] with
 * perspective-correct subdivision. n = grid resolution (8–20).
 */
export function quadWarp(ctx, img, quad, n = 12, srcRect = null) {
  const sw = srcRect ? srcRect[2] : img.width, sh = srcRect ? srcRect[3] : img.height;
  const sx0 = srcRect ? srcRect[0] : 0, sy0 = srcRect ? srcRect[1] : 0;
  const m = homography([[0, 0], [1, 0], [1, 1], [0, 1]], quad);
  const G = []; for (let j = 0; j <= n; j++) { G.push([]); for (let i = 0; i <= n; i++) G[j].push(applyH(m, i / n, j / n)); }
  const tri = (s0, s1, s2, d0, d1, d2) => {
    ctx.save(); ctx.beginPath();
    // expand slightly to hide seams
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const ex = (p) => [p[0] + (p[0] - cx) * 0.04 + Math.sign(p[0] - cx) * 0.6, p[1] + (p[1] - cy) * 0.04 + Math.sign(p[1] - cy) * 0.6];
    const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2);
    ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2;
    const det = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1); if (Math.abs(det) < 1e-9) { ctx.restore(); return; }
    const a = (d0[0] * (y1 - y2) + d1[0] * (y2 - y0) + d2[0] * (y0 - y1)) / det;
    const b = (d0[1] * (y1 - y2) + d1[1] * (y2 - y0) + d2[1] * (y0 - y1)) / det;
    const c = (d0[0] * (x2 - x1) + d1[0] * (x0 - x2) + d2[0] * (x1 - x0)) / det;
    const d = (d0[1] * (x2 - x1) + d1[1] * (x0 - x2) + d2[1] * (x1 - x0)) / det;
    const e = (d0[0] * (x1 * y2 - x2 * y1) + d1[0] * (x2 * y0 - x0 * y2) + d2[0] * (x0 * y1 - x1 * y0)) / det;
    const f = (d0[1] * (x1 * y2 - x2 * y1) + d1[1] * (x2 * y0 - x0 * y2) + d2[1] * (x0 * y1 - x1 * y0)) / det;
    ctx.transform(a, b, c, d, e, f); ctx.drawImage(img, 0, 0); ctx.restore();
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const s = (ii, jj) => [sx0 + (ii / n) * sw, sy0 + (jj / n) * sh];
    tri(s(i, j), s(i + 1, j), s(i, j + 1), G[j][i], G[j][i + 1], G[j + 1][i]);
    tri(s(i + 1, j), s(i + 1, j + 1), s(i, j + 1), G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]);
  }
}
/** project a 3D-rotated card: returns quad for a w×h card centred at (cx,cy) rotated rx/ry (rad) with perspective p */
export function cardQuad(cx, cy, w, h, rx = 0, ry = 0, rz = 0, persp = 1600) {
  const pts = [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]];
  return pts.map(([x, y, z]) => {
    let X = x * Math.cos(rz) - y * Math.sin(rz), Y = x * Math.sin(rz) + y * Math.cos(rz); x = X; y = Y;
    let y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
    let x2 = x * Math.cos(ry) + z1 * Math.sin(ry), z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
    const s = persp / (persp + z2);
    return [cx + x2 * s, cy + y1 * s];
  });
}

// ── procedural textures (cached) ─────────────────────────────────────────────
const texCache = new Map();
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/** warm paper with fibres & tooth. tone: base colour */
export function paperTexture(w = 1024, h = 1024, { tone = '#ede6d6', seed = 3, fibres = 900, dirt = 0.4 } = {}) {
  const key = `paper:${w}:${h}:${tone}:${seed}:${fibres}:${dirt}`; if (texCache.has(key)) return texCache.get(key);
  const c = cv(w, h), x = c.getContext('2d'); x.fillStyle = tone; x.fillRect(0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), d = img.data; const [r0, g0, b0] = hex(tone);
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const n = fbm2(i * 0.012 + seed, y * 0.012, 4) * 18 * dirt + (noise2(i * 0.6, y * 0.6 + seed) * 7);
    const k = (y * w + i) * 4; const g = hashNoise(i, y, seed) * 10 - 5;
    d[k] = r0 + n + g; d[k + 1] = g0 + n + g; d[k + 2] = b0 + n * 0.9 + g;
  }
  x.putImageData(img, 0, 0);
  const R = rng(seed); x.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const px = R() * w, py = R() * h, a = R() * TAU, l = 4 + R() * 22;
    x.strokeStyle = `rgba(${R() < 0.5 ? '90,70,40' : '255,255,250'},${0.05 + R() * 0.08})`; x.lineWidth = 0.6 + R() * 0.8;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.5) * l * 0.5, py + Math.sin(a + 0.5) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  texCache.set(key, c); return c;
}
function hashNoise(x, y, s) { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
/** tileable-ish fbm noise texture (grayscale with alpha) — fog, clouds, stains */
export function noiseTexture(size = 512, { scale = 4, oct = 5, seed = 1, contrast = 1.2, alpha = true } = {}) {
  const key = `noise:${size}:${scale}:${oct}:${seed}:${contrast}:${alpha}`; if (texCache.has(key)) return texCache.get(key);
  const c = cv(size, size), x = c.getContext('2d'); const img = x.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let i = 0; i < size; i++) {
    // seamless via 4D-ish torus blend
    const u = i / size, v = y / size;
    const a = fbm2(u * scale + seed, v * scale, oct), b = fbm2((u - 1) * scale + seed, v * scale, oct);
    const c2 = fbm2(u * scale + seed, (v - 1) * scale, oct), e = fbm2((u - 1) * scale + seed, (v - 1) * scale, oct);
    const n = lerp(lerp(a, b, u), lerp(c2, e, u), v);
    const val = clamp01((n * contrast) * 0.5 + 0.5);
    const k = (y * size + i) * 4;
    if (alpha) { d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = val * 255; } else { d[k] = d[k + 1] = d[k + 2] = val * 255; d[k + 3] = 255; }
  }
  x.putImageData(img, 0, 0); texCache.set(key, c); return c;
}
/** fine grain/specks texture for surfaces (multiply) */
export function grainTexture(size = 512, { seed = 5, amount = 0.5, dark = '40,30,20' } = {}) {
  const key = `grain:${size}:${seed}:${amount}:${dark}`; if (texCache.has(key)) return texCache.get(key);
  const c = cv(size, size), x = c.getContext('2d'); const R = rng(seed);
  for (let i = 0; i < size * size * 0.02 * amount; i++) { x.fillStyle = `rgba(${dark},${R() * 0.25})`; x.fillRect(R() * size, R() * size, 1 + R() * 1.6, 1 + R() * 1.6); }
  for (let i = 0; i < 60 * amount; i++) { const r = 4 + R() * 30; const px = R() * size, py = R() * size; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${dark},${R() * 0.08})`); g.addColorStop(1, `rgba(${dark},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  texCache.set(key, c); return c;
}
/** overlay a texture across the whole frame (or rect) with a blend mode */
export function overlay(ctx, tex, { mode = 'multiply', alpha = 0.3, rect = [0, 0, W, H], tile = false, offset = [0, 0] } = {}) {
  ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha *= alpha;
  if (tile) { const p = ctx.createPattern(tex, 'repeat'); ctx.translate(offset[0], offset[1]); ctx.fillStyle = p; ctx.fillRect(rect[0] - offset[0], rect[1] - offset[1], rect[2], rect[3]); }
  else ctx.drawImage(tex, rect[0], rect[1], rect[2], rect[3]);
  ctx.restore();
}
/**
 * Halftone a source canvas (print motif). Draws dots whose radius ∝ darkness.
 * cell: grid px; angle: screen angle; color: ink colour. Use on a layer.
 */
export function halftone(ctx, src, { cell = 10, angle = 0.4, color = '#0b1620', invert = false, scale = 1, sample = null } = {}) {
  const sw = Math.ceil(W / cell) + 4, sh = Math.ceil(H / cell) + 4;
  const s = sample || (() => { const c = cv(sw, sh); return c; })();
  const sx = s.getContext('2d'); sx.clearRect(0, 0, sw, sh); sx.drawImage(src, 0, 0, sw, sh);
  const d = sx.getImageData(0, 0, sw, sh).data;
  ctx.save(); ctx.fillStyle = color;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const R = Math.hypot(W, H) / 2;
  ctx.beginPath();
  for (let gy = -R; gy < R; gy += cell) for (let gx = -R; gx < R; gx += cell) {
    const x = W / 2 + gx * ca - gy * sa, y = H / 2 + gx * sa + gy * ca;
    if (x < -cell || y < -cell || x > W + cell || y > H + cell) continue;
    const ix = Math.max(0, Math.min(sw - 1, Math.floor((x / W) * sw))), iy = Math.max(0, Math.min(sh - 1, Math.floor((y / H) * sh)));
    const k = (iy * sw + ix) * 4; const a = d[k + 3] / 255; if (a < 0.02) continue;
    let l = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; if (!invert) l = 1 - l;
    const r = Math.sqrt(l * a) * cell * 0.62 * scale; if (r < 0.35) continue;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill(); ctx.restore();
}

/** convenience: offscreen canvas */
export const canvas = cv;
