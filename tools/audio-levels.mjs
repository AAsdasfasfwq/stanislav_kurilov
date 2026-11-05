// Measures peak/RMS of each instrument & SFX voice in isolation (QA calibration).
// node tools/audio-levels.mjs   (CHROME_PATH=/path/to/chrome optional)
import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const port = srv.address().port;
const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] }); const pg = await b.newPage();
await pg.goto(`http://127.0.0.1:${port}/index.html?render=1`); await pg.waitForFunction('window.__READY===true');
const res = await pg.evaluate(async () => {
  const { renderSegmentAudio, stats } = await import('/engine/audio/kit.js');
  const { chord } = await import('/engine/audio/theory.js');
  const seg = { id: 'x', start: 0, end: 4 };
  const tests = {
    pad_Dm9: (A) => A.inst.pad(A.music, 0, 3, chord('Dm9', 3), { vel: 0.6 }),
    strings_A4: (A) => A.inst.strings(A.music, 0, 3, 'A4', { vel: 0.6 }),
    ensemble_Dm: (A) => A.inst.ensemble(A.music, 0, 3, [38, 50, 57, 62, 65, 69], { vel: 0.6 }),
    stacc_D3: (A) => A.inst.stacc(A.music, 0, 'D3', { vel: 0.6 }),
    brass_D3: (A) => A.inst.brass(A.music, 0, 2, 'D3', { vel: 0.6 }),
    choir_D4: (A) => A.inst.choir(A.music, 0, 3, 'D4', { vel: 0.6 }),
    epiano_F4: (A) => A.inst.epiano(A.music, 0, 'F4', { vel: 0.6 }),
    bell_celesta: (A) => A.inst.bell(A.music, 0, 'A5', { vel: 0.6 }),
    sub_D2: (A) => A.inst.sub(A.music, 0, 2, 'D2', { vel: 0.6 }),
    bass_D2: (A) => A.inst.bass(A.music, 0, 1, 'D2', { vel: 0.6 }),
    reed_A4: (A) => A.inst.reed(A.music, 0, 1, 'A4', { vel: 0.6 }),
    theremin: (A) => A.inst.theremin(A.music, 0, 2, 'A4', 'D5', { vel: 0.6 }),
    glass_A5: (A) => A.inst.glass(A.music, 0, 2, 'A5', { vel: 0.6 }),
    drone_D2: (A) => A.inst.drone(A.music, 0, 3, 'D2', { vel: 0.6, attack: 0.5 }),
    braam_D2: (A) => A.inst.braam(A.music, 0, 2, 'D2', { vel: 0.6 }),
    pluck_guitar: (A) => A.inst.pluck(A.music, 0, 'A3', { vel: 0.6 }),
    piano_F4: (A) => A.inst.piano(A.music, 0, 'F4', { vel: 0.6 }),
    marimba_C5: (A) => A.inst.marimba(A.music, 0, 'C5', { vel: 0.6 }),
    kick: (A) => A.inst.kick(A.music, 0, { vel: 0.6 }), snare: (A) => A.inst.snare(A.music, 0, { vel: 0.6 }),
    taiko: (A) => A.inst.taiko(A.music, 0, { vel: 0.6 }), timpani: (A) => A.inst.timpani(A.music, 0, 'D2', { vel: 0.6 }),
    boom: (A) => A.inst.boom(A.music, 0, { vel: 0.6 }), crash: (A) => A.inst.crash(A.music, 0, { vel: 0.6 }),
    whoosh: (A) => A.sfx.whoosh(0, {}), impact: (A) => A.sfx.impact(0, {}), riser: (A) => A.sfx.riser(0, { dur: 2 }),
    subDrop: (A) => A.sfx.subDrop(0, {}), tick: (A) => A.sfx.tick(0, {}), typewriter: (A) => A.sfx.typewriter(0, 10),
    stamp: (A) => A.sfx.stamp(0, {}), storm: (A) => A.sfx.storm(0, 3, {}), waves: (A) => A.sfx.waves(0, 3, {}),
    propeller: (A) => A.sfx.propeller(0, 3, {}), shipHorn: (A) => A.sfx.shipHorn(0, {}), splash: (A) => A.sfx.splash(0, {}),
    thunder: (A) => A.sfx.thunder(0, {}), murmur: (A) => A.sfx.murmur(0, 3, {}), underwater: (A) => A.sfx.underwater(0, 3, {}),
    heartbeat: (A) => A.sfx.heartbeat(0, {}), jailDoor: (A) => A.sfx.jailDoor(0, {}), creak: (A) => A.sfx.creak(0, {}),
  };
  const out = {};
  for (const [k, fn] of Object.entries(tests)) { const buf = await renderSegmentAudio({ audio: fn }, seg); const s = stats(buf); out[k] = [s.peakDb.toFixed(1), s.rmsDb.toFixed(1)]; }
  return out;
});
for (const [k, [p, r]] of Object.entries(res)) console.log(k.padEnd(16), 'peak', p.padStart(6), ' rms', r.padStart(6));
await b.close(); srv.close();
