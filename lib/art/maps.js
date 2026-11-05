// ─────────────────────────────────────────────────────────────────────────────
//  lib/art/maps.js — cartography toolkit (Natural Earth data in geo-data.js).
//
//    import { View, drawLand, drawGraticule, drawRoute, pin, ringNear } from '../../lib/art/maps.js';
//    import { PACIFIC, USSR, PHILIPPINES_HI, PLACES, CRUISE_ROUTE } from '../../lib/art/geo-data.js';
//    const v = new View({ type: 'merc', center: [128, 22], zoom: 9, x: 960, y: 540 });   // zoom = px per degree
//    drawLand(ctx, PACIFIC, v, { fill: '#e6dcc4', stroke: '#2b2a26', relief: true });
//    drawRoute(ctx, CRUISE_ROUTE, v, p, { color: '#5cf2c4', width: 4, head: true });
//    const [px, py] = v.project(...PLACES.siargao);
//  Views: 'merc' (Mercator), 'eq' (equirectangular), 'ortho' (globe; rot = [lon, lat])
//  Render maps ONCE into an oversized cached plate and move/zoom the plate with
//  transforms when possible (no shimmer, faster) — see makePlate().
// ─────────────────────────────────────────────────────────────────────────────
import { clamp01, lerp, polyLengths, polySlice, polyAt, TAU, rgba } from '../../engine/math.js';

const R2D = 180 / Math.PI, D2R = Math.PI / 180;
export class View {
  constructor(o = {}) { this.type = 'merc'; this.center = [0, 0]; this.zoom = 8; this.x = 960; this.y = 540; this.rot = [0, 0]; this.radius = 400; this.tilt = 0; Object.assign(this, o); }
  mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2)) * R2D; }
  /** [lon,lat] → [x,y] (+ visible flag for ortho) */
  project(lon, lat) {
    if (this.type === 'ortho') {
      const [l0, p0] = this.rot; const λ = (lon - l0) * D2R, φ = lat * D2R, φ0 = p0 * D2R;
      const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
      const X = Math.cos(φ) * Math.sin(λ), Y = Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ);
      const r = this.radius; const out = [this.x + X * r, this.y - Y * r]; out.visible = cosc >= 0; out.cosc = cosc; return out;
    }
    const [cl, cp] = this.center;
    let dx = lon - cl; if (dx > 180) dx -= 360; if (dx < -180) dx += 360;
    const yy = this.type === 'merc' ? this.mercY(lat) - this.mercY(cp) : lat - cp;
    const out = [this.x + dx * this.zoom, this.y - yy * this.zoom]; out.visible = true; return out;
  }
  /** pixels per km at a latitude (for scale bars, distance rings) */
  pxPerKm(lat = this.center[1]) { const degKm = 111.32; return this.type === 'merc' ? this.zoom / (degKm * Math.cos(lat * D2R)) * (1 / Math.cos(lat * D2R)) * Math.cos(lat * D2R) : this.zoom / degKm; }
}
/** path of rings (flat [lon,lat,…] arrays) in a view. Ortho: rings are cut at the
 *  horizon and each visible run is closed along the globe limb. */
export function landPath(rings, view, minPx = 0.6) {
  const p = new Path2D();
  for (const r of rings) {
    const pts = []; let anyHidden = false, anyVis = false;
    for (let i = 0; i < r.length; i += 2) { const q = view.project(r[i], r[i + 1]); pts.push(q); if (q.visible) anyVis = true; else anyHidden = true; }
    if (!anyVis) continue;
    if (!anyHidden || view.type !== 'ortho') {
      let lx = 1e9, ly = 1e9, n = 0;
      pts.forEach((q, i) => { if (i && Math.abs(q[0] - lx) < minPx && Math.abs(q[1] - ly) < minPx) return; i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); lx = q[0]; ly = q[1]; n++; });
      if (n > 2) p.closePath(); continue;
    }
    // rotate so we start right after a hidden point
    const N = pts.length; let s0 = 0; for (let i = 0; i < N; i++) if (!pts[i].visible && pts[(i + 1) % N].visible) { s0 = (i + 1) % N; break; }
    const ang = (q) => Math.atan2(q[1] - view.y, q[0] - view.x);
    const limb = (a) => [view.x + Math.cos(a) * view.radius, view.y + Math.sin(a) * view.radius];
    let run = [];
    const flush = () => {
      if (run.length > 2) {
        const a0 = ang(run[0]), a1 = ang(run[run.length - 1]);
        const e0 = limb(a0), e1 = limb(a1);
        p.moveTo(e0[0], e0[1]); run.forEach((q) => p.lineTo(q[0], q[1])); p.lineTo(e1[0], e1[1]);
        let d = a0 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const steps = Math.max(2, Math.ceil(Math.abs(d) / 0.05)); for (let k = 1; k <= steps; k++) { const q = limb(a1 + (d * k) / steps); p.lineTo(q[0], q[1]); }
        p.closePath();
      }
      run = [];
    };
    for (let k = 0; k < N; k++) { const q = pts[(s0 + k) % N]; if (q.visible) run.push(q); else flush(); }
    flush();
  }
  return p;
}
/** equirectangular land plate (for texturing a Three.js globe): returns canvas */
export function equirectPlate(rings, { w = 2048, h = 1024, land = '#d8cfb6', sea = '#123447', stroke = null, extra = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = sea; x.fillRect(0, 0, w, h); x.fillStyle = land;
  const P = (lo, la) => [((lo + 180) / 360) * w, ((90 - la) / 180) * h];
  x.beginPath(); for (const r of rings) { for (let i = 0; i < r.length; i += 2) { const [px, py] = P(r[i], r[i + 1]); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); } x.fill();
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.2; x.stroke(); }
  if (extra) extra(x, P);
  return c;
}
/**
 * Land with an editorial print look: fill, inner shadow coast, optional relief hatch,
 * and an ink coastline. opts: fill, stroke, lineWidth, shadow (drop), relief (bool), coastGlow
 */
export function drawLand(ctx, rings, view, o = {}) {
  const { fill = '#e6dcc4', stroke = '#2b2a26', lineWidth = 1.4, shadow = 'rgba(0,0,0,0.35)', relief = false, coastGlow = null, alpha = 1 } = o;
  const path = landPath(rings, view);
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) { ctx.save(); ctx.translate(4, 6); ctx.filter = 'blur(6px)'; ctx.fillStyle = shadow; ctx.fill(path); ctx.restore(); }
  if (coastGlow) { ctx.save(); ctx.strokeStyle = coastGlow; ctx.lineWidth = 10; ctx.filter = 'blur(8px)'; ctx.stroke(path); ctx.restore(); }
  ctx.fillStyle = fill; ctx.fill(path);
  if (relief) { ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(60,50,30,0.12)'; ctx.lineWidth = 1; for (let k = -1200; k < 3200; k += 7) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - 1080, 1080); ctx.stroke(); } ctx.restore(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.stroke(path); }
  ctx.restore();
  return path;
}
/** lat/lon grid lines (+ optional degree labels) */
export function drawGraticule(ctx, view, { step = 10, color = 'rgba(255,255,255,0.12)', width = 1, lon = [-180, 180], lat = [-80, 80], dash = null } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  for (let L = Math.ceil(lon[0] / step) * step; L <= lon[1]; L += step) { ctx.beginPath(); let st = false; for (let p = lat[0]; p <= lat[1]; p += 1) { const q = view.project(L, p); if (!q.visible) { st = false; continue; } st ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); st = true; } ctx.stroke(); }
  for (let P = Math.ceil(lat[0] / step) * step; P <= lat[1]; P += step) { ctx.beginPath(); let st = false; for (let l = lon[0]; l <= lon[1]; l += 1) { const q = view.project(l, P); if (!q.visible) { st = false; continue; } st ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); st = true; } ctx.stroke(); }
  ctx.restore();
}
/** draw-on route with glowing head. coords [[lon,lat],…]; p 0..1 */
export function drawRoute(ctx, coords, view, p = 1, { color = '#5cf2c4', width = 4, dash = null, head = true, glow = true, smooth = true } = {}) {
  const pts = coords.map(([lo, la]) => view.project(lo, la)).map((q) => [q[0], q[1]]);
  const dense = smooth ? catmullPts(pts, 10) : pts; const lens = polyLengths(dense);
  const sl = polySlice(dense, 0, clamp01(p), lens);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (glow) { ctx.strokeStyle = rgba(color, 0.25); ctx.lineWidth = width * 4; ctx.filter = 'blur(6px)'; strokePts(ctx, sl); ctx.filter = 'none'; }
  ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash); strokePts(ctx, sl); ctx.setLineDash([]);
  if (head && p > 0 && p < 1) { const h = polyAt(dense, p, lens); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(h.x, h.y, width * 1.3, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, width * 8); g.addColorStop(0, rgba(color, 0.8)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(h.x - width * 8, h.y - width * 8, width * 16, width * 16); }
  ctx.restore();
  return { pts: dense, lens, head: polyAt(dense, clamp01(p), lens) };
}
function strokePts(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
function catmullPts(points, segs) {
  const out = []; const n = points.length; if (n < 3) return points;
  const P = (i) => points[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < segs; s++) { const t = s / segs, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
  out.push(points[n - 1]); return out;
}
/** location pin: pulsing ring + dot; returns screen position */
export function pin(ctx, x, y, p = 1, { color = '#e8432e', r = 7, t = 0, ring = true } = {}) {
  const e = clamp01(p);
  ctx.save();
  if (ring) { const k = (t * 0.8) % 1; ctx.strokeStyle = rgba(color, (1 - k) * 0.8 * e); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + k * r * 4, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * e, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.38 * e, 0, TAU); ctx.fill();
  ctx.restore();
}
/** great-circle-ish distance in km between [lon,lat] pairs */
export function distKm(a, b) { const R = 6371; const dφ = (b[1] - a[1]) * D2R, dλ = (b[0] - a[0]) * D2R; const h = Math.sin(dφ / 2) ** 2 + Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
/** find the ring (island) containing/nearest to a lon/lat (e.g. Siargao in PHILIPPINES_HI) */
export function ringNear(rings, lon, lat) {
  let best = null, bd = 1e9;
  for (const r of rings) { let mx = 0, my = 0, n = r.length / 2; for (let i = 0; i < r.length; i += 2) { mx += r[i]; my += r[i + 1]; } mx /= n; my /= n; const d = Math.hypot(mx - lon, my - lat); if (d < bd) { bd = d; best = r; } }
  return best;
}
/**
 * Pre-render a static map into an oversized plate (cache it with E.cache) and
 * then move it with ctx transforms → stable, fast, no shimmer.
 */
export function makePlate(w, h, drawFn) { const c = document.createElement('canvas'); c.width = w; c.height = h; drawFn(c.getContext('2d'), w, h); return c; }
void lerp;
