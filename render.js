#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  render.js — renders the film frame-by-frame with Puppeteer + ffmpeg.
//
//    npm install            (installs puppeteer + its Chrome)
//    node render.js                         # whole film → out/alone-in-the-ocean.mp4
//    node render.js --segment s3            # one segment (+ its audio)
//    node render.js --from 340 --to 360     # any range (seconds)
//    node render.js --workers 6             # parallel browsers (default: CPU/2, max 8)
//    node render.js --stills 12.5,48,301    # PNG stills into out/stills/
//    node render.js --sheet s3 --every 2    # contact sheet of a segment
//    node render.js --audio-only            # just the mixed soundtrack (wav)
//
//  Options: --out <file> --crf 16 --preset slow --format jpeg|png --quality 95
//           --gpu (hardware WebGL; default is SwiftShader for determinism)
//           --chrome <path> (custom Chrome/Chromium) --keep (keep chunk files)
//           --no-audio  --no-duck  --music-db 0 (trim music+sfx bed level)
//  Requires ffmpeg in PATH (or FFMPEG=/path/to/ffmpeg).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const argv = parseArgs(process.argv.slice(2));

function parseArgs(a) {
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v; }
    else o._.push(a[i]);
  }
  return o;
}
const log = (...m) => console.log(`[render ${new Date().toISOString().slice(11, 19)}]`, ...m);

// ── static server ────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const p = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// ── browser ─────────────────────────────────────────────────────────────────
async function launch() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) {
    try { puppeteer = require('puppeteer-core'); } catch (e2) { console.error('Puppeteer is not installed. Run:  npm install'); process.exit(1); }
  }
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio'];
  if (argv.gpu) args.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default');
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  const opts = { headless: true, args, defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, protocolTimeout: 0 };
  const exe = argv.chrome || process.env.CHROME_PATH; if (exe) opts.executablePath = exe;
  return puppeteer.launch(opts);
}
async function openPage(browser, port) {
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') console.log(`  [page ${t}]`, m.text().slice(0, 400)); });
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__READY === true', { timeout: 180000 });
  return page;
}

// ── helpers ─────────────────────────────────────────────────────────────────
function ffmpeg(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [opts.stdin ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', reject); p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg exited ' + c))));
    if (opts.onSpawn) opts.onSpawn(p);
  });
}
function manifest() {
  const src = fs.readFileSync(path.join(ROOT, 'segments/manifest.js'), 'utf8');
  const num = (k) => parseFloat(new RegExp(`export const ${k} = ([\\d.]+)`).exec(src)[1]);
  const segs = [...src.matchAll(/\{ id: '(s\d+)', start: ([\d.]+),\s*end: ([\w.]+)/g)].map((m) => ({ id: m[1], start: parseFloat(m[2]), end: m[3] === 'DURATION' ? num('DURATION') : parseFloat(m[3]) }));
  return { FPS: num('FPS'), DURATION: num('DURATION'), SEGMENTS: segs };
}

async function main() {
  if (spawnSync(FFMPEG, ['-version']).status !== 0) { console.error('ffmpeg not found (set FFMPEG=/path/to/ffmpeg)'); process.exit(1); }
  const M = manifest(); const FPS = M.FPS;
  let from = 0, to = M.DURATION, label = 'alone-in-the-ocean';
  const segArg = argv.segment || argv.sheet;
  if (segArg && segArg !== true) { const s = M.SEGMENTS.find((x) => x.id === segArg); if (!s) throw new Error('unknown segment ' + segArg); from = s.start; to = s.end; label = s.id; }
  if (argv.from != null) from = parseFloat(argv.from);
  if (argv.to != null) to = parseFloat(argv.to);
  if (argv.from != null || argv.to != null) label = `range_${from}-${to}`;
  const outDir = path.join(ROOT, 'out'); const work = path.join(outDir, '.work', label); fs.mkdirSync(work, { recursive: true });
  const outFile = argv.out ? path.resolve(argv.out) : path.join(outDir, `${label}.mp4`);
  const { srv, port } = await serve();
  log(`server :${port} · range ${from.toFixed(2)}–${to.toFixed(2)} s`);

  try {
    // ── stills / contact sheet ─────────────────────────────────────────────
    if (argv.stills || argv.sheet) {
      const times = argv.stills ? String(argv.stills).split(',').map(parseFloat)
        : (() => { const ev = parseFloat(argv.every || 2); const a = []; for (let t = from + 0.5; t < to; t += ev) a.push(+t.toFixed(3)); return a; })();
      const dir = path.join(outDir, 'stills', label); fs.mkdirSync(dir, { recursive: true });
      const browser = await launch(); const page = await openPage(browser, port);
      const failed = await page.evaluate((a, b) => window.__RENDER.prepare(a, b), Math.min(...times), Math.max(...times));
      if (failed.length) log('segments failed to load:', failed.join(','));
      const files = [];
      for (const t of times) {
        await page.evaluate((x) => window.__RENDER.frame(x), t);
        const f = path.join(dir, `t${t.toFixed(2).padStart(8, '0')}.png`);
        await page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); files.push(f);
      }
      await browser.close();
      if (argv.sheet) {
        const cols = 6; const list = path.join(dir, 'list.txt');
        fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
        await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=480:-1,tile=${cols}x${Math.ceil(files.length / cols)}`, '-frames:v', '1', path.join(outDir, `sheet_${label}.jpg`)]);
        log('sheet →', path.join(outDir, `sheet_${label}.jpg`));
      } else log(`${files.length} stills → ${dir}`);
      return;
    }

    // ── audio ───────────────────────────────────────────────────────────────
    let mixWav = null;
    if (!argv['no-audio']) {
      const segs = M.SEGMENTS.filter((s) => s.end + 4 > from && s.start < to);
      const browser = await launch(); const page = await openPage(browser, port);
      await page.exposeFunction('__saveChunk', (name, b64, first) => {
        const f = path.join(work, name); const buf = Buffer.from(b64, 'base64');
        if (first) fs.writeFileSync(f, buf); else fs.appendFileSync(f, buf); return true;
      });
      const stems = [];
      for (const s of segs) {
        log(`audio ${s.id}: synthesizing music & sfx…`);
        const r = await page.evaluate((id) => window.__RENDER.audio(id), s.id);
        if (r.empty) { log(`  ${s.id}: no audio() defined`); continue; }
        log(`  ${s.id}: peak ${r.peakDb.toFixed(1)} dBFS · rms ${r.rmsDb.toFixed(1)} dBFS`);
        stems.push({ file: path.join(work, `audio_${s.id}.wav`), start: s.start });
      }
      await browser.close();
      mixWav = path.join(work, 'mix.wav');
      const dur = to - from; const musicGain = Math.pow(10, parseFloat(argv['music-db'] || 0) / 20);
      const inputs = ['-i', path.join(ROOT, 'assets/voiceover.mp3')]; stems.forEach((s) => inputs.push('-i', s.file));
      const parts = [`[0:a]atrim=start=${from}:end=${to},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${dur}[vo]`];
      stems.forEach((s, i) => {
        const off = s.start - from;
        parts.push(off >= 0 ? `[${i + 1}:a]aresample=48000,adelay=${Math.round(off * 1000)}:all=1,volume=${musicGain}[m${i}]`
          : `[${i + 1}:a]aresample=48000,atrim=start=${-off},asetpts=PTS-STARTPTS,volume=${musicGain}[m${i}]`);
      });
      if (stems.length) {
        parts.push(`${stems.map((_, i) => `[m${i}]`).join('')}amix=inputs=${stems.length}:normalize=0:duration=longest,apad=whole_dur=${dur}[bed]`);
        if (argv['no-duck']) parts.push('[vo][bed]amix=inputs=2:normalize=0:duration=first[mx]');
        else parts.push('[vo]asplit=2[vo1][vo2]', '[bed][vo2]sidechaincompress=threshold=0.035:ratio=3.5:attack=25:release=520:knee=4[duck]', '[vo1][duck]amix=inputs=2:normalize=0:duration=first[mx]');
      } else parts.push('[vo]anull[mx]');
      parts.push(`[mx]loudnorm=I=-14:TP=-1.5:LRA=13,atrim=0:${dur}[out]`);
      log('mixing soundtrack (duck + loudnorm −14 LUFS)…');
      await ffmpeg([...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', mixWav]);
      if (argv['audio-only']) { const o = outFile.replace(/\.mp4$/, '.wav'); fs.copyFileSync(mixWav, o); log('soundtrack →', o); return; }
    }

    // ── video ───────────────────────────────────────────────────────────────
    const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS); const total = f1 - f0;
    const workers = Math.max(1, Math.min(parseInt(argv.workers || Math.min(8, Math.max(1, Math.floor(os.cpus().length / 2))), 10), Math.ceil(total / 60)));
    const fmt = argv.format === 'png' ? 'png' : 'jpeg'; const quality = parseInt(argv.quality || 95, 10);
    const crf = String(argv.crf || 16); const preset = String(argv.preset || 'medium');
    log(`video: ${total} frames @${FPS}fps · ${workers} worker(s) · ${fmt}`);
    const chunks = []; const per = Math.ceil(total / workers);
    for (let w = 0; w < workers; w++) { const a = f0 + w * per, b = Math.min(f1, a + per); if (a < b) chunks.push({ w, a, b, file: path.join(work, `chunk_${String(w).padStart(2, '0')}_${a}_${b}.mp4`) }); }
    let done = 0; const t0 = Date.now();
    const progress = () => { const el = (Date.now() - t0) / 1000; const fps = done / el; const eta = (total - done) / Math.max(0.01, fps);
      process.stdout.write(`\r  ${done}/${total} frames · ${fps.toFixed(2)} fps · ETA ${Math.floor(eta / 60)}m${String(Math.floor(eta % 60)).padStart(2, '0')}s   `); };
    await Promise.all(chunks.map(async (c) => {
      if (fs.existsSync(c.file + '.done')) { done += c.b - c.a; return; }
      const browser = await launch(); const page = await openPage(browser, port);
      const failed = await page.evaluate((a, b) => window.__RENDER.prepare(a, b), c.a / FPS, c.b / FPS);
      if (failed.length) log(`\n  worker ${c.w}: segments failed to load: ${failed.join(',')} (placeholder cards will render)`);
      const cdp = await page.target().createCDPSession();
      let ff; const fin = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', fmt === 'png' ? 'png' : 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', c.file], { stdin: true, onSpawn: (p) => (ff = p) });
      for (let f = c.a; f < c.b; f++) {
        await page.evaluate((x) => window.__RENDER.frame(x), f / FPS);
        const shot = await cdp.send('Page.captureScreenshot', { format: fmt, quality: fmt === 'jpeg' ? quality : undefined, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, optimizeForSpeed: true });
        const buf = Buffer.from(shot.data, 'base64');
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        done++; if (done % 10 === 0) progress();
      }
      ff.stdin.end(); await fin; await browser.close(); fs.writeFileSync(c.file + '.done', 'ok');
    }));
    progress(); process.stdout.write('\n');
    const list = path.join(work, 'chunks.txt'); fs.writeFileSync(list, chunks.map((c) => `file '${c.file}'`).join('\n'));
    const silent = path.join(work, 'video.mp4');
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    if (mixWav) await ffmpeg(['-i', silent, '-i', mixWav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(total / FPS), '-movflags', '+faststart', outFile]);
    else fs.copyFileSync(silent, outFile);
    log('done →', outFile);
    if (!argv.keep) for (const c of chunks) { try { fs.unlinkSync(c.file); fs.unlinkSync(c.file + '.done'); } catch (e) { /* ignore */ } }
  } finally { srv.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
