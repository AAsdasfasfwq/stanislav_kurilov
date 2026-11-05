// ─────────────────────────────────────────────────────────────────────────────
//  engine/core.js — deterministic frame engine.
//
//  The whole film is a pure function  frame = f(t).  Each segment module draws
//  the complete picture for its time range into a 1920×1080 2D canvas ("comp").
//  A final WebGL pass (post.js) adds the shared film/lens finish.
//
//  Modes:
//    • preview  — index.html with transport, scrubbing, live audio
//    • render   — driven by render.js (Puppeteer) through window.__RENDER
// ─────────────────────────────────────────────────────────────────────────────
import { W, H, FPS, DURATION, SEGMENTS, TAIL, segmentAt } from '../segments/manifest.js';
import { Post } from './post.js';
import { loadFonts, F, font } from './fonts.js';
import { noise2 } from './math.js';

class LayerPool {
  constructor() { this.items = []; this.i = 0; }
  reset() { this.i = 0; }
  get(w = W, h = H) {
    let L = this.items[this.i];
    if (!L || L.canvas.width !== w || L.canvas.height !== h) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      L = { canvas, ctx }; this.items[this.i] = L;
    }
    this.i++;
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = 'source-over';
    L.ctx.filter = 'none'; L.ctx.shadowBlur = 0; L.ctx.shadowColor = 'transparent';
    L.ctx.clearRect(0, 0, w, h);
    return L;
  }
}

export class Engine {
  constructor() {
    this.W = W; this.H = H; this.FPS = FPS; this.DURATION = DURATION; this.SEGMENTS = SEGMENTS; this.TAIL = TAIL;
    this.t = 0; this.frame = 0; this.mode = 'preview';
    this.modules = new Map();   // id → module (default export)
    this.loading = new Map();   // id → promise
    this.failed = new Map();    // id → error
    this.layers = new LayerPool();
    this._cache = new Map();
    this._sims = new Map();
    this.words = [];
    this.prevPost = null;
    this._three = null;
    this.current = null;        // currently rendering segment descriptor
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  async boot({ mode = 'preview', outCanvas } = {}) {
    this.mode = mode;
    this.comp = document.createElement('canvas'); this.comp.width = W; this.comp.height = H;
    this.ctx = this.comp.getContext('2d', { alpha: false });
    this.out = outCanvas || document.createElement('canvas'); this.out.width = W; this.out.height = H;
    this.postFx = new Post(this.out, W, H);
    this.post = this.postFx.params;
    await loadFonts();
    try {
      const tr = await (await fetch(new URL('../assets/transcript.json', import.meta.url))).json();
      this.words = tr.segments.flatMap((s) => s.words.map((w) => ({ w: w.word.trim(), s: w.start, e: w.end })));
      this.lines = tr.segments.map((s) => ({ text: s.text.trim(), s: s.start, e: s.end }));
    } catch (e) { console.warn('transcript not loaded', e); this.lines = []; }
    return this;
  }

  // ── segments ──────────────────────────────────────────────────────────────
  segmentsIn(t0, t1) { return SEGMENTS.filter((s) => s.end + TAIL > t0 && s.start <= t1); }
  async loadSegment(id) {
    if (this.modules.has(id)) return this.modules.get(id);
    if (this.loading.has(id)) return this.loading.get(id);
    const p = (async () => {
      try {
        const mod = await import(`../segments/${id}/index.js`);
        const seg = mod.default;
        if (seg.preload) await seg.preload(this);
        this.modules.set(id, seg);
        return seg;
      } catch (e) {
        console.error(`[engine] segment ${id} failed to load`, e);
        this.failed.set(id, e); return null;
      } finally { this.loading.delete(id); }
    })();
    this.loading.set(id, p);
    return p;
  }
  /** load every segment needed to render [t0,t1] (incl. the previous one for hand-offs) */
  async ensureRange(t0, t1) {
    const need = new Set();
    for (const s of SEGMENTS) {
      if (s.end > t0 && s.start <= t1) {
        need.add(s.id);
        const i = SEGMENTS.indexOf(s);
        if (i > 0 && t0 < s.start + TAIL + 0.01) need.add(SEGMENTS[i - 1].id);
      }
    }
    await Promise.all([...need].map((id) => this.loadSegment(id)));
  }

  // ── per-frame rendering ───────────────────────────────────────────────────
  renderAt(t) {
    t = Math.max(0, Math.min(DURATION, t));
    this.t = t; this.frame = Math.round(t * FPS);
    this.postFx.reset(); this.prevPost = null;
    this.layers.reset();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#0b1620'; ctx.fillRect(0, 0, W, H);
    const seg = segmentAt(t); this.current = seg;
    const mod = this.modules.get(seg.id);
    ctx.save();
    try {
      if (mod) mod.render(ctx, t, this);
      else this.placeholder(ctx, t, seg);
    } catch (e) {
      console.error(`[engine] ${seg.id} render error @${t.toFixed(3)}`, e);
      this.errorCard(ctx, t, seg, e);
    }
    ctx.restore();
    this.postFx.render(this.comp, this.frame, t);
    return this.out;
  }

  /**
   * Draw the PREVIOUS segment's frame at the current time into ctx (for hand-off
   * transitions in the first TAIL seconds of a segment). Returns true on success.
   * The previous segment's post settings are stored in E.prevPost (use E.blendPost).
   */
  drawPrev(ctx) {
    const seg = this.current; const i = SEGMENTS.indexOf(seg);
    if (i <= 0) return false;
    const prev = SEGMENTS[i - 1]; const mod = this.modules.get(prev.id);
    if (!mod || this.t > prev.end + TAIL) return false;
    const saved = JSON.parse(JSON.stringify(this.post));
    this.postFx.reset();
    const before = this.current; this.current = prev;
    ctx.save();
    try { mod.render(ctx, this.t, this); } catch (e) { console.error('[engine] prev render error', e); }
    ctx.restore();
    this.current = before;
    this.prevPost = JSON.parse(JSON.stringify(this.post));
    Object.assign(this.post, saved);
    return true;
  }
  /** blend current post params towards prevPost by (1-k) — k=0 → prev, k=1 → current */
  blendPost(k) {
    const a = this.prevPost; if (!a) return; const p = this.post;
    for (const key in a) {
      if (Array.isArray(a[key])) p[key] = p[key].map((v, j) => a[key][j] + (v - a[key][j]) * k);
      else if (typeof a[key] === 'number') p[key] = a[key] + (p[key] - a[key]) * k;
    }
  }

  // ── helpers for segments ──────────────────────────────────────────────────
  /** fresh transparent 1920×1080 layer {canvas, ctx}; recycled every frame */
  layer(w = W, h = H) { return this.layers.get(w, h); }
  /** memoize an expensive asset (offscreen canvas, geometry…) */
  cache(key, build) { if (!this._cache.has(key)) this._cache.set(key, build()); return this._cache.get(key); }
  /** set post params for this frame */
  postSet(obj) { return Object.assign(this.post, obj); }
  /** camera shake through the post pass. amp in px, freq in Hz */
  shake(amp = 6, freq = 9, seed = 0, rot = 0.002) {
    const t = this.t;
    this.post.shakeX += noise2(t * freq, 3.1 + seed) * amp;
    this.post.shakeY += noise2(t * freq, 9.7 + seed) * amp;
    this.post.shakeRot += noise2(t * freq * 0.7, 21.3 + seed) * rot * (amp / 6);
  }
  /**
   * Fixed-step deterministic simulation. Re-simulates from t0 when seeking backwards.
   *  const st = E.sim('spray', t, shotStart, 1/60, () => init(), (st, dt, time) => step(...));
   */
  sim(key, t, t0, dt, init, step) {
    let s = this._sims.get(key);
    if (!s || t < s.t - 1e-9 || s.t0 !== t0) s = { t: t0, t0, state: init() };
    let guard = 0;
    while (s.t + dt <= t + 1e-9 && guard++ < 200000) { step(s.state, dt, s.t); s.t += dt; }
    this._sims.set(key, s);
    return s.state;
  }
  /** first time (s) the word (case-insensitive, punctuation ignored) is spoken after `after` */
  at(word, after = 0) {
    const k = word.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    const w = this.words.find((x) => x.s >= after && x.w.toLowerCase().replace(/[^a-z0-9'-]/g, '') === k);
    return w ? w.s : null;
  }
  /** word being spoken at time t (or null) */
  wordAt(t) { return this.words.find((w) => t >= w.s && t < w.e) || null; }
  lineAt(t) { return this.lines.find((l) => t >= l.s && t < l.e) || null; }

  /** lazily created shared Three.js renderer. Usage:
   *    const T = await E.getThree(); …  const cv = T.render(scene, camera); ctx.drawImage(cv, 0, 0);
   *  (drawImage IMMEDIATELY — the canvas is reused by the next render call) */
  async getThree() {
    if (this._three) return this._three;
    const THREE = await import('three');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const T = {
      THREE, renderer,
      render(scene, camera, w = W, h = H) {
        const s = renderer.getSize(new THREE.Vector2());
        if (s.x !== w || s.y !== h) renderer.setSize(w, h, false);
        if (camera.isPerspectiveCamera && Math.abs(camera.aspect - w / h) > 1e-4) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
        renderer.setClearColor(0x000000, 0); renderer.clear();
        renderer.render(scene, camera);
        return renderer.domElement;
      },
    };
    this._three = T; return T;
  }

  // ── fallback cards ────────────────────────────────────────────────────────
  placeholder(ctx, t, seg) {
    ctx.fillStyle = '#132430'; ctx.fillRect(0, 0, W, H);
    const lp = (t - seg.start) / (seg.end - seg.start);
    ctx.fillStyle = '#1d3644'; ctx.fillRect(0, H - 12, W * lp, 12);
    ctx.fillStyle = '#e8432e'; ctx.font = font(F.mono, 28, 500); ctx.textAlign = 'left';
    ctx.fillText(`${seg.id.toUpperCase()} · ${seg.title}`, 120, 140);
    ctx.fillStyle = '#ede6d6'; ctx.font = font(F.wide, 120, 800); ctx.fillText(t.toFixed(2), 120, 300);
    const line = this.lineAt(t); ctx.font = font(F.serif, 52, 400, 'italic'); ctx.fillStyle = '#c9d3d6';
    if (line) wrapText(ctx, line.text, 120, 460, W - 240, 64);
    if (this.failed.has(seg.id)) { ctx.fillStyle = '#e8432e'; ctx.font = font(F.mono, 24); ctx.fillText(String(this.failed.get(seg.id)).slice(0, 140), 120, H - 80); }
  }
  errorCard(ctx, t, seg, e) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#3a0d0a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = font(F.mono, 30, 500);
    ctx.fillText(`RENDER ERROR ${seg.id} @ ${t.toFixed(3)}s`, 100, 140);
    ctx.font = font(F.mono, 22); wrapText(ctx, String(e && e.stack || e), 100, 200, W - 200, 30);
  }
}

export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(/\s+/); let line = ''; let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export const E = new Engine();
export default E;
