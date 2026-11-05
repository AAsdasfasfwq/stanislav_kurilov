// ─────────────────────────────────────────────────────────────────────────────
//  lib/three/liner3d.js — the liner "SOVETSKY SOYUZ" as a procedural 3D model.
//  Design sheet (keep consistent with lib/art/liner2d.js):
//   • ~205 m long, black hull with white boot-top line and red-oxide bottom
//   • white 5-deck superstructure, rows of warm lit windows, lifeboats on davits
//   • TWO cream funnels with a red band + gold hammer & sickle, raked masts
//   • cruiser stern with railings; ANTI-ROLL BULGES along the sides below the waterline
//   • two 4-blade bronze propellers under the stern
//  Units: metres. Origin: midship at the waterline. +X = bow, +Y = up, +Z = port.
//
//    import { makeLiner, makePropeller } from '../../lib/three/liner3d.js';
//    const ship = makeLiner(THREE, { lights: 1, bulges: true });  scene.add(ship.group);
//    ship.setLights(0.8)  ship.update(t)  (props spin, lights flicker)
// ─────────────────────────────────────────────────────────────────────────────

export const LINER = { length: 205, beam: 25, draft: 9.5, freeboard: 11, superDecks: 5, deckH: 2.8 };

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** hull half-width at station u (−1 stern … +1 bow) and height y (−draft … +freeboard) */
function hullHalfWidth(u, y, o) {
  const B = LINER.beam / 2;
  // plan shape: fine bow, full midbody, rounded cruiser stern
  let plan;
  if (u > 0.35) { const k = (u - 0.35) / 0.65; plan = Math.cos(Math.pow(k, 1.6) * Math.PI / 2); }
  else if (u < -0.6) { const k = (-u - 0.6) / 0.4; plan = Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.2))); }
  else plan = 1;
  // section shape: flare above water, bilge turn below
  const yn = (y + LINER.draft) / (LINER.draft + LINER.freeboard); // 0 keel … 1 deck
  let sec = yn < 0.12 ? Math.pow(yn / 0.12, 0.5) * 0.82 : 0.82 + 0.18 * Math.min(1, (yn - 0.12) / 0.4);
  if (u > 0.6 && yn > 0.5) sec *= 1 + (yn - 0.5) * 0.25 * (u - 0.6) / 0.4; // bow flare
  let w = B * plan * sec;
  // anti-roll bulges ("blisters") along the midbody, just below the waterline
  if (o.bulges && u > -0.55 && u < 0.45) { const by = (y + 3.2) / 3.2; const along = Math.sin(Math.PI * (u + 0.55) / 1.0); if (by > -1 && by < 1) w += 1.6 * Math.cos(by * Math.PI / 2) * Math.pow(Math.max(0, along), 0.4); }
  return Math.max(0.05, w);
}

export function makeLiner(THREE, o = {}) {
  o = { lights: 1, bulges: true, detail: 1, ...o };
  const group = new THREE.Group(); group.name = 'SovetskySoyuz';
  const L = LINER.length, D = LINER.draft, F = LINER.freeboard;
  // ── hull geometry (lofted) ────────────────────────────────────────────────
  const NS = Math.round(90 * o.detail), NY = 22;
  const pos = [], uv = [], idx = [];
  const ys = []; for (let j = 0; j <= NY; j++) ys.push(-D + (D + F) * Math.pow(j / NY, 1.0));
  const sheer = (u) => 0.9 * Math.pow(Math.abs(u), 2) * (u > 0 ? 1.6 : 0.8); // deck rises toward bow
  for (let i = 0; i <= NS; i++) {
    const u = -1 + (2 * i) / NS; const x = (u * L) / 2;
    // raked stem: bow profile cuts back toward keel
    const ring = [];
    for (let j = 0; j <= NY; j++) { const y = ys[j] + (j === NY ? sheer(u) : sheer(u) * (j / NY)); ring.push([x, y, hullHalfWidth(u, ys[j], o)]); }
    // port side (top→bottom), then starboard (bottom→top)
    const sideVerts = [];
    for (let j = NY; j >= 0; j--) sideVerts.push([ring[j][0], ring[j][1], ring[j][2]]);
    for (let j = 1; j <= NY; j++) sideVerts.push([ring[j][0], ring[j][1], -ring[j][2]]);
    sideVerts.forEach((v, k) => { let [vx, vy, vz] = v; if (u > 0.9) vx -= (1 - (vy + D) / (D + F)) * (u - 0.9) * 60; pos.push(vx, vy, vz); uv.push(i / NS, k / (sideVerts.length - 1)); });
  }
  const per = NY * 2 + 1;
  for (let i = 0; i < NS; i++) for (let k = 0; k < per - 1; k++) { const a = i * per + k, b = a + per; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const hullGeo = new THREE.BufferGeometry(); hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hullGeo.setIndex(idx); hullGeo.computeVertexNormals();
  // hull texture: black topsides, white boot-top, red bottom, plating seams, portholes
  const hullTex = canvasTex(THREE, 2048, 512, (x, w, h) => {
    // v: 0 = port deck edge … 0.5 keel … 1 starboard deck edge. waterline at v where y=0
    const wl = (F / (D + F)) * 0.5; // from top edge to waterline (port half)
    const paintBand = (v0, v1, col) => { x.fillStyle = col; x.fillRect(0, v0 * h, w, (v1 - v0) * h); };
    paintBand(0, 1, '#0d0f12');
    for (const s of [0, 1]) { const top = s ? 1 - wl : wl; const a = s ? 1 - wl - 0.012 : wl - 0.012; const b = s ? 1 - wl + 0.005 : wl + 0.005;
      paintBand(Math.min(a, b), Math.max(a, b), '#e9e6dc'); // boot-top
      if (!s) paintBand(wl + 0.005, 0.5, '#7a2a1f'); else paintBand(0.5, 1 - wl - 0.012, '#7a2a1f'); void top; }
    // plating seams
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1; for (let i = 0; i < 80; i++) { x.beginPath(); x.moveTo((i / 80) * w, 0); x.lineTo((i / 80) * w, h); x.stroke(); }
    for (let j = 0; j < 14; j++) { x.beginPath(); x.moveTo(0, (j / 14) * h); x.lineTo(w, (j / 14) * h); x.stroke(); }
    const r = rnd(7); x.fillStyle = 'rgba(90,60,40,0.12)'; for (let i = 0; i < 400; i++) x.fillRect(r() * w, r() * h, 1 + r() * 30, 1 + r() * 3); // rust streaks
    // name (Cyrillic) near bow on both sides
    x.save(); x.fillStyle = '#e9e6dc'; x.font = '700 30px "Dela Gothic One", sans-serif'; x.textAlign = 'center';
    x.fillText('СОВЕТСКИЙ СОЮЗ', w * 0.86, wl * h * 0.45); x.scale(-1, 1); x.restore();
  });
  const hullEmi = canvasTex(THREE, 2048, 512, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const wl = (F / (D + F)) * 0.5; const r = rnd(3);
    for (const row of [0.35, 0.6]) for (let i = 0; i < 150; i++) { const u = 0.08 + (i / 150) * 0.84; if (r() < 0.12) continue; const k = 0.55 + r() * 0.45; x.fillStyle = `rgba(255,${190 + r() * 40 | 0},${110 + r() * 50 | 0},${k})`;
      for (const v of [wl * row, 1 - wl * row]) { x.beginPath(); x.arc(u * w, v * h, 2.6, 0, Math.PI * 2); x.fill(); } } });
  const hullMat = new THREE.MeshStandardMaterial({ map: hullTex, emissiveMap: hullEmi, emissive: new THREE.Color(1, 0.8, 0.55), emissiveIntensity: 1.6 * o.lights, roughness: 0.55, metalness: 0.25 });
  const hull = new THREE.Mesh(hullGeo, hullMat); hull.castShadow = hull.receiveShadow = true; group.add(hull);
  // deck plane
  const deckShape = new THREE.Shape(); const NP = 60;
  for (let i = 0; i <= NP; i++) { const u = -1 + (2 * i) / NP; const xx = (u * L) / 2; const hw = hullHalfWidth(u, F, o) * 0.98; i ? deckShape.lineTo(xx, hw) : deckShape.moveTo(xx, hw); }
  for (let i = NP; i >= 0; i--) { const u = -1 + (2 * i) / NP; deckShape.lineTo((u * L) / 2, -hullHalfWidth(u, F, o) * 0.98); }
  const deckTex = canvasTex(THREE, 1024, 256, (x, w, h) => { x.fillStyle = '#8c7a5c'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(40,30,20,0.35)'; for (let j = 0; j < 40; j++) { x.beginPath(); x.moveTo(0, (j / 40) * h); x.lineTo(w, (j / 40) * h); x.stroke(); } });
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85 }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = F + 0.1; deck.receiveShadow = true; group.add(deck);
  // ── superstructure ────────────────────────────────────────────────────────
  const white = (emi) => new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.6, metalness: 0.05, emissive: emi ? new THREE.Color(1, 0.82, 0.55) : 0x000000, emissiveIntensity: emi ? 1.4 * o.lights : 0 });
  const winTex = (rows, cols, seed) => canvasTex(THREE, 1024, 128, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const r = rnd(seed);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { if (r() < 0.25) continue; const k = 0.4 + r() * 0.6; x.fillStyle = `rgba(255,${180 + r() * 50 | 0},${100 + r() * 60 | 0},${k})`; x.fillRect((i + 0.2) / cols * w, (j + 0.3) / rows * h, w / cols * 0.6, h / rows * 0.45); } });
  const decks = []; const windows = [];
  for (let d = 0; d < LINER.superDecks; d++) {
    const len = L * (0.62 - d * 0.075), x0 = -L * 0.06 + d * 1.5, wdt = LINER.beam * (0.86 - d * 0.06), hgt = LINER.deckH;
    const shape = new THREE.Shape(); const r = wdt / 2;
    shape.moveTo(-len / 2, -r); shape.lineTo(len / 2 - r * 0.6, -r); shape.quadraticCurveTo(len / 2 + r * 0.4, 0, len / 2 - r * 0.6, r); shape.lineTo(-len / 2, r); shape.quadraticCurveTo(-len / 2 - r * 0.3, 0, -len / 2, -r);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: false, curveSegments: 10 }); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, white(false)); m.position.set(x0, F + 0.1 + d * hgt, 0); m.castShadow = m.receiveShadow = true; group.add(m); decks.push(m);
    // lit window strips on both sides
    const em = winTex(1, Math.round(len / 2.4), 11 + d);
    const wmat = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.2, metalness: 0.4, emissive: new THREE.Color(1, 0.82, 0.55), emissiveMap: em, emissiveIntensity: 1.5 * o.lights, transparent: true });
    for (const side of [1, -1]) { const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.92, hgt * 0.42), wmat); strip.position.set(x0 - len * 0.02, F + 0.1 + d * hgt + hgt * 0.55, side * (r + 0.03)); if (side < 0) strip.rotation.y = Math.PI; group.add(strip); windows.push(wmat); }
    // deck overhang lip + railings
    const lip = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.7 }));
    lip.scale.set(1.03, 1, 1.06); lip.position.set(x0, F + 0.1 + (d + 1) * hgt, 0); group.add(lip);
  }
  // bridge front windows (dark glass band)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, LINER.beam * 0.62), new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.15, metalness: 0.6, emissive: 0x332010, emissiveIntensity: o.lights }));
  bridge.position.set(L * 0.2, F + LINER.deckH * 4.4, 0); group.add(bridge);
  // lifeboats on the boat deck
  const boatGeo = (() => { const s = new THREE.Shape(); s.moveTo(-4, 0); s.quadraticCurveTo(-4.2, -1.1, 0, -1.25); s.quadraticCurveTo(4.2, -1.1, 4, 0); s.lineTo(-4, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 }); g.translate(0, 0, -1.1); return g; })();
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xeee9dc, roughness: 0.5 }); const boatTop = new THREE.MeshStandardMaterial({ color: 0xc9572f, roughness: 0.7 });
  for (const side of [1, -1]) for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(boatGeo, boatMat); b.position.set(-L * 0.18 + i * 10.5, F + LINER.deckH * 2.6, side * LINER.beam * 0.47); group.add(b);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.25, 2.3), boatTop); cv.position.copy(b.position); cv.position.y += 0.15; group.add(cv); }
  // funnels
  const funTex = canvasTex(THREE, 512, 512, (x, w, h) => { x.fillStyle = '#e4dcc8'; x.fillRect(0, 0, w, h); x.fillStyle = '#b8261d'; x.fillRect(0, h * 0.12, w, h * 0.2); x.fillStyle = '#111'; x.fillRect(0, 0, w, h * 0.08);
    x.fillStyle = '#e8c15a'; x.font = 'bold 70px serif'; x.textAlign = 'center'; for (const u of [0.25, 0.75]) x.fillText('☭', u * w, h * 0.29); });
  const funnels = [];
  for (const fx of [-L * 0.02, L * 0.11]) {
    const g = new THREE.CylinderGeometry(3.2, 3.6, 14, 28, 1, true); g.scale(1.45, 1, 1);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: funTex, roughness: 0.6, side: THREE.DoubleSide })); m.position.set(fx, F + LINER.deckH * 5 + 6.5, 0); m.rotation.z = 0.1; m.castShadow = true; group.add(m); funnels.push(m);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28).scale(1.45, 1, 1), new THREE.MeshBasicMaterial({ color: 0x050505 })); cap.rotation.x = -Math.PI / 2; cap.position.set(fx - 0.7, F + LINER.deckH * 5 + 13.5, 0); group.add(cap);
  }
  // masts + rigging lines
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.6 });
  const masts = [[L * 0.34, 26], [-L * 0.24, 22]].map(([mx, mh]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, mh, 10), mastMat); m.position.set(mx, F + mh / 2, 0); m.rotation.z = 0.08; group.add(m); return m; });
  const rig = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(L * 0.5, F + 2, 0), new THREE.Vector3(L * 0.34 - 1, F + 26, 0), new THREE.Vector3(-L * 0.24 - 1, F + 22, 0), new THREE.Vector3(-L * 0.5, F + 3, 0)]);
  group.add(new THREE.Line(rig, new THREE.LineBasicMaterial({ color: 0x9aa3a8 })));
  // string lights between masts (party cruise!)
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd38a }), 70);
  const tmp = new THREE.Object3D(); for (let i = 0; i < 70; i++) { const k = i / 69; const a = k < 0.5 ? k * 2 : (k - 0.5) * 2; const p0 = k < 0.5 ? [L * 0.5, F + 2, L * 0.34, F + 26] : [L * 0.34, F + 26, -L * 0.5, F + 3];
    tmp.position.set(p0[0] + (p0[2] - p0[0]) * a, p0[1] + (p0[3] - p0[1]) * a - Math.sin(a * Math.PI) * 2.5, 0); tmp.updateMatrix(); bulbs.setMatrixAt(i, tmp.matrix); }
  group.add(bulbs);
  // stern railing (the jump point!)
  const railMat = new THREE.MeshStandardMaterial({ color: 0xcfd2cf, roughness: 0.4, metalness: 0.6 });
  const railPts = []; for (let i = 0; i <= 30; i++) { const a = -Math.PI / 2 + (i / 30) * Math.PI; const u = -1 + 0.04; railPts.push(new THREE.Vector3(-L / 2 + 3 - Math.cos(a) * 3.5, F + 1.1, Math.sin(a) * hullHalfWidth(u, F, o) * 0.95)); }
  const railCurve = new THREE.CatmullRomCurve3(railPts); const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 60, 0.06, 6), railMat); group.add(rail);
  const rail2 = rail.clone(); rail2.position.y = -0.5; group.add(rail2);
  for (let i = 0; i <= 30; i += 2) { const p = railPts[i]; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), railMat); post.position.set(p.x, F + 0.55, p.z); group.add(post); }
  // propellers
  const props = [];
  for (const pz of [4.2, -4.2]) { const p = makePropeller(THREE, { radius: 2.6 }); p.position.set(-L / 2 + 8, -D + 3.2, pz); p.rotation.y = Math.PI / 2; group.add(p); props.push(p); }
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a2219, roughness: 0.8 })); rudder.position.set(-L / 2 + 4, -D + 4, 0); group.add(rudder);

  const api = {
    group, hull, decks, funnels, props, masts, rail, bulbs,
    /** world position of the stern rail centre (for cameras / characters) */
    sternRail: new THREE.Vector3(-L / 2 + 1, F + 1.1, 0),
    setLights(k) { hullMat.emissiveIntensity = 1.6 * k; windows.forEach((w) => (w.emissiveIntensity = 1.5 * k)); bulbs.visible = k > 0.05; },
    update(t) { props.forEach((p, i) => (p.rotation.x = t * 9 * (i ? -1 : 1))); },
  };
  return api;
}

/** 4-blade bronze propeller (blade = twisted elliptical surface) */
export function makePropeller(THREE, { radius = 2.6, blades = 4 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 0.9 });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.22, 20, 12).scale(1, 1, 1.6), mat); g.add(hub);
  for (let b = 0; b < blades; b++) {
    const pos = []; const idx = []; const NU = 12, NV = 6;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV - 0.5; const r = radius * (0.2 + 0.8 * u); const chord = radius * 0.55 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) * (1 - u * 0.3);
      const twist = 0.9 - u * 0.5; const a = v * chord / r; pos.push(Math.cos(a) * r, Math.sin(a) * r, v * chord * Math.sin(twist));
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, c = a + NV + 1; idx.push(a, c, a + 1, c, c + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide })); m.rotation.z = (b / blades) * Math.PI * 2; g.add(m);
  }
  const wrap = new THREE.Group(); g.rotation.y = Math.PI / 2; wrap.add(g); return wrap;
}
