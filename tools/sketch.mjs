// Render stills of an isolated sketch module (asset development & QA).
//   node tools/sketch.mjs tools/tests/chars.js 0,1.5,3 [outPrefix]
// The module exports draw(ctx, t, E) (+ optional async preload(E)). Output: out/sketch/<name>_t<time>.png
import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [modPath, timesArg = '0', prefix] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(r); }).listen(0);
const port = srv.address().port;
const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1920, height: 1080 } });
const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('[page error]', e.message)); pg.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await pg.goto(`http://127.0.0.1:${port}/tools/sketch.html?mod=/${modPath.replace(/^\.?\//, '')}`); await pg.waitForFunction('window.__READY===true', { timeout: 120000 });
const outDir = path.join(ROOT, 'out', 'sketch'); fs.mkdirSync(outDir, { recursive: true });
const name = prefix || path.basename(modPath, '.js');
for (const t of timesArg.split(',').map(Number)) { await pg.evaluate((x) => window.__draw(x), t); const f = path.join(outDir, `${name}_t${t.toFixed(2)}.png`); await pg.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); console.log(f); }
await b.close(); srv.close();
