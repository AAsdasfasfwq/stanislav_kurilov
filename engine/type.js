// ─────────────────────────────────────────────────────────────────────────────
//  engine/type.js — kinetic typography for canvas.
//  Text is a design element, not a subtitle: few words, big contrast of scale,
//  tracking, masking, depth. See docs/BIBLE.md §Typography for the role rules.
//
//  Core:  set(ctx, {family,size,weight,style,tracking})  → applies font & letterSpacing
//         draw(ctx, str, x, y, opts)                      → static text with tracking/fill/stroke
//         reveal(ctx, str, x, y, p, opts)                 → animated per-char/word/line reveals
//         counter(ctx, value, x, y, opts)                 → numbers (plain or odometer)
//         onPath(ctx, str, pts, opts)                     → text along a polyline
// ─────────────────────────────────────────────────────────────────────────────
import { F, font } from './fonts.js';
import * as Ease from './ease.js';
import { clamp01, lerp, hash, noise2, polyLengths, polyAt } from './math.js';

export { F, font };

const measureCache = new Map();
export function set(ctx, { family = F.serif, size = 64, weight = 400, style = 'normal', tracking = 0, align = 'left', baseline = 'alphabetic' } = {}) {
  ctx.font = font(family, size, weight, style);
  ctx.letterSpacing = `${tracking}px`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
}
export function measure(ctx, str) {
  const key = ctx.font + '|' + ctx.letterSpacing + '|' + str;
  let m = measureCache.get(key);
  if (!m) { m = ctx.measureText(str).width; if (measureCache.size > 20000) measureCache.clear(); measureCache.set(key, m); }
  return m;
}

/**
 * Static text. opts: family,size,weight,style,tracking,align,baseline,
 *   fill, stroke, strokeWidth, alpha, shadow:{color,blur,x,y}, maxWidth
 */
export function draw(ctx, str, x, y, o = {}) {
  ctx.save(); set(ctx, o);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.shadow) { ctx.shadowColor = o.shadow.color || 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.shadow.blur ?? 20; ctx.shadowOffsetX = o.shadow.x ?? 0; ctx.shadowOffsetY = o.shadow.y ?? 8; }
  if (o.fill !== null) { ctx.fillStyle = o.fill || '#ede6d6'; ctx.fillText(str, x, y); }
  if (o.stroke) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 2; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.restore();
}

/** split into glyph boxes honoring tracking (x offsets relative to start) */
export function glyphs(ctx, str) {
  const out = []; let x = 0;
  const tr = parseFloat(ctx.letterSpacing) || 0;
  const chars = [...str];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const wPrefix = measure(ctx, chars.slice(0, i + 1).join('')) ;
    const w = wPrefix - x;
    out.push({ ch, x, w, i });
    x = wPrefix;
  }
  void tr;
  return { list: out, width: x };
}

/**
 * Animated reveal. p: 0..1 overall progress. mode:
 *   'rise'     per-char slide up out of a mask line (classic editorial)
 *   'drop'     per-char fall from above with slight rotation
 *   'blur'     per-char focus-in (blur + opacity + small scale)
 *   'track'    whole word tracks in from wide letter-spacing
 *   'type'     typewriter (with optional caret)
 *   'scramble' cipher-like glyph shuffle resolving left→right (deterministic)
 *   'wipe'     hard mask wipe left→right with a leading bar
 *   'words'    per-word rise
 *   'stamp'    scale-down slam (1.6→1) with a jolt — verdicts, numbers
 * opts: family,size,weight,style,tracking,align, fill, stagger (0..1 share), ease, caret, color2, seed
 */
export function reveal(ctx, str, x, y, p, o = {}) {
  const mode = o.mode || 'rise';
  ctx.save(); set(ctx, { ...o, align: 'left' });
  const G = glyphs(ctx, str);
  const total = G.width;
  let x0 = x;
  if (o.align === 'center') x0 = x - total / 2; else if (o.align === 'right') x0 = x - total;
  const size = o.size || 64; const fill = o.fill || '#ede6d6';
  const ease = o.ease || Ease.out; const st = o.stagger ?? 0.5; const n = G.list.length;
  const charP = (i) => { const d = n > 1 ? (i / (n - 1)) * st : 0; return ease(clamp01((p - d) / (1 - st || 1))); };
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = fill;
  if (o.shadow) { ctx.shadowColor = o.shadow.color || 'rgba(0,0,0,0.45)'; ctx.shadowBlur = o.shadow.blur ?? 18; ctx.shadowOffsetY = o.shadow.y ?? 6; }
  switch (mode) {
    case 'rise': case 'drop': {
      ctx.save();
      if (mode === 'rise') { ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.25, total + size * 2, size * 1.55); ctx.clip(); }
      for (const g of G.list) {
        const e = charP(g.i); if (e <= 0) continue;
        const dy = mode === 'rise' ? (1 - e) * size * 1.1 : -(1 - e) * size * 1.4;
        ctx.save(); ctx.translate(x0 + g.x + g.w / 2, y + dy);
        if (mode === 'drop') { ctx.rotate((1 - e) * (hash(g.i + 7) - 0.5) * 0.8); ctx.globalAlpha *= e; }
        ctx.fillText(g.ch, -g.w / 2, 0); ctx.restore();
      }
      ctx.restore(); break;
    }
    case 'words': {
      const words = str.split(' '); let cx = x0; const sp = measure(ctx, ' ');
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.25, total + size * 2, size * 1.55); ctx.clip();
      const nw = words.length;
      words.forEach((w, i) => {
        const d = nw > 1 ? (i / (nw - 1)) * st : 0; const e = ease(clamp01((p - d) / (1 - st || 1)));
        if (e > 0) ctx.fillText(w, cx, y + (1 - e) * size * 1.1);
        cx += measure(ctx, w) + sp;
      });
      ctx.restore(); break;
    }
    case 'blur': {
      for (const g of G.list) {
        const e = charP(g.i); if (e <= 0) continue;
        ctx.save(); ctx.globalAlpha *= e; const b = (1 - e) * size * 0.18; if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`;
        const s = lerp(1.25, 1, e); ctx.translate(x0 + g.x + g.w / 2, y - size * 0.35); ctx.scale(s, s);
        ctx.fillText(g.ch, -g.w / 2, size * 0.35); ctx.restore();
      }
      break;
    }
    case 'track': {
      const e = ease(clamp01(p)); const extra = (1 - e) * (o.trackFrom ?? size * 0.6);
      ctx.globalAlpha *= clamp01(p * 2.5);
      const wFull = total + extra * (n - 1);
      let sx = x; if (o.align === 'center') sx = x - wFull / 2; else if (o.align === 'right') sx = x - wFull;
      for (const g of G.list) ctx.fillText(g.ch, sx + g.x + extra * g.i, y);
      break;
    }
    case 'type': {
      const k = Math.floor(clamp01(p) * n + 0.0001);
      const s = G.list.slice(0, k).map((g) => g.ch).join('');
      ctx.fillText(s, x0, y);
      if (o.caret !== false && p < 1.05) {
        const cw = k > 0 ? G.list[k - 1].x + G.list[k - 1].w : 0;
        if (Math.floor((o.t ?? p * 10) * 2.2) % 2 === 0 || p < 1) { ctx.fillRect(x0 + cw + 3, y - size * 0.8, Math.max(2, size * 0.07), size * 0.95); }
      }
      break;
    }
    case 'scramble': {
      const pool = o.pool || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
      const seed = o.seed || 1; const tick = Math.floor((o.t ?? p * 20) * 24);
      for (const g of G.list) {
        const e = charP(g.i); if (e <= 0) continue;
        const ch = e >= 1 || g.ch === ' ' ? g.ch : pool[Math.floor(hash(g.i * 131 + tick * 7 + seed) * pool.length)];
        ctx.globalAlpha = e >= 1 ? 1 : 0.55 + 0.45 * e;
        ctx.fillStyle = e >= 1 ? fill : (o.color2 || fill);
        ctx.fillText(ch, x0 + g.x, y);
      }
      break;
    }
    case 'wipe': {
      const e = ease(clamp01(p)); const wx = x0 + (total + size * 0.2) * e;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y - size * 1.2, wx - x0 + 4, size * 1.6); ctx.clip(); ctx.fillText(str, x0, y); ctx.restore();
      if (e > 0 && e < 1) { ctx.fillStyle = o.color2 || '#e8432e'; ctx.fillRect(wx, y - size * 0.95, Math.max(4, size * 0.08), size * 1.15); }
      break;
    }
    case 'stamp': {
      const e = clamp01(p / 0.35); const s = lerp(1.7, 1, Ease.expoOut(e));
      const jolt = p > 0.35 ? Math.sin((p - 0.35) * 40) * Math.exp(-(p - 0.35) * 12) * 0.03 : 0;
      ctx.globalAlpha *= clamp01(e * 3);
      ctx.translate(x0 + total / 2, y - size * 0.35); ctx.rotate((o.rot || 0) + jolt); ctx.scale(s, s);
      ctx.fillText(str, -total / 2, size * 0.35);
      break;
    }
    default: ctx.fillText(str, x0, y);
  }
  ctx.restore();
  return total;
}

/** numbers. opts: decimals, prefix, suffix, sep (thousands), odometer:true for rolling digits */
export function formatNum(v, { decimals = 0, sep = ',', prefix = '', suffix = '' } = {}) {
  const s = Math.abs(v).toFixed(decimals); let [i, d] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${v < 0 ? '−' : ''}${prefix}${i}${d ? '.' + d : ''}${suffix}`;
}
export function counter(ctx, value, x, y, o = {}) {
  ctx.save(); set(ctx, { family: F.wide, weight: 700, ...o, align: 'left' });
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = o.fill || '#ede6d6';
  const str = formatNum(value, o);
  const width = measure(ctx, str);
  let x0 = x; if (o.align === 'center') x0 = x - width / 2; else if (o.align === 'right') x0 = x - width;
  if (!o.odometer) { ctx.fillText(str, x0, y); ctx.restore(); return width; }
  // odometer: each digit rolls vertically; fractional part of value drives the roll
  const size = o.size || 64;
  const G = glyphs(ctx, str);
  ctx.beginPath(); ctx.rect(x0 - 10, y - size * 1.0, width + 20, size * 1.22); ctx.clip();
  const intVal = Math.floor(Math.abs(value)); const frac = Math.abs(value) - intVal;
  const digits = G.list.filter((g) => /\d/.test(g.ch));
  let di = 0;
  for (const g of G.list) {
    if (!/\d/.test(g.ch)) { ctx.fillText(g.ch, x0 + g.x, y); continue; }
    const place = digits.length - 1 - di; di++;
    // roll only the digits that are changing: the lowest place rolls with frac
    const roll = place === 0 ? Ease.std(frac) : 0;
    const d = parseInt(g.ch, 10);
    ctx.fillText(String(d), x0 + g.x, y - roll * size * 1.1);
    if (roll > 0) ctx.fillText(String((d + 1) % 10), x0 + g.x, y + (1 - roll) * size * 1.1);
  }
  ctx.restore();
  return width;
}

/** text along a polyline (map labels on routes, rivers, coastlines) */
export function onPath(ctx, str, pts, o = {}) {
  ctx.save(); set(ctx, { ...o, align: 'left' }); ctx.fillStyle = o.fill || '#ede6d6';
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const lens = polyLengths(pts); const total = lens[lens.length - 1];
  const G = glyphs(ctx, str); let start = (o.offset ?? 0.5) * total - G.width / 2;
  const shown = Math.floor((o.p ?? 1) * G.list.length + 1e-6);
  for (const g of G.list.slice(0, shown)) {
    const d = start + g.x + g.w / 2; if (d < 0 || d > total) continue;
    const q = polyAt(pts, d / total, lens);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.angle); ctx.fillText(g.ch, -g.w / 2, o.dy ?? -6); ctx.restore();
  }
  ctx.restore();
}

/** small technical label with leader line & dot (HUD / diagram annotation) */
export function label(ctx, str, ax, ay, lx, ly, p = 1, o = {}) {
  const e = Ease.out(clamp01(p));
  const color = o.color || '#ede6d6';
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = o.lineWidth || 1.6;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.beginPath(); ctx.arc(ax, ay, (o.dot ?? 5) * clamp01(p * 4), 0, Math.PI * 2); ctx.fill();
  const mx = lerp(ax, lx, clamp01(e * 1.6)), my = lerp(ay, ly, clamp01(e * 1.6));
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx, my);
  const ex = lx + (o.right === false ? -1 : 1) * (o.shelf ?? 60) * clamp01(e * 1.6 - 0.6);
  if (e > 0.6) ctx.lineTo(ex, ly);
  ctx.stroke();
  if (e > 0.55) reveal(ctx, str, o.right === false ? ex - 8 : ex + 8, ly + (o.size || 22) * 0.35, clamp01((e - 0.55) / 0.45),
    { family: o.family || F.mono, size: o.size || 22, weight: o.weight || 500, tracking: o.tracking ?? 2, fill: color, mode: o.mode || 'scramble', align: o.right === false ? 'right' : 'left', t: o.t });
  ctx.restore();
}
void noise2;
