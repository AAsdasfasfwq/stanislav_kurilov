// ─────────────────────────────────────────────────────────────────────────────
//  lib/chars/rig.js — 2.5D character rig: "drawn like 2D, built like 3D".
//
//  A character is a 3D skeleton (FK) projected to the screen. Every body part is
//  painted as a 2D illustration (cel shading + soft core shadow + rim light +
//  coloured ink line), but its position, foreshortening, draw order, the way
//  stripes wrap around the torso and the way facial features slide across the
//  head when it turns all come from 3D. Result: hand-drawn look, 3D physics.
//
//    import { drawCharacter, pose, P } from '../../lib/chars/rig.js';
//    import { KURILOV } from '../../lib/chars/kurilov.js';
//    const p = pose({ yaw: 0.6, headYaw: 0.3, ...P.standRail });   // or blend: lerpPose(a, b, k)
//    drawCharacter(ctx, KURILOV.adult, p, { x: 960, y: 620, scale: 0.9, light: LIGHT.stormNight, outfit: 'deck' });
//
//  Coordinates: character space y DOWN, x = character's LEFT (screen right when
//  facing camera), z = toward camera. Origin = pelvis centre. Units ≈ px @ scale 1
//  (adult ≈ 760 px tall). Angles in radians.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp01, lerp, hex, rgba, shade, noise2, TAU } from '../../engine/math.js';
import { smoothPath } from '../../engine/draw.js';

// ── tiny 3D math ─────────────────────────────────────────────────────────────
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// 3x3 matrices as flat arrays (row-major)
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mm = (A, B) => { const R = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return R; };
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
/** yaw (Y) · pitch (X) · roll (Z) */
const eul = (yaw = 0, pitch = 0, roll = 0) => mm(mm(Ry(yaw), Rx(pitch)), Rz(roll));

// ── pose ────────────────────────────────────────────────────────────────────
/**
 * Pose fields (all optional, radians):
 *  yaw pitch roll           whole body (yaw 0 = facing camera, +π/2 = facing screen-right... profile)
 *  spinePitch spineRoll spineYaw   torso bend (pitch + = bend forward)
 *  neckPitch headYaw headPitch headRoll
 *  lShoulderPitch lShoulderRoll lShoulderYaw lElbow lWrist   (L = character's left)
 *  rShoulderPitch rShoulderRoll rShoulderYaw rElbow rWrist
 *  lHipPitch lHipRoll lKnee lAnkle   rHipPitch rHipRoll rKnee rAnkle
 *  lHand rHand: 'open'|'relaxed'|'fist'|'grip'|'point'|'claw'|'spread'
 *  gazeX gazeY (-1..1) blink (0..1) expr: name or object (see EXPR)
 *  breathe (0..1 chest expansion) wind (hair/clothes push, px) wet (0..1 hair)
 */
export const POSE0 = {
  yaw: 0, pitch: 0, roll: 0, spinePitch: 0, spineRoll: 0, spineYaw: 0, neckPitch: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  lShoulderPitch: 0, lShoulderRoll: 0.12, lShoulderYaw: 0, lElbow: 0.15, lWrist: 0,
  rShoulderPitch: 0, rShoulderRoll: 0.12, rShoulderYaw: 0, rElbow: 0.15, rWrist: 0,
  lHipPitch: 0, lHipRoll: 0.04, lKnee: 0.02, lAnkle: 0, rHipPitch: 0, rHipRoll: 0.04, rKnee: 0.02, rAnkle: 0,
  lHand: 'relaxed', rHand: 'relaxed', gazeX: 0, gazeY: 0, blink: 0, expr: 'neutral', breathe: 0, wind: 0, windY: 0, wet: 0,
};
export const pose = (o = {}) => ({ ...POSE0, ...o });
/** blend two poses (numbers lerped; strings switch at k=0.5; expr objects blended) */
export function lerpPose(a, b, k) {
  const out = {};
  for (const key in POSE0) {
    const va = a[key] ?? POSE0[key], vb = b[key] ?? POSE0[key];
    if (typeof va === 'number') out[key] = lerp(va, vb, k);
    else if (key === 'expr') out[key] = blendExpr(va, vb, k);
    else out[key] = k < 0.5 ? va : vb;
  }
  return out;
}

// ── expressions ─────────────────────────────────────────────────────────────
// browIn (+ = knit down toward nose), browUp (+ = raised), lid (1 open … 0 closed),
// squint (lower lid up), mouthOpen, mouthWide, smile (+/-), teeth (0/1), jaw (drop), tongue
export const EXPR = {
  neutral: { browIn: 0, browUp: 0, lid: 0.85, squint: 0.1, mouthOpen: 0, mouthWide: 0, smile: 0, teeth: 0, jaw: 0, sneer: 0 },
  determined: { browIn: 0.7, browUp: -0.2, lid: 0.7, squint: 0.35, mouthOpen: 0, mouthWide: 0.1, smile: -0.25, teeth: 0, jaw: 0, sneer: 0 },
  focused: { browIn: 0.45, browUp: 0, lid: 0.75, squint: 0.3, mouthOpen: 0, mouthWide: -0.1, smile: -0.1, teeth: 0, jaw: 0, sneer: 0 },
  fear: { browIn: 0.5, browUp: 0.9, lid: 1.0, squint: 0, mouthOpen: 0.35, mouthWide: 0.3, smile: -0.4, teeth: 0.6, jaw: 0.2, sneer: 0 },
  shock: { browIn: -0.2, browUp: 1, lid: 1.05, squint: 0, mouthOpen: 0.8, mouthWide: -0.2, smile: -0.1, teeth: 0, jaw: 0.6, sneer: 0 },
  pain: { browIn: 0.9, browUp: 0.5, lid: 0.3, squint: 0.8, mouthOpen: 0.35, mouthWide: 0.7, smile: -0.6, teeth: 1, jaw: 0.15, sneer: 0.5 },
  exhausted: { browIn: 0.3, browUp: 0.35, lid: 0.35, squint: 0.2, mouthOpen: 0.25, mouthWide: 0, smile: -0.35, teeth: 0, jaw: 0.25, sneer: 0 },
  wonder: { browIn: -0.1, browUp: 0.7, lid: 0.95, squint: 0, mouthOpen: 0.3, mouthWide: -0.1, smile: 0.15, teeth: 0, jaw: 0.2, sneer: 0 },
  anger: { browIn: 1, browUp: -0.4, lid: 0.8, squint: 0.4, mouthOpen: 0.2, mouthWide: 0.5, smile: -0.5, teeth: 1, jaw: 0.05, sneer: 0.7 },
  smile: { browIn: -0.1, browUp: 0.2, lid: 0.7, squint: 0.45, mouthOpen: 0.08, mouthWide: 0.4, smile: 0.8, teeth: 0.5, jaw: 0, sneer: 0 },
  sad: { browIn: 0.6, browUp: 0.6, lid: 0.55, squint: 0.1, mouthOpen: 0, mouthWide: -0.05, smile: -0.6, teeth: 0, jaw: 0, sneer: 0 },
  smug: { browIn: 0.1, browUp: 0.25, lid: 0.55, squint: 0.25, mouthOpen: 0, mouthWide: 0.25, smile: 0.45, teeth: 0, jaw: 0, sneer: 0.6 },
  stern: { browIn: 0.6, browUp: -0.3, lid: 0.6, squint: 0.3, mouthOpen: 0, mouthWide: 0.05, smile: -0.45, teeth: 0, jaw: 0, sneer: 0 },
  sleep: { browIn: 0, browUp: -0.1, lid: 0, squint: 0, mouthOpen: 0.06, mouthWide: 0, smile: -0.1, teeth: 0, jaw: 0.08, sneer: 0 },
  scream: { browIn: 0.8, browUp: 0.6, lid: 0.6, squint: 0.6, mouthOpen: 1, mouthWide: 0.3, smile: -0.3, teeth: 1, jaw: 0.9, sneer: 0.3 },
};
function resolveExpr(e) { return typeof e === 'string' ? EXPR[e] || EXPR.neutral : { ...EXPR.neutral, ...e }; }
export function blendExpr(a, b, k) { const A = resolveExpr(a), B = resolveExpr(b); const o = {}; for (const key in EXPR.neutral) o[key] = lerp(A[key] ?? 0, B[key] ?? 0, k); return o; }

// ── lighting presets ─────────────────────────────────────────────────────────
// angle: SCREEN direction the key light comes FROM (rad; -π/2 = from above, π = from the left)
export const LIGHT = {
  studio: { angle: -2.3, key: '#fff4e2', keyAmt: 0.0, shadow: 0.55, rim: '#ffffff', rimAmt: 0.35, rimAngle: -0.6, ambient: '#3a4a5a', ambientAmt: 0.08 },
  stormNight: { angle: -1.9, key: '#bcd3e6', keyAmt: 0.05, shadow: 0.72, rim: '#ffcf87', rimAmt: 0.75, rimAngle: 0.3, ambient: '#0f2a3a', ambientAmt: 0.35 },
  porthole: { angle: 0.2, key: '#ffcf87', keyAmt: 0.15, shadow: 0.6, rim: '#7fb6d6', rimAmt: 0.6, rimAngle: Math.PI - 0.3, ambient: '#0f2a3a', ambientAmt: 0.3 },
  tropicSun: { angle: -1.35, key: '#fff1c8', keyAmt: 0.22, shadow: 0.55, rim: '#ffffff', rimAmt: 0.55, rimAngle: -1.8, ambient: '#2c6f8f', ambientAmt: 0.12 },
  underwater: { angle: -1.6, key: '#a6f3ff', keyAmt: 0.1, shadow: 0.6, rim: '#5cf2c4', rimAmt: 0.6, rimAngle: -1.6, ambient: '#0d4e63', ambientAmt: 0.35 },
  biolum: { angle: 1.57, key: '#5cf2c4', keyAmt: 0.25, shadow: 0.8, rim: '#5cf2c4', rimAmt: 0.95, rimAngle: 1.57, ambient: '#021018', ambientAmt: 0.6 },
  office: { angle: -2.6, key: '#ffe7c2', keyAmt: 0.08, shadow: 0.5, rim: '#d9e6ee', rimAmt: 0.3, rimAngle: -0.4, ambient: '#4a4a3c', ambientAmt: 0.1 },
  dawn: { angle: -0.4, key: '#ffb37a', keyAmt: 0.2, shadow: 0.55, rim: '#ffd9a8', rimAmt: 0.7, rimAngle: -0.3, ambient: '#3b3a5a', ambientAmt: 0.15 },
  memory: { angle: -2.2, key: '#ffe2b0', keyAmt: 0.12, shadow: 0.45, rim: '#fff3dc', rimAmt: 0.4, rimAngle: -0.6, ambient: '#6b5137', ambientAmt: 0.12 },
};

// ── colour helpers ───────────────────────────────────────────────────────────
const C = (c) => (typeof c === 'string' ? hex(c) : c);
function mixc(a, b, k) { a = C(a); b = C(b); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
function lit(base, L) { // apply ambient tint & key colour to a base colour → [lit, shadow, line]
  const b = C(base);
  const amb = mixc(b, L.ambient, L.ambientAmt);
  const keyed = mixc(amb, mixc(amb, L.key, 0.5), L.keyAmt);
  const sh = mixc(mixc(b, [b[0] * 0.38, b[1] * 0.36, b[2] * 0.48], 1), L.ambient, L.ambientAmt * 0.9);
  const line = mixc(b, [8, 14, 22], 0.78);
  return { lit: keyed, shadow: sh, line };
}
const css = (c, a = 1) => rgba(c, a);

// ── skeleton ─────────────────────────────────────────────────────────────────
function solve(ch, p) {
  const B = ch.body; const S = {};
  const root = eul(p.yaw, p.pitch, p.roll);
  const spineR = mm(root, eul(p.spineYaw, p.spinePitch, p.spineRoll));
  const pelvis = v3(0, 0, 0);
  S.pelvis = pelvis; S.Rroot = root; S.Rspine = spineR;
  S.chest = add(pelvis, mv(spineR, [0, -B.torso, 0]));
  S.waist = add(pelvis, mv(mm(root, eul(p.spineYaw * 0.5, p.spinePitch * 0.5, p.spineRoll * 0.5)), [0, -B.torso * 0.45, 0]));
  const neckR = mm(spineR, Rx(p.neckPitch)); S.Rneck = neckR;
  S.neckTop = add(S.chest, mv(neckR, [0, -B.neck, 0]));
  const headR = mm(neckR, eul(p.headYaw, p.headPitch, p.headRoll)); S.Rhead = headR;
  S.head = add(S.neckTop, mv(headR, [0, -B.headUp, B.headFwd]));
  for (const side of ['l', 'r']) {
    const sx = side === 'l' ? 1 : -1;
    const sh = add(S.chest, mv(spineR, [sx * B.shoulderW, B.shoulderDrop - p.breathe * 4, 0]));
    const up = mm(spineR, mm(Rz(sx * p[side + 'ShoulderRoll']), mm(Rx(-p[side + 'ShoulderPitch']), Ry(sx * p[side + 'ShoulderYaw']))));
    const elbow = add(sh, mv(up, [0, B.upperArm, 0]));
    const lo = mm(up, Rx(-p[side + 'Elbow']));
    const wrist = add(elbow, mv(lo, [0, B.foreArm, 0]));
    const hr = mm(lo, Rx(-p[side + 'Wrist']));
    S[side + 'Shoulder'] = sh; S[side + 'Elbow'] = elbow; S[side + 'Wrist'] = wrist; S[side + 'Rhand'] = hr; S[side + 'Rlo'] = lo; S[side + 'Rup'] = up;
    const hip = add(pelvis, mv(root, [sx * B.hipW, B.hipDrop, 0]));
    const th = mm(root, mm(Rz(sx * p[side + 'HipRoll']), Rx(-p[side + 'HipPitch'])));
    const knee = add(hip, mv(th, [0, B.thigh, 0]));
    const sh2 = mm(th, Rx(p[side + 'Knee']));
    const ankle = add(knee, mv(sh2, [0, B.shin, 0]));
    const fr = mm(sh2, Rx(-p[side + 'Ankle']));
    const toe = add(ankle, mv(fr, [0, B.footDown, B.foot]));
    S[side + 'Hip'] = hip; S[side + 'Knee'] = knee; S[side + 'Ankle'] = ankle; S[side + 'Toe'] = toe; S[side + 'Rfoot'] = fr; S[side + 'Rshin'] = sh2; S[side + 'Rthigh'] = th;
  }
  return S;
}

// ── projection ───────────────────────────────────────────────────────────────
function projector(o) {
  const s = o.scale ?? 1, f = o.persp ?? 2600, ox = o.x ?? 960, oy = o.y ?? 540;
  return (P) => { const k = f / (f - P[2] * s); return { x: ox + P[0] * s * k, y: oy + P[1] * s * k, z: P[2], k: s * k }; };
}

// ── limb painter ─────────────────────────────────────────────────────────────
/** tapered organic limb between two screen points with muscle bulge (not a capsule!) */
function limbPath(a, b, wa, wb, bulge = 0.15, bulgeAt = 0.35, side = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 0.001, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const pts = [];
  const N = 8;
  for (let i = 0; i <= N; i++) { const t = i / N; const w = lerp(wa, wb, t) * 0.5 * (1 + bulge * Math.sin(Math.PI * clamp01((t - bulgeAt + 0.35) / 0.7)) * (side > 0 ? 1.15 : 0.85)); pts.push([a.x + dx * t + nx * w, a.y + dy * t + ny * w]); }
  // rounded end b
  for (let i = 1; i < 6; i++) { const ang = Math.atan2(ny, nx) - (i / 6) * Math.PI; pts.push([b.x + Math.cos(ang) * wb * 0.5, b.y + Math.sin(ang) * wb * 0.5]); }
  for (let i = N; i >= 0; i--) { const t = i / N; const w = lerp(wa, wb, t) * 0.5 * (1 + bulge * 0.6 * Math.sin(Math.PI * clamp01((t - bulgeAt + 0.25) / 0.7)) * (side > 0 ? 0.85 : 1.15)); pts.push([a.x + dx * t - nx * w, a.y + dy * t - ny * w]); }
  for (let i = 1; i < 6; i++) { const ang = Math.atan2(-ny, -nx) - (i / 6) * Math.PI; pts.push([a.x + Math.cos(ang) * wa * 0.5, a.y + Math.sin(ang) * wa * 0.5]); }
  return { path: smoothPath(pts, true, 0.5), nx, ny, L };
}
/** cylinder shading of a filled path: core shadow across width + rim */
function shadeCyl(ctx, path, a, b, w, cols, L, o = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln;
  const lx = Math.cos(L.angle), ly = Math.sin(L.angle); const d = nx * lx + ny * ly; const s = d >= 0 ? 1 : -1;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const hw = w * 0.55;
  ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(path); ctx.clip(path);
  // core shadow (cel step + soft falloff) on the side away from light
  const g = ctx.createLinearGradient(mx + nx * hw * s, my + ny * hw * s, mx - nx * hw * s, my - ny * hw * s);
  const shA = L.shadow * (o.form ?? 1); const edge = 0.52 - Math.abs(d) * 0.12;
  g.addColorStop(0, css(cols.shadow, 0)); g.addColorStop(Math.max(0, edge - 0.04), css(cols.shadow, 0)); g.addColorStop(Math.min(1, edge + 0.04), css(cols.shadow, shA * 0.8)); g.addColorStop(1, css(cols.shadow, shA));
  ctx.fillStyle = g; ctx.fillRect(Math.min(a.x, b.x) - w * 2, Math.min(a.y, b.y) - w * 2, Math.abs(dx) + w * 4, Math.abs(dy) + w * 4);
  // reflected light sliver near shadow edge
  // rim light
  if (L.rimAmt > 0) {
    const rx = Math.cos(L.rimAngle), ry = Math.sin(L.rimAngle); const rd = nx * rx + ny * ry; const rs = rd >= 0 ? 1 : -1;
    const k = Math.abs(rd) * 0.7 + 0.3;
    ctx.globalCompositeOperation = 'screen';
    const rg = ctx.createLinearGradient(mx + nx * hw * rs, my + ny * hw * rs, mx, my);
    rg.addColorStop(0, css(L.rim, L.rimAmt * k)); rg.addColorStop(0.28, css(L.rim, L.rimAmt * k * 0.15)); rg.addColorStop(0.45, css(L.rim, 0));
    ctx.fillStyle = rg; ctx.fillRect(Math.min(a.x, b.x) - w * 2, Math.min(a.y, b.y) - w * 2, Math.abs(dx) + w * 4, Math.abs(dy) + w * 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
function ink(ctx, path, cols, lw, alpha = 1) { if (lw <= 0) return; ctx.save(); ctx.strokeStyle = css(cols.line, alpha); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); ctx.restore(); }

/**
 * One continuous organic tube through several joints (shoulder→elbow→wrist or
 * hip→knee→ankle): no seams at the joints. widths: full width per joint.
 * bulges: per segment [front, back] muscle bulge factors.
 */
function tubeOutline(pts, widths, bulges = []) {
  const n = pts.length; const segN = [];
  for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, l = Math.hypot(dx, dy) || 0.001; segN.push([-dy / l, dx / l, dx / l, dy / l, l]); }
  const L = [], R = [];
  for (let i = 0; i < n - 1; i++) {
    const [nx, ny] = segN[i]; const [bf, bb] = bulges[i] || [0.12, 0.12];
    const S = 7;
    for (let k = (i === 0 ? 0 : 1); k <= S; k++) {
      const t = k / S; let mx = nx, my = ny;
      // blend normal toward neighbour segment near joints (smooth elbows)
      if (t > 0.75 && i < n - 2) { const b = (t - 0.75) / 0.25 * 0.5; mx = lerp(nx, segN[i + 1][0], b); my = lerp(ny, segN[i + 1][1], b); }
      if (t < 0.25 && i > 0) { const b = (0.25 - t) / 0.25 * 0.5; mx = lerp(nx, segN[i - 1][0], b); my = lerp(ny, segN[i - 1][1], b); }
      const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const w = lerp(widths[i], widths[i + 1], t) * 0.5; const sw = Math.sin(Math.PI * Math.min(1, t * 1.15));
      const x = lerp(pts[i].x, pts[i + 1].x, t), y = lerp(pts[i].y, pts[i + 1].y, t);
      L.push([x + mx * w * (1 + bf * sw), y + my * w * (1 + bf * sw)]); R.push([x - mx * w * (1 + bb * sw), y - my * w * (1 + bb * sw)]);
    }
  }
  const out = [...L];
  const e = pts[n - 1], we = widths[n - 1] * 0.5, [enx, eny] = segN[n - 2]; const ea = Math.atan2(eny, enx);
  for (let k = 1; k < 6; k++) { const a = ea - (k / 6) * Math.PI; out.push([e.x + Math.cos(a) * we, e.y + Math.sin(a) * we]); }
  for (let i = R.length - 1; i >= 0; i--) out.push(R[i]);
  const s0 = pts[0], ws = widths[0] * 0.5, [snx, sny] = segN[0]; const sa = Math.atan2(-sny, -snx);
  for (let k = 1; k < 6; k++) { const a = sa - (k / 6) * Math.PI; out.push([s0.x + Math.cos(a) * ws, s0.y + Math.sin(a) * ws]); }
  return { path: smoothPath(out, true, 0.5), segN };
}
function shadeTube(ctx, path, pts, widths, segN, cols, L, o = {}) {
  ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(path); ctx.clip(path);
  const lx = Math.cos(L.angle), ly = Math.sin(L.angle), rx = Math.cos(L.rimAngle), ry = Math.sin(L.rimAngle);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const [nx, ny, ux, uy] = segN[i]; const w = Math.max(widths[i], widths[i + 1]) * 0.62;
    ctx.save();
    // region between joint bisectors
    const big = 4000; const reg = new Path2D();
    const bis = (j) => { if (j <= 0 || j >= pts.length - 1) { const s = segN[Math.min(j, pts.length - 2)]; return [s[0], s[1]]; } const s1 = segN[j - 1], s2 = segN[j]; const bx = s1[0] + s2[0], by = s1[1] + s2[1]; const l = Math.hypot(bx, by) || 1; return [bx / l, by / l]; };
    const b0 = bis(i), b1 = bis(i + 1); const ext0 = i === 0 ? -big * 0.05 : 0, ext1 = i === pts.length - 2 ? big * 0.05 : 0;
    reg.moveTo(a.x + b0[0] * big - ux * ext0 * -1, a.y + b0[1] * big); reg.lineTo(b.x + b1[0] * big + ux * ext1, b.y + b1[1] * big + uy * ext1);
    reg.lineTo(b.x - b1[0] * big + ux * ext1, b.y - b1[1] * big + uy * ext1); reg.lineTo(a.x - b0[0] * big + ux * ext0, a.y - b0[1] * big + uy * ext0); reg.closePath();
    ctx.clip(reg);
    const d = nx * lx + ny * ly; const s = d >= 0 ? 1 : -1; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const g = ctx.createLinearGradient(mx + nx * w * s, my + ny * w * s, mx - nx * w * s, my - ny * w * s);
    const shA = L.shadow * (o.form ?? 1); const edge = 0.5 - Math.abs(d) * 0.1;
    g.addColorStop(0, css(cols.shadow, 0)); g.addColorStop(Math.max(0, edge - 0.05), css(cols.shadow, 0)); g.addColorStop(Math.min(1, edge + 0.05), css(cols.shadow, shA * 0.82)); g.addColorStop(1, css(cols.shadow, shA));
    ctx.fillStyle = g; ctx.fillRect(Math.min(a.x, b.x) - w * 3, Math.min(a.y, b.y) - w * 3, Math.abs(b.x - a.x) + w * 6, Math.abs(b.y - a.y) + w * 6);
    if (L.rimAmt > 0) { const rd = nx * rx + ny * ry; const rs = rd >= 0 ? 1 : -1; const k = Math.abs(rd) * 0.7 + 0.3;
      ctx.globalCompositeOperation = 'screen'; const rg = ctx.createLinearGradient(mx + nx * w * rs, my + ny * w * rs, mx, my);
      rg.addColorStop(0, css(L.rim, L.rimAmt * k)); rg.addColorStop(0.22, css(L.rim, L.rimAmt * k * 0.18)); rg.addColorStop(0.4, css(L.rim, 0));
      ctx.fillStyle = rg; ctx.fillRect(Math.min(a.x, b.x) - w * 3, Math.min(a.y, b.y) - w * 3, Math.abs(b.x - a.x) + w * 6, Math.abs(b.y - a.y) + w * 6); }
    ctx.restore();
  }
  ctx.restore();
}
/** horizontal ring stripes around a limb/torso axis (telnyashka). rings given in 3D */
function stripesOnLimb(ctx, clip, A3, B3, radius, proj, R, n, color, width, phase = 0) {
  ctx.save(); ctx.clip(clip); ctx.strokeStyle = color; ctx.lineCap = 'butt';
  const axis = sub(B3, A3); const L = len3(axis); const u = norm(axis);
  let t1 = cross(u, [0, 0, 1]); if (len3(t1) < 0.1) t1 = cross(u, [1, 0, 0]); t1 = norm(t1); const t2 = cross(u, t1);
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5 + phase) / n; if (f < 0 || f > 1) continue;
    const c = add(A3, mul(axis, f)); ctx.beginPath(); let started = false;
    for (let k = 0; k <= 24; k++) {
      const ang = (k / 24) * TAU; const pt = add(c, add(mul(t1, Math.cos(ang) * radius), mul(t2, Math.sin(ang) * radius)));
      const nz = (mul(t1, Math.cos(ang))[2] + mul(t2, Math.sin(ang))[2]);
      const q = proj(pt);
      if (nz > -0.05) { if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y); } else started = false;
    }
    ctx.lineWidth = width * proj(c).k; ctx.stroke();
  }
  ctx.restore(); void L; void R;
}

// ── hands ────────────────────────────────────────────────────────────────────
const HAND = { // per finger curl (index, middle, ring, pinky), thumb curl, spread
  open: { c: [0.1, 0.1, 0.12, 0.15], th: 0.1, sp: 0.25 }, relaxed: { c: [0.35, 0.45, 0.55, 0.6], th: 0.3, sp: 0.08 },
  fist: { c: [1, 1, 1, 1], th: 0.9, sp: 0 }, grip: { c: [0.75, 0.8, 0.82, 0.85], th: 0.6, sp: 0.02 },
  point: { c: [0, 1, 1, 1], th: 0.7, sp: 0.05 }, claw: { c: [0.55, 0.6, 0.6, 0.65], th: 0.45, sp: 0.3 }, spread: { c: [0, 0, 0, 0], th: 0, sp: 0.5 },
};
function drawHand(ctx, side, S, proj, ch, poseName, L, sc, outfit) {
  const H = HAND[poseName] || HAND.relaxed; const sx = side === 'l' ? 1 : -1;
  const R = S[side + 'Rhand']; const w3 = S[side + 'Wrist']; const hl = ch.body.hand;
  const cols = lit(ch.skin, L);
  const P = (x, y, z) => proj(add(w3, mv(R, [x * sx, y, z])));
  const palm = [P(-hl * 0.22, 0, 0), P(hl * 0.25, 0, 0), P(hl * 0.3, hl * 0.48, 0), P(-hl * 0.26, hl * 0.5, 0)];
  // fingers
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const x0 = lerp(hl * 0.24, -hl * 0.2, i / 3) + (i - 1.5) * H.sp * 6; const len = hl * [0.46, 0.5, 0.47, 0.37][i];
    const curl = H.c[i]; let pt = [x0, hl * 0.48, 0]; let ang = (i - 1.5) * H.sp * 0.25; const pts = [P(...pt)];
    for (let j = 0; j < 3; j++) { const a = curl * [1.0, 1.35, 1.1][j]; const segL = len * [0.42, 0.33, 0.25][j];
      const dir = [Math.sin(ang) * Math.cos(a * (j + 1) * 0.5), Math.cos(ang) * Math.cos((curl * 1.2) * (j + 1) * 0.6), -Math.sin((curl * 1.2) * (j + 1) * 0.6)];
      pt = [pt[0] + dir[0] * segL, pt[1] + dir[1] * segL, pt[2] + dir[2] * segL * 1.2]; pts.push(P(...pt)); void a; }
    fingers.push({ pts, w: hl * [0.15, 0.16, 0.15, 0.13][i] * sc });
  }
  const thumbPts = [P(hl * 0.22, hl * 0.08, 0)]; { let pt = [hl * 0.22, hl * 0.08, 0]; for (let j = 0; j < 2; j++) { const a = H.th * (j + 1) * 0.8; pt = [pt[0] + Math.cos(0.9 + a) * hl * 0.26, pt[1] + Math.sin(0.9 + a) * hl * 0.2, pt[2] + hl * 0.12 * (1 + H.th)]; thumbPts.push(P(...pt)); } }
  const lw = ch.lineW * sc;
  // draw: back fingers first depending on facing
  const drawFinger = (f) => { for (let j = 0; j < f.pts.length - 1; j++) { const a = f.pts[j], b = f.pts[j + 1]; const wv = f.w * (1 - j * 0.12); const lp = limbPath(a, b, wv, wv * 0.92, 0.05, 0.4); shadeCyl(ctx, lp.path, a, b, wv, cols, L, { form: 0.7 }); ink(ctx, lp.path, cols, lw * 0.7, 0.9); } };
  const palmPath = smoothPath(palm.map((p) => [p.x, p.y]), true, 0.6);
  const thumbF = { pts: thumbPts, w: hl * 0.19 * sc };
  const fist = H.c[1] > 0.7;
  if (!fist) fingers.forEach(drawFinger);
  ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(palmPath); shadeCyl(ctx, palmPath, palm[0], palm[3], hl * 0.5 * sc, cols, L, { form: 0.8 }); ink(ctx, palmPath, cols, lw * 0.8); ctx.restore();
  if (fist) fingers.forEach(drawFinger);
  drawFinger(thumbF);
  void outfit;
}

// ── head ─────────────────────────────────────────────────────────────────────
function headGeo(ch) { return ch.head; }
/** head-local point on the face surface at (x, y) → 3D with forward z (front surface of rings) */
function faceZ(H, x, y) {
  const R = H.rings; let i = 0; while (i < R.length - 2 && R[i + 1][0] < y) i++;
  const a = R[i], b = R[i + 1]; const t = clamp01((y - a[0]) / (b[0] - a[0] || 1));
  const w = lerp(a[1], b[1], t), d = lerp(a[2], b[2], t), z0 = lerp(a[3], b[3], t);
  const u = clamp01(Math.abs(x) / Math.max(1, w)); return z0 + d * Math.sqrt(Math.max(0, 1 - u * u));
}
function drawHead(ctx, ch, S, p, proj, L, sc, o) {
  const H = headGeo(ch); const R = S.Rhead; const c0 = S.head; const e = resolveExpr(p.expr);
  const P3 = (x, y, z) => add(c0, mv(R, [x, y, z]));
  const P = (x, y, z) => proj(P3(x, y, z));
  const N = (x, y, z) => mv(R, norm([x, y, z]))[2]; // facing toward camera
  const skin = lit(ch.skin, L); const hairC = lit(o.wetHair ? shade(ch.hair, 0.85) : ch.hair, L);
  const lw = ch.lineW * sc;
  const facing = mv(R, [0, 0, 1])[2]; // >0 face visible
  const side = mv(R, [1, 0, 0])[2];   // >0 char-left side toward camera
  // silhouette from rings
  const pts = [];
  for (const [y, w, d, z] of H.rings) for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU; pts.push(P(Math.cos(a) * w, y, z + Math.sin(a) * d)); }
  const hull = convexHull(pts.map((q) => [q.x, q.y]));
  const headPath = smoothPath(hull, true, 0.45);
  const bb = bbox(hull);
  // ── back hair (clumps facing away) ──
  const clumps = (H.hairClumps || []).map((cl) => { const n = N(cl.at[0], cl.at[1], cl.at[2]); return { ...cl, n }; });
  const drawClump = (cl) => drawHairClump(ctx, cl, P, R, hairC, lw, L, p, o, sc, S);
  clumps.filter((c) => c.n < -0.15 || c.back).forEach(drawClump);
  // ── ears (behind face edge) ──
  for (const sx of [1, -1]) { const n = mv(R, [sx, 0, 0])[2]; if (n > 0.02) drawEar(ctx, H, P, R, sx, skin, lw, n, L); }
  // ── skull / face fill ──
  ctx.save(); ctx.fillStyle = css(skin.lit); ctx.fill(headPath); ctx.clip(headPath);
  // form shadow on the face: gradient across the head opposite the light, plus side-plane from yaw
  const lx = Math.cos(L.angle), ly = Math.sin(L.angle); const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2; const rr = (bb[2] - bb[0]) * 0.6;
  const g = ctx.createLinearGradient(cx + lx * rr, cy + ly * rr, cx - lx * rr, cy - ly * rr);
  g.addColorStop(0, css(skin.shadow, 0)); g.addColorStop(0.5, css(skin.shadow, 0.05)); g.addColorStop(0.56, css(skin.shadow, L.shadow * 0.75)); g.addColorStop(1, css(skin.shadow, L.shadow));
  ctx.fillStyle = g; ctx.fillRect(bb[0] - 20, bb[1] - 20, bb[2] - bb[0] + 40, bb[3] - bb[1] + 40);
  // cheek hollows / cheekbone plane (character)
  for (const sx of [1, -1]) { const q = P(sx * (H.cheekX || 30), H.cheekY || 22, faceZ(H, sx * (H.cheekX || 30), H.cheekY || 22) - 4); const n = mv(R, [sx * 0.7, 0.1, 0.7])[2];
    if (n > 0) { const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 22 * sc); gg.addColorStop(0, css(skin.shadow, 0.22 * (ch.gaunt ?? 0.5))); gg.addColorStop(1, css(skin.shadow, 0)); ctx.fillStyle = gg; ctx.fillRect(q.x - 30 * sc, q.y - 30 * sc, 60 * sc, 60 * sc); } }
  // structure: temple shadow, jawline shadow, chin + cheekbone highlights, under-jaw occlusion
  {
    const jl = []; for (let k = 0; k <= 16; k++) { const a = -Math.PI * 0.95 + (k / 16) * Math.PI * 0.9; const y = 40 + Math.sin(-a) * 0; void y; }
    for (const sx of [1, -1]) {
      const n = mv(R, [sx, 0, 0.35])[2];
      const tq = P(sx * 44, -22, faceZ(H, sx * 44, -22) - 2); const tg = ctx.createRadialGradient(tq.x, tq.y, 0, tq.x, tq.y, 26 * sc); tg.addColorStop(0, css(skin.shadow, 0.25)); tg.addColorStop(1, css(skin.shadow, 0)); ctx.fillStyle = tg; ctx.fillRect(tq.x - 30 * sc, tq.y - 30 * sc, 60 * sc, 60 * sc);
      const jq = P(sx * 30, 58, faceZ(H, sx * 30, 58) - 6); const jg = ctx.createRadialGradient(jq.x, jq.y, 0, jq.x, jq.y, 30 * sc); jg.addColorStop(0, css(skin.shadow, 0.32)); jg.addColorStop(1, css(skin.shadow, 0)); ctx.fillStyle = jg; ctx.fillRect(jq.x - 34 * sc, jq.y - 34 * sc, 68 * sc, 68 * sc);
      if (n > -0.2) { const cq = P(sx * 34, 10, faceZ(H, sx * 34, 10)); const cg = ctx.createRadialGradient(cq.x, cq.y, 0, cq.x, cq.y, 16 * sc); cg.addColorStop(0, `rgba(255,240,220,${0.18 * clamp01(n + 0.5)})`); cg.addColorStop(1, 'rgba(255,240,220,0)'); ctx.fillStyle = cg; ctx.fillRect(cq.x - 20 * sc, cq.y - 20 * sc, 40 * sc, 40 * sc); }
    }
    const ch2 = P(0, 66, faceZ(H, 0, 66)); const chg = ctx.createRadialGradient(ch2.x, ch2.y - 4 * sc, 0, ch2.x, ch2.y, 14 * sc); chg.addColorStop(0, 'rgba(255,240,225,0.2)'); chg.addColorStop(1, 'rgba(255,240,225,0)'); ctx.fillStyle = chg; ctx.fillRect(ch2.x - 16 * sc, ch2.y - 16 * sc, 32 * sc, 32 * sc);
    const fh = P(0, -30, faceZ(H, 0, -30)); const fg = ctx.createRadialGradient(fh.x, fh.y, 0, fh.x, fh.y, 34 * sc); fg.addColorStop(0, 'rgba(255,240,225,0.14)'); fg.addColorStop(1, 'rgba(255,240,225,0)'); ctx.fillStyle = fg; ctx.fillRect(fh.x - 36 * sc, fh.y - 36 * sc, 72 * sc, 72 * sc);
  }
  // sunburn / blush
  if (o.burn || ch.blush) { const k = o.burn || ch.blush; for (const sx of [1, -1, 0]) { const q = sx === 0 ? P(0, 16, faceZ(H, 0, 16) + 18) : P(sx * 26, 14, faceZ(H, sx * 26, 14)); const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 26 * sc); gg.addColorStop(0, `rgba(226,74,52,${0.45 * k})`); gg.addColorStop(1, 'rgba(226,74,52,0)'); ctx.fillStyle = gg; ctx.fillRect(q.x - 30 * sc, q.y - 30 * sc, 60 * sc, 60 * sc); } }
  // stubble
  if (ch.stubble || o.stubble) { const k = o.stubble ?? ch.stubble; drawStubble(ctx, H, P, R, k, sc); }
  // rim light on head
  if (L.rimAmt > 0) { const rx = Math.cos(L.rimAngle), ry = Math.sin(L.rimAngle); ctx.translate(rx * 5 * sc, ry * 5 * sc); ctx.globalCompositeOperation = 'destination-over'; ctx.restore(); ctx.save();
    ctx.save(); ctx.clip(headPath); ctx.translate(-rx * 4.5 * sc, -ry * 4.5 * sc); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = css(L.rim, L.rimAmt * 0.9); ctx.lineWidth = 9 * sc; ctx.filter = `blur(${2 * sc}px)`; ctx.stroke(headPath); ctx.restore(); }
  ctx.restore();
  // ── features (only when face visible) ──
  if (facing > -0.1) {
    ctx.save(); ctx.clip(headPath);
    drawBrowsEyes(ctx, ch, H, P, R, p, e, skin, lw, sc, L, o);
    drawMouth(ctx, ch, H, P, R, e, skin, lw, sc, L, o);
    if (ch.mustache) drawMustache(ctx, ch, H, P, R, hairC, lw, sc);
    ctx.restore();
    drawNose(ctx, ch, H, P, R, skin, lw, sc, L, facing, side);
  }
  ink(ctx, headPath, skin, lw);
  drawHairMass(ctx, H, P, R, hairC, sc, L, o, p, lw);
  // front hair clumps over silhouette
  clumps.filter((c) => !(c.n < -0.15 || c.back)).sort((a, b) => a.n - b.n).forEach(drawClump);
  // accessories
  if (o.mask) drawMask(ctx, ch, H, P, R, sc, lw, L, o.mask === 'up', p);
  if (o.snorkel) drawSnorkel(ctx, ch, H, P, R, sc, lw, L);
  if (ch.glasses) drawGlasses(ctx, ch, H, P, R, sc, lw, L);
  if (o.hat || ch.hat) drawHat(ctx, o.hat || ch.hat, H, P, R, sc, lw, L, ch);
  return { headPath, bbox: bb, facing };
}
function bbox(pts) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
export function convexHull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
/** affine frame of a face feature: centre + tangent vectors projected */
function frame(P, x, y, z, R) {
  const c = P(x, y, z); const ex = P(x + 1, y, z), ey = P(x, y + 1, z);
  return { c, ax: ex.x - c.x, ay: ex.y - c.y, bx: ey.x - c.x, by: ey.y - c.y, nz: mv(R, norm([x * 0.02, y * 0.01, 1]))[2] };
}
function withFrame(ctx, F, fn) { ctx.save(); ctx.transform(F.ax, F.ay, F.bx, F.by, F.c.x, F.c.y); fn(ctx); ctx.restore(); }

function drawBrowsEyes(ctx, ch, H, P, R, p, e, skin, lw, sc, L, o) {
  const E = H.eyes; const blink = clamp01(Math.max(p.blink, 1 - e.lid));
  for (const sx of [1, -1]) {
    const x = sx * E.x, y = E.y, z = faceZ(H, x, y) - E.inset; const n = mv(R, norm([sx * 0.5, 0, 1]))[2]; if (n < -0.05) continue;
    const F = frame(P, x, y, z, R);
    // socket shadow
    withFrame(ctx, F, (c) => { const g = c.createRadialGradient(0, -2, 0, 0, -2, E.w * 1.25); g.addColorStop(0, css(skin.shadow, 0.35 * (ch.deepEyes ?? 0.6))); g.addColorStop(1, css(skin.shadow, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(0, -2, E.w * 1.3, E.h * 1.6, 0, 0, TAU); c.fill(); });
    if (o.mask && o.mask !== 'up') { /* eyes behind mask glass still drawn */ }
    withFrame(ctx, F, (c) => {
      const w = E.w, h = E.h; const open = (1 - blink) * (0.75 + 0.25 * (e.lid > 0.9 ? 1 : e.lid)); const squ = e.squint;
      const top = -h * open * 1.05, bot = h * (0.55 - squ * 0.35) * Math.max(0.2, open);
      const tilt = sx * (E.tilt || 0);
      const eyePath = new Path2D(); eyePath.moveTo(-w, tilt); eyePath.bezierCurveTo(-w * 0.45, top * 1.2, w * 0.4, top * 1.25, w, -tilt * 0.5 - h * 0.15); eyePath.bezierCurveTo(w * 0.45, bot * 1.25, -w * 0.4, bot * 1.2, -w, tilt);
      if (open > 0.04) {
        c.fillStyle = '#efe9df'; c.fill(eyePath); c.save(); c.clip(eyePath);
        const gx = p.gazeX * w * 0.45, gy = p.gazeY * h * 0.5 - h * 0.05; const ir = E.iris;
        c.fillStyle = ch.irisColor || '#3b2a1e'; c.beginPath(); c.arc(gx, gy, ir, 0, TAU); c.fill();
        c.fillStyle = '#0a0806'; c.beginPath(); c.arc(gx, gy, ir * (o.pupil || 0.45), 0, TAU); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-w, top * 1.3, w * 2, h * 0.5); // lid shadow on eyeball
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(gx - ir * 0.35, gy - ir * 0.4, ir * 0.28, 0, TAU); c.fill();
        c.restore();
      }
      // upper lid line (thick lash line)
      c.strokeStyle = css(mixc(skin.line, [0, 0, 0], 0.5)); c.lineCap = 'round'; c.lineWidth = Math.max(1.5, lw * 1.25 / Math.max(0.4, Math.abs(F.ax)));
      c.beginPath(); c.moveTo(-w * 1.05, tilt + 1); c.bezierCurveTo(-w * 0.45, top * 1.2, w * 0.4, top * 1.25, w * 1.05, -tilt * 0.5 - h * 0.15); c.stroke();
      // crease above lid
      c.lineWidth *= 0.45; c.strokeStyle = css(skin.line, 0.5); c.beginPath(); c.moveTo(-w * 0.8, top - h * 0.55); c.quadraticCurveTo(0, top - h * 1.15, w * 0.9, top - h * 0.5); c.stroke();
      // lower lid hint / bags (exhaustion)
      c.strokeStyle = css(skin.line, 0.35 + (ch.bags || 0) * 0.3); c.beginPath(); c.moveTo(-w * 0.7, bot + h * 0.35); c.quadraticCurveTo(0, bot + h * 0.85, w * 0.75, bot + h * 0.3); c.stroke();
    });
    // brow
    const by = y - E.browH - e.browUp * 7 + (e.browIn * 3);
    const BF = frame(P, x, by, faceZ(H, x, by) + 2, R);
    withFrame(ctx, BF, (c) => {
      const bw = E.w * 1.35; const inner = -sx * bw * 0.95, outer = sx * bw;
      const innerY = e.browIn * 6 - 2 - e.browUp * 4 * (e.browIn > 0.3 ? 1.5 : 0.6), outerY = 3 - e.browIn * 3 + e.browUp * 1.5;
      const pts = [[inner, innerY + 2], [lerp(inner, outer, 0.35), innerY * 0.5 - 4], [lerp(inner, outer, 0.7), -5 + outerY * 0.6], [outer, outerY + 1]];
      c.fillStyle = css(ch.browColor ? hex(ch.browColor) : mixc(ch.hair, [0, 0, 0], 0.2));
      const th = E.browThick;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1] - th * 0.5);
      c.bezierCurveTo(pts[1][0], pts[1][1] - th, pts[2][0], pts[2][1] - th * 0.8, pts[3][0], pts[3][1]);
      c.bezierCurveTo(pts[2][0], pts[2][1] + th * 0.3, pts[1][0], pts[1][1] + th * 0.5, pts[0][0], pts[0][1] + th * 0.6); c.closePath(); c.fill();
    });
  }
}
function drawNose(ctx, ch, H, P, R, skin, lw, sc, L, facing, side) {
  const Nz = H.nose; const bz = faceZ(H, 0, Nz.top);
  const top = P(0, Nz.top, bz + 1), tip = P(0, Nz.tipY, faceZ(H, 0, Nz.tipY) + Nz.len), base = P(0, Nz.baseY, faceZ(H, 0, Nz.baseY) + 2);
  const wl = P(Nz.w, Nz.wingY, faceZ(H, Nz.w, Nz.wingY) + Nz.len * 0.35), wr = P(-Nz.w, Nz.wingY, faceZ(H, -Nz.w, Nz.wingY) + Nz.len * 0.35);
  const hump = P(0, lerp(Nz.top, Nz.tipY, 0.45), faceZ(H, 0, lerp(Nz.top, Nz.tipY, 0.45)) + Nz.len * (0.55 + (Nz.hump || 0)));
  const tipL = P(Nz.w * 0.45, Nz.tipY + 2, faceZ(H, 0, Nz.tipY) + Nz.len * 0.85), tipR = P(-Nz.w * 0.45, Nz.tipY + 2, faceZ(H, 0, Nz.tipY) + Nz.len * 0.85);
  const vis = Math.abs(side); // how much in profile
  // nose body: bridge → hump → tip → wings → base
  const sideSign = side >= 0 ? 1 : -1; // which wing is the far one
  const near = sideSign > 0 ? wl : wr, far = sideSign > 0 ? wr : wl, tipN = sideSign > 0 ? tipL : tipR, tipF = sideSign > 0 ? tipR : tipL;
  const path = new Path2D();
  path.moveTo(top.x, top.y); path.quadraticCurveTo(hump.x, hump.y, tipF.x, tipF.y); path.quadraticCurveTo(tip.x + (tip.x - base.x) * 0.15, tip.y + 4 * sc, tipN.x, tipN.y);
  path.quadraticCurveTo(near.x, near.y + 3 * sc, near.x, near.y); path.quadraticCurveTo(base.x, base.y, far.x, far.y);
  path.quadraticCurveTo(lerp(far.x, top.x, 0.5) - sideSign * 6 * sc * (1 - vis), lerp(far.y, top.y, 0.5), top.x, top.y); path.closePath();
  const cols = skin;
  ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(path);
  // shadow side of nose (opposite light) + under-tip shadow
  const lx = Math.cos(L.angle); ctx.clip(path);
  const g = ctx.createLinearGradient(tip.x + lx * 30 * sc, tip.y, tip.x - lx * 30 * sc, tip.y); g.addColorStop(0, css(cols.shadow, 0)); g.addColorStop(0.55, css(cols.shadow, L.shadow * 0.8)); g.addColorStop(1, css(cols.shadow, L.shadow));
  ctx.fillStyle = g; ctx.fillRect(Math.min(top.x, tip.x, wl.x, wr.x) - 40 * sc, top.y - 5, 120 * sc, base.y - top.y + 40 * sc);
  // bridge side plane (reads the nose in front view)
  ctx.strokeStyle = css(cols.shadow, 0.45 * (1 - vis * 0.6)); ctx.lineWidth = 5 * sc; ctx.beginPath(); const bs = -Math.sign(lx || 1) * 5 * sc; ctx.moveTo(top.x + bs, top.y + 6 * sc); ctx.quadraticCurveTo(hump.x + bs, hump.y, tipF.x + bs * 0.6, tipF.y - 4 * sc); ctx.stroke();
  // highlight on bridge
  ctx.strokeStyle = 'rgba(255,248,235,0.35)'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(lerp(top.x, hump.x, 0.3), lerp(top.y, hump.y, 0.4)); ctx.quadraticCurveTo(hump.x, hump.y, lerp(hump.x, tip.x, 0.7), lerp(hump.y, tip.y, 0.7)); ctx.stroke();
  ctx.fillStyle = 'rgba(255,245,230,0.35)'; ctx.beginPath(); ctx.ellipse(lerp(tip.x, tipN.x, 0.3), tip.y - 3 * sc, 4 * sc, 3 * sc, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // ink: only the outer contour on the visible side + nostrils
  ctx.save(); ctx.strokeStyle = css(cols.line); ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); if (vis > 0.25) { ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(hump.x, hump.y, tipF.x, tipF.y); }
  ctx.moveTo(tipF.x, tipF.y); ctx.quadraticCurveTo(tip.x, tip.y + 4 * sc, tipN.x, tipN.y); ctx.quadraticCurveTo(near.x, near.y + 3 * sc, near.x, near.y); ctx.stroke();
  // nostril
  ctx.fillStyle = css(mixc(cols.shadow, [20, 8, 8], 0.5)); ctx.beginPath(); const nn = lerp(near, base, 0.5); ctx.ellipse(lerp(near.x, base.x, 0.45), lerp(near.y, base.y, 0.5) + 1 * sc, 4 * sc, 2.4 * sc, 0, 0, TAU); ctx.fill();
  if (vis < 0.55) { ctx.beginPath(); ctx.ellipse(lerp(far.x, base.x, 0.45), lerp(far.y, base.y, 0.5) + 1 * sc, 3.4 * sc, 2 * sc, 0, 0, TAU); ctx.fill(); }
  ctx.restore(); void nn; void facing;
}
function drawMouth(ctx, ch, H, P, R, e, skin, lw, sc, L, o) {
  const M = H.mouth; const y = M.y + e.jaw * 6; const F = frame(P, 0, y, faceZ(H, 0, y) + 1, R);
  withFrame(ctx, F, (c) => {
    const w = M.w * (1 + e.mouthWide * 0.35 + e.smile * 0.12); const open = e.mouthOpen * M.h * 1.6 + e.jaw * 8;
    const sm = e.smile * 6; const sneer = e.sneer * 3;
    const lip = css(mixc(ch.lip || mixc(ch.skin, [150, 60, 60], 0.35), [0, 0, 0], 0.1));
    if (open > 1.5) {
      const mp = new Path2D(); mp.moveTo(-w, -sm); mp.bezierCurveTo(-w * 0.5, -open * 0.45 - sneer, w * 0.5, -open * 0.45 - sneer * 0.5, w, -sm);
      mp.bezierCurveTo(w * 0.6, open * 0.9, -w * 0.6, open * 0.9, -w, -sm); c.fillStyle = '#2a0f0f'; c.fill(mp);
      c.save(); c.clip(mp);
      if (e.teeth > 0.2) { c.fillStyle = '#e9e3d4'; c.fillRect(-w, -open * 0.5 - 2, w * 2, open * 0.32 * e.teeth + 3); if (e.teeth > 0.7 && open > 6) c.fillRect(-w, open * 0.62 - open * 0.2, w * 2, open * 0.4); }
      if (o.tongue) { c.fillStyle = '#b5504a'; c.beginPath(); c.ellipse(0, open * 0.55, w * (0.7 + o.tongue * 0.5), open * (0.3 + o.tongue * 0.5), 0, 0, TAU); c.fill(); }
      c.restore();
      c.strokeStyle = lip; c.lineWidth = 1.6; c.stroke(mp);
    } else {
      c.strokeStyle = css(mixc(skin.line, [60, 20, 20], 0.3)); c.lineWidth = Math.max(1.6, lw * 0.9); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-w, -sm + (e.smile < 0 ? -e.smile * 5 : 0)); c.bezierCurveTo(-w * 0.35, -sm * 0.2 + 1, w * 0.35, -sm * 0.2 + 1 - sneer, w, -sm + (e.smile < 0 ? -e.smile * 5 : 0)); c.stroke();
    }
    // lower lip volume + chin dimple shadow
    c.fillStyle = css(skin.shadow, 0.14); c.beginPath(); c.ellipse(0, open * 0.6 + 8, w * 0.5, 2.4, 0, 0, TAU); c.fill();
    c.fillStyle = css(skin.shadow, 0.18); c.beginPath(); c.ellipse(0, open * 0.6 + 20, w * 0.35, 4, 0, 0, TAU); c.fill();
    // nasolabial folds (age / strain)
    c.strokeStyle = css(skin.line, 0.3 + (ch.folds || 0.3) * 0.4 + Math.max(0, -e.smile) * 0.1); c.lineWidth = 1.4;
    for (const sx of [1, -1]) { c.beginPath(); c.moveTo(sx * w * 0.9, -M.h * 2.6); c.quadraticCurveTo(sx * w * 1.45, -M.h * 0.4, sx * w * 1.25, M.h * 0.9 + Math.max(0, e.smile) * 2); c.stroke(); }
  });
}
function drawMustache(ctx, ch, H, P, R, hairC, lw, sc) {
  const M = H.mouth; const y = M.y - 7; const F = frame(P, 0, y, faceZ(H, 0, y) + 4, R);
  withFrame(ctx, F, (c) => {
    const w = M.w * 1.35; const th = ch.mustache === 'thick' ? 9 : 6;
    const path = new Path2D(); path.moveTo(-w, 7); path.bezierCurveTo(-w * 0.9, -th * 0.4, -w * 0.4, -th, 0, -th * 0.55); path.bezierCurveTo(w * 0.4, -th, w * 0.9, -th * 0.4, w, 7);
    path.bezierCurveTo(w * 0.7, 3, w * 0.3, 2, 0, 3.5); path.bezierCurveTo(-w * 0.3, 2, -w * 0.7, 3, -w, 7); path.closePath();
    c.fillStyle = css(hairC.lit); c.fill(path); c.fillStyle = css(hairC.shadow, 0.6); c.save(); c.clip(path); c.fillRect(-w, 0, w * 2, 10); c.restore();
    c.strokeStyle = css(hairC.line, 0.9); c.lineWidth = 1.2; c.stroke(path);
    c.strokeStyle = css(hairC.shadow, 0.7); c.lineWidth = 0.9; for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * w / 7, -th * 0.4); c.lineTo(i * w / 6.2, 3); c.stroke(); }
  });
}
function drawEar(ctx, H, P, R, sx, skin, lw, n, L) {
  const E = H.ear; const F = { c: P(sx * E.x, E.y, E.z), ...(() => { const c = P(sx * E.x, E.y, E.z); const a = P(sx * E.x, E.y, E.z + 1); const b = P(sx * E.x, E.y + 1, E.z); return { ax: a.x - c.x, ay: a.y - c.y, bx: b.x - c.x, by: b.y - c.y }; })() };
  const k = clamp01(n + 0.35);
  ctx.save(); ctx.globalAlpha *= clamp01(k * 3);
  withFrame(ctx, F, (c) => {
    const path = new Path2D(); path.moveTo(4, -E.h * 0.5); path.bezierCurveTo(-E.w * 0.6, -E.h * 0.8, -E.w * 1.25, -E.h * 0.1, -E.w * 0.6, E.h * 0.35); path.bezierCurveTo(-E.w * 0.3, E.h * 0.62, 2, E.h * 0.62, 4, E.h * 0.3); path.closePath();
    c.fillStyle = css(skin.lit); c.fill(path); c.fillStyle = css(skin.shadow, 0.6); c.beginPath(); c.ellipse(-E.w * 0.45, -E.h * 0.05, E.w * 0.32, E.h * 0.3, 0, 0, TAU); c.fill(); c.strokeStyle = css(skin.line, 0.6); c.lineWidth = 1.2; c.beginPath(); c.arc(-E.w * 0.4, -E.h * 0.05, E.w * 0.42, -1.4, 1.6); c.stroke();
    c.strokeStyle = css(skin.line); c.lineWidth = 1.6; c.stroke(path);
  });
  ctx.restore(); void lw; void L;
}
function drawStubble(ctx, H, P, R, k, sc) {
  ctx.save(); ctx.fillStyle = `rgba(30,24,22,${0.28 * k})`;
  for (let i = 0; i < 260; i++) { const u = (Math.sin(i * 12.9898) * 43758.5453) % 1, v = (Math.sin(i * 78.233) * 12345.678) % 1; const x = (Math.abs(u) - 0.5) * 70, y = 30 + Math.abs(v) * 38;
    const n = mv(R, norm([x * 0.02, (y - 20) * 0.015, 1]))[2]; if (n < 0.05) continue; const q = P(x, y, faceZ(H, x, y)); ctx.fillRect(q.x, q.y, 1.4 * sc, 1.4 * sc); }
  ctx.restore();
}
function ringAt(H, y) {
  const R = H.rings; let i = 0; while (i < R.length - 2 && R[i + 1][0] < y) i++;
  const a = R[i], b = R[i + 1]; const t = clamp01((y - a[0]) / ((b[0] - a[0]) || 1));
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}
function drawHairCap(ctx, H, P, R, hairC, sc) {
  const hl = H.hairline; if (!hl) return;
  // hairline loop around the skull: front (forehead) → sides (temples) → back (nape)
  const pts = [], vis = [];
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * TAU; const c = Math.cos(a);
    const y = c >= 0 ? lerp(hl.side, hl.front, c) : lerp(hl.side, hl.back, -c);
    const [w, d, z0] = ringAt(H, y);
    const n = mv(R, norm([Math.sin(a), 0, c]))[2];
    pts.push(P(Math.sin(a) * w * 1.01, y, z0 + c * d * 1.01)); vis.push(n > -0.02);
  }
  let best = [], cur = [];
  for (let i = 0; i < pts.length * 2; i++) { const j = i % pts.length; if (vis[j]) { cur.push(pts[j]); if (cur.length > best.length) best = cur.slice(); if (cur.length >= pts.length) break; } else cur = []; }
  if (best.length < 2) return;
  ctx.save();
  const up = mv(R, [0, -1, 0]); const ux = up[0] * 3000, uy = up[1] * 3000;
  const path = new Path2D(); path.moveTo(best[0].x + ux, best[0].y + uy); best.forEach((q) => path.lineTo(q.x, q.y)); path.lineTo(best[best.length - 1].x + ux, best[best.length - 1].y + uy); path.closePath();
  ctx.fillStyle = css(hairC.lit); ctx.fill(path); ctx.clip(path);
  const lx = Math.cos(-1.9), ly = Math.sin(-1.9); void lx; void ly;
  const mid = best[Math.floor(best.length / 2)];
  const g = ctx.createLinearGradient(mid.x + up[0] * 90 * sc, mid.y + up[1] * 90 * sc, mid.x, mid.y); g.addColorStop(0, css(hairC.lit, 0)); g.addColorStop(1, css(hairC.shadow, 0.55));
  ctx.fillStyle = g; ctx.fillRect(-5000, -5000, 10000, 10000);
  ctx.restore();
}
/**
 * Volumetric hair mass by SPLATTING: dense points on an inflated skull surface
 * above the hairline are projected (visible hemisphere + a bit beyond the
 * silhouette) and drawn as discs into an offscreen layer → exact for any head
 * rotation, with a naturally wavy contour. Then shaded, strands, sheen, ink rim.
 */
let _hairLayer = null;
function hairLayer(w, h) {
  if (!_hairLayer) { const c = document.createElement('canvas'); _hairLayer = { c, x: c.getContext('2d') }; }
  if (_hairLayer.c.width < w || _hairLayer.c.height < h) { _hairLayer.c.width = Math.max(w, _hairLayer.c.width); _hairLayer.c.height = Math.max(h, _hairLayer.c.height); }
  const x = _hairLayer.x; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.filter = 'none'; x.clearRect(0, 0, _hairLayer.c.width, _hairLayer.c.height);
  return _hairLayer;
}
function hairlineY(hl, a) { const c = Math.cos(a); return c >= 0 ? lerp(hl.side, hl.front, c) : lerp(hl.side, hl.back, -c); }
function drawHairMass(ctx, H, P, R, hairC, sc, L, o, p, lw) {
  const hl = H.hairline; if (!hl) return;
  const wet = !!o.wetHair; const vol = (H.hairVol ?? 10) * (wet ? 0.3 : 1); const wave = (H.hairWave ?? 0.5) * (wet ? 0.25 : 1);
  const yTop = H.rings[0][0], yBot = Math.max(hl.back, hl.side, hl.front);
  const splats = []; let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const NA = 40, NY = 16;
  for (let j = 0; j <= NY; j++) {
    const y = lerp(yTop - 2, yBot, j / NY);
    const [w, d, z0] = ringAt(H, y);
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * TAU; if (y > hairlineY(hl, a)) continue;
      const n = mv(R, norm([Math.sin(a) * 0.8, (y - 10) / 90, Math.cos(a) * 0.8]))[2];
      if (n < -0.45) continue;
      const curl = 1 + (noise2(Math.cos(a) * 2.1 + j * 0.31, Math.sin(a) * 2.1 + (H.hairSeed || 1)) * 0.5 + 0.5) * wave * 0.9;
      const lift = y < yTop + 14 ? vol * 0.8 : 0;
      const q = P(Math.sin(a) * (w + vol * 0.55 * curl), y - lift * 0.6, z0 + Math.cos(a) * (d + vol * 0.55 * curl));
      const r = (5 + vol * 0.28 * curl) * sc;
      splats.push({ x: q.x, y: q.y, r, n }); minX = Math.min(minX, q.x - r); minY = Math.min(minY, q.y - r); maxX = Math.max(maxX, q.x + r); maxY = Math.max(maxY, q.y + r);
    }
  }
  if (!splats.length) return;
  const pad = 12; const ox = Math.floor(minX) - pad, oy = Math.floor(minY) - pad; const W = Math.ceil(maxX - minX) + pad * 2, Hh = Math.ceil(maxY - minY) + pad * 2;
  const Lr = hairLayer(W, Hh); const c = Lr.x; c.translate(-ox, -oy);
  c.fillStyle = css(hairC.lit); c.beginPath(); for (const s of splats) { c.moveTo(s.x + s.r, s.y); c.arc(s.x, s.y, s.r, 0, TAU); } c.fill();
  // shading inside the mass
  c.globalCompositeOperation = 'source-atop';
  const lx = Math.cos(L.angle), ly = Math.sin(L.angle); const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2; const rr = (maxX - minX) * 0.6;
  const g = c.createLinearGradient(cx + lx * rr, cy + ly * rr, cx - lx * rr, cy - ly * rr); g.addColorStop(0, css(hairC.shadow, 0.0)); g.addColorStop(0.48, css(hairC.shadow, 0.3)); g.addColorStop(0.56, css(hairC.shadow, 0.7)); g.addColorStop(1, css(hairC.shadow, 0.9));
  c.fillStyle = g; c.fillRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
  // locks: darker crescents on every 3rd splat give clumped, wavy structure
  c.strokeStyle = css(hairC.shadow, 0.55); c.lineWidth = 2.2 * sc; c.lineCap = 'round';
  splats.forEach((s, i) => { if (i % 3 || s.n < 0.1) return; c.beginPath(); c.arc(s.x, s.y, s.r * 0.75, 0.3 + (i % 5) * 0.2, 1.9 + (i % 5) * 0.2); c.stroke(); });
  // sheen
  const sx0 = cx + lx * rr * 0.32, sy0 = cy + ly * rr * 0.4; const sg = c.createRadialGradient(sx0, sy0, 0, sx0, sy0, rr * 0.5);
  sg.addColorStop(0, wet ? 'rgba(215,238,255,0.22)' : css(mixc(hairC.lit, [255, 238, 215], 0.55), 0.32)); sg.addColorStop(1, 'rgba(255,255,255,0)');
  c.globalCompositeOperation = 'screen'; c.fillStyle = sg; c.fillRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
  if (wet) { c.strokeStyle = 'rgba(220,240,255,0.55)'; c.lineWidth = 1.6 * sc; splats.forEach((s2, i) => { if (i % 4 || s2.n < 0.35) return; c.beginPath(); c.moveTo(s2.x - s2.r * 0.5, s2.y - s2.r * 0.3); c.quadraticCurveTo(s2.x, s2.y - s2.r * 0.6, s2.x + s2.r * 0.6, s2.y - s2.r * 0.1); c.stroke(); }); }
  if (L.rimAmt > 0) { const rx = Math.cos(L.rimAngle), ry = Math.sin(L.rimAngle); const rg = c.createLinearGradient(cx + rx * rr, cy + ry * rr, cx + rx * rr * 0.55, cy + ry * rr * 0.55); rg.addColorStop(0, css(L.rim, L.rimAmt * 0.8)); rg.addColorStop(1, css(L.rim, 0)); c.fillStyle = rg; c.globalCompositeOperation = 'source-atop'; c.fillRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20); }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
  // ink rim by dilation, then the mass
  ctx.save();
  const lwi = Math.max(1, lw * 0.9);
  ctx.globalAlpha *= 0.95;
  const tint = document.createElement('canvas'); void tint;
  ctx.filter = `drop-shadow(${lwi}px 0 0 ${css(hairC.line)}) drop-shadow(-${lwi}px 0 0 ${css(hairC.line)}) drop-shadow(0 ${lwi}px 0 ${css(hairC.line)}) drop-shadow(0 -${lwi}px 0 ${css(hairC.line)})`;
  ctx.drawImage(Lr.c, 0, 0, W, Hh, ox, oy, W, Hh);
  ctx.restore();
}
function drawHairClump(ctx, cl, P, R, hairC, lw, L, p, o, sc, S) {
  const [x, y, z] = cl.at; const F = frame(P, x, y, z, R);
  // orient clump: its direction vector in head space → screen
  const d = cl.dir || [0, 1, 0]; const tip = P(x + d[0] * cl.len, y + d[1] * cl.len, z + d[2] * cl.len);
  const wind = p.wind || 0; const wob = noise2((o.time || 0) * 1.3, x * 0.1 + y * 0.07) * (cl.flex || 0.3) * (Math.abs(wind) * 0.4 + 2) * sc;
  const tx = tip.x + wind * (cl.flex || 0.3) * sc * 2 + wob, ty = tip.y + (p.windY || 0) * (cl.flex || 0.3) * sc + (o.wetHair ? 6 * sc : 0);
  const bx = F.c.x, by = F.c.y; const dx = tx - bx, dy = ty - by; const Ln = Math.hypot(dx, dy) || 1; const nx = -dy / Ln, ny = dx / Ln;
  const w = cl.w * sc * (o.wetHair ? 0.75 : 1); const curl = cl.curl || 0;
  const path = new Path2D();
  path.moveTo(bx + nx * w, by + ny * w);
  path.bezierCurveTo(bx + nx * w * 1.1 + dx * 0.4, by + ny * w * 1.1 + dy * 0.4, tx + nx * w * 0.4 + curl * ny * 8 * sc, ty + ny * w * 0.4 - curl * nx * 8 * sc, tx + curl * nx * 10 * sc, ty + curl * ny * 10 * sc);
  path.bezierCurveTo(tx - nx * w * 0.2, ty - ny * w * 0.2, bx - nx * w * 0.6 + dx * 0.5, by - ny * w * 0.6 + dy * 0.5, bx - nx * w, by - ny * w);
  path.closePath();
  ctx.save(); ctx.fillStyle = css(cl.back ? hairC.shadow : mixc(hairC.lit, hairC.shadow, 0.25)); ctx.fill(path);
  ctx.clip(path); const g = ctx.createLinearGradient(bx - nx * w, by - ny * w, bx + nx * w, by + ny * w);
  const lx = Math.cos(L.angle), ly = Math.sin(L.angle); const s = nx * lx + ny * ly > 0;
  g.addColorStop(s ? 1 : 0, css(hairC.shadow, 0)); g.addColorStop(s ? 0 : 1, css(hairC.shadow, 0.7)); ctx.fillStyle = g; ctx.fillRect(Math.min(bx, tx) - w * 2, Math.min(by, ty) - w * 2, Math.abs(dx) + w * 4, Math.abs(dy) + w * 4);
  // sheen strand
  ctx.strokeStyle = o.wetHair ? 'rgba(220,240,255,0.55)' : css(mixc(hairC.lit, [255, 240, 220], 0.35), 0.5); ctx.lineWidth = 1.6 * sc;
  ctx.beginPath(); ctx.moveTo(bx + dx * 0.15, by + dy * 0.15); ctx.quadraticCurveTo(bx + dx * 0.5 + nx * w * 0.3, by + dy * 0.5 + ny * w * 0.3, bx + dx * 0.8, by + dy * 0.8); ctx.stroke();
  ctx.restore();
  ink(ctx, path, hairC, lw * 0.8, 0.85); void S;
}
function drawMask(ctx, ch, H, P, R, sc, lw, L, up, p) {
  const y = up ? -42 : H.eyes.y + 6; const z = faceZ(H, 0, y) + (up ? 6 : 10);
  const F = frame(P, 0, y, z, R);
  withFrame(ctx, F, (c) => {
    const w = 46, h = up ? 22 : 30;
    c.strokeStyle = '#1b2127'; c.lineWidth = 13; c.beginPath(); c.ellipse(0, 0, w + 5, h + 5, 0, 0, TAU); c.stroke(); // rubber skirt (ring)
    const g = c.createLinearGradient(-w, -h, w, h); g.addColorStop(0, 'rgba(200,236,248,0.32)'); g.addColorStop(0.45, 'rgba(120,170,190,0.08)'); g.addColorStop(1, 'rgba(210,240,255,0.26)');
    c.fillStyle = up ? 'rgba(40,60,70,0.9)' : g; c.beginPath(); c.ellipse(0, 0, w, h, 0, 0, TAU); c.fill();
    c.strokeStyle = '#c9d3d6'; c.lineWidth = 3.5; c.stroke(); // steel band
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3; c.beginPath(); c.ellipse(-w * 0.2, -h * 0.25, w * 0.6, h * 0.5, 0, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
  });
  // strap around head
  ctx.save(); ctx.strokeStyle = '#1b2127'; ctx.lineWidth = 7 * sc; ctx.lineCap = 'round';
  for (const sx of [1, -1]) { const n = mv(R, [sx, 0, 0])[2]; if (n < -0.4) continue; const a = P(sx * 44, y, faceZ(H, sx * 40, y) - 6), b = P(sx * 50, y - 6, -20); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(P(sx * 52, y - 2, -6).x, P(sx * 52, y - 2, -6).y, b.x, b.y); ctx.stroke(); }
  ctx.restore(); void lw; void L; void p; void ch;
}
function drawSnorkel(ctx, ch, H, P, R, sc, lw, L) {
  const sx = -1; // on the character's right side
  const pts = [[sx * 8, H.mouth.y + 2, faceZ(H, 0, H.mouth.y) + 10], [sx * 30, H.mouth.y + 8, faceZ(H, 30, H.mouth.y) + 8], [sx * 56, H.mouth.y - 4, 4], [sx * 58, -10, 0], [sx * 56, -60, -4], [sx * 52, -96, -6]].map(([x, y, z]) => P(x, y, z));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = new Path2D(); path.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length - 1; i++) { const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }; path.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); } path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = '#11161a'; ctx.lineWidth = 15 * sc; ctx.stroke(path); ctx.strokeStyle = '#2b343b'; ctx.lineWidth = 11 * sc; ctx.stroke(path);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3 * sc; ctx.stroke(path);
  const tip = pts[pts.length - 1], pre = pts[pts.length - 2]; const a = Math.atan2(tip.y - pre.y, tip.x - pre.x);
  ctx.strokeStyle = '#f26b2b'; ctx.lineWidth = 15 * sc; ctx.beginPath(); ctx.moveTo(tip.x - Math.cos(a) * 26 * sc, tip.y - Math.sin(a) * 26 * sc); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.restore(); void ch; void lw; void L;
}
function drawGlasses(ctx, ch, H, P, R, sc, lw, L) {
  for (const sx of [1, -1]) { const x = sx * H.eyes.x; const F = frame(P, x, H.eyes.y, faceZ(H, x, H.eyes.y) + 6, R); if (F.nz < -0.1) continue;
    withFrame(ctx, F, (c) => { c.strokeStyle = ch.glasses.color || '#1a1a1a'; c.lineWidth = ch.glasses.thick || 3; const r = ch.glasses.r || 14;
      c.fillStyle = 'rgba(200,225,240,0.12)'; c.beginPath(); if (ch.glasses.round) c.arc(0, 0, r, 0, TAU); else c.roundRect(-r * 1.2, -r * 0.8, r * 2.4, r * 1.6, 4); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.5); c.lineTo(-r * 0.1, -r * 0.6); c.stroke(); }); }
  const a = P(H.eyes.x - 10, H.eyes.y - 2, faceZ(H, 0, H.eyes.y) + 8), b = P(-H.eyes.x + 10, H.eyes.y - 2, faceZ(H, 0, H.eyes.y) + 8);
  ctx.strokeStyle = ch.glasses.color || '#1a1a1a'; ctx.lineWidth = 2.5 * sc; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 4 * sc, b.x, b.y); ctx.stroke(); void lw; void L;
}
function drawHat(ctx, hat, H, P, R, sc, lw, L, ch) {
  const cols = lit(hat.color || '#3a3a36', L);
  const ring = (y, r, d, z = -2) => { const out = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; out.push(P(Math.cos(a) * r, y, z + Math.sin(a) * d)); } return out; };
  let pts;
  if (hat.type === 'cap') { pts = [...ring(-36, 50, 54), ...ring(-58, 40, 44), ...ring(-66, 22, 24)]; }
  else if (hat.type === 'beanie') { pts = [...ring(-30, 52, 56), ...ring(-62, 40, 44), ...ring(-74, 16, 18)]; }
  else if (hat.type === 'fedora') { pts = [...ring(-34, 84, 88), ...ring(-36, 86, 90), ...ring(-60, 44, 46), ...ring(-80, 36, 30)]; }
  else if (hat.type === 'salakot') { pts = [...ring(-30, 120, 120), ...ring(-50, 70, 70), ...ring(-96, 6, 6)]; }
  else if (hat.type === 'police') { pts = [...ring(-34, 50, 54), ...ring(-62, 58, 62), ...ring(-64, 50, 54)]; }
  else return;
  const hull = convexHull(pts.map((q) => [q.x, q.y])); const path = smoothPath(hull, true, 0.4); const bb = bbox(hull);
  ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(path); ctx.clip(path);
  const g = ctx.createLinearGradient(bb[0], 0, bb[2], 0); const s = Math.cos(L.angle) > 0; g.addColorStop(s ? 1 : 0, css(cols.shadow, 0)); g.addColorStop(s ? 0 : 1, css(cols.shadow, L.shadow)); ctx.fillStyle = g; ctx.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
  if (hat.band) { ctx.strokeStyle = hat.band; ctx.lineWidth = 9 * sc; const b = ring(-40, 52, 56).filter((q, i) => Math.sin((i / 24) * TAU) > -0.1); ctx.beginPath(); b.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); }
  if (hat.type === 'cap' || hat.type === 'police') { const v = [P(-40, -34, 46), P(40, -34, 46), P(30, -30, 82), P(-30, -30, 82)]; ctx.restore(); ctx.save(); ctx.fillStyle = css(cols.shadow); ctx.beginPath(); v.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill(); }
  ctx.restore(); ink(ctx, path, cols, lw); void ch;
}

// ── torso & body ─────────────────────────────────────────────────────────────
function torsoRings(ch, S, p) {
  const B = ch.body; const sp = S.Rspine, rt = S.Rroot; const out = [];
  const mid = mm(rt, eul(p.spineYaw * 0.5, p.spinePitch * 0.5, p.spineRoll * 0.5));
  const def = [ // [f along pelvis→chest, halfW, halfD, forward z, rotation]
    [-0.13, B.hipW * 1.0, B.depth * 0.75, -2, rt], [0.0, B.hipW * 1.3, B.depth * 1.0, -3, rt], [0.2, B.hipW * 1.22, B.depth * 0.95, 0, rt],
    [0.42, B.waistW, B.depth * 0.86, 1, mid], [0.62, B.chestW * 0.96 + p.breathe * 2, B.depth * (0.98 + p.breathe * 0.05), 3, sp],
    [0.8, B.chestW * 1.05 + p.breathe * 3, B.depth * (1.05 + p.breathe * 0.06), 4, sp], [0.93, B.shoulderW * 1.0, B.depth * 0.8, 1, sp],
    [1.0, B.shoulderW * 0.62, B.depth * 0.62, 0, sp], [1.05, B.neckW * 0.62, B.neckW * 0.55, 0, sp],
  ];
  for (const [f, w, d, zf, R] of def) {
    const base = f <= 0.42 ? add(S.pelvis, mv(R, [0, -B.torso * f, 0])) : add(S.pelvis, mul(sub(S.chest, S.pelvis), f));
    out.push({ c: add(base, mv(R, [0, 0, zf])), w, d, R, f });
  }
  return out;
}
/** organic (non-convex) torso silhouette: per-ring extremes across the spine */
function torsoOutline(rings, proj) {
  const a = proj(rings[1].c), b = proj(rings[rings.length - 2].c);
  let ux = b.x - a.x, uy = b.y - a.y; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; const nx = -uy, ny = ux;
  const left = [], right = []; let bottom = null, top = null;
  rings.forEach((r, i) => {
    let mn = 1e9, mx = -1e9, pm = null, pM = null; const pts = ringPts(r, proj, 28);
    for (const q of pts) { const d = (q.x - a.x) * nx + (q.y - a.y) * ny; if (d < mn) { mn = d; pm = q; } if (d > mx) { mx = d; pM = q; } }
    left.push([pm.x, pm.y]); right.push([pM.x, pM.y]);
    if (i === 0) { let lo = -1e9; for (const q of pts) { const d = (q.x - a.x) * ux + (q.y - a.y) * uy; if (-d > lo) { lo = -d; bottom = [q.x, q.y]; } } }
    if (i === rings.length - 1) { let hi = -1e9; for (const q of pts) { const d = (q.x - a.x) * ux + (q.y - a.y) * uy; if (d > hi) { hi = d; top = [q.x, q.y]; } } }
  });
  const pts = [...left, top, ...right.reverse(), bottom];
  return smoothPath(pts, true, 0.5);
}
function ringPts(r, proj, n = 20) { const pts = []; for (let k = 0; k < n; k++) { const a = (k / n) * TAU; pts.push(proj(add(r.c, mv(r.R, [Math.cos(a) * r.w, 0, Math.sin(a) * r.d])))); } return pts; }

/**
 * MAIN ENTRY. Draws a character.
 * o: { x, y, scale, light (LIGHT preset or object), outfit (name in ch.outfits or object),
 *      mask: true|'up', snorkel: bool, wetHair, burn (0..1 sunburn), stubble, tongue, hat,
 *      lineW (override), time (for hair wobble), silhouette: colour (draw flat silhouette),
 *      only: 'head' (portrait/close-up: draws neck+shoulders+head) }
 * Returns screen positions of joints (useful to attach props / particles).
 */
export function drawCharacter(ctx, ch, p, o = {}) {
  p = { ...POSE0, ...p };
  const L = typeof o.light === 'string' ? LIGHT[o.light] : (o.light || LIGHT.studio);
  const outfit = typeof o.outfit === 'string' ? ch.outfits[o.outfit] : (o.outfit || ch.outfits[ch.defaultOutfit]);
  const S = solve(ch, p); const proj = projector(o); const sc = (o.scale ?? 1); const lw = (o.lineW ?? ch.lineW) * sc;
  const Q = {}; for (const k of ['pelvis', 'chest', 'neckTop', 'head', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'rWrist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle', 'lToe', 'rToe']) Q[k] = proj(S[k]);
  const parts = [];
  const B = ch.body;
  const colOf = (key) => lit(outfit[key] || ch.skin, L);
  const skinC = lit(ch.skin, L);
  // limbs (continuous tubes)
  for (const side of ['l', 'r']) {
    const sh = Q[side + 'Shoulder'], el = Q[side + 'Elbow'], wr = Q[side + 'Wrist'], hp = Q[side + 'Hip'], kn = Q[side + 'Knee'], an = Q[side + 'Ankle'], to = Q[side + 'Toe'];
    const sleeve = outfit.upperArm && outfit.upperArm !== ch.skin; const longSleeve = sleeve && outfit.sleeves !== 'short' && outfit.foreArm !== ch.skin;
    const armC = colOf('upperArm');
    const aw = B.armW * sc, cloth = sleeve ? 1.18 : 1;
    parts.push({ z: (sh.z + el.z + wr.z) / 3 + 0.5, draw: () => {
      const wA = [aw * 0.98 * cloth, aw * 0.84 * (longSleeve ? 1.14 : 1), aw * 0.6 * (longSleeve ? 1.22 : 1)];
      if (sleeve && !longSleeve) { // short sleeve: skin arm tube + sleeve tube on upper arm
        const T0 = tubeOutline([sh, el, wr], [aw * 1.05, aw * 0.82, aw * 0.58], [[0.16, 0.1], [0.14, 0.08]]); shadeTube(ctx, T0.path, [sh, el, wr], [aw, aw * 0.8, aw * 0.6], T0.segN, skinC, L); ink(ctx, T0.path, skinC, lw);
        const mid = { x: lerp(sh.x, el.x, 0.55), y: lerp(sh.y, el.y, 0.55), z: 0 }; const T1 = tubeOutline([sh, mid], [aw * 1.3, aw * 1.15], [[0.05, 0.05]]); shadeTube(ctx, T1.path, [sh, mid], [aw * 1.3, aw * 1.15], T1.segN, armC, L); ink(ctx, T1.path, armC, lw);
      } else {
        const C = longSleeve || !sleeve ? armC : skinC;
        const T = tubeOutline([sh, el, wr], wA, [[0.18, 0.1], [0.16, 0.06]]); shadeTube(ctx, T.path, [sh, el, wr], wA, T.segN, C, L);
        if (outfit.stripes && outfit.stripesOn?.includes('arms')) { stripesOnLimb(ctx, T.path, S[side + 'Shoulder'], S[side + 'Elbow'], B.armW * 0.6, proj, null, 6, outfit.stripes, 6, 0); stripesOnLimb(ctx, T.path, S[side + 'Elbow'], S[side + 'Wrist'], B.armW * 0.55, proj, null, 6, outfit.stripes, 6, 0); }
        if (longSleeve) { ctx.save(); ctx.clip(T.path); ctx.strokeStyle = css(C.shadow, 0.55); ctx.lineWidth = 1.6 * sc; // elbow folds + cuff
          for (let f = 0; f < 3; f++) { const k = 0.82 + f * 0.06; const px = lerp(sh.x, el.x, k), py = lerp(sh.y, el.y, k); const [nx, ny] = T.segN[0]; ctx.beginPath(); ctx.moveTo(px - nx * aw * 0.5, py - ny * aw * 0.5); ctx.quadraticCurveTo(px + (el.x - sh.x) * 0.04, py + (el.y - sh.y) * 0.04, px + nx * aw * 0.35, py + ny * aw * 0.35); ctx.stroke(); }
          const cx = lerp(el.x, wr.x, 0.9), cy = lerp(el.y, wr.y, 0.9); const [nx, ny] = T.segN[1]; ctx.lineWidth = 2.2 * sc; ctx.beginPath(); ctx.moveTo(cx - nx * aw, cy - ny * aw); ctx.lineTo(cx + nx * aw, cy + ny * aw); ctx.stroke(); ctx.restore(); }
        ink(ctx, T.path, C, lw);
        if (!longSleeve && sleeve) { /* unreachable */ }
      }
    } });
    parts.push({ z: wr.z + 0.7 + (ch.handZBias || 0), draw: () => drawHand(ctx, side, S, proj, ch, p[side + 'Hand'], L, sc, outfit) });
    const trousers = outfit.thigh && outfit.thigh !== ch.skin; const shorts = trousers && outfit.shin === ch.skin;
    const lwid = B.legW * sc;
    parts.push({ z: (hp.z + kn.z + an.z) / 3 - 0.2, draw: () => {
      const legC = colOf('thigh');
      if (trousers && !shorts) { const W3 = [lwid * 1.22, lwid * 0.95, lwid * 0.82]; const T = tubeOutline([hp, kn, an], W3, [[0.08, 0.06], [0.03, 0.03]]); shadeTube(ctx, T.path, [hp, kn, an], W3, T.segN, legC, L);
        ctx.save(); ctx.clip(T.path); ctx.strokeStyle = css(legC.shadow, 0.6); ctx.lineWidth = 1.5 * sc; const [nx, ny] = T.segN[0]; // knee folds + crease
        for (let f = 0; f < 2; f++) { const k = 0.9 + f * 0.07; const px = lerp(hp.x, kn.x, k), py = lerp(hp.y, kn.y, k); ctx.beginPath(); ctx.moveTo(px - nx * lwid * 0.5, py - ny * lwid * 0.5); ctx.quadraticCurveTo(px + nx * 0.1, py + 6 * sc, px + nx * lwid * 0.45, py + ny * lwid * 0.45); ctx.stroke(); }
        ctx.restore(); ink(ctx, T.path, legC, lw);
      } else {
        const W3 = [lwid * 1.15, lwid * 0.72, lwid * 0.5]; const T = tubeOutline([hp, kn, an], W3, [[0.12, 0.16], [0.06, 0.22]]); shadeTube(ctx, T.path, [hp, kn, an], W3, T.segN, skinC, L);
        ctx.save(); ctx.clip(T.path); ctx.strokeStyle = css(skinC.shadow, 0.5); ctx.lineWidth = 1.5 * sc; const kx = kn.x, ky = kn.y; ctx.beginPath(); ctx.arc(kx, ky, lwid * 0.22, 0.3, 2.6); ctx.stroke(); ctx.restore(); // kneecap
        ink(ctx, T.path, skinC, lw);
        if (shorts) { const mid = { x: lerp(hp.x, kn.x, 0.6), y: lerp(hp.y, kn.y, 0.6) }; const T1 = tubeOutline([hp, mid], [lwid * 1.35, lwid * 1.2], [[0.05, 0.05]]); shadeTube(ctx, T1.path, [hp, mid], [lwid * 1.35, lwid * 1.2], T1.segN, legC, L); ink(ctx, T1.path, legC, lw); }
      }
    } });
    parts.push({ z: (an.z + to.z) / 2 - 0.3, draw: () => drawFoot(ctx, side, S, proj, ch, outfit, L, sc, lw) });
  }
  // torso
  const rings = torsoRings(ch, S, p);
  parts.push({ z: (Q.pelvis.z + Q.chest.z) / 2, torso: true, draw: () => drawTorso(ctx, ch, S, p, rings, proj, outfit, L, sc, lw) });
  // neck
  parts.push({ z: Q.neckTop.z - 1, draw: () => { const a = proj(add(S.chest, mv(S.Rspine, [0, 6, 0]))), b = Q.neckTop; limb(ctx, a, { ...b, y: b.y - 10 * sc }, B.neckW * sc, B.neckW * 0.92 * sc, skinC, L, lw, 0.1, null, outfit, proj, sc);
    if (outfit.collar) drawCollar(ctx, S, proj, outfit, L, sc, lw, ch); } });
  // head
  parts.push({ z: Q.head.z + 5, draw: () => drawHead(ctx, ch, S, p, proj, L, sc, { ...o, wetHair: o.wetHair ?? p.wet > 0.5 }) });
  // depth sort: far first. Arms/legs vs torso use their z; torso gets slight priority.
  parts.sort((a, b) => a.z - b.z);
  ctx.save();
  if (o.silhouette) {
    const lay = o.layer ? o.layer() : null; const c2 = lay ? lay.ctx : ctx;
    for (const pt of parts) pt.draw.call(null);
    void c2;
  } else for (const pt of parts) pt.draw();
  ctx.restore();
  return { joints: Q, S };
}
function limb(ctx, a, b, wa, wb, cols, L, lw, bulge, stripes, outfit, proj, sc, bulgeAt = 0.35) {
  const lp = limbPath(a, b, wa, wb, bulge, bulgeAt);
  shadeCyl(ctx, lp.path, a, b, (wa + wb) / 2, cols, L);
  if (stripes && outfit.stripes) stripesOnLimb(ctx, lp.path, stripes.A3, stripes.B3, stripes.r, proj, null, Math.max(3, Math.round(len3(sub(stripes.B3, stripes.A3)) / 18)), outfit.stripes, 6, 0);
  // fabric fold lines at the joint end
  if (outfit && outfit.folds && cols !== undefined) { ctx.save(); ctx.clip(lp.path); ctx.strokeStyle = css(cols.shadow, 0.5); ctx.lineWidth = 1.4 * sc; const mx = lerp(a.x, b.x, 0.8), my = lerp(a.y, b.y, 0.8); ctx.beginPath(); ctx.moveTo(mx - lp.nx * wa * 0.4, my - lp.ny * wa * 0.4); ctx.quadraticCurveTo(mx + (b.x - a.x) * 0.05, my + (b.y - a.y) * 0.05, mx + lp.nx * wa * 0.3, my + lp.ny * wa * 0.3); ctx.stroke(); ctx.restore(); }
  ink(ctx, lp.path, cols, lw);
}
function drawTorso(ctx, ch, S, p, rings, proj, outfit, L, sc, lw) {
  const path = torsoOutline(rings, proj);
  const pel = proj(S.pelvis), che = proj(S.chest); const bw = ch.body.chestW * 2 * sc;
  const top = lit(outfit.torso || ch.skin, L);
  shadeCyl(ctx, path, pel, che, bw, top, L);
  ctx.save(); ctx.clip(path);
  // telnyashka stripes wrapping around the torso
  if (outfit.stripes && outfit.stripesOn?.includes('torso')) {
    ctx.strokeStyle = outfit.stripes; const n = 15;
    for (let i = 0; i < n; i++) { const f = 0.25 + (i / n) * 0.78; let r0 = rings[0]; for (const r of rings) if (r.f <= f) r0 = r; const ri = rings[Math.min(rings.length - 1, rings.indexOf(r0) + 1)]; const k = clamp01((f - r0.f) / ((ri.f - r0.f) || 1));
      const r = { c: add(mul(r0.c, 1 - k), mul(ri.c, k)), w: lerp(r0.w, ri.w, k) * 1.02, d: lerp(r0.d, ri.d, k) * 1.02, R: ri.R };
      ctx.beginPath(); let st = false; for (let j = 0; j <= 28; j++) { const a = (j / 28) * TAU; const nz = mv(r.R, [Math.cos(a), 0, Math.sin(a)])[2]; const q = proj(add(r.c, mv(r.R, [Math.cos(a) * r.w, 0, Math.sin(a) * r.d]))); if (nz > -0.1) { st ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); st = true; } else st = false; }
      ctx.lineWidth = 7 * sc; ctx.stroke(); }
    // re-shade over stripes
    const lx = Math.cos(L.angle), ly = Math.sin(L.angle); const nx = -(che.y - pel.y), ny = che.x - pel.x; const ln = Math.hypot(nx, ny) || 1; const d = (nx * lx + ny * ly) / ln; const s = d >= 0 ? 1 : -1; const mx = (pel.x + che.x) / 2, my = (pel.y + che.y) / 2;
    const g = ctx.createLinearGradient(mx + (nx / ln) * bw * 0.5 * s, my + (ny / ln) * bw * 0.5 * s, mx - (nx / ln) * bw * 0.5 * s, my - (ny / ln) * bw * 0.5 * s); g.addColorStop(0, css(top.shadow, 0)); g.addColorStop(0.5, css(top.shadow, 0.05)); g.addColorStop(0.56, css(top.shadow, L.shadow * 0.6)); g.addColorStop(1, css(top.shadow, L.shadow * 0.85));
    ctx.fillStyle = g; ctx.fillRect(-5000, -5000, 10000, 10000);
  }
  // pecs / ribcage / abs hints for bare torso
  if (!outfit.torso || outfit.torso === ch.skin) {
    const facing = mv(S.Rspine, [0, 0, 1])[2];
    if (facing > 0) { const c = rings[5]; ctx.strokeStyle = css(top.shadow, 0.45 * facing); ctx.lineWidth = 2 * sc;
      for (const sx of [1, -1]) { const a = proj(add(c.c, mv(c.R, [sx * c.w * 0.1, -6, c.d]))), b = proj(add(c.c, mv(c.R, [sx * c.w * 0.75, 4, c.d * 0.7]))); const m = proj(add(c.c, mv(c.R, [sx * c.w * 0.4, 16, c.d * 1.05]))); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { const r = rings[3]; const q = proj(add(r.c, mv(r.R, [(i % 2 ? -1 : 1) * r.w * 0.55, -8 - i * 10, r.d * 0.85]))); ctx.beginPath(); ctx.moveTo(q.x - 9 * sc, q.y); ctx.quadraticCurveTo(q.x, q.y + 3 * sc, q.x + 9 * sc, q.y); ctx.stroke(); }
      const nv = proj(add(rings[2].c, mv(rings[2].R, [0, -14, rings[2].d]))); ctx.fillStyle = css(top.shadow, 0.6); ctx.beginPath(); ctx.ellipse(nv.x, nv.y, 3 * sc, 4 * sc, 0, 0, TAU); ctx.fill(); }
  }
  // jacket: open front showing the shirt
  if (outfit.jacket) {
    const J = lit(outfit.jacket, L); const facing = mv(S.Rspine, [0, 0, 1])[2];
    ctx.fillStyle = css(J.lit); ctx.globalAlpha = 1;
    // paint jacket everywhere except a front opening strip
    const open = []; const r3 = rings[6], r1 = rings[2];
    open.push(proj(add(r3.c, mv(r3.R, [-r3.w * 0.32, 0, r3.d * 1.02])))); open.push(proj(add(r3.c, mv(r3.R, [r3.w * 0.32, 0, r3.d * 1.02]))));
    open.push(proj(add(r1.c, mv(r1.R, [r1.w * 0.12, 0, r1.d * 1.02])))); open.push(proj(add(r1.c, mv(r1.R, [-r1.w * 0.12, 0, r1.d * 1.02]))));
    ctx.save();
    if (facing > 0) { const op = new Path2D(); op.moveTo(-5000, -5000); op.lineTo(5000, -5000); op.lineTo(5000, 5000); op.lineTo(-5000, 5000); op.closePath(); op.moveTo(open[0].x, open[0].y); op.lineTo(open[3].x, open[3].y); op.lineTo(open[2].x, open[2].y); op.lineTo(open[1].x, open[1].y); op.closePath(); ctx.clip(op, 'evenodd'); }
    ctx.fillRect(-5000, -5000, 10000, 10000);
    const lx = Math.cos(L.angle); const g = ctx.createLinearGradient(pel.x + lx * bw * 0.5, 0, pel.x - lx * bw * 0.5, 0); g.addColorStop(0, css(J.shadow, 0)); g.addColorStop(0.55, css(J.shadow, L.shadow * 0.7)); g.addColorStop(1, css(J.shadow, L.shadow)); ctx.fillStyle = g; ctx.fillRect(-5000, -5000, 10000, 10000);
    ctx.restore();
    if (facing > 0) { ctx.strokeStyle = css(J.line); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(open[0].x, open[0].y); ctx.lineTo(open[3].x, open[3].y); ctx.moveTo(open[1].x, open[1].y); ctx.lineTo(open[2].x, open[2].y); ctx.stroke();
      // lapels
      ctx.fillStyle = css(J.shadow, 0.6); for (const [a, b] of [[open[0], open[3]], [open[1], open[2]]]) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, 0.35) + (a.x < b.x ? -14 : 14) * sc, lerp(a.y, b.y, 0.3)); ctx.lineTo(lerp(a.x, b.x, 0.45), lerp(a.y, b.y, 0.45)); ctx.closePath(); ctx.fill(); } }
  }
  // swim briefs / trousers top
  if (outfit.briefs) {
    const Bc = lit(outfit.briefs, L); const r0 = rings[0], r1 = rings[2]; const pts = [];
    for (let j = 0; j <= 24; j++) { const a = (j / 24) * TAU; pts.push(proj(add(r1.c, mv(r1.R, [Math.cos(a) * r1.w * 1.05, 6, Math.sin(a) * r1.d * 1.05])))); }
    for (let j = 24; j >= 0; j--) { const a = (j / 24) * TAU; pts.push(proj(add(r0.c, mv(r0.R, [Math.cos(a) * r0.w * 1.04, 26 + Math.abs(Math.cos(a)) * -18, Math.sin(a) * r0.d * 1.04])))); }
    const bp = smoothPath(convexHull(pts.map((q) => [q.x, q.y])), true, 0.3); shadeCyl(ctx, bp, pel, proj(add(r1.c, [0, 0, 0])), bw, Bc, L); ink(ctx, bp, Bc, lw * 0.8);
  }
  if (outfit.belt) { const r = rings[2]; ctx.strokeStyle = outfit.belt; ctx.lineWidth = 9 * sc; ctx.beginPath(); let st = false; for (let j = 0; j <= 24; j++) { const a = (j / 24) * TAU; const nz = mv(r.R, [Math.cos(a), 0, Math.sin(a)])[2]; const q = proj(add(r.c, mv(r.R, [Math.cos(a) * r.w * 1.04, 4, Math.sin(a) * r.d * 1.04]))); if (nz > -0.1) { st ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); st = true; } else st = false; } ctx.stroke(); }
  ctx.restore();
  ink(ctx, path, top, lw);
}
function drawCollar(ctx, S, proj, outfit, L, sc, lw, ch) {
  const c = lit(outfit.collarColor || outfit.torso, L); const r = { c: add(S.chest, mv(S.Rspine, [0, -2, 0])), w: ch.body.neckW * 0.75, d: ch.body.neckW * 0.65, R: S.Rspine };
  const pts = ringPts(r, proj, 24); const path = smoothPath(convexHull(pts.map((q) => [q.x, q.y])), true, 0.4);
  if (outfit.collar === 'turtleneck') { const r2 = { ...r, c: add(S.chest, mv(S.Rspine, [0, -22, 0])) }; const p2 = ringPts(r2, proj, 24); const hp = smoothPath(convexHull([...pts, ...p2].map((q) => [q.x, q.y])), true, 0.4); shadeCyl(ctx, hp, proj(r.c), proj(r2.c), ch.body.neckW * 1.4 * sc, c, L); ink(ctx, hp, c, lw); }
  else { ctx.save(); ctx.fillStyle = css(c.shadow, 0.9); ctx.fill(path); ctx.restore(); }
  void outfit;
}
function drawFoot(ctx, side, S, proj, ch, outfit, L, sc, lw) {
  const R = S[side + 'Rfoot']; const an = S[side + 'Ankle']; const sx = side === 'l' ? 1 : -1; const B = ch.body;
  const P = (x, y, z) => proj(add(an, mv(R, [x * sx, y, z])));
  if (outfit.fins) {
    const cols = lit('#15191d', L); const fl = B.foot * 2.6;
    const pts = [P(-14, 2, -14), P(14, 2, -14), P(30, 8, fl * 0.45), P(36, 14, fl), P(0, 18, fl * 1.06), P(-36, 14, fl), P(-30, 8, fl * 0.45)];
    const path = smoothPath(pts.map((q) => [q.x, q.y]), true, 0.35);
    ctx.save(); ctx.fillStyle = css(cols.lit); ctx.fill(path); ctx.clip(path);
    ctx.strokeStyle = 'rgba(120,150,170,0.35)'; ctx.lineWidth = 2.5 * sc; for (const xx of [-16, 0, 16]) { const a = P(xx, 6, fl * 0.3), b = P(xx * 1.6, 14, fl * 0.98); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    if (L.rimAmt) { ctx.strokeStyle = css(L.rim, L.rimAmt * 0.6); ctx.lineWidth = 4 * sc; ctx.stroke(path); }
    ctx.restore(); ink(ctx, path, cols, lw * 0.8);
    { const a = P(0, 4, 0), b = P(0, 16, fl * 1.03); ctx.save(); ctx.strokeStyle = css(cols.lit); ctx.lineCap = 'round'; ctx.lineWidth = 9 * sc; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = css(cols.line); ctx.lineWidth = 2 * sc; ctx.stroke(); ctx.restore(); }
    const shoe = smoothPath([P(-15, -10, -16), P(15, -10, -16), P(17, 4, 30), P(-17, 4, 30)].map((q) => [q.x, q.y]), true, 0.5); ctx.fillStyle = css(lit('#232a30', L).lit); ctx.fill(shoe); ink(ctx, shoe, cols, lw * 0.7);
    return;
  }
  const cols = lit(outfit.shoes || ch.skin, L);
  const pts = [P(-13, -6, -12), P(13, -6, -12), P(16, 6, B.foot * 0.6), P(12, 9, B.foot), P(-12, 9, B.foot), P(-15, 6, B.foot * 0.6)];
  const path = smoothPath(pts.map((q) => [q.x, q.y]), true, 0.5);
  shadeCyl(ctx, path, P(0, 0, 0), P(0, 4, B.foot), 30 * sc, cols, L); ink(ctx, path, cols, lw * 0.85);
  if (outfit.shoes) { const s1 = P(-14, 9, -10), s2 = P(14, 9, B.foot); ctx.strokeStyle = css(cols.line); ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); }
}

// ── animation helpers ────────────────────────────────────────────────────────
/** front-crawl swim cycle (phase in cycles). Body horizontal: use with pitch ≈ π/2 */
export function swimCrawl(t, speed = 0.55, o = {}) {
  const ph = t * speed * TAU;
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    pitch: Math.PI / 2 - 0.12, yaw: o.yaw ?? -Math.PI / 2, roll: s * 0.35,
    rShoulderPitch: (ph % TAU) / TAU * TAU, lShoulderPitch: ((ph + Math.PI) % TAU) / TAU * TAU,
    rShoulderRoll: 0.15 + Math.max(0, Math.cos(ph)) * 0.4, lShoulderRoll: 0.15 + Math.max(0, -Math.cos(ph)) * 0.4,
    rElbow: 0.3 + Math.max(0, Math.sin(ph)) * 1.1, lElbow: 0.3 + Math.max(0, -Math.sin(ph)) * 1.1,
    lHipPitch: Math.sin(ph * 3) * 0.25, rHipPitch: -Math.sin(ph * 3) * 0.25, lKnee: 0.15 + Math.max(0, Math.sin(ph * 3)) * 0.35, rKnee: 0.15 + Math.max(0, -Math.sin(ph * 3)) * 0.35,
    lAnkle: -0.9, rAnkle: -0.9, headYaw: c > 0.6 ? (c - 0.6) * 2.2 : 0, headPitch: -0.75, lHand: 'open', rHand: 'open',
  };
}
/** treading water (vertical body, sculling arms, egg-beater legs) */
export function treadWater(t, effort = 0.5) {
  const ph = t * TAU * (0.6 + effort * 0.5);
  return {
    pitch: 0.12, lShoulderRoll: 1.15 + Math.sin(ph) * 0.25, rShoulderRoll: 1.15 + Math.sin(ph + 0.4) * 0.25, lShoulderPitch: 0.5 + Math.cos(ph) * 0.3, rShoulderPitch: 0.5 + Math.cos(ph + 0.4) * 0.3,
    lElbow: 0.5 + Math.sin(ph) * 0.2, rElbow: 0.5 + Math.sin(ph + 0.4) * 0.2, lHand: 'open', rHand: 'open',
    lHipPitch: 0.5 + Math.sin(ph * 1.3) * 0.35, rHipPitch: 0.5 - Math.sin(ph * 1.3) * 0.35, lKnee: 0.9 + Math.cos(ph * 1.3) * 0.4, rKnee: 0.9 - Math.cos(ph * 1.3) * 0.4,
    lHipRoll: 0.3, rHipRoll: 0.3, lAnkle: -0.5, rAnkle: -0.5, breathe: 0.5 + 0.5 * Math.sin(ph * 0.5),
  };
}
/** walk cycle (phase seconds) */
export function walk(t, speed = 1, o = {}) {
  const ph = t * speed * Math.PI * 1.8; const s = Math.sin(ph), c = Math.cos(ph);
  return { lHipPitch: s * 0.42, rHipPitch: -s * 0.42, lKnee: 0.1 + Math.max(0, -c) * 0.75, rKnee: 0.1 + Math.max(0, c) * 0.75, lAnkle: s * 0.2, rAnkle: -s * 0.2,
    lShoulderPitch: -s * 0.35, rShoulderPitch: s * 0.35, lElbow: 0.25 + Math.max(0, s) * 0.3, rElbow: 0.25 + Math.max(0, -s) * 0.3,
    spineYaw: s * 0.08, spineRoll: c * 0.03, roll: 0, headYaw: (o.headYaw || 0) - s * 0.04, breathe: 0.3, yBob: Math.abs(c) * -8 };
}
/** idle: breathing + micro weight shift (add to any pose) */
export function idle(t, amt = 1) {
  return { breathe: (0.5 + 0.5 * Math.sin(t * 1.6)) * amt, spineRoll: Math.sin(t * 0.4) * 0.02 * amt, headRoll: Math.sin(t * 0.33 + 1) * 0.03 * amt, headYaw: Math.sin(t * 0.21) * 0.04 * amt, blink: blinkAt(t) };
}
/** natural blink track (returns 0..1) */
export function blinkAt(t, seed = 0) {
  const period = 3.7 + (seed % 3) * 0.6; const ph = ((t + seed * 1.37) % period) / period; const d = Math.abs(ph - 0.5) * period; return d < 0.08 ? 1 - d / 0.08 : 0;
}
/** add pose deltas: base + delta(s) */
export function addPose(base, ...deltas) { const o = { ...base }; for (const d of deltas) for (const k in d) { if (typeof d[k] === 'number' && typeof o[k] === 'number') o[k] += d[k]; else o[k] = d[k]; } return o; }

/** library of key poses (merge with pose()) */
export const P = {
  stand: {},
  standRail: { yaw: Math.PI - 0.35, spinePitch: 0.18, lShoulderPitch: 0.75, rShoulderPitch: 0.75, lElbow: 0.9, rElbow: 0.9, lShoulderRoll: 0.35, rShoulderRoll: 0.35, lHand: 'grip', rHand: 'grip', headPitch: 0.25 },
  lookBack: { yaw: Math.PI - 0.6, headYaw: -1.1, spineYaw: -0.25 },
  readBook: { spinePitch: 0.3, headPitch: 0.45, lShoulderPitch: 0.9, rShoulderPitch: 0.9, lElbow: 1.5, rElbow: 1.5, lShoulderRoll: -0.05, rShoulderRoll: -0.05, lHand: 'open', rHand: 'open', gazeY: 0.6 },
  armsCrossed: { lShoulderPitch: 0.6, rShoulderPitch: 0.6, lElbow: 2.0, rElbow: 2.0, lShoulderRoll: -0.25, rShoulderRoll: -0.25, lShoulderYaw: 0.6, rShoulderYaw: 0.6, lHand: 'fist', rHand: 'fist' },
  pointUp: { rShoulderPitch: 2.6, rElbow: 0.2, rHand: 'point', headPitch: -0.4 },
  climbRail: { spinePitch: 0.35, lShoulderPitch: 0.6, rShoulderPitch: 0.9, lElbow: 1.1, rElbow: 0.8, lHand: 'grip', rHand: 'grip', lHipPitch: 1.4, lKnee: 1.6, rHipPitch: 0.1 },
  crouchJump: { spinePitch: 0.75, lHipPitch: 1.3, rHipPitch: 1.3, lKnee: 1.9, rKnee: 1.9, lAnkle: -0.5, rAnkle: -0.5, lShoulderPitch: -0.8, rShoulderPitch: -0.8, lElbow: 0.2, rElbow: 0.2, headPitch: -0.3 },
  leap: { spinePitch: -0.15, lHipPitch: 0.1, rHipPitch: -0.05, lKnee: 0.1, rKnee: 0.2, lShoulderPitch: 2.9, rShoulderPitch: 2.9, lShoulderRoll: 0.25, rShoulderRoll: 0.25, lElbow: 0.1, rElbow: 0.1, lAnkle: -0.9, rAnkle: -0.9, headPitch: -0.2 },
  feetFirst: { spinePitch: 0.05, lHipPitch: 0, rHipPitch: 0, lKnee: 0, rKnee: 0, lShoulderPitch: 0, rShoulderPitch: 0, lShoulderRoll: 0.05, rShoulderRoll: 0.05, lElbow: 0, rElbow: 0, lAnkle: -1.2, rAnkle: -1.2, lHand: 'fist', rHand: 'fist' },
  crawl: { pitch: 1.2, spinePitch: 0.15, lShoulderPitch: 1.3, rShoulderPitch: 1.0, lElbow: 0.2, rElbow: 0.5, lHipPitch: 1.5, rHipPitch: 1.2, lKnee: 1.6, rKnee: 1.8, lHand: 'claw', rHand: 'claw', headPitch: -0.9 },
  lieDown: { pitch: Math.PI / 2, yaw: 0.1, lShoulderRoll: 0.4, rShoulderRoll: 0.6, lElbow: 0.5, rElbow: 0.3, lHipRoll: 0.12, rHipRoll: 0.1, lKnee: 0.3, headYaw: 0.5, expr: 'sleep' },
  sitDesk: { lHipPitch: 1.55, rHipPitch: 1.55, lKnee: 1.55, rKnee: 1.55, spinePitch: 0.25, lShoulderPitch: 0.8, rShoulderPitch: 0.8, lElbow: 1.2, rElbow: 1.2, headPitch: 0.35 },
  shrug: { lShoulderRoll: 0.55, rShoulderRoll: 0.55, lElbow: 1.4, rElbow: 1.4, lShoulderYaw: 0.8, rShoulderYaw: 0.8, lHand: 'open', rHand: 'open', headRoll: 0.12, expr: 'smug' },
  facepalm: { rShoulderPitch: 2.0, rElbow: 2.3, rHand: 'open', headPitch: 0.3, expr: 'sad' },
  salute: { rShoulderPitch: 1.4, rShoulderRoll: 1.0, rElbow: 2.2, rHand: 'open', expr: 'stern' },
};
