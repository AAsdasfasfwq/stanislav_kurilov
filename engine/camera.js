// ─────────────────────────────────────────────────────────────────────────────
//  engine/camera.js — 2.5D multiplane camera (the "Disney multiplane" model).
//
//  Author every plane at SCREEN SCALE as it should look with the camera at rest.
//  Give it a depth z (focal plane = 1000). The camera then pans / dollies / rolls
//  and each plane moves with correct parallax, scale, depth-of-field and haze.
//
//    const cam = new Cam25({ x: 0, y: 0, z: 0, zoom: 1, roll: 0, focus: 1000, aperture: 0.8,
//                            fog: { color: '#0f2a3a', near: 1200, far: 6000, max: 0.65 } });
//    cam.x = kf(lt, [[0,-40],[4,40]]);   cam.z = 120 * E.out(p)   // dolly-in
//    cam.handheld(t, 2.5);                                         // living camera
//    cam.plane(ctx, 6000, (c) => drawSky(c));                      // far: slow, hazy
//    cam.plane(ctx, 1000, (c) => drawHero(c));                     // focal plane: sharp
//    cam.plane(ctx, 420,  (c) => drawForegroundRail(c));           // near: fast, blurred
//
//  Rules of thumb: z ≥ 3000 sky/horizon · 1500–3000 background · 1000 hero ·
//  500–900 foreground props · 250–450 pass-by elements (heavily blurred).
// ─────────────────────────────────────────────────────────────────────────────
import { noise2, clamp01 } from './math.js';
import { rgba } from './math.js';

const W = 1920, H = 1080;

export class Cam25 {
  constructor(o = {}) {
    this.x = 0; this.y = 0; this.z = 0; this.zoom = 1; this.roll = 0;
    this.focal = 1000; this.focus = 1000; this.aperture = 0; this.maxBlur = 22;
    this.fog = null; this.cx = W / 2; this.cy = H / 2;
    this.layerFn = null; // E.layer for offscreen planes
    Object.assign(this, o);
    this._hx = 0; this._hy = 0; this._hr = 0;
  }
  /** organic handheld drift (amp in px at focal plane) */
  handheld(t, amp = 2, speed = 0.6, seed = 0) {
    this._hx = noise2(t * speed, 11.1 + seed) * amp * 1.0 + noise2(t * speed * 3.1, 2.2 + seed) * amp * 0.25;
    this._hy = noise2(t * speed, 37.7 + seed) * amp * 0.7 + noise2(t * speed * 2.7, 8.8 + seed) * amp * 0.2;
    this._hr = noise2(t * speed * 0.8, 71.3 + seed) * amp * 0.00045;
    return this;
  }
  /** scale factor of a plane at depth z (relative to its rest appearance) */
  k(z) { const d = z - this.z; return d <= 1 ? Infinity : (z / d) * this.zoom; }
  /** parallax factor (screen px per camera px) at depth z */
  par(z) { const d = z - this.z; return d <= 1 ? Infinity : (this.focal / d) * this.zoom; }
  blurOf(z) {
    if (!this.aperture) return 0;
    const d = z - this.z; if (d <= 1) return this.maxBlur;
    const b = this.aperture * Math.abs(1 - (this.focus - this.z) / d) * 14;
    return Math.min(this.maxBlur, b);
  }
  fogOf(z) {
    if (!this.fog) return 0;
    const { near = 1500, far = 8000, max = 0.7 } = this.fog;
    return clamp01((z - near) / (far - near)) * max;
  }
  /** apply this plane's transform to ctx (no layer) */
  apply(ctx, z) {
    const k = this.k(z), par = this.par(z);
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.roll + this._hr);
    ctx.translate(-(this.x + this._hx) * par, -(this.y + this._hy) * par);
    ctx.scale(k, k);
    ctx.translate(-this.cx, -this.cy);
  }
  /** screen position of a point authored on plane z */
  project(px, py, z) {
    const k = this.k(z), par = this.par(z);
    let x = (px - this.cx) * k - (this.x + this._hx) * par, y = (py - this.cy) * k - (this.y + this._hy) * par;
    const r = this.roll + this._hr, c = Math.cos(r), s = Math.sin(r);
    return { x: this.cx + x * c - y * s, y: this.cy + x * s + y * c, k };
  }
  /**
   * Draw a plane. opts: { blur (override), fog (override 0..1), fogColor, alpha, composite, layer:E.layer }
   * When blur/fog are needed the plane renders into an offscreen layer first.
   */
  plane(ctx, z, draw, opts = {}) {
    const d = z - this.z; if (d <= 20) return; // behind / too close to camera
    const blur = opts.blur ?? this.blurOf(z);
    const fog = opts.fog ?? this.fogOf(z);
    const fogColor = opts.fogColor || (this.fog && this.fog.color) || '#0f2a3a';
    const alpha = opts.alpha ?? 1;
    if (alpha <= 0) return;
    const needLayer = blur > 0.4 || fog > 0.01 || opts.forceLayer;
    if (!needLayer) {
      ctx.save(); ctx.globalAlpha *= alpha; if (opts.composite) ctx.globalCompositeOperation = opts.composite;
      this.apply(ctx, z); draw(ctx, this.k(z)); ctx.restore(); return;
    }
    const layer = (opts.layer || this.layerFn)();
    const c = layer.ctx;
    c.save(); this.apply(c, z); draw(c, this.k(z)); c.restore();
    if (fog > 0.01) { c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(fogColor, fog); c.fillRect(0, 0, W, H); c.restore(); }
    ctx.save(); ctx.globalAlpha *= alpha; if (opts.composite) ctx.globalCompositeOperation = opts.composite;
    if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  }
}

/** quick helper: create camera bound to engine layers */
export const cam25 = (E, o) => new Cam25({ layerFn: () => E.layer(), ...o });
