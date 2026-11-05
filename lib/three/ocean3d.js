// ─────────────────────────────────────────────────────────────────────────────
//  lib/three/ocean3d.js — stylized-real Gerstner ocean + gradient sky for Three.js.
//  Deterministic: everything is driven by the `time` you pass to update(t).
//
//    const ocean = makeOcean(THREE, OCEAN.storm);   scene.add(ocean.mesh, ocean.sky);
//    ocean.update(t);  ocean.heightAt(x, z, t) → y   (to float/pitch/roll the ship)
//    ocean.set({ flash: 0.8 })  (lightning)   presets: storm · night · day · dawn · glassy
// ─────────────────────────────────────────────────────────────────────────────
export const OCEAN = {
  storm: { waves: [[0.9, 0.24, 90, 0.0], [0.5, 0.2, 52, 0.7], [-0.3, 0.16, 31, 2.1], [0.2, 0.12, 17, 4.0], [-0.7, 0.08, 9, 1.3]], amp: 1.0, deep: '#06131b', shallow: '#1d4a5c', foam: '#d8e4e6', sky: ['#0b1620', '#1f3442', '#3b5260'], fog: '#1c2f3a', fogDist: 900, sun: [-0.3, 0.25, -1], sunColor: '#9fb6c4', spec: 0.6, foamAmt: 1 },
  night: { waves: [[0.9, 0.14, 70, 0], [0.4, 0.12, 38, 1], [-0.4, 0.1, 21, 2], [0.1, 0.08, 11, 3]], amp: 1.0, deep: '#020a10', shallow: '#0b2635', foam: '#9fb3bb', sky: ['#01060b', '#06141e', '#0e2433'], fog: '#081722', fogDist: 1100, sun: [0.2, 0.35, -1], sunColor: '#c9d8e6', spec: 0.9, foamAmt: 0.4 },
  day: { waves: [[0.9, 0.1, 55, 0], [0.4, 0.09, 30, 1], [-0.4, 0.08, 17, 2], [0.1, 0.06, 9, 3]], amp: 1.0, deep: '#0a3e5c', shallow: '#2a8aa6', foam: '#f2f6f4', sky: ['#7fc0dc', '#bfe0ea', '#eef3ea'], fog: '#cfe4ea', fogDist: 1400, sun: [0.3, 0.7, -0.6], sunColor: '#fff3d6', spec: 1.2, foamAmt: 0.3 },
  dawn: { waves: [[0.9, 0.08, 55, 0], [0.4, 0.07, 30, 1], [-0.4, 0.06, 17, 2]], amp: 1.0, deep: '#14243a', shallow: '#4a5a72', foam: '#f4dcc4', sky: ['#2b3555', '#c9798a', '#ffc58f'], fog: '#e8a98a', fogDist: 1300, sun: [0, 0.06, -1], sunColor: '#ffb070', spec: 1.6, foamAmt: 0.3 },
  glassy: { waves: [[0.9, 0.03, 50, 0], [0.4, 0.025, 25, 1]], amp: 1.0, deep: '#0d3550', shallow: '#3a86a0', foam: '#ffffff', sky: ['#9fd0e8', '#d6ecf0', '#fbf3e0'], fog: '#e6f0ee', fogDist: 1600, sun: [0.2, 0.8, -0.5], sunColor: '#fff6e0', spec: 2.0, foamAmt: 0.1 },
};

const G = 9.81;
const VS = `
uniform float uTime; uniform float uAmp; uniform vec4 uW[6]; uniform int uN;
varying vec3 vWorld; varying vec3 vNormal; varying float vFoam;
vec3 gerstner(vec4 w, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float dirA = w.x; float steep = w.y; float wl = w.z; float ph = w.w;
  vec2 d = normalize(vec2(cos(dirA), sin(dirA)));
  float k = 6.28318 / wl; float c = sqrt(9.81 / k); float a = steep / k;
  float f = k * (dot(d, p.xz) - c * uTime) + ph;
  tangent += vec3(-d.x * d.x * (steep * sin(f)), d.x * (steep * cos(f)), -d.x * d.y * (steep * sin(f)));
  binormal += vec3(-d.x * d.y * (steep * sin(f)), d.y * (steep * cos(f)), -d.y * d.y * (steep * sin(f)));
  return vec3(d.x * (a * cos(f)), a * sin(f), d.y * (a * cos(f)));
}
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 tangent = vec3(1.0, 0.0, 0.0), binormal = vec3(0.0, 0.0, 1.0); vec3 o = p;
  for (int i = 0; i < 6; i++) { if (i >= uN) break; vec4 w = uW[i]; w.y *= 1.0; o += gerstner(w, p, tangent, binormal) * uAmp; }
  vNormal = normalize(cross(binormal, tangent)); vWorld = o;
  float hmax = 0.0; for (int i = 0; i < 6; i++) { if (i >= uN) break; hmax += uW[i].y / (6.28318 / uW[i].z); } vFoam = clamp((o.y - p.y) / max(0.01, hmax * uAmp) * 0.5 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(o, 1.0);
}`;
const FS = `
uniform vec3 uDeep, uShallow, uFoam, uSkyTop, uSkyMid, uSkyHor, uFog, uSunDir, uSunCol; uniform float uFogDist, uSpec, uFoamAmt, uFlash, uTime;
varying vec3 vWorld; varying vec3 vNormal; varying float vFoam;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
vec3 sky(vec3 d){ float y = clamp(d.y, -0.2, 1.0); vec3 c = mix(uSkyHor, uSkyMid, smoothstep(0.0, 0.25, y)); c = mix(c, uSkyTop, smoothstep(0.25, 0.9, y)); return c; }
void main() {
  vec3 V = normalize(cameraPosition - vWorld); vec3 N = normalize(vNormal);
  // micro ripples
  float r = n2(vWorld.xz * 0.35 + uTime * 0.6) + n2(vWorld.xz * 0.9 - uTime * 0.9) * 0.5;
  N = normalize(N + vec3((r - 0.75) * 0.08, 0.0, (n2(vWorld.zx * 0.4 - uTime * 0.5) - 0.5) * 0.08));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.85 + 0.04;
  vec3 R = reflect(-V, N); vec3 refl = sky(R);
  float depthMix = clamp(vFoam * 1.2 + 0.1, 0.0, 1.0);
  vec3 water = mix(uDeep, uShallow, depthMix * 0.75);
  // subsurface glow on wave backs facing the light
  water += uShallow * pow(max(dot(normalize(vec3(uSunDir.x, 0.0, uSunDir.z)), -V), 0.0), 3.0) * vFoam * 0.4;
  vec3 col = mix(water, refl, fres);
  vec3 S = normalize(uSunDir); float spec = pow(max(dot(R, S), 0.0), 180.0) * uSpec * 4.0 + pow(max(dot(R, S), 0.0), 20.0) * uSpec * 0.12;
  col += uSunCol * spec;
  // foam on crests (broken by noise)
  float fn = n2(vWorld.xz * 0.25 + vec2(uTime * 0.2, 0.0)) * 0.6 + n2(vWorld.xz * 1.3) * 0.4;
  float foam = smoothstep(0.78, 0.98, vFoam + (fn - 0.5) * 0.35) * uFoamAmt;
  col = mix(col, uFoam, foam * 0.85);
  // fog to horizon
  float dist = length(cameraPosition - vWorld); float fog = 1.0 - exp(-pow(dist / uFogDist, 1.6));
  col = mix(col, uFog, clamp(fog, 0.0, 1.0));
  col += vec3(0.75, 0.85, 1.0) * uFlash * (0.35 + fres * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const SKY_FS = `
uniform vec3 uSkyTop, uSkyMid, uSkyHor, uSunDir, uSunCol; uniform float uFlash, uTime, uClouds;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uSkyHor, uSkyMid, smoothstep(0.0, 0.25, y)); c = mix(c, uSkyTop, smoothstep(0.25, 0.9, y));
  vec3 S = normalize(uSunDir); float sd = max(dot(d, S), 0.0);
  c += uSunCol * (pow(sd, 600.0) * 2.0 + pow(sd, 12.0) * 0.25);
  if (uClouds > 0.0) { vec2 uv = d.xz / max(0.08, d.y + 0.15) * 0.7 + vec2(uTime * 0.01, 0.0);
    float cl = fbm(uv * 1.3); float m = smoothstep(0.42, 0.75, cl) * uClouds * smoothstep(-0.05, 0.15, d.y);
    vec3 cc = mix(uSkyMid * 0.55, uSkyHor * 1.1, fbm(uv * 2.0 + 3.0)); c = mix(c, cc, m); }
  c += vec3(0.8, 0.88, 1.0) * uFlash * 0.7;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

export function makeOcean(THREE, preset = OCEAN.storm, { size = 3000, segments = 384, clouds = 0.8 } = {}) {
  const P = { ...preset };
  const col = (c) => new THREE.Color(c).convertSRGBToLinear();
  const uW = []; for (let i = 0; i < 6; i++) uW.push(new THREE.Vector4(...(P.waves[i] || [0, 0, 1, 0])));
  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: P.amp }, uW: { value: uW }, uN: { value: P.waves.length },
    uDeep: { value: col(P.deep) }, uShallow: { value: col(P.shallow) }, uFoam: { value: col(P.foam) },
    uSkyTop: { value: col(P.sky[0]) }, uSkyMid: { value: col(P.sky[1]) }, uSkyHor: { value: col(P.sky[2]) },
    uFog: { value: col(P.fog) }, uFogDist: { value: P.fogDist }, uSunDir: { value: new THREE.Vector3(...P.sun).normalize() }, uSunCol: { value: col(P.sunColor) },
    uSpec: { value: P.spec }, uFoamAmt: { value: P.foamAmt }, uFlash: { value: 0 }, uClouds: { value: clouds },
  };
  const geo = new THREE.PlaneGeometry(size, size, segments, segments); geo.rotateX(-Math.PI / 2);
  // concentrate vertices near the centre (camera) for detail
  const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); const r = Math.hypot(x, z) / (size / 2); const k = Math.pow(r, 1.8) / Math.max(r, 1e-6); pa.setX(i, x * k); pa.setZ(i, z * k); }
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -1;
  const api = {
    mesh, sky, uniforms, preset: P,
    update(t) { uniforms.uTime.value = t; mesh.position.set(0, 0, 0); },
    set(o) { if (o.flash != null) uniforms.uFlash.value = o.flash; if (o.amp != null) uniforms.uAmp.value = o.amp; if (o.clouds != null) uniforms.uClouds.value = o.clouds; },
    /** surface height (approx, ignores horizontal displacement) — for buoyancy */
    heightAt(x, z, t) {
      let y = 0; const amp = uniforms.uAmp.value;
      for (const [dirA, steep, wl, ph] of P.waves) { const dx = Math.cos(dirA), dz = Math.sin(dirA); const k = (2 * Math.PI) / wl; const c = Math.sqrt(G / k); const a = steep / k; y += a * Math.sin(k * (dx * x + dz * z - c * t) + ph) * amp; }
      return y;
    },
    /** ship attitude from 4 sample points: returns { y, pitch, roll } */
    attitude(x, z, t, len = 120, beam = 24) {
      const f = this.heightAt(x + len / 2, z, t), b = this.heightAt(x - len / 2, z, t), l = this.heightAt(x, z + beam / 2, t), r = this.heightAt(x, z - beam / 2, t);
      return { y: (f + b + l + r) / 4, pitch: Math.atan2(f - b, len), roll: Math.atan2(l - r, beam) };
    },
  };
  return api;
}
