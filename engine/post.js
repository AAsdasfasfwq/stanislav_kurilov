// ─────────────────────────────────────────────────────────────────────────────
//  engine/post.js — final WebGL2 "lens & film" pass applied to every frame.
//  Segments never touch WebGL here; they set E.post.* values per frame.
//  The pass gives the whole film one optical identity: grain, halation, bloom,
//  vignette, chromatic aberration, grade, shake, flashes, letterbox.
// ─────────────────────────────────────────────────────────────────────────────

export const POST_DEFAULTS = Object.freeze({
  exposure: 0,          // stops
  contrast: 1.04,
  saturation: 1.0,
  temperature: 0,       // -1 cold … +1 warm
  tint: 0,              // -1 green … +1 magenta
  lift: [0, 0, 0],      // shadows offset (−0.1…0.1)
  gamma: [1, 1, 1],     // midtones
  gain: [1, 1, 1],      // highlights
  fadeBlacks: 0.012,    // milky blacks (film)
  vignette: 0.26,       // 0..1
  vignetteSoft: 0.65,
  grain: 0.045,         // 0..0.2
  grainSize: 1.15,
  ca: 0.0011,           // chromatic aberration (fraction of width at the edge)
  bloom: 0.16,          // bloom mix
  bloomThreshold: 0.74,
  halation: 0.10,       // red-orange film halation around highlights
  distortion: 0.0,      // barrel (+) / pincushion (−), keep < 0.08
  shakeX: 0, shakeY: 0, shakeRot: 0, // px, px, radians (use E.shake())
  zoom: 1.0,            // final-frame zoom (punch-ins on impacts)
  flash: 0, flashColor: [1, 1, 1],
  fade: 0, fadeColor: [0, 0, 0],      // global fade (avoid; prefer motivated transitions)
  blur: 0,              // full-frame defocus in px (0..24) — rack-focus/blur transitions
  letterbox: 0,         // 0..1 → animates 2.39:1 bars in
  scanlines: 0,         // 0..1 — archival / TV / monitor look
  sepia: 0,             // 0..1 — archival memory look
});

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform float thr;
void main(){ vec3 c = texture(src, uv).rgb; float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(thr, thr + 0.25, l); o = vec4(c * k, 1.); }`;

const FS_BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ vec3 s = vec3(0.); float w[7] = float[](0.1964825501511404,0.2969069646728344,0.2969069646728344,0.09447039785044732,0.09447039785044732,0.010381362401148057,0.010381362401148057);
  vec2 off[7] = vec2[](vec2(0.),dir*1.411764705882353,-dir*1.411764705882353,dir*3.2941176470588234,-dir*3.2941176470588234,dir*5.176470588235294,-dir*5.176470588235294);
  for(int i=0;i<7;i++) s += texture(src, uv + off[i]).rgb * w[i]; o = vec4(s,1.); }`;

const FS_FINAL = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src; uniform sampler2D bloomTex; uniform sampler2D blurTex;
uniform vec2 res; uniform float time; uniform float frame;
uniform float exposure, contrast, saturation, temperature, tint, fadeBlacks;
uniform vec3 lift, gammaV, gain;
uniform float vignette, vignetteSoft, grain, grainSize, ca, bloom, halation, distortion;
uniform vec2 shake; uniform float shakeRot, zoom;
uniform float flash; uniform vec3 flashColor; uniform float fade; uniform vec3 fadeColor;
uniform float blurMix, letterbox, scanlines, sepia;

float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 sampleCA(vec2 q, float amt){
  vec2 d = (q - 0.5);
  float r = texture(src, q + d * amt).r;
  float g = texture(src, q).g;
  float b = texture(src, q - d * amt).b;
  return vec3(r,g,b);
}
void main(){
  vec2 q = uv;
  // camera: zoom + rotation + shake around centre (aspect-correct)
  vec2 c = q - 0.5; c.x *= res.x/res.y;
  float cr = cos(shakeRot), sr = sin(shakeRot);
  c = mat2(cr,-sr,sr,cr) * c; c /= zoom; c.x /= res.x/res.y;
  q = c + 0.5 - shake / res;
  // lens distortion
  vec2 dd = q - 0.5; float r2 = dot(dd, dd); q = 0.5 + dd * (1.0 + distortion * r2 * 2.0);
  vec3 col = sampleCA(q, ca * (0.4 + 2.6 * r2));
  vec3 bl = texture(blurTex, q).rgb; col = mix(col, bl, blurMix);
  // bloom + halation
  vec3 b = texture(bloomTex, q).rgb;
  col += b * bloom;
  col += b * vec3(1.0, 0.32, 0.12) * halation;
  // exposure / white balance
  col *= exp2(exposure);
  col *= vec3(1.0 + temperature*0.10, 1.0 + tint*-0.05, 1.0 - temperature*0.12);
  // lift / gamma / gain
  col = col * gain + lift * (1.0 - col);
  col = pow(max(col, 0.0), 1.0 / gammaV);
  // contrast around mid grey (in a gentle S)
  col = (col - 0.5) * contrast + 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  if (sepia > 0.0) { vec3 sp = vec3(l*1.07+0.04, l*0.95+0.02, l*0.78); col = mix(col, sp, sepia); }
  col = max(col, 0.0); col = col * (1.0 - fadeBlacks) + fadeBlacks;
  // vignette
  vec2 vq = uv - 0.5; vq.x *= res.x/res.y * 0.82;
  float v = smoothstep(0.85, 0.85 - vignetteSoft, length(vq) * 1.15);
  col *= mix(1.0, v, vignette);
  // scanlines
  if (scanlines > 0.0) { float s = 0.5 + 0.5 * sin(uv.y * res.y * 3.14159); col *= 1.0 - scanlines * 0.35 * s; }
  // flash & fade
  col = mix(col, flashColor, clamp(flash, 0.0, 1.0));
  col = mix(col, fadeColor, clamp(fade, 0.0, 1.0));
  // grain (luma-weighted, animated per frame, film-like)
  vec2 gp = floor(uv * res / grainSize);
  float n = h12(gp + frame * 17.0) + h12(gp * 1.7 + frame * 3.1) - 1.0;
  float gw = grain * (0.55 + 0.9 * (1.0 - abs(l * 2.0 - 1.0)));
  col += n * gw;
  // letterbox 2.39:1
  float barH = letterbox * (1.0 - (res.x / 2.39) / res.y) * 0.5;
  if (uv.y < barH || uv.y > 1.0 - barH) col = vec3(0.0);
  // dither to kill banding in gradients
  col += (h12(uv * res + frame) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(canvas, W, H) {
    this.W = W; this.H = H; this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is required for the post pass');
    this.gl = gl;
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.quad = quad;
    this.pBright = this.program(FS_BRIGHT); this.pBlur = this.program(FS_BLUR); this.pFinal = this.program(FS_FINAL);
    this.src = this.tex(W, H);
    this.bw = Math.round(W / 4); this.bh = Math.round(H / 4);
    this.fbA = this.fbo(this.bw, this.bh); this.fbB = this.fbo(this.bw, this.bh);
    this.fbC = this.fbo(Math.round(W / 2), Math.round(H / 2)); this.fbD = this.fbo(Math.round(W / 2), Math.round(H / 2));
    this.params = { ...POST_DEFAULTS };
  }
  program(fs) {
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name] = gl.getUniformLocation(p, info.name); }
    return p;
  }
  tex(w, h) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  fbo(w, h) { const gl = this.gl; const t = this.tex(w, h); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { f, t, w, h }; }
  reset() { const d = POST_DEFAULTS; const p = this.params;
    for (const k in d) p[k] = Array.isArray(d[k]) ? d[k].slice() : d[k]; }
  /** merge partial params */
  set(obj) { Object.assign(this.params, obj); return this.params; }
  draw(prog, target, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    setup(prog.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  bind(unit, tex, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); }
  render(sourceCanvas, frame, time) {
    const gl = this.gl, p = this.params;
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    // bloom chain (quarter res)
    const needBloom = p.bloom > 0.001 || p.halation > 0.001;
    if (needBloom) {
      this.draw(this.pBright, this.fbA, (u) => { this.bind(0, this.src, u.src); gl.uniform1f(u.thr, p.bloomThreshold); });
      for (let i = 0; i < 2; i++) {
        const s = 1 + i * 1.5;
        this.draw(this.pBlur, this.fbB, (u) => { this.bind(0, this.fbA.t, u.src); gl.uniform2f(u.dir, s / this.bw, 0); });
        this.draw(this.pBlur, this.fbA, (u) => { this.bind(0, this.fbB.t, u.src); gl.uniform2f(u.dir, 0, s / this.bh); });
      }
    }
    // full-frame defocus (half res)
    const blurMix = Math.min(1, p.blur / 6);
    if (p.blur > 0.05) {
      const s = Math.max(0.5, p.blur / 4);
      this.draw(this.pBlur, this.fbC, (u) => { this.bind(0, this.src, u.src); gl.uniform2f(u.dir, s / this.fbC.w, 0); });
      this.draw(this.pBlur, this.fbD, (u) => { this.bind(0, this.fbC.t, u.src); gl.uniform2f(u.dir, 0, s / this.fbC.h); });
      if (p.blur > 8) {
        this.draw(this.pBlur, this.fbC, (u) => { this.bind(0, this.fbD.t, u.src); gl.uniform2f(u.dir, s * 1.8 / this.fbC.w, 0); });
        this.draw(this.pBlur, this.fbD, (u) => { this.bind(0, this.fbC.t, u.src); gl.uniform2f(u.dir, 0, s * 1.8 / this.fbC.h); });
      }
    }
    this.draw(this.pFinal, null, (u) => {
      this.bind(0, this.src, u.src); this.bind(1, this.fbA.t, u.bloomTex); this.bind(2, this.fbD.t, u.blurTex);
      gl.uniform2f(u.res, this.W, this.H); gl.uniform1f(u.time, time); gl.uniform1f(u.frame, frame % 1000);
      gl.uniform1f(u.exposure, p.exposure); gl.uniform1f(u.contrast, p.contrast); gl.uniform1f(u.saturation, p.saturation);
      gl.uniform1f(u.temperature, p.temperature); gl.uniform1f(u.tint, p.tint); gl.uniform1f(u.fadeBlacks, p.fadeBlacks);
      gl.uniform3fv(u.lift, p.lift); gl.uniform3fv(u.gammaV, p.gamma); gl.uniform3fv(u.gain, p.gain);
      gl.uniform1f(u.vignette, p.vignette); gl.uniform1f(u.vignetteSoft, p.vignetteSoft);
      gl.uniform1f(u.grain, p.grain); gl.uniform1f(u.grainSize, p.grainSize); gl.uniform1f(u.ca, p.ca);
      gl.uniform1f(u.bloom, needBloom ? p.bloom : 0); gl.uniform1f(u.halation, needBloom ? p.halation : 0); gl.uniform1f(u.distortion, p.distortion);
      gl.uniform2f(u.shake, p.shakeX, -p.shakeY); gl.uniform1f(u.shakeRot, p.shakeRot); gl.uniform1f(u.zoom, p.zoom);
      gl.uniform1f(u.flash, p.flash); gl.uniform3fv(u.flashColor, p.flashColor);
      gl.uniform1f(u.fade, p.fade); gl.uniform3fv(u.fadeColor, p.fadeColor);
      gl.uniform1f(u.blurMix, p.blur > 0.05 ? blurMix : 0); gl.uniform1f(u.letterbox, p.letterbox);
      gl.uniform1f(u.scanlines, p.scanlines); gl.uniform1f(u.sepia, p.sepia);
    });
  }
}
