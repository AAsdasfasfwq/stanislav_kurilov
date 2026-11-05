// Segment QA:  node tools/qa.mjs s3 [--audio] [--perf] [--frames 24]
//  --audio : renders the segment's music+sfx offline, prints peak/RMS per 5 s window, writes out/qa/audio_s3.wav
//  --perf  : renders N evenly spaced frames, prints ms/frame (avg / max) and the slowest times
// (CHROME_PATH=/path/to/chrome optional)
import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const seg = args[0]; const has = (k) => args.includes(k); const nF = +(args[args.indexOf('--frames') + 1] || 24);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(r); }).listen(0);
const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1920, height: 1080 } });
const pg = await b.newPage(); pg.on('pageerror', (e) => console.log('[page error]', e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text().slice(0, 300)); });
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?render=1`); await pg.waitForFunction('window.__READY===true', { timeout: 120000 });
const info = await pg.evaluate((id) => window.__RENDER.segments.find((s) => s.id === id), seg);
if (!info) { console.log('unknown segment', seg); process.exit(1); }
const failed = await pg.evaluate((a, c) => window.__RENDER.prepare(a, c), info.start, info.end);
if (failed.length) console.log('FAILED TO LOAD:', failed);
fs.mkdirSync(path.join(ROOT, 'out', 'qa'), { recursive: true });
if (has('--perf')) {
  const res = await pg.evaluate(async (s, e, n) => { const out = []; for (let i = 0; i < n; i++) { const t = s + ((i + 0.5) / n) * (e - s); const t0 = performance.now(); window.__RENDER.frame(t); await new Promise((r) => requestAnimationFrame(r)); out.push([t, performance.now() - t0]); } return out; }, info.start, info.end, nF);
  const ms = res.map((r) => r[1]); console.log(`perf ${seg}: avg ${(ms.reduce((a, c) => a + c, 0) / ms.length).toFixed(0)} ms · max ${Math.max(...ms).toFixed(0)} ms`);
  res.sort((a, c) => c[1] - a[1]).slice(0, 5).forEach(([t, m]) => console.log(`  slow @${t.toFixed(2)}s: ${m.toFixed(0)} ms`));
}
if (has('--audio')) {
  const out = await pg.evaluate(async (id) => {
    const { renderSegmentAudio, toWav } = await import('/engine/audio/kit.js');
    const s = window.__RENDER.segments.find((x) => x.id === id); const { E } = await import('/engine/core.js'); const mod = await E.loadSegment(id);
    const buf = await renderSegmentAudio(mod, s); const win = []; const step = buf.sampleRate * 5;
    for (let o = 0; o < buf.length; o += step) { let pk = 0, sum = 0, n = 0; for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = o; i < Math.min(buf.length, o + step); i += 2) { const a = Math.abs(d[i]); if (a > pk) pk = a; sum += d[i] * d[i]; n++; } } win.push([s.start + o / buf.sampleRate, 20 * Math.log10(pk + 1e-9), 10 * Math.log10(sum / Math.max(1, n) + 1e-12)]); }
    const wav = new Uint8Array(toWav(buf)); let bin = ''; for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
    return { win, b64: btoa(bin) };
  }, seg);
  fs.writeFileSync(path.join(ROOT, 'out', 'qa', `audio_${seg}.wav`), Buffer.from(out.b64, 'base64'));
  console.log(`audio ${seg}: window peak/rms dBFS (target: peaks ≤ −10, typical rms −30…−22, never silent > 6 s unless intended)`);
  for (const [t, p, r] of out.win) console.log(`  ${t.toFixed(1).padStart(7)}s  peak ${p.toFixed(1).padStart(6)}  rms ${r.toFixed(1).padStart(6)}  ${'█'.repeat(Math.max(0, Math.round((r + 60) / 2)))}`);
}
await b.close(); srv.close();
