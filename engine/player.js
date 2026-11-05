// ─────────────────────────────────────────────────────────────────────────────
//  engine/player.js — preview transport (browser) + render bridge (Puppeteer).
//
//  Preview:  open index.html via a static server (npm run preview).
//    space play/pause · ←/→ ±1 s (shift ±5 s) · ,/. ±1 frame · 1–7 jump to segment
//    G safe-area guides · M mute music · URL: #t=346.5   ?seg=s3 (loads only s3)
//  Render:   index.html?render=1 exposes window.__RENDER (used by render.js)
// ─────────────────────────────────────────────────────────────────────────────
import { E } from './core.js';
import { SEGMENTS, DURATION, FPS, TAIL } from '../segments/manifest.js';
import { renderSegmentAudio, toWav, stats } from './audio/kit.js';

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const $ = (id) => document.getElementById(id);
if (RENDER) document.body.classList.add('render');

await E.boot({ mode: RENDER ? 'render' : 'preview', outCanvas: $('out') });

if (RENDER) {
  window.__RENDER = {
    duration: DURATION, fps: FPS, segments: SEGMENTS.map((s) => ({ ...s })),
    async prepare(t0, t1) { await E.ensureRange(t0, t1); return [...E.failed.keys()]; },
    frame(t) { E.renderAt(t); return E.frame; },
    /** render a segment's music+sfx; streams WAV to node via window.__saveChunk(name, b64, first, last) */
    async audio(id) {
      const seg = SEGMENTS.find((s) => s.id === id);
      const mod = await E.loadSegment(id);
      if (!mod || !mod.audio) return { id, empty: true };
      const buf = await renderSegmentAudio(mod, seg);
      const st = stats(buf);
      const wav = new Uint8Array(toWav(buf));
      const CH = 3 * 1024 * 1024;
      for (let o = 0; o < wav.length; o += CH) {
        const part = wav.subarray(o, Math.min(wav.length, o + CH));
        let bin = ''; for (let i = 0; i < part.length; i += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000));
        await window.__saveChunk(`audio_${id}.wav`, btoa(bin), o === 0, o + CH >= wav.length);
      }
      return { id, start: seg.start, ...st };
    },
  };
  window.__READY = true;
} else {
  // ── preview UI ───────────────────────────────────────────────────────────
  const only = params.get('seg');
  let t = 0;
  const hashT = /t=([\d.]+)/.exec(location.hash);
  if (only) t = SEGMENTS.find((s) => s.id === only)?.start ?? 0;
  if (hashT) t = parseFloat(hashT[1]);
  const track = $('track'), head = $('head');
  for (const s of SEGMENTS) {
    const d = document.createElement('div'); d.className = 'seg'; d.id = 'seg-' + s.id;
    d.style.left = (s.start / DURATION) * 100 + '%'; d.style.width = ((s.end - s.start) / DURATION) * 100 + '%';
    d.textContent = `${s.id} · ${s.title}`; d.title = `${s.id}  ${s.start}–${s.end}s  ${s.title}`; track.appendChild(d);
  }
  const vo = new Audio('./assets/voiceover.mp3'); vo.preload = 'auto';
  let playing = false, guides = false, musicOn = true;
  let actx = null, musicGain = null; const buffers = new Map(); const sources = [];
  const status = (s) => ($('status').textContent = s);

  async function load(range0, range1) {
    status('loading segments…');
    if (only) await E.ensureRange(SEGMENTS.find((s) => s.id === only).start, SEGMENTS.find((s) => s.id === only).end);
    else await E.ensureRange(range0, range1);
    for (const s of SEGMENTS) $('seg-' + s.id).classList.toggle('missing', !E.modules.has(s.id));
    status(E.failed.size ? `failed: ${[...E.failed.keys()].join(',')}` : 'ready');
  }
  function draw() {
    E.renderAt(t);
    head.style.left = (t / DURATION) * 100 + '%';
    const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0');
    $('tc').textContent = `${m}:${s}  f${Math.round(t * FPS)}`;
    const line = E.lineAt(t); $('line').textContent = line ? line.text : '';
    const g = $('guides').getContext('2d'); g.clearRect(0, 0, 1920, 1080);
    if (guides) { g.strokeStyle = 'rgba(92,242,196,0.6)'; g.lineWidth = 2; g.strokeRect(96, 54, 1728, 972); g.strokeStyle = 'rgba(232,67,46,0.6)'; g.strokeRect(192, 108, 1536, 864);
      g.beginPath(); g.moveTo(640, 0); g.lineTo(640, 1080); g.moveTo(1280, 0); g.lineTo(1280, 1080); g.moveTo(0, 360); g.lineTo(1920, 360); g.moveTo(0, 720); g.lineTo(1920, 720); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.stroke(); }
  }
  async function segBuffer(seg) {
    if (buffers.has(seg.id)) return buffers.get(seg.id);
    const p = (async () => { const mod = await E.loadSegment(seg.id); if (!mod || !mod.audio) return null; status(`rendering audio ${seg.id}…`);
      const b = await renderSegmentAudio(mod, seg); const st = stats(b); status(`audio ${seg.id} peak ${st.peakDb.toFixed(1)} dB`); return b; })();
    buffers.set(seg.id, p); return p;
  }
  function stopMusic() { while (sources.length) { try { sources.pop().stop(); } catch (e) { /* noop */ } } }
  async function startMusic() {
    if (!musicOn) return;
    if (!actx) { actx = new AudioContext({ sampleRate: 48000 }); musicGain = actx.createGain(); musicGain.connect(actx.destination); }
    await actx.resume(); stopMusic();
    const segs = SEGMENTS.filter((s) => s.end + 4 > t && (!only || s.id === only));
    for (const s of segs) {
      segBuffer(s).then((buf) => {
        if (!buf || !playing) return;
        const now = vo.currentTime; const src = actx.createBufferSource(); src.buffer = buf; src.connect(musicGain);
        const off = now - s.start;
        if (off >= 0) { if (off < buf.duration) src.start(actx.currentTime, off); } else src.start(actx.currentTime - off);
        sources.push(src);
      });
    }
  }
  async function play() {
    if (playing) return; playing = true; $('play').textContent = '❚❚ pause';
    vo.currentTime = t; await vo.play().catch(() => {}); startMusic();
    const loop = () => { if (!playing) return; t = vo.currentTime; if (only) { const s = SEGMENTS.find((x) => x.id === only); if (t > s.end + TAIL) { pause(); return; } } draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  function pause() { playing = false; vo.pause(); stopMusic(); $('play').textContent = '▶ play'; t = vo.currentTime || t; draw(); }
  async function seek(nt) { t = Math.max(0, Math.min(DURATION, nt)); history.replaceState(null, '', `#t=${t.toFixed(2)}`);
    if (!only) await load(t - 1, t + 1); if (playing) { vo.currentTime = t; startMusic(); } draw(); }
  $('play').onclick = () => (playing ? pause() : play());
  track.onclick = (e) => { const r = track.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * DURATION); };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') seek(t + (e.shiftKey ? 5 : 1));
    else if (e.key === 'ArrowLeft') seek(t - (e.shiftKey ? 5 : 1));
    else if (e.key === '.') seek(t + 1 / FPS);
    else if (e.key === ',') seek(t - 1 / FPS);
    else if (e.key === 'g' || e.key === 'G') { guides = !guides; draw(); }
    else if (e.key === 'm' || e.key === 'M') { musicOn = !musicOn; if (!musicOn) stopMusic(); else if (playing) startMusic(); status(musicOn ? 'music on' : 'music muted'); }
    else if (/^[1-7]$/.test(e.key)) seek(SEGMENTS[+e.key - 1].start);
  });
  await load(t - 1, t + 1); draw();
  window.__E = E; // console access
}
