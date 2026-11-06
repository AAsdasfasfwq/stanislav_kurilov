# API & Workflow for segment authors

Project root: `/home/user/stanislav_kurilov`. Plain ES modules, no build step. Browser = Chromium (Puppeteer).
Canvas 1920×1080, 30 fps, everything is a **pure function of time** `t` (global film seconds).

## 0. Rules of the house (read twice)

1. **You own only `segments/<id>/`** (any files/sub-folders inside) and optionally `tools/tests/<id>-*.js` for sketches.
   **Never edit** `engine/`, `lib/`, `tools/*.mjs`, `docs/`, `segments/manifest.js`, `index.html`, `render.js`, `vendor/`, `assets/`.
   Need a variant of a shared helper? Copy it into your folder and adapt it. Found a bug in shared code? Work around it locally
   and report it in your final message.
2. **No git commands** (the director commits). No network installs.
3. **Determinism:** no `Math.random()`, no `Date`, no `performance.now()` in render code. Use `rng(seed)`, `hash()`, `noise*()`
   from `engine/math.js`. Simulations: `E.sim()` (fixed step). Same `t` → same pixels, in any order of frames.
4. **Performance budget** (SwiftShader, this 4-core box): average **≤ 350 ms/frame**, worst **≤ 1500 ms/frame** for your segment
   (`node tools/qa.mjs <id> --perf`). Cache heavy static art with `E.cache(key, () => canvas)` in `preload` or lazily.
   Use `ctx.filter = 'blur()'` sparingly (expensive on big areas); prefer pre-blurred cached sprites.
5. Your segment must render **every t in [start, end + 1.5]** without throwing (the tail is used by the next segment's hand-off).
   Before `start` you are never called.
6. All fonts via `F.*` constants (`engine/fonts.js`). Cyrillic only in Cyrillic-capable families (see BIBLE §3).
7. Keep files reasonably sized (split scenes into modules, e.g. `segments/s3/shots/*.js`).

## 1. Segment module contract — `segments/<id>/index.js`

```js
import { Sequence } from '../../engine/sequence.js';
import * as TR from '../../engine/transitions.js';
import * as Ease from '../../engine/ease.js';
import { kf, clamp01, lerp, spring, noise2, rng } from '../../engine/math.js';
import { F } from '../../engine/fonts.js';
import * as T from '../../engine/type.js';
import { cam25 } from '../../engine/camera.js';
import { bgGrad, volume, glow, rays, paperTexture, quadWarp } from '../../engine/draw.js';
import * as FX from '../../engine/fx.js';

const START = 342.4, END = 522.4;           // must match segments/manifest.js
const seq = new Sequence([
  { at: 342.40, draw: shotAtlas, in: TR.fromPrev(TR.wipe({ dur: 0.5, line: '#5cf2c4' })) }, // hand-off from previous segment
  { at: 345.90, draw: shotRoute },                                                     // hard cut
  { at: 351.90, draw: shotBlueprint, in: TR.circle({ x: 960, y: 540, dur: 0.6 }) },
  // …
], { end: END });

export default {
  async preload(E) { /* build caches, Three.js scenes: const T3 = await E.getThree(); */ },
  render(ctx, t, E) { seq.render(ctx, t, E); /* + global overlays/post for this segment */ },
  audio(A) { /* music & sfx in GLOBAL time — see §9 */ },
};

function shotAtlas(ctx, lt, S) {            // lt = seconds since shot start; S = { t, lt, dur, p, i, E, out }
  bgGrad(ctx, '#10263f', '#0b1620');
  // …
}
```
* A shot may be rendered past its own end (while the next shot transitions in) — keep it valid for `lt > dur`.
* `S.E.postSet({...})` inside a shot sets the film look for that frame (see §3). Post is reset every frame.

## 2. Engine object `E` (passed to render/preload/shots)
`E.W/H/FPS` · `E.t` · `E.frame` · `E.layer()` → `{canvas, ctx}` fresh transparent full-frame layer (pooled per frame) ·
`E.cache(key, build)` · `E.postSet(obj)` / `E.post` · `E.shake(amp=6, freq=9, seed, rot)` (camera shake via post) ·
`E.sim(key, t, t0, dt, init, step)` · `E.at('word', after)` → first time a word is spoken after `after` ·
`E.wordAt(t)` · `E.lineAt(t)` · `await E.getThree()` → `{ THREE, renderer, render(scene, camera, w=1920, h=1080) → canvas }`
(**drawImage the returned canvas immediately**; it is reused) · `E.drawPrev(ctx)` (used by `TR.fromPrev`).

## 3. Post look — `E.postSet({...})` keys (defaults in `engine/post.js`)
`exposure, contrast, saturation, temperature (-1 cold…+1 warm), tint, lift[3], gamma[3], gain[3], fadeBlacks, vignette, vignetteSoft,
grain, grainSize, ca, bloom, bloomThreshold, halation, distortion, shakeX/Y/Rot, zoom (final punch-in), flash + flashColor[3],
fade + fadeColor[3], blur (px, full-frame defocus), letterbox (0..1), scanlines, sepia`.

## 4. Sequence & transitions (`engine/sequence.js`, `engine/transitions.js`)
`new Sequence(shots, { end })` · shot `{ at, draw, in }`. Transitions (all `{dur, …}`):
`TR.fade · TR.dip({color}) · TR.flash({color:[r,g,b], peak}) · TR.blur · TR.wipe({angle, line, lineWidth, feather}) ·
TR.circle({x, y, ring, ringWidth, invert}) · TR.push({dir}) · TR.whip({dir}) · TR.zoomThrough({x, y}) · TR.ink({seed, scale}) ·
TR.water({up, foam, amp}) · TR.lightLeak({color}) · TR.slices({n, vertical}) · TR.glitch · TR.halftone({cell}) ·
TR.mask({maskFn(ctx, p, info)}) · TR.custom(dur, fn(ctx, A, B, p, info))` · wrap with `TR.fromPrev(...)` for the first shot.
Nested Sequences inside a shot are fine (sub-edits).

## 5. 2.5D camera (`engine/camera.js`)
```js
const cam = cam25(E, { aperture: 0.8, focus: 1000, fog: { color: '#0f2a3a', near: 1500, far: 6000, max: 0.6 } });
cam.x = kf(lt, [[0, -60], [4, 60]], Ease.inOut);  cam.y = …;  cam.z = 150 * Ease.out(p);  cam.zoom = 1.05;  cam.roll = 0.01;
cam.handheld(t, 2.5);
cam.plane(ctx, 6000, (c, k) => drawSky(c));      // far
cam.plane(ctx, 1000, (c) => drawHero(c));        // focal plane (sharp)
cam.plane(ctx, 450, (c) => drawForeground(c));   // near (blurred, fast parallax)
const p = cam.project(px, py, z);                // screen pos of a point on a plane
```
Author each plane at screen scale (as seen with the camera at rest). Planes closer than `cam.z + 20` are skipped (pass-through).

## 6. Drawing toolkit (`engine/draw.js`) — make everything volumetric
`smoothPath(pts, closed)` · `blob(cx,cy,rx,ry,{seed,wobble,t})` · `polyPath` · `roundRectPath` ·
`brush(ctx, pts, width|fn, {color, jitter})` tapered ink strokes · `taper(...)` ·
`volume(ctx, path, [x,y,w,h], {base, light, form, spec, rim, rimWidth, ao, tex, cel})` **form shading + rim for any shape** ·
`contactShadow(ctx, x, y, rx, ry, alpha)` · `castShadow(ctx, path, {dx, dy, blur, skewX})` · `glow(ctx, x, y, r, color, a)` ·
`rays(ctx, x, y, {angle, spread, n, length, color, alpha, t})` god rays · `hatch(ctx, path, bbox, {angle, spacing, cross})` engraving shading ·
`lin/rad(ctx, …stops)` · `bgGrad(ctx, top, bottom, mid)` · `quadWarp(ctx, img, [tl,tr,br,bl], n)` perspective-map any canvas (cards,
maps on tables, text on floors) · `cardQuad(cx, cy, w, h, rx, ry, rz, persp)` → quad of a 3D-rotated card ·
textures (cached): `paperTexture(w,h,{tone,seed,fibres,dirt})`, `noiseTexture(size,{scale,oct,seed})`, `grainTexture` ·
`overlay(ctx, tex, {mode, alpha, rect, tile})` · `halftone(ctx, srcCanvas, {cell, angle, color})` · `canvas(w,h)`.

## 7. Typography (`engine/type.js`)
`T.draw(ctx, str, x, y, {family, size, weight, style, tracking, align, fill, stroke, shadow})` ·
`T.reveal(ctx, str, x, y, p, {mode: 'rise'|'drop'|'blur'|'track'|'type'|'scramble'|'wipe'|'words'|'stamp', stagger, ease, …})` ·
`T.counter(ctx, value, x, y, {decimals, suffix, prefix, odometer, …})` · `T.onPath(ctx, str, pts, {offset, p})` ·
`T.label(ctx, str, anchorX, anchorY, labelX, labelY, p, {color, size, right})` leader-line annotation · `T.measure`, `T.glyphs`.

## 8. Particles & atmosphere (`engine/fx.js`)
`FX.rain(ctx, t, {n, speed, len, wind, color, alpha, layers})` · `FX.field(ctx, t, {n, vx, vy, turb, size, color, alpha, twinkle, glow, shape})`
(dust, plankton, embers, snow) · `FX.bubbles` · `FX.stars(ctx, t, {n, twinkle, rot, pole})` · `FX.fog(ctx, t, {color, alpha, scale, speed})` ·
`FX.lightning(ctx, t, t0, {x, y, x2, y2, seed})` → flash intensity · `FX.caustics(ctx, t, {rect, color, alpha})` · `FX.burst(ctx, t, t0, {x, y, n, …})` spray.

## 9. Math & easing
`engine/math.js`: `clamp lerp invLerp remap prog smoothstep fract mod hash rng(seed) noise1/2/3 fbm2/3 wob spring(t,freq,zeta) springTo jiggle
kf(t, [[time, value, ease?], …]) bezierPoint catmull polyLengths polyAt polySlice hex rgba mixColor shade oklch`.
`engine/ease.js`: `out hero std inn inOut soft back anticip … ep(t, start, dur, fn) env(t, start, end, in, out)`.

## 10. Characters (`lib/chars/rig.js`, `lib/chars/kurilov.js`)
```js
import { drawCharacter, pose, lerpPose, addPose, P, EXPR, LIGHT, idle, walk, swimCrawl, treadWater, blinkAt } from '../../lib/chars/rig.js';
import { CAST } from '../../lib/chars/kurilov.js';
const p = addPose(pose({ ...P.standRail, expr: 'determined', wind: 14 }), idle(t));
const out = drawCharacter(ctx, CAST.kurilov, p, { x: 960, y: 600, scale: 0.8, light: LIGHT.stormNight, outfit: 'deck', time: t });
// out.joints.head / lWrist / rToe … → screen positions to attach props, splashes, glows
```
* `x, y` = pelvis on screen; adult ≈ 760 px tall at scale 1 (head ≈ 145 px). Close-up: big scale (1.6–3) and a y below the frame.
* Pose fields: body `yaw pitch roll`; `spinePitch/Roll/Yaw`; `neckPitch headYaw headPitch headRoll`; per arm `l|rShoulderPitch/Roll/Yaw, l|rElbow, l|rWrist`;
  per leg `l|rHipPitch/Roll, l|rKnee, l|rAnkle`; `lHand/rHand` ('open','relaxed','fist','grip','point','claw','spread'); `gazeX gazeY blink breathe wind windY expr`.
* Expressions `EXPR`: neutral determined focused fear shock pain exhausted wonder anger smile sad smug stern sleep scream (blend with `lerpPose`).
* Key poses `P`: stand standRail lookBack readBook armsCrossed pointUp climbRail crouchJump leap feetFirst crawl lieDown sitDesk shrug facepalm salute.
* Cycles: `walk(t)`, `swimCrawl(t)`, `treadWater(t, effort)`, `idle(t)`. Turn characters with body `yaw` (head `headYaw` within ±1.1 of the body).
* Options: `light` (LIGHT preset), `outfit`, `mask: true|'up'`, `snorkel`, `wetHair`, `burn` (0..1), `stubble`, `tongue` (0..1 swollen), `hat`.
* Animate with springs/overlap: drive pose values with `springTo`/`jiggle`, add anticipation before big moves, delay hands & hair.
* Build environments around characters (deck, cabin, lounge, beach) yourself — with depth planes, contact shadows and matching light.

## 11. Ship, sea, maps
* **2D liner** (`lib/art/liner2d.js`): `drawLiner(ctx, {x, y (waterline), scale (1 → 1000 px long), facing, lights, t, style: 'illustration'|'blueprint'|'silhouette', roll, smoke})` ·
  `drawHullSection(ctx, {x, y, scale, bulges, style, p})` (midship section with the anti-roll bulges).
* **3D liner** (`lib/three/liner3d.js`): `makeLiner(THREE, {lights, bulges})` → `{ group, props, rail, sternRail (Vector3), setLights(k), update(t) }`
  (metres; origin midship waterline; +X bow, +Y up, stern rail at x≈−101.5, y≈12) · `makePropeller(THREE, {radius})`.
* **3D ocean** (`lib/three/ocean3d.js`): `makeOcean(THREE, OCEAN.storm|night|day|dawn|glassy, {clouds})` → `{ mesh, sky, update(t), set({flash, amp, clouds}), heightAt(x,z,t), attitude(x,z,t) }`.
  Example (renders in ~150–300 ms): see `tools/tests/ship3d.js`.
* **Maps** (`lib/art/maps.js` + `lib/art/geo-data.js`): `new View({type:'merc'|'eq'|'ortho', center, zoom (px/deg), x, y, rot, radius})` ·
  `view.project(lon, lat)` · `drawLand(ctx, rings, view, {fill, stroke, relief, shadow, coastGlow})` · `landPath` · `drawGraticule` ·
  `drawRoute(ctx, coords, view, p, {color, width, dash, head})` · `pin(ctx, x, y, p, {color, t})` · `distKm` · `ringNear(rings, lon, lat)` ·
  `makePlate(w, h, fn)` · `equirectPlate(rings, {w, h, land, sea})` (texture for a Three.js globe).
  Data: `WORLD` (110m), `PACIFIC` (50m), `PHILIPPINES_HI` (10m, includes Siargao), `USSR` (merged 15 republics), `COUNTRIES[name]`, `GALILEE`, `PLACES`, `CRUISE_ROUTE` (illustrative).

## 12. Audio (`engine/audio/kit.js`, `instruments.js`, `sfx.js`, `theory.js`) — all times GLOBAL
```js
import { chord, midi, grid, MOTIFS, playMotif, deg, voice } from '../../engine/audio/theory.js';
audio(A) {
  const { inst, sfx } = A;                         // buses: A.music, A.sfxBus, A.amb · reverbs: A.room A.plate A.hall A.space A.under
  const g = grid(96, 342.4);                       // bpm, t0 → g.beat(n), g.bar(n, beat)
  inst.pad(A.music, 342.4, 8, chord('Dm9', 3), { vel: 0.45, cutoff: 1200 });
  for (let b = 0; b < 32; b++) inst.stacc(A.music, g.beat(b) , b % 4 ? 'D3' : 'A2', { vel: 0.5 });
  playMotif(MOTIFS.FREEDOM, 'D4', g.bar(8), 96, (t, m, d) => inst.strings(A.music, t, d, m, { vel: 0.55 }));
  sfx.whoosh(346.1, { dur: 0.7 }); sfx.impact(381.2, { weight: 0.8 }); sfx.storm(410, 60, { intensity: 0.9 });
  A.automate(A.music.gain, [[400, 0.5], [404, 0.2]]);   // bus rides
}
```
* Instruments (bus first): `pad(bus,t,dur,notes,o) strings(bus,t,dur,note,o{section}) ensemble(bus,t,dur,notes,o) stacc(bus,t,note,o) brass choir(…,{vowel})
  epiano(bus,t,note,{dur}) bell(bus,t,note,{type:'celesta'|'glock'|'tubular'|'bowl'|'musicbox'}) sub bass reed(bayan/accordion) theremin(bus,t,dur,from,to)
  glass drone braam(≤3 per film!) pluck(bus,t,note,{body:'guitar'|'harp'|'balalaika'|'pizz'|'koto'}) piano marimba musicbox
  kick snare hat({open}) taiko({pitch}) tom timpani boom crash swell(bus, tEnd, dur) tick clap shaker`.
* SFX: `whoosh swish riser reverseSwell subDrop impact hit(t, note) tick click blip pop glitch scribble stamp typewriter(t, n, {rate, bell}) paper shutter
  waves(t,dur) wind rain storm thunder propeller shipHorn creak clink murmur splash bubbles underwater heartbeat sonar jailDoor gavel radio morse ring`.
* Levels are pre-calibrated (vel 0.6 ≈ −18 dBFS peak for a single melodic voice). Mind the sum: chords + drums + SFX add up.
  Check: `node tools/qa.mjs <id> --audio` (per-5 s peak/RMS + WAV at `out/qa/audio_<id>.wav`). Target peaks ≤ −10 dBFS, typical RMS −30…−22.
  You cannot listen: reason about harmony/rhythm in code, inspect levels, and keep the arrangement clean.

## 13. Your test loop
```bash
export CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
node render.js --stills 345.2,349.8,355.1                  # PNGs → out/stills/alone-in-the-ocean/t00345.20.png …
node render.js --sheet s3 --every 2                          # contact sheet → out/sheet_s3.jpg (6 per row, 1 frame / 2 s)
node render.js --from 380 --to 386 --workers 2               # short MP4 with audio → out/range_380-386.mp4
node tools/qa.mjs s3 --perf --frames 30                      # ms per frame
node tools/qa.mjs s3 --audio                                 # loudness windows
node tools/sketch.mjs tools/tests/s3-propeller.js 0,1,2      # isolated asset sketch → out/sketch/…
```
* Look at your stills with the Read tool. **Use a NEW file name for every look** (copy/rename) — the image viewer caches by path.
* Review like a director: contact sheet every ~2 s for rhythm and variety; stills at every key word for sync; check safe areas,
  overlaps, readability at phone size, AI-smell. Then fix and look again. Iterate until it is genuinely good.
* The machine is shared by 7 authors — keep test renders short (stills, sheets, ≤ 6 s clips).
