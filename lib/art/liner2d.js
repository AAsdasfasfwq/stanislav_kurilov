// ─────────────────────────────────────────────────────────────────────────────
//  lib/art/liner2d.js — the liner "SOVETSKY SOYUZ" as a 2D illustration.
//  Same design as lib/three/liner3d.js: black hull, white boot-top, red-oxide
//  bottom, 5 white decks with warm windows, lifeboats, two cream funnels with a
//  red band + gold hammer & sickle, raked masts, string lights, cruiser stern.
//
//    drawLiner(ctx, { x, y, scale, facing: 1|-1, lights: 0..1, t, style: 'illustration'|'blueprint'|'silhouette',
//                     roll (rad), smoke: 0..1, underwater: bool (show hull below waterline), cut: 0..1 })
//      x,y = waterline at midship. Length at scale 1 = 1000 px.
//    drawHullSection(ctx, { x, y, scale, bulges: true, style, p })  — midship cross-section (anti-roll bulges)
// ─────────────────────────────────────────────────────────────────────────────
import { rgba, noise2, hash, clamp01, lerp, TAU } from '../../engine/math.js';

const HULL_TOP = -56, KEEL = 48; // px at scale 1 (freeboard / draft)

function hullPath(L) {
  // profile from stern (left, x=-L/2) to bow (right, x=+L/2), facing right
  const p = new Path2D();
  const sheer = (x) => -6 * Math.pow((x / (L / 2)), 2) - (x > 0 ? 8 * Math.pow(x / (L / 2), 3) : 0);
  p.moveTo(-L / 2 + 10, HULL_TOP + sheer(-L / 2) + 4);
  for (let i = 0; i <= 40; i++) { const x = -L / 2 + 10 + (i / 40) * (L - 30); p.lineTo(x, HULL_TOP + sheer(x)); }
  // raked stem
  p.lineTo(L / 2, HULL_TOP + sheer(L / 2) - 4);
  p.bezierCurveTo(L / 2 - 20, -10, L / 2 - 60, KEEL - 6, L / 2 - 110, KEEL);
  p.lineTo(-L / 2 + 70, KEEL);
  // cruiser stern
  p.bezierCurveTo(-L / 2 + 20, KEEL - 4, -L / 2, 10, -L / 2 + 4, -20);
  p.bezierCurveTo(-L / 2 + 6, -40, -L / 2 + 8, HULL_TOP + 4, -L / 2 + 10, HULL_TOP + sheer(-L / 2) + 4);
  p.closePath();
  return { p, sheer };
}

export function drawLiner(ctx, o = {}) {
  const { x = 960, y = 600, scale = 1, facing = 1, lights = 1, t = 0, style = 'illustration', roll = 0, smoke = 0.6, underwater = false, alpha = 1 } = o;
  const L = 1000; const { p: hull, sheer } = hullPath(L);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(roll); ctx.scale(scale * facing, scale);
  const bp = style === 'blueprint', sil = style === 'silhouette';
  const ink = bp ? '#9fe6ff' : sil ? (o.silColor || '#05090d') : '#0b0d10';
  const strokeOnly = (path, w = 2) => { ctx.strokeStyle = ink; ctx.lineWidth = w / scale; ctx.stroke(path); };
  // smoke (behind)
  if (smoke > 0 && !bp && !sil) for (const fx of [-30, 95]) for (let i = 0; i < 14; i++) {
    const k = i / 14; const drift = (t * 40 + i * 30) % 420; const px = fx - drift * 1.2 - k * 40, py = HULL_TOP - 190 - drift * 0.35 + noise2(i, t * 0.3) * 12;
    const r = 18 + drift * 0.18; ctx.fillStyle = rgba('#3a4148', smoke * 0.35 * (1 - drift / 420)); ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
  // ── superstructure tiers ──
  const tiers = [[-300, 330, 0], [-280, 300, 1], [-250, 270, 2], [-200, 230, 3], [-120, 200, 4]]; // [x0, x1, level]
  const deckH = 22;
  tiers.forEach(([x0, x1, lv]) => {
    const yb = HULL_TOP + sheer((x0 + x1) / 2) - lv * deckH; const yt = yb - deckH;
    const path = new Path2D(); path.moveTo(x0, yb); path.lineTo(x0 + 6, yt); path.lineTo(x1 - 10, yt); path.quadraticCurveTo(x1 + 4, yt + 4, x1, yb); path.closePath();
    if (bp) { strokeOnly(path, 1.5); }
    else if (sil) { ctx.fillStyle = ink; ctx.fill(path); }
    else {
      const g = ctx.createLinearGradient(0, yt, 0, yb); g.addColorStop(0, '#f6f2e8'); g.addColorStop(1, '#cfc9bb'); ctx.fillStyle = g; ctx.fill(path);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, yb - 3, x1 - x0, 3);
      // windows
      for (let wx = x0 + 14; wx < x1 - 14; wx += 11) { const on = hash(Math.floor(wx) * 7 + lv * 131) > 0.22; const fl = 0.85 + 0.15 * Math.sin(t * 3 + wx);
        ctx.fillStyle = on && lights > 0 ? `rgba(255,${200 + (hash(wx + lv) * 40 | 0)},${120 + (hash(wx * 3) * 60 | 0)},${lights * fl})` : 'rgba(40,52,60,0.85)'; ctx.fillRect(wx, yt + 7, 6, 7); }
    }
  });
  // lifeboats
  if (!bp) for (let i = 0; i < 7; i++) { const bx = -230 + i * 52, by = HULL_TOP - deckH * 2.6 - 6; ctx.fillStyle = sil ? ink : '#efe9dd'; ctx.beginPath(); ctx.ellipse(bx, by, 20, 6, 0, 0, Math.PI); ctx.fill(); if (!sil) { ctx.fillStyle = '#c9572f'; ctx.fillRect(bx - 20, by - 3, 40, 3); } }
  // funnels
  for (const fx of [-30, 95]) {
    const fy = HULL_TOP - deckH * 5 - 4; const fp = new Path2D(); fp.moveTo(fx - 26, fy); fp.lineTo(fx - 18 - 14, fy - 120); fp.lineTo(fx + 30 - 14, fy - 120); fp.lineTo(fx + 26, fy); fp.closePath();
    if (bp) strokeOnly(fp, 1.5);
    else if (sil) { ctx.fillStyle = ink; ctx.fill(fp); }
    else { const g = ctx.createLinearGradient(fx - 30, 0, fx + 30, 0); g.addColorStop(0, '#bdb4a0'); g.addColorStop(0.4, '#efe7d4'); g.addColorStop(1, '#a89f8c'); ctx.fillStyle = g; ctx.fill(fp);
      ctx.save(); ctx.clip(fp); ctx.fillStyle = '#b8261d'; ctx.fillRect(fx - 60, fy - 100, 120, 26); ctx.fillStyle = '#121212'; ctx.fillRect(fx - 60, fy - 124, 120, 12);
      ctx.fillStyle = '#e8c15a'; ctx.font = '700 20px serif'; ctx.textAlign = 'center'; ctx.fillText('☭', fx - 6, fy - 80); ctx.restore(); }
  }
  // masts & string lights
  const mast = (mx, h) => { ctx.strokeStyle = bp ? ink : sil ? ink : '#d9d4c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, HULL_TOP + sheer(mx)); ctx.lineTo(mx - 8, HULL_TOP + sheer(mx) - h); ctx.stroke(); return [mx - 8, HULL_TOP + sheer(mx) - h]; };
  const m1 = mast(330, 250), m2 = mast(-250, 210);
  ctx.strokeStyle = bp ? ink : 'rgba(180,190,195,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L / 2 - 4, HULL_TOP - 12); ctx.lineTo(...m1); ctx.lineTo(...m2); ctx.lineTo(-L / 2 + 14, HULL_TOP - 4); ctx.stroke();
  if (lights > 0 && !bp && !sil) { const seg = [[L / 2 - 4, HULL_TOP - 12, ...m1], [...m1, ...m2], [...m2, -L / 2 + 14, HULL_TOP - 4]];
    for (const [ax, ay, bx, by] of seg) for (let i = 0; i <= 18; i++) { const k = i / 18; const px = lerp(ax, bx, k), py = lerp(ay, by, k) + Math.sin(k * Math.PI) * 8; const fl = 0.6 + 0.4 * Math.sin(t * 5 + i * 1.7);
      ctx.fillStyle = `rgba(255,214,140,${lights * fl})`; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill(); } }
  // ── hull ──
  if (bp) { strokeOnly(hull, 2.2); ctx.setLineDash([10 / scale, 6 / scale]); ctx.beginPath(); ctx.moveTo(-L / 2 - 20, 0); ctx.lineTo(L / 2 + 20, 0); ctx.stroke(); ctx.setLineDash([]); }
  else if (sil) { ctx.fillStyle = ink; ctx.fill(hull); }
  else {
    ctx.save(); ctx.clip(hull);
    const g = ctx.createLinearGradient(0, HULL_TOP, 0, KEEL); g.addColorStop(0, '#1b1f24'); g.addColorStop(0.5, '#0c0e11'); g.addColorStop(1, '#08090b'); ctx.fillStyle = g; ctx.fillRect(-L, -200, L * 2, 400);
    ctx.fillStyle = '#7a2a1f'; ctx.fillRect(-L, 4, L * 2, 200); ctx.fillStyle = '#e9e6dc'; ctx.fillRect(-L, -1, L * 2, 6);
    // plating seams + highlight along the sheer
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; for (let i = -L / 2; i < L / 2; i += 26) { ctx.beginPath(); ctx.moveTo(i, HULL_TOP - 20); ctx.lineTo(i, KEEL); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,220,235,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const xx = -L / 2 + 10 + (i / 40) * (L - 30); i ? ctx.lineTo(xx, HULL_TOP + sheer(xx) + 3) : ctx.moveTo(xx, HULL_TOP + sheer(xx) + 3); } ctx.stroke();
    // portholes
    for (const row of [-38, -22]) for (let px = -L / 2 + 50; px < L / 2 - 60; px += 9) { const on = hash(Math.floor(px * 3) + row) > 0.15; const fl = 0.8 + 0.2 * Math.sin(t * 2.3 + px * 0.1);
      ctx.fillStyle = on && lights > 0 ? `rgba(255,${200 + (hash(px) * 40 | 0)},130,${lights * fl})` : 'rgba(60,70,78,0.7)'; ctx.beginPath(); ctx.arc(px, row + sheer(px), 2.2, 0, TAU); ctx.fill(); }
    // name
    ctx.save(); ctx.scale(facing, 1); ctx.fillStyle = '#e9e6dc'; ctx.font = '400 15px "Dela Gothic One"'; ctx.textAlign = 'center'; ctx.fillText('СОВЕТСКИЙ СОЮЗ', facing * (L / 2 - 120), -40 + sheer(L / 2 - 120)); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#050607'; ctx.lineWidth = 2; ctx.stroke(hull);
  }
  // underwater part: propellers & rudder hint
  if (underwater || bp) { ctx.strokeStyle = bp ? ink : '#b08a4a'; ctx.lineWidth = 3; for (const a of [0, 1, 2, 3]) { const ang = t * 9 + a * Math.PI / 2; ctx.beginPath(); ctx.ellipse(-L / 2 + 70, KEEL - 18, 4, 22, ang, 0, TAU); ctx.stroke(); } }
  ctx.restore();
}

/**
 * Midship cross-section (looking from the stern): shows why jumping over the side
 * meant hitting the ANTI-ROLL BULGES. style: 'blueprint' | 'illustration'. p: reveal 0..1
 */
export function drawHullSection(ctx, { x = 960, y = 540, scale = 1, bulges = true, style = 'blueprint', p = 1, waterline = true } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const bp = style === 'blueprint'; const ink = bp ? '#9fe6ff' : '#0b0d10';
  const B = 250, D = 190, F = 230; // half-beam, draft, freeboard px
  const path = new Path2D();
  path.moveTo(-B, -F); path.lineTo(-B, -40);
  if (bulges) { path.bezierCurveTo(-B, -10, -B - 60, 10, -B - 55, 60); path.bezierCurveTo(-B - 50, 100, -B + 10, 110, -B + 30, 130); }
  path.bezierCurveTo(-B + 50, D, -B + 100, D, -B + 160, D); path.lineTo(B - 160, D); path.bezierCurveTo(B - 100, D, B - 50, D, B - 30, 130);
  if (bulges) { path.bezierCurveTo(B - 10, 110, B + 50, 100, B + 55, 60); path.bezierCurveTo(B + 60, 10, B, -10, B, -40); } else path.lineTo(B, -40);
  path.lineTo(B, -F);
  const k = clamp01(p);
  if (bp) { ctx.setLineDash([2400 * k, 2400]); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke(path); ctx.setLineDash([]); }
  else { ctx.fillStyle = '#0c0e11'; ctx.fill(path); ctx.save(); ctx.clip(path); ctx.fillStyle = '#7a2a1f'; ctx.fillRect(-600, 0, 1200, 400); ctx.fillStyle = '#e9e6dc'; ctx.fillRect(-600, -6, 1200, 8); ctx.restore(); ctx.strokeStyle = '#050607'; ctx.lineWidth = 3; ctx.stroke(path); }
  if (waterline) { ctx.strokeStyle = bp ? 'rgba(159,230,255,0.6)' : 'rgba(30,120,160,0.8)'; ctx.setLineDash([12, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-B * 1.8, 0); ctx.lineTo(B * 1.8, 0); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}
