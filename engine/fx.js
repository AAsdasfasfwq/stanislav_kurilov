// ─────────────────────────────────────────────────────────────────────────────
//  engine/fx.js — atmosphere & particles. All closed-form f(t) → deterministic.
//  Use with restraint: every particle must have a physical reason (rain in a
//  storm, spray at the stern, plankton in the night sea, dust in a lamp beam).
// ─────────────────────────────────────────────────────────────────────────────
import { hash, hash2, noise2, noise3, fract, clamp01, lerp, TAU, rgba } from './math.js';
import { noiseTexture } from './draw.js';

const W = 1920, H = 1080;

/**
 * Rain streaks. depth layers give parallax; wind = angle in rad from vertical.
 * opts: n, speed (px/s), len, wind, color, alpha, seed, width, rect:[x,y,w,h]
 */
export function rain(ctx, t, { n = 420, speed = 2200, len = 46, wind = 0.22, color = '#cfe0ea', alpha = 0.35, seed = 1, width = 1.3, rect = [0, 0, W, H], layers = 3 } = {}) {
  const [rx, ry, rw, rh] = rect;
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let L = 0; L < layers; L++) {
    const depth = 0.45 + (L / Math.max(1, layers - 1)) * 0.55; // 0.45 far … 1 near
    ctx.lineWidth = width * depth * 1.4; ctx.globalAlpha = alpha * (0.35 + depth * 0.65);
    ctx.beginPath();
    const count = Math.floor(n / layers);
    for (let i = 0; i < count; i++) {
      const id = i + L * 10007 + seed * 131;
      const sp = speed * depth * (0.8 + hash(id) * 0.4);
      const span = rh + len * 2 + Math.abs(Math.tan(wind)) * rh;
      const y = fract(hash(id + 1) + (t * sp) / span) * span - len;
      const x = rx + fract(hash(id + 2) + 0.0) * (rw + rh * Math.tan(wind)) - rh * Math.tan(wind) + y * Math.tan(wind);
      const l = len * depth * (0.7 + hash(id + 3) * 0.6);
      ctx.moveTo(x, ry + y); ctx.lineTo(x - Math.sin(wind) * l, ry + y - Math.cos(wind) * l);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Generic particle field (dust, plankton, embers, snow, bubbles).
 * Particles live in a box, drift with velocity + noise, wrap around.
 * opts: n, vx, vy (px/s), turb (px), size [min,max], color, alpha, twinkle, glow, seed, rect, shape:'dot'|'soft'|'streak'
 */
export function field(ctx, t, { n = 120, vx = 0, vy = -20, turb = 30, size = [1, 3], color = '#fff', alpha = 0.6, twinkle = 0, glow = 0, seed = 7, rect = [0, 0, W, H], shape = 'soft', depthScale = true } = {}) {
  const [rx, ry, rw, rh] = rect;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const id = i * 7 + seed * 1009;
    const d = 0.4 + hash(id) * 0.6; // depth
    const px = fract(hash(id + 1) + (t * vx * d) / rw + noise2(i * 0.31, t * 0.15 + seed) * turb / rw);
    const py = fract(hash(id + 2) + (t * vy * d) / rh + noise2(i * 0.53 + 9, t * 0.15 + seed) * turb / rh);
    const x = rx + px * rw, y = ry + py * rh;
    let s = lerp(size[0], size[1], hash(id + 3)) * (depthScale ? d : 1);
    let a = alpha * (depthScale ? 0.35 + d * 0.65 : 1);
    if (twinkle) a *= 1 - twinkle + twinkle * (0.5 + 0.5 * Math.sin(t * (2 + hash(id + 4) * 5) + hash(id + 5) * TAU));
    if (a <= 0.003) continue;
    if (shape === 'soft' || glow) {
      const r = s * (glow ? 3.5 : 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (shape === 'streak') {
      ctx.strokeStyle = rgba(color, a); ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx * 0.05, y - vy * 0.05); ctx.stroke();
    } else { ctx.fillStyle = rgba(color, a); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/** rising bubbles with wobble and highlight (underwater) */
export function bubbles(ctx, t, { n = 40, rect = [0, 0, W, H], speed = 120, size = [2, 9], color = '#dff6ff', alpha = 0.7, seed = 3 } = {}) {
  const [rx, ry, rw, rh] = rect;
  ctx.save(); ctx.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    const id = i * 13 + seed * 977; const r = lerp(size[0], size[1], hash(id));
    const sp = speed * (0.6 + r / size[1]);
    const py = 1 - fract(hash(id + 1) + (t * sp) / rh);
    const x = rx + hash(id + 2) * rw + Math.sin(t * (2 + hash(id + 3) * 3) + i) * r * 1.5;
    const y = ry + py * rh;
    const a = alpha * clamp01(py * 4) * clamp01((1 - py) * 6);
    ctx.strokeStyle = rgba(color, a * 0.8); ctx.fillStyle = rgba(color, a * 0.12);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.9 + 0.1 * Math.sin(t * 9 + i)), 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', a * 0.9); ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** star field with twinkle; optional slow rotation around a pole */
export function stars(ctx, t, { n = 600, seed = 11, color = '#f4f1e6', alpha = 0.9, rect = [0, 0, W, H], twinkle = 0.5, rot = 0, pole = [W / 2, -400], bright = 0.04 } = {}) {
  const [rx, ry, rw, rh] = rect;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const id = i * 3 + seed * 7919;
    let x = rx + hash(id) * rw, y = ry + hash(id + 1) * rh;
    if (rot) { const dx = x - pole[0], dy = y - pole[1]; const a = rot * t; x = pole[0] + dx * Math.cos(a) - dy * Math.sin(a); y = pole[1] + dx * Math.sin(a) + dy * Math.cos(a); }
    const m = Math.pow(hash(id + 2), 3); const s = 0.4 + m * 1.9;
    let a = alpha * (0.25 + m * 0.75) * (1 - twinkle * 0.5 + twinkle * 0.5 * Math.sin(t * (1 + hash(id + 3) * 4) + id));
    ctx.fillStyle = rgba(color, a); ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (m > 1 - bright) { const g = ctx.createRadialGradient(x, y, 0, x, y, s * 6); g.addColorStop(0, rgba(color, a * 0.5)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - s * 6, y - s * 6, s * 12, s * 12); }
  }
  ctx.restore();
}

/**
 * Drifting fog / mist / cloud bank built from noise textures.
 * opts: color, alpha, scale (texture px size), speed [vx,vy], seed, rect, layers
 */
export function fog(ctx, t, { color = '#cfd8dc', alpha = 0.35, scale = 900, speed = [18, 0], seed = 2, rect = [0, 0, W, H], layers = 2, contrast = 1.4, mode = 'source-over' } = {}) {
  const tex = tinted(noiseTexture(512, { scale: 3, oct: 5, seed, contrast }), color);
  const [rx, ry, rw, rh] = rect;
  ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); ctx.globalCompositeOperation = mode;
  for (let L = 0; L < layers; L++) {
    const s = scale * (1 + L * 0.6); const ox = ((t * speed[0] * (1 + L * 0.5)) % s + s) % s; const oy = ((t * speed[1] * (1 + L * 0.5)) % s + s) % s;
    ctx.globalAlpha = alpha / (1 + L * 0.4);
    for (let y = ry - s + oy; y < ry + rh; y += s) for (let x = rx - s + ox; x < rx + rw; x += s) ctx.drawImage(tex, x, y, s, s);
  }
  ctx.restore();
}
const tintCache = new Map();
export function tinted(tex, color) {
  const key = tex.width + ':' + color + ':' + (tex.__id || (tex.__id = Math.floor(hash(tintCache.size + 1) * 1e9)));
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height; const x = c.getContext('2d');
  x.drawImage(tex, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c); return c;
}

/**
 * Branching lightning bolt. Visible ~0.35s after t0 with re-strikes.
 * Returns the flash intensity (0..1) so the caller can light the scene / post.flash.
 */
export function lightning(ctx, t, t0, { x = 900, y = -20, x2 = 1100, y2 = 700, seed = 1, color = '#eef6ff', width = 3, branches = 4 } = {}) {
  const d = t - t0; if (d < 0 || d > 0.6) return 0;
  const strike = d < 0.07 ? 1 : d < 0.12 ? 0.25 : d < 0.2 ? 0.9 : Math.max(0, 1 - (d - 0.2) / 0.4) * 0.5;
  const R = (k) => hash(seed * 1000 + k);
  const bolt = (ax, ay, bx, by, depth, w, k0) => {
    const pts = [[ax, ay]]; const n = 14;
    for (let i = 1; i < n; i++) {
      const f = i / n; const nx = lerp(ax, bx, f) + (R(k0 + i) - 0.5) * 90 * (1 - f * 0.4); const ny = lerp(ay, by, f) + (R(k0 + i + 50) - 0.5) * 30;
      pts.push([nx, ny]);
      if (depth > 0 && R(k0 + i + 99) < 0.18) bolt(nx, ny, nx + (R(k0 + i + 7) - 0.5) * 400, ny + 120 + R(k0 + i + 8) * 200, depth - 1, w * 0.5, k0 + i * 37);
    }
    pts.push([bx, by]);
    for (const [lw, a] of [[w * 6, 0.12], [w * 2.2, 0.35], [w, 1]]) {
      ctx.strokeStyle = rgba(color, a * strike); ctx.lineWidth = lw; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
  };
  ctx.save(); ctx.globalCompositeOperation = 'screen'; bolt(x, y, x2, y2, branches > 0 ? 2 : 0, width, 1); ctx.restore();
  return strike;
}

/** animated caustic light pattern (underwater floors, hull bottoms) */
export function caustics(ctx, t, { rect = [0, 0, W, H], color = '#bff6ff', alpha = 0.25, scale = 1, speed = 1 } = {}) {
  const [rx, ry, rw, rh] = rect;
  ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rgba(color, alpha); ctx.lineCap = 'round';
  const cell = 70 * scale;
  for (let gy = ry - cell; gy < ry + rh + cell; gy += cell * 0.5) {
    ctx.beginPath();
    for (let gx = rx - cell; gx < rx + rw + cell; gx += 8) {
      const n = noise3(gx / (cell * 2.2), gy / (cell * 1.4), t * 0.35 * speed);
      const yy = gy + n * cell * 0.55;
      gx === rx - cell ? ctx.moveTo(gx, yy) : ctx.lineTo(gx, yy);
    }
    ctx.lineWidth = 2.2 * scale; ctx.stroke();
  }
  ctx.restore();
}

/** spray / droplets burst (closed-form ballistic) from origin at t0 */
export function burst(ctx, t, t0, { x, y, n = 60, speed = [300, 900], angle = -Math.PI / 2, spread = 1.2, gravity = 1400, size = [1.5, 4], life = 1.2, color = '#eef7f7', seed = 5, drag = 0.6 } = {}) {
  const d = t - t0; if (d < 0 || d > life * 1.5) return;
  ctx.save(); ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const id = seed * 733 + i * 3;
    const a = angle + (hash(id) - 0.5) * spread; const v = lerp(speed[0], speed[1], hash(id + 1));
    const k = (1 - Math.exp(-drag * d * 3)) / (drag * 3);
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 0.5 * gravity * d * d;
    const lf = life * (0.5 + hash(id + 2) * 0.5); const al = clamp01(1 - d / lf); if (al <= 0) continue;
    const s = lerp(size[0], size[1], hash(id + 3));
    ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
