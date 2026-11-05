// ─────────────────────────────────────────────────────────────────────────────
//  engine/audio/sfx.js — procedural sound design (A.sfx.*). GLOBAL film times.
//  Every SFX defaults to the SFX bus at a level that sits UNDER the narrator.
//  opts common: vel (0..1, default 0.6), pan, send, sendAmt, bus.
//
//  TRANSITIONS: whoosh · swish · riser · reverseSwell · subDrop · impact · hit (tonal)
//  UI / GRAPHIC: tick · click · blip · pop · glitch · scribble · stamp · typewriter · paper · shutter
//  WORLD:       waves · storm · wind · rain · thunder · propeller · shipHorn · creak · clink · murmur
//               splash · bubbles · underwater · heartbeat · sonar · jailDoor · gavel · radio · morse · ring
// ─────────────────────────────────────────────────────────────────────────────
import { rng } from '../math.js';

export class SFX {
  constructor(A) { this.A = A; this.ac = A.ac; this.sr = A.sr; this._s = 1; }
  _out(node, o, defSend = null, defAmt = 0.2) {
    return this.A.route(node, { bus: o.bus || this.A.sfxBus, pan: o.pan || 0, send: o.send === undefined ? defSend : o.send, sendAmt: o.sendAmt ?? defAmt, gain: o.gain ?? 1 });
  }
  _v(o, d = 0.6) { const v = o.vel ?? d; return Math.pow(v, 1.4); }
  _noise(g, dur) { return this.A.noiseSource(g, dur, { offset: (this._s++ * 0.731) % 3 }); }
  _filt(type, f, q = 1) { const b = this.ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  _gain(v = 0) { const g = this.ac.createGain(); g.gain.value = v; return g; }
  _osc(type, f, g, dur) { const o = this.ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(this.A.t(g)); o.stop(this.A.t(g + dur) + 0.05); return o; }

  // ── transitions ────────────────────────────────────────────────────────────
  /** air whoosh: filtered noise sweep with a bell envelope; peak at g + dur*peakAt */
  whoosh(g, o = {}) {
    const A = this.A; const { dur = 0.8, from = 400, to = 3200, peakAt = 0.55, q = 1.4, panFrom = -0.6, panTo = 0.6 } = o; if (!A.inRange(g, dur)) return;
    const n = this._noise(g, dur + 0.2); const bp = this._filt('bandpass', from, q);
    bp.frequency.setValueAtTime(from, A.t(g)); bp.frequency.exponentialRampToValueAtTime(to, A.t(g + dur * peakAt)); bp.frequency.exponentialRampToValueAtTime(Math.max(80, from * 0.8), A.t(g + dur));
    const amp = this._gain(); const v = this._v(o) * 0.28;
    amp.gain.setValueAtTime(0.0001, A.t(g)); amp.gain.exponentialRampToValueAtTime(v, A.t(g + dur * peakAt)); amp.gain.exponentialRampToValueAtTime(0.0001, A.t(g + dur));
    const p = this.ac.createStereoPanner(); p.pan.setValueAtTime(panFrom, A.t(g)); p.pan.linearRampToValueAtTime(panTo, A.t(g + dur));
    n.connect(bp); bp.connect(amp); amp.connect(p); this._out(p, o, A.plate, 0.15);
  }
  swish(g, o = {}) { this.whoosh(g, { dur: 0.32, from: 1200, to: 6000, peakAt: 0.4, q: 2, vel: 0.45, ...o }); }
  /** tension riser ending at g + dur */
  riser(g, o = {}) {
    const A = this.A; const { dur = 3, from = 200, to = 2400 } = o; if (!A.inRange(g, dur)) return;
    const n = this._noise(g, dur + 0.1); const bp = this._filt('bandpass', from, 3);
    bp.frequency.setValueAtTime(from, A.t(g)); bp.frequency.exponentialRampToValueAtTime(to, A.t(g + dur));
    const os = this._osc('sawtooth', from / 2, g, dur); os.frequency.setValueAtTime(from / 2, A.t(g)); os.frequency.exponentialRampToValueAtTime(to / 3, A.t(g + dur));
    const lp = this._filt('lowpass', 800, 1); lp.frequency.setValueAtTime(400, A.t(g)); lp.frequency.exponentialRampToValueAtTime(5000, A.t(g + dur));
    const og = this._gain(0.25); os.connect(lp); lp.connect(og);
    const amp = this._gain(); const v = this._v(o) * 0.4;
    amp.gain.setValueAtTime(0.0001, A.t(g)); amp.gain.exponentialRampToValueAtTime(v, A.t(g + dur * 0.97)); amp.gain.linearRampToValueAtTime(0, A.t(g + dur) + 0.03);
    n.connect(bp); bp.connect(amp); og.connect(amp); this._out(amp, o, A.hall, 0.3);
  }
  /** reversed swell ending exactly at gEnd (pre-hit suck) */
  reverseSwell(gEnd, o = {}) { const { dur = 1.4 } = o; this.riser(gEnd - dur, { dur, from: 2000, to: 8000, vel: 0.35, ...o }); }
  /** sub drop (scale change, reveal) */
  subDrop(g, o = {}) {
    const A = this.A; const { dur = 1.8, from = 90, to = 28 } = o; if (!A.inRange(g, dur)) return;
    const os = this._osc('sine', from, g, dur + 0.1); os.frequency.setValueAtTime(from, A.t(g)); os.frequency.exponentialRampToValueAtTime(to, A.t(g + dur));
    const amp = this._gain(); amp.gain.setValueAtTime(0, A.t(g)); amp.gain.linearRampToValueAtTime(this._v(o) * 0.3, A.t(g) + 0.02); amp.gain.exponentialRampToValueAtTime(0.0001, A.t(g + dur));
    os.connect(amp); this._out(amp, o, null);
  }
  /** low impact thud (+ optional crack). weight 0..1 */
  impact(g, o = {}) {
    const A = this.A; const { weight = 0.6, crack = 0.4 } = o; if (!A.inRange(g, 3)) return; const v = this._v(o) * 0.6;
    const os = this._osc('sine', 120, g, 1.6); os.frequency.setValueAtTime(140 - weight * 50, A.t(g)); os.frequency.exponentialRampToValueAtTime(32, A.t(g) + 0.5 + weight * 0.6);
    const a1 = this._gain(); a1.gain.setValueAtTime(0, A.t(g)); a1.gain.linearRampToValueAtTime(v * 0.7, A.t(g) + 0.004); a1.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.6 + weight);
    os.connect(a1); this._out(a1, o, A.hall, 0.25);
    const n = this._noise(g, 0.5); const lp = this._filt('lowpass', 1800 + crack * 4000, 0.7); const a2 = this._gain();
    a2.gain.setValueAtTime(v * 0.45 * crack, A.t(g)); a2.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.18);
    n.connect(lp); lp.connect(a2); this._out(a2, o, A.hall, 0.3);
  }
  /** tonal hit (number lands / reveal): soft bell+sub with note */
  hit(g, note = 50, o = {}) { this.A.inst.bell(this.A.sfxBus, g, note + 24, { vel: (o.vel ?? 0.5) * 0.8, type: 'tubular', decay: 0.6 }); this.A.inst.sub(this.A.sfxBus, g, 0.6, note - 12, { vel: (o.vel ?? 0.5) * 0.8, release: 0.8 }); }

  // ── UI / graphic accents ───────────────────────────────────────────────────
  tick(g, o = {}) { const A = this.A; if (!A.inRange(g, 0.2)) return; const os = this._osc('square', o.freq || 2200, g, 0.05); const bp = this._filt('bandpass', o.freq || 2200, 6); const a = this._gain();
    a.gain.setValueAtTime(this._v(o, 0.5) * 1.2, A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.035); os.connect(bp); bp.connect(a); this._out(a, o, A.room, 0.1); }
  click(g, o = {}) { const A = this.A; if (!A.inRange(g, 0.2)) return; const n = this._noise(g, 0.05); const hp = this._filt('highpass', 2500, 0.8); const a = this._gain();
    a.gain.setValueAtTime(this._v(o, 0.5) * 0.4, A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.02); n.connect(hp); hp.connect(a); this._out(a, o, A.room, 0.1); }
  blip(g, note = 84, o = {}) { const A = this.A; if (!A.inRange(g, 0.5)) return; const f = 440 * Math.pow(2, (note - 69) / 12); const os = this._osc('sine', f, g, 0.3); const a = this._gain();
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(this._v(o, 0.4) * 0.22, A.t(g) + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.18); os.connect(a); this._out(a, o, A.plate, 0.2); }
  pop(g, o = {}) { const A = this.A; if (!A.inRange(g, 0.3)) return; const os = this._osc('sine', 900, g, 0.12); os.frequency.setValueAtTime(1300, A.t(g)); os.frequency.exponentialRampToValueAtTime(260, A.t(g) + 0.09); const a = this._gain();
    a.gain.setValueAtTime(this._v(o, 0.45) * 0.3, A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.1); os.connect(a); this._out(a, o, A.room, 0.12); }
  glitch(g, o = {}) { const A = this.A; const { dur = 0.35 } = o; if (!A.inRange(g, dur)) return; const r = rng(Math.floor(g * 100));
    const n = this._noise(g, dur); const bp = this._filt('bandpass', 1500, 2); const a = this._gain(0);
    for (let t = 0; t < dur; t += 0.02 + r() * 0.03) { a.gain.setValueAtTime(r() < 0.55 ? this._v(o, 0.4) * 0.35 : 0, A.t(g + t)); bp.frequency.setValueAtTime(300 + r() * 5000, A.t(g + t)); }
    a.gain.setValueAtTime(0, A.t(g + dur)); n.connect(bp); bp.connect(a); this._out(a, o, null); }
  scribble(g, o = {}) { const A = this.A; const { dur = 0.8 } = o; if (!A.inRange(g, dur)) return; const n = this._noise(g, dur); const bp = this._filt('bandpass', 3500, 1.5); const a = this._gain(0);
    const lfo = this.ac.createOscillator(); lfo.frequency.value = 11; const lg = this._gain(this._v(o, 0.4) * 0.12); lfo.connect(lg); lg.connect(a.gain); lfo.start(A.t(g)); lfo.stop(A.t(g + dur));
    n.connect(bp); bp.connect(a); this._out(a, o, A.room, 0.1); }
  /** rubber stamp: thump + paper slap */
  stamp(g, o = {}) { this.impact(g, { weight: 0.2, crack: 0.8, vel: (o.vel ?? 0.6) * 0.8, ...o }); this.paper(g + 0.005, { dur: 0.08, vel: o.vel ?? 0.6 }); }
  /** typewriter: n keystrokes from g at rate (keys/s), optional bell at end */
  typewriter(g, n = 12, o = {}) { const A = this.A; const { rate = 11, bell = false } = o; const r = rng(Math.floor(g * 1000));
    for (let i = 0; i < n; i++) { const tt = g + i / rate + r() * 0.025; if (!A.inRange(tt, 0.2)) continue;
      const nn = this._noise(tt, 0.06); const bp = this._filt('bandpass', 1800 + r() * 1400, 3); const a = this._gain();
      a.gain.setValueAtTime(this._v(o, 0.5) * 0.5, A.t(tt)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(tt) + 0.03); nn.connect(bp); bp.connect(a); this._out(a, o, A.room, 0.15);
      const th = this._osc('sine', 160, tt, 0.05); const ta = this._gain(); ta.gain.setValueAtTime(this._v(o, 0.5) * 0.25, A.t(tt)); ta.gain.exponentialRampToValueAtTime(0.0001, A.t(tt) + 0.04); th.connect(ta); this._out(ta, o, null); }
    if (bell) this.A.inst.bell(this.A.sfxBus, g + n / rate + 0.05, 'A6', { vel: 0.35, type: 'glock' }); }
  paper(g, o = {}) { const A = this.A; const { dur = 0.35 } = o; if (!A.inRange(g, dur)) return; const n = this._noise(g, dur); const hp = this._filt('highpass', 1800, 0.6); const bp = this._filt('peaking', 4500, 1); bp.gain.value = 6; const a = this._gain();
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(this._v(o, 0.5) * 0.25, A.t(g) + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g + dur)); n.connect(hp); hp.connect(bp); bp.connect(a); this._out(a, o, A.room, 0.12); }
  shutter(g, o = {}) { this.click(g, o); this.click(g + 0.06, { ...o, vel: (o.vel ?? 0.5) * 0.7 }); }

  // ── world ambiences (long) ─────────────────────────────────────────────────
  /** ocean surf / swell bed. intensity 0..1 */
  waves(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { intensity = 0.5, fadeIn = 1.5, fadeOut = 1.5, period = 6.5 } = o;
    const n = this._noise(g, dur + 0.2); const lp = this._filt('lowpass', 500 + intensity * 1500, 0.5); const a = this._gain(0);
    const lfo = this.ac.createOscillator(); lfo.frequency.value = 1 / period; const lg = this._gain(0.4); lfo.connect(lg); lg.connect(a.gain);
    const lfo2 = this.ac.createOscillator(); lfo2.frequency.value = 1 / (period * 1.7); const lg2 = this._gain(600 * intensity); lfo2.connect(lg2); lg2.connect(lp.frequency);
    lfo.start(A.t(g)); lfo.stop(A.t(g + dur) + 0.1); lfo2.start(A.t(g)); lfo2.stop(A.t(g + dur) + 0.1);
    const base = this._gain(0); const v = this._v(o, 0.5) * 0.25 * (0.5 + intensity);
    base.gain.setValueAtTime(0, A.t(g)); base.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); base.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); base.gain.linearRampToValueAtTime(0, A.t(g + dur));
    a.gain.value = 0.6; n.connect(lp); lp.connect(a); a.connect(base); this._out(base, { bus: this.A.amb, ...o }, A.hall, 0.15);
  }
  /** wind howl — band-passed noise with wandering pitch */
  wind(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { intensity = 0.5, fadeIn = 1, fadeOut = 1 } = o;
    const n = this._noise(g, dur + 0.2); const bp = this._filt('bandpass', 500, 6 + intensity * 6);
    const l1 = this.ac.createOscillator(); l1.frequency.value = 0.13; const k1 = this._gain(250 + intensity * 400); l1.connect(k1); k1.connect(bp.frequency);
    const l2 = this.ac.createOscillator(); l2.frequency.value = 0.41; const k2 = this._gain(120); l2.connect(k2); k2.connect(bp.frequency);
    [l1, l2].forEach((l) => { l.start(A.t(g)); l.stop(A.t(g + dur) + 0.1); });
    const a = this._gain(0); const v = this._v(o, 0.5) * 0.35 * (0.8 + intensity);
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); a.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); a.gain.linearRampToValueAtTime(0, A.t(g + dur));
    n.connect(bp); bp.connect(a); this._out(a, { bus: this.A.amb, ...o }, A.hall, 0.2);
  }
  rain(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { intensity = 0.5, fadeIn = 1, fadeOut = 1 } = o;
    const n = this._noise(g, dur + 0.2); const hp = this._filt('highpass', 1500, 0.5); const lp = this._filt('lowpass', 9000, 0.5);
    const a = this._gain(0); const v = this._v(o, 0.5) * 0.18 * (0.5 + intensity);
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); a.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); a.gain.linearRampToValueAtTime(0, A.t(g + dur));
    n.connect(hp); hp.connect(lp); lp.connect(a); this._out(a, { bus: this.A.amb, ...o }, A.room, 0.2);
  }
  /** full storm bed = waves + wind + rain */
  storm(g, dur, o = {}) { const i = o.intensity ?? 0.8; this.waves(g, dur, { ...o, intensity: i }); this.wind(g, dur, { ...o, intensity: i, vel: (o.vel ?? 0.5) * 0.8 }); this.rain(g, dur, { ...o, intensity: i }); }
  thunder(g, o = {}) {
    const A = this.A; const { dur = 4.5, dist = 0.5 } = o; if (!A.inRange(g, dur)) return; const r = rng(Math.floor(g * 77));
    const n = this._noise(g, dur); const lp = this._filt('lowpass', 1400 - dist * 1000, 0.7); const a = this._gain(0); const v = this._v(o, 0.6) * 0.45;
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v * (dist < 0.3 ? 1 : 0.5), A.t(g) + 0.02 + dist * 0.3);
    for (let t = 0.2; t < dur; t += 0.12 + r() * 0.3) a.gain.linearRampToValueAtTime(v * Math.exp(-t * 0.8) * (0.4 + r() * 0.6), A.t(g + t));
    a.gain.linearRampToValueAtTime(0, A.t(g + dur));
    n.connect(lp); lp.connect(a); this._out(a, o, A.space, 0.35);
    this.subDrop(g, { dur: 2.5, from: 60, to: 25, vel: (o.vel ?? 0.6) * 0.6 });
  }
  /** ship propellers: low churn with blade-rate modulation */
  propeller(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { rate = 7, fadeIn = 1, fadeOut = 1 } = o;
    const n = this._noise(g, dur + 0.2); const lp = this._filt('lowpass', 260, 1); const a = this._gain(0.5);
    const lfo = this.ac.createOscillator(); lfo.frequency.value = rate; const lg = this._gain(0.45); lfo.connect(lg); lg.connect(a.gain); lfo.start(A.t(g)); lfo.stop(A.t(g + dur) + 0.1);
    const hum = this._osc('sawtooth', 38, g, dur); const hl = this._filt('lowpass', 120, 1); const hg = this._gain(0.18); hum.connect(hl); hl.connect(hg); hg.connect(a);
    const base = this._gain(0); const v = this._v(o, 0.5) * 0.5;
    base.gain.setValueAtTime(0, A.t(g)); base.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); base.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); base.gain.linearRampToValueAtTime(0, A.t(g + dur));
    n.connect(lp); lp.connect(a); a.connect(base); this._out(base, { bus: this.A.amb, ...o }, A.hall, 0.15);
  }
  /** ocean-liner horn (two detuned low reeds) */
  shipHorn(g, o = {}) {
    const A = this.A; const { dur = 2.8 } = o; if (!A.inRange(g, dur + 4)) return; const v = this._v(o, 0.6) * 0.35;
    const mix = this._gain(0.12); [[98, -6], [123.5, 5], [196, 0]].forEach(([f, dt]) => { const os = this._osc('sawtooth', f, g, dur + 0.5); os.detune.value = dt; os.connect(mix); });
    const lp = this._filt('lowpass', 700, 1.5); const pk = this._filt('peaking', 380, 2); pk.gain.value = 6; const a = this._gain(0);
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g) + 0.25); a.gain.setValueAtTime(v, A.t(g + dur)); a.gain.linearRampToValueAtTime(0, A.t(g + dur) + 0.4);
    mix.connect(lp); lp.connect(pk); pk.connect(a); this._out(a, o, A.space, 0.6);
  }
  /** metal hull creak */
  creak(g, o = {}) {
    const A = this.A; const { dur = 1.4 } = o; if (!A.inRange(g, dur)) return; const r = rng(Math.floor(g * 31));
    const os = this._osc('sawtooth', 60, g, dur); const k = this.ac.createGain(); k.gain.value = 0;
    for (let t = 0; t < dur; t += 0.03) os.frequency.setValueAtTime(40 + r() * 70 + Math.sin(t * 8) * 20, A.t(g + t));
    const bp1 = this._filt('bandpass', 420, 14), bp2 = this._filt('bandpass', 1150, 18);
    const a = this._gain(0); const v = this._v(o, 0.5) * 0.9; a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g) + dur * 0.3); a.gain.linearRampToValueAtTime(0, A.t(g + dur));
    os.connect(bp1); os.connect(bp2); bp1.connect(a); bp2.connect(a); this._out(a, o, A.hall, 0.3); void k;
  }
  clink(g, o = {}) { [3140, 4210, 6020].forEach((f, i) => { const A = this.A; if (!A.inRange(g, 2)) return; const os = this._osc('sine', f * (o.pitch || 1), g + i * 0.002, 1.2); const a = this._gain();
    a.gain.setValueAtTime(this._v(o, 0.4) * 0.08 / (i + 1), A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.9 - i * 0.2); os.connect(a); this._out(a, o, A.room, 0.3); }); }
  /** crowd murmur / party babble (bandpassed noise with syllabic modulation) */
  murmur(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { fadeIn = 1, fadeOut = 1 } = o;
    const base = this._gain(0); const v = this._v(o, 0.4) * 1.0;
    [[520, 3.1], [900, 4.3], [1500, 5.2]].forEach(([f, rate], i) => {
      const n = this._noise(g, dur + 0.2); const bp = this._filt('bandpass', f, 3); const a = this._gain(0.25);
      const l = this.ac.createOscillator(); l.frequency.value = rate; const lg = this._gain(0.22); l.connect(lg); lg.connect(a.gain); l.start(A.t(g) + i * 0.13); l.stop(A.t(g + dur) + 0.1);
      n.connect(bp); bp.connect(a); a.connect(base);
    });
    base.gain.setValueAtTime(0, A.t(g)); base.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); base.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); base.gain.linearRampToValueAtTime(0, A.t(g + dur));
    this._out(base, { bus: this.A.amb, ...o }, A.room, 0.35);
  }
  /** body hitting water. size 0..1 */
  splash(g, o = {}) {
    const A = this.A; const { size = 0.7 } = o; if (!A.inRange(g, 3)) return; const v = this._v(o, 0.7);
    const n = this._noise(g, 1.6); const lp = this._filt('lowpass', 6000, 0.6); lp.frequency.setValueAtTime(7000, A.t(g)); lp.frequency.exponentialRampToValueAtTime(400, A.t(g) + 0.6 + size * 0.6);
    const a = this._gain(); a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v * 0.35, A.t(g) + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.8 + size);
    n.connect(lp); lp.connect(a); this._out(a, o, A.hall, 0.3);
    this.impact(g, { weight: size, crack: 0.2, vel: v * 0.55 });
    this.bubbles(g + 0.15, { dur: 1.2 + size, density: 14 + size * 20, vel: v * 0.6 });
  }
  bubbles(g, o = {}) {
    const A = this.A; const { dur = 2, density = 10 } = o; const r = rng(Math.floor(g * 53));
    for (let t = 0; t < dur; t += 1 / density * (0.4 + r() * 1.2)) { const tt = g + t; if (!A.inRange(tt, 0.2)) continue;
      const f0 = 300 + r() * 900; const os = this._osc('sine', f0, tt, 0.12); os.frequency.setValueAtTime(f0, A.t(tt)); os.frequency.exponentialRampToValueAtTime(f0 * (1.6 + r()), A.t(tt) + 0.06);
      const a = this._gain(); a.gain.setValueAtTime(0, A.t(tt)); a.gain.linearRampToValueAtTime(this._v(o, 0.4) * 0.12 * (1 - t / dur * 0.6), A.t(tt) + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, A.t(tt) + 0.07);
      os.connect(a); this._out(a, { ...o, pan: (r() - 0.5) * 1.2 }, A.under, 0.4); }
  }
  /** submerged bed: muffled rumble + filtered surface noise (crossfade with waves on dives) */
  underwater(g, dur, o = {}) {
    const A = this.A; if (!A.inRange(g, dur)) return; const { fadeIn = 0.3, fadeOut = 0.6 } = o;
    const n = this._noise(g, dur + 0.2); const lp = this._filt('lowpass', 320, 0.8); const a = this._gain(0); const v = this._v(o, 0.6) * 0.16;
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g + fadeIn)); a.gain.setValueAtTime(v, A.t(g + dur - fadeOut)); a.gain.linearRampToValueAtTime(0, A.t(g + dur));
    const l = this.ac.createOscillator(); l.frequency.value = 0.2; const lg = this._gain(120); l.connect(lg); lg.connect(lp.frequency); l.start(A.t(g)); l.stop(A.t(g + dur) + 0.1);
    n.connect(lp); lp.connect(a); this._out(a, { bus: this.A.amb, ...o }, A.under, 0.6);
  }
  heartbeat(g, o = {}) { const A = this.A; const { bpm = 60, count = 6, vel = 0.6 } = o;
    for (let i = 0; i < count; i++) { const tt = g + (i * 60) / bpm; [0, 0.17].forEach((d, k) => { const t2 = tt + d; if (!A.inRange(t2, 0.5)) return; const os = this._osc('sine', 55, t2, 0.3); os.frequency.setValueAtTime(70, A.t(t2)); os.frequency.exponentialRampToValueAtTime(40, A.t(t2) + 0.12);
      const a = this._gain(); a.gain.setValueAtTime(0, A.t(t2)); a.gain.linearRampToValueAtTime(Math.pow(vel, 1.4) * (k ? 0.11 : 0.17), A.t(t2) + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, A.t(t2) + 0.22); os.connect(a); this._out(a, o, null); }); } }
  sonar(g, note = 88, o = {}) { this.A.inst.bell(this.A.sfxBus, g, note, { vel: o.vel ?? 0.35, type: 'bowl', decay: 0.5, send: this.A.space, sendAmt: 0.8 }); }
  jailDoor(g, o = {}) { this.impact(g, { weight: 0.5, crack: 0.9, vel: (o.vel ?? 0.7) * 0.65 }); [[187, 2.2], [410, 1.4], [733, 0.9], [1290, 0.5]].forEach(([f, d]) => { const A = this.A; if (!A.inRange(g, 3)) return; const os = this._osc('triangle', f, g, d + 0.2); const a = this._gain();
    a.gain.setValueAtTime(this._v(o, 0.6) * 0.07, A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + d); os.connect(a); this._out(a, o, A.hall, 0.4); }); }
  gavel(g, o = {}) { const A = this.A; if (!A.inRange(g, 1)) return; const os = this._osc('sine', 300, g, 0.2); os.frequency.setValueAtTime(420, A.t(g)); os.frequency.exponentialRampToValueAtTime(180, A.t(g) + 0.05);
    const a = this._gain(); a.gain.setValueAtTime(this._v(o, 0.7) * 0.5, A.t(g)); a.gain.exponentialRampToValueAtTime(0.0001, A.t(g) + 0.12); os.connect(a); this._out(a, o, A.hall, 0.45); this.click(g, { vel: o.vel ?? 0.7 }); }
  /** radio static bed / burst */
  radio(g, dur, o = {}) { const A = this.A; if (!A.inRange(g, dur)) return; const n = this._noise(g, dur); const bp = this._filt('bandpass', 2200, 0.8); const a = this._gain(0); const v = this._v(o, 0.4) * 0.16;
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g) + 0.05); a.gain.setValueAtTime(v, A.t(g + dur) - 0.05); a.gain.linearRampToValueAtTime(0, A.t(g + dur)); n.connect(bp); bp.connect(a); this._out(a, o, null); }
  morse(g, text = 'SOS', o = {}) { const A = this.A; const M = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
    const u = o.unit || 0.06; let t = g; for (const ch of text.toUpperCase()) { if (ch === ' ') { t += u * 7; continue; } for (const s of M[ch] || '') { const d = s === '.' ? u : u * 3; if (A.inRange(t, d)) { const os = this._osc('sine', 760, t, d); const a = this._gain(); a.gain.setValueAtTime(0, A.t(t)); a.gain.linearRampToValueAtTime(this._v(o, 0.35) * 0.15, A.t(t) + 0.004); a.gain.setValueAtTime(this._v(o, 0.35) * 0.15, A.t(t + d) - 0.004); a.gain.linearRampToValueAtTime(0, A.t(t + d)); os.connect(a); this._out(a, o, A.room, 0.15); } t += d + u; } t += u * 2; } return t; }
  /** tinnitus / tension ring (dehydration, shock) */
  ring(g, dur, o = {}) { const A = this.A; if (!A.inRange(g, dur)) return; const os = this._osc('sine', o.freq || 3800, g, dur + 0.2); const a = this._gain(0); const v = this._v(o, 0.3) * 0.05;
    a.gain.setValueAtTime(0, A.t(g)); a.gain.linearRampToValueAtTime(v, A.t(g) + dur * 0.3); a.gain.linearRampToValueAtTime(0, A.t(g + dur)); os.connect(a); this._out(a, o, A.space, 0.2); }
}
