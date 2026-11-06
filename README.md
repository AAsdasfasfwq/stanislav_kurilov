# ALONE IN THE OCEAN — documentary motion-design film (source project)

A 20-minute (1226 s) documentary film about Soviet oceanographer **Stanislav Kurilov**, built entirely in code:
Canvas 2D illustration & motion graphics, a 2.5D multiplane camera, Three.js 3D (the liner *Sovetsky Soyuz*,
a Gerstner storm ocean, propellers, globe), a WebGL film/lens post pass, and a procedurally synthesized score
and sound design (Web Audio API). Every frame is a pure function of time, so the film renders deterministically
frame-by-frame with **Puppeteer**.

* Format: 1920×1080, 16:9, 30 fps, H.264 + AAC 320 kbps, loudness −14 LUFS (YouTube).
* Voice-over: `assets/voiceover.mp3`, timing: `assets/transcript.json`.

## Requirements
* Node.js ≥ 18
* ffmpeg in `PATH` (or `FFMPEG=/path/to/ffmpeg`)
* `npm install` (downloads Puppeteer + its Chrome). To use an existing Chrome/Chromium: `CHROME_PATH=/path/to/chrome` or `--chrome <path>`.

## Render
```bash
npm install
```
```bash
node render.js
```
Output: `out/alone-in-the-ocean.mp4`. The renderer
1. synthesizes the music & sound design of each segment offline in the browser (Web Audio `OfflineAudioContext`),
2. mixes it under the voice-over (side-chain ducking) and normalises to −14 LUFS / −1.5 dBTP,
3. renders all 36 780 frames in parallel browser workers, encodes chunks with x264 (CRF 16) and concatenates them.

Useful options:
```bash
node render.js --workers 8            # parallel Chrome instances (default: CPU cores / 2, max 8)
```
```bash
node render.js --gpu                  # hardware WebGL (faster; default is SwiftShader for bit-exact determinism)
```
```bash
node render.js --segment s3           # render one segment (s1 … s7) with its audio
```
```bash
node render.js --from 470 --to 500    # any time range in seconds
```
```bash
node render.js --sheet s4 --every 2   # contact sheet of a segment → out/sheet_s4.jpg
```
```bash
node render.js --stills 12.5,97,480   # PNG stills → out/stills/
```
```bash
node render.js --audio-only           # just the mixed soundtrack (WAV)
```
Other flags: `--crf 16 --preset slow --format png|jpeg --quality 95 --keep --no-audio --no-duck --music-db -2`.
Interrupted renders resume: finished chunks are kept in `out/.work/` and skipped on the next run.

Rendering time depends heavily on the machine: with software WebGL count on roughly 0.3–1 s per frame per worker;
`--gpu` and more workers speed it up considerably.

## Preview in the browser
```bash
npm run preview
```
Open `http://localhost:8080/` — space: play/pause · ←/→: ±1 s (shift ±5 s) · `,` `.`: ±1 frame · 1–7: jump to a segment ·
G: safe-area guides · M: mute music. URL options: `?seg=s3` (load one segment only), `#t=480.5` (start time).
The score is synthesized when you press play (a few seconds per segment).

## Structure
```
engine/            deterministic frame engine, sequence/transitions, 2.5D camera, drawing, typography, particles, post FX
engine/audio/      offline audio kit, synthesized orchestra, procedural SFX, leitmotifs
lib/chars/         2.5D character rig (3D skeleton, cel-shaded illustration) + cast (Kurilov, Cousteau, …)
lib/art/           2D liner, maps (Natural Earth data), geo data
lib/three/         3D liner model, Gerstner ocean & sky
segments/s1…s7/    the film, ~3 minutes per segment (each with its own BEATS.md, shots, music & sound)
docs/              art-direction bible, director's plan, API, skills digest, per-segment transcripts
tools/             preview server, QA (perf/audio), sketch harness, geo-data builder
render.js          Puppeteer + ffmpeg renderer
```

## Credits & licenses
* Map data: Natural Earth (public domain) via `world-atlas`.
* Fonts (SIL Open Font License): Dela Gothic One, Instrument Serif, Unbounded, IBM Plex Mono, Big Shoulders Display,
  Alumni Sans, Caveat, Old Standard TT, Special Elite, PT Mono.
* Three.js (MIT).
