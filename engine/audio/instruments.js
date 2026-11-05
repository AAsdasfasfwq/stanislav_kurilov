// ─────────────────────────────────────────────────────────────────────────────
//  engine/audio/instruments.js — the film's orchestra, synthesized.
//  All functions take GLOBAL film time. `bus` defaults to A.music.
//  Common opts: vel (0..1), pan (-1..1), send (A.hall / A.plate / A.room / A.space /
//  A.under or null), sendAmt (0..1), bus.
//
//  NODE VOICES:  pad · strings · ensemble · stacc · brass · choir · epiano · bell ·
//                sub · bass · reed (bayan/accordion) · theremin · glass · drone · braam
//  BUFFER VOICES: pluck (guitar/harp/balalaika/pizz) · piano · marimba · musicbox ·
//                 kick · snare · hat · taiko · timpani · tom · boom · crash · swell · tick · clap · shaker
// ─────────────────────────────────────────────────────────────────────────────
import { hz, midi as toMidi } from './theory.js';
import { rng } from '../math.js';

const TAU = Math.PI * 2;

export class Instruments {
  constructor(A) { this.A = A; this.ac = A.ac; this.sr = A.sr; this.cache = new Map(); this._seed = 1; }
  _r() { return rng(this._seed++ * 7919); }
  _osc(type, freq, g, dur, detune = 0) {
    const o = this.ac.createOscillator(); if (type === 'pulse') o.setPeriodicWave(this._pulse()); else o.type = type;
    o.frequency.value = freq; o.detune.value = detune; o.start(this.A.t(g)); o.stop(this.A.t(g + dur) + 0.05); return o;
  }
  _pulse(duty = 0.28) {
    const key = 'pulse' + duty; if (this.cache.has(key)) return this.cache.get(key);
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    const w = this.ac.createPeriodicWave(re, im); this.cache.set(key, w); return w;
  }
  _lfo(freq, depth, param, g, dur, phase = 0) {
    const o = this.ac.createOscillator(); o.frequency.value = freq; const k = this.ac.createGain(); k.gain.value = depth;
    o.connect(k); k.connect(param); o.start(this.A.t(g) + phase); o.stop(this.A.t(g + dur) + 0.1); return k;
  }
  _out(node, o, defSend, defAmt = 0.3) {
    return this.A.route(node, { bus: o.bus || this.A.music, pan: o.pan || 0, send: o.send === undefined ? defSend : o.send, sendAmt: o.sendAmt ?? defAmt, gain: o.gain ?? 1 });
  }
  _buf(len) { return this.ac.createBuffer(2, Math.max(1, Math.floor(len)), this.sr); }
  _play(buf, g, o, defSend = this.A.room, defAmt = 0.2, rate = 1) {
    const s = this.ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const amp = this.ac.createGain(); amp.gain.value = o.vel == null ? 0.8 : 0.15 + 0.85 * Math.pow(o.vel, 1.3);
    s.connect(amp); this._out(amp, o, defSend, defAmt);
    s.start(this.A.t(g)); if (o.dur) { amp.gain.setTargetAtTime(0, this.A.t(g + o.dur), 0.08); s.stop(this.A.t(g + o.dur) + 1); }
    return s;
  }

  // ── PAD: warm detuned ensemble, slow filter breathing ───────────────────────
  pad(bus, g, dur, notes, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 4)) return;
    const { vel = 0.5, attack = 1.6, release = 2.5, cutoff = 1600, res = 0.6, detune = 9, wave = 'sawtooth', lfo = 0.09, sub = true, bright = 0.4 } = o;
    notes.forEach((n, i) => {
      const f = hz(n); const amp = this.ac.createGain(); amp.gain.value = 0;
      const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = res;
      lp.frequency.setValueAtTime(cutoff * 0.55, A.t(g)); lp.frequency.linearRampToValueAtTime(cutoff, A.t(g + attack * 1.4));
      this._lfo(lfo + i * 0.013, cutoff * 0.25, lp.frequency, g, dur + release, i * 0.37);
      const mix = this.ac.createGain(); mix.gain.value = 0.026;
      [-detune, 0.3, detune].forEach((dt) => { this._osc(wave, f, g, dur + release, dt + (i % 2 ? 2 : -2)).connect(mix); });
      if (sub && i === 0) { const s = this._osc('triangle', f / 2, g, dur + release); const sg = this.ac.createGain(); sg.gain.value = 0.03; s.connect(sg); sg.connect(mix); }
      const hi = this.ac.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 3000; hi.gain.value = (bright - 0.5) * 10;
      mix.connect(lp); lp.connect(hi); hi.connect(amp);
      A.env(amp.gain, g, { a: attack, d: 1, s: 0.85, r: release, peak: Math.pow(vel, 1.2), dur });
      this._out(amp, { ...o, bus: bus || o.bus, pan: (o.pan || 0) + (i - (notes.length - 1) / 2) * 0.18 }, A.hall, 0.35);
    });
  }

  // ── STRINGS: bowed section with vibrato & body resonance ────────────────────
  strings(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 3)) return;
    const { vel = 0.6, attack = 0.35, release = 0.9, section = 'violins', vibrato = 0.18, bright = 0.5 } = o;
    const m = toMidi(note); const f = hz(m);
    const cut = { violins: 3800, violas: 2900, celli: 2200, basses: 1300 }[section] * (0.6 + bright * 0.8) * (0.7 + vel * 0.5);
    const mix = this.ac.createGain(); mix.gain.value = 0.034;
    const oscs = [-12, -4, 5, 13].map((dt, k) => { const os = this._osc('sawtooth', f, g, dur + release + 0.2, dt); os.connect(mix); return os; });
    // vibrato fades in
    const vib = this.ac.createOscillator(); vib.frequency.value = 5.1 + (m % 5) * 0.12; const vg = this.ac.createGain(); vg.gain.value = 0;
    vg.gain.setValueAtTime(0, A.t(g)); vg.gain.linearRampToValueAtTime(vibrato * 100, A.t(g + Math.min(0.6, dur * 0.5) + 0.25));
    vib.connect(vg); oscs.forEach((os) => vg.connect(os.detune)); vib.start(A.t(g)); vib.stop(A.t(g + dur + release) + 0.2);
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(cut * 0.45, A.t(g)); lp.frequency.linearRampToValueAtTime(cut, A.t(g + attack * 1.2));
    const b1 = this.ac.createBiquadFilter(); b1.type = 'peaking'; b1.frequency.value = section === 'violins' ? 480 : 260; b1.gain.value = 3; b1.Q.value = 1.2;
    const b2 = this.ac.createBiquadFilter(); b2.type = 'peaking'; b2.frequency.value = 2600; b2.gain.value = 2.5; b2.Q.value = 1.5;
    const hp = this.ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = section === 'basses' ? 35 : 70;
    const amp = this.ac.createGain(); amp.gain.value = 0;
    mix.connect(hp); hp.connect(lp); lp.connect(b1); b1.connect(b2); b2.connect(amp);
    A.env(amp.gain, g, { a: attack, d: 0.6, s: 0.9, r: release, peak: Math.pow(vel, 1.3), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.hall, 0.32);
  }
  /** play a chord / voicing on strings (sections chosen by register) */
  ensemble(bus, g, dur, notes, o = {}) {
    notes.forEach((n, i) => { const m = toMidi(n); const section = m < 43 ? 'basses' : m < 55 ? 'celli' : m < 62 ? 'violas' : 'violins';
      this.strings(bus, g + (o.spread || 0) * i, dur, m, { ...o, section, pan: (o.pan || 0) + ((m - 60) / 30) * 0.6 }); });
  }
  // ── STACCATO strings / ostinato ─────────────────────────────────────────────
  stacc(bus, g, note, o = {}) {
    const A = this.A; if (!A.inRange(g, 1)) return;
    const { vel = 0.6, len = 0.14, bright = 0.5 } = o; const f = hz(note);
    const mix = this.ac.createGain(); mix.gain.value = 0.2;
    [-8, 7].forEach((dt) => this._osc('sawtooth', f, g, len + 0.4, dt).connect(mix));
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(1800 + bright * 4000, A.t(g)); lp.frequency.exponentialRampToValueAtTime(700 + bright * 600, A.t(g + len));
    const amp = this.ac.createGain(); mix.connect(lp); lp.connect(amp);
    A.env(amp.gain, g, { a: 0.008, d: len * 0.6, s: 0.35, r: 0.12, peak: Math.pow(vel, 1.2), dur: len });
    this._out(amp, { ...o, bus: bus || o.bus }, A.plate, 0.22);
  }
  // ── BRASS: horns / trombones with the "blat" filter envelope ───────────────
  brass(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 3)) return;
    const { vel = 0.6, attack = 0.08, release = 0.6, bright = 0.5, scoop = true } = o; const m = toMidi(note); const f = hz(m);
    const mix = this.ac.createGain(); mix.gain.value = 0.045;
    const oscs = [this._osc('sawtooth', f, g, dur + release + 0.2, -6), this._osc('sawtooth', f, g, dur + release + 0.2, 6), this._osc('pulse', f, g, dur + release + 0.2, 0)];
    oscs.forEach((os) => { os.connect(mix); if (scoop) { os.detune.setValueAtTime(os.detune.value - 35, A.t(g)); os.detune.linearRampToValueAtTime(os.detune.value, A.t(g + 0.09)); } });
    const vib = this.ac.createOscillator(); vib.frequency.value = 4.8; const vg = this.ac.createGain();
    vg.gain.setValueAtTime(0, A.t(g)); vg.gain.linearRampToValueAtTime(12, A.t(g + Math.min(0.8, dur)));
    vib.connect(vg); oscs.forEach((os) => vg.connect(os.detune)); vib.start(A.t(g)); vib.stop(A.t(g + dur + release) + 0.2);
    const top = (900 + bright * 2400) * (0.55 + vel * 0.7) * Math.min(2, Math.max(0.6, f / 220));
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.2;
    lp.frequency.setValueAtTime(180, A.t(g)); lp.frequency.linearRampToValueAtTime(top, A.t(g + attack + 0.05)); lp.frequency.setTargetAtTime(top * 0.62, A.t(g + attack + 0.06), 0.25);
    lp.frequency.setTargetAtTime(150, A.t(g + dur), release / 3);
    const pk = this.ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1200; pk.gain.value = 3; pk.Q.value = 1;
    const amp = this.ac.createGain(); mix.connect(lp); lp.connect(pk); pk.connect(amp);
    A.env(amp.gain, g, { a: attack, d: 0.4, s: 0.8, r: release, peak: Math.pow(vel, 1.3), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.hall, 0.38);
  }
  // ── CHOIR: formant-filtered voices ─────────────────────────────────────────
  choir(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 4)) return;
    const { vel = 0.5, vowel = 'a', attack = 0.9, release = 1.8, breath = 0.15 } = o; const f = hz(note);
    const FORM = { a: [[800, 1], [1150, 0.5], [2900, 0.25]], o: [[450, 1], [800, 0.45], [2830, 0.12]], u: [[325, 1], [700, 0.25], [2530, 0.08]], e: [[400, 1], [1700, 0.4], [2600, 0.25]], i: [[300, 1], [2200, 0.3], [3000, 0.2]], m: [[260, 1], [1000, 0.1], [2400, 0.03]] }[vowel];
    const src = this.ac.createGain(); src.gain.value = 0.07;
    const oscs = [-11, -3, 4, 12].map((dt) => { const os = this._osc(dt % 2 ? 'sawtooth' : 'pulse', f, g, dur + release + 0.2, dt); os.connect(src); return os; });
    const vib = this.ac.createOscillator(); vib.frequency.value = 5.4; const vg = this.ac.createGain(); vg.gain.value = 14; vib.connect(vg); oscs.forEach((os) => vg.connect(os.detune)); vib.start(A.t(g)); vib.stop(A.t(g + dur + release) + 0.2);
    const amp = this.ac.createGain();
    FORM.forEach(([ff, gg]) => { const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = ff < 1000 ? 6 : 9; const k = this.ac.createGain(); k.gain.value = gg * 2.2; src.connect(bp); bp.connect(k); k.connect(amp); });
    if (breath > 0) { const n = this.A.noiseSource(g, dur + release); const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = FORM[1][0]; bp.Q.value = 2; const k = this.ac.createGain(); k.gain.value = breath * 0.05; n.connect(bp); bp.connect(k); k.connect(amp); }
    A.env(amp.gain, g, { a: attack, d: 1, s: 0.9, r: release, peak: Math.pow(vel, 1.2), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.space, 0.45);
  }
  // ── E-PIANO (FM Rhodes) ─────────────────────────────────────────────────────
  epiano(bus, g, note, o = {}) {
    const A = this.A; const { vel = 0.6, dur = 1.5, release = 0.5, tine = 0.25 } = o; if (!A.inRange(g, dur + 3)) return;
    const f = hz(note); const decay = Math.max(0.8, 3.2 - (toMidi(note) - 48) * 0.04);
    const car = this._osc('sine', f, g, dur + release + 0.2); const mod = this._osc('sine', f, g, dur + release + 0.2);
    const idx = this.ac.createGain(); idx.gain.setValueAtTime(f * (1.2 + vel * 2.2), A.t(g)); idx.gain.setTargetAtTime(f * 0.3, A.t(g), 0.25);
    mod.connect(idx); idx.connect(car.frequency);
    const tn = this._osc('sine', f * 14, g, 0.4); const tg = this.ac.createGain(); tg.gain.setValueAtTime(tine * vel * 0.2, A.t(g)); tg.gain.setTargetAtTime(0, A.t(g), 0.03); tn.connect(tg);
    const amp = this.ac.createGain(); amp.gain.value = 0; car.connect(amp); tg.connect(amp);
    const pk = Math.pow(vel, 1.4) * 0.16; amp.gain.setValueAtTime(0, A.t(g)); amp.gain.linearRampToValueAtTime(pk, A.t(g) + 0.004);
    amp.gain.setTargetAtTime(pk * 0.25, A.t(g) + 0.01, decay / 2.5); amp.gain.setTargetAtTime(0, A.t(g + dur), release / 4);
    this._out(amp, { ...o, bus: bus || o.bus }, A.plate, 0.25);
  }
  // ── BELLS: celesta · glock · tubular · bowl · musicbox (additive partials) ──
  bell(bus, g, note, o = {}) {
    const A = this.A; const { vel = 0.5, type = 'celesta', decay: dk } = o; if (!A.inRange(g, 8)) return;
    const P = {
      celesta: [[1, 1, 1.2], [2, 0.3, 0.6], [4.02, 0.12, 0.25], [6.9, 0.05, 0.1]],
      glock: [[1, 1, 1.6], [2.76, 0.45, 0.6], [5.4, 0.2, 0.25], [8.93, 0.08, 0.1]],
      tubular: [[1, 0.7, 4.5], [2.0, 0.6, 3.5], [3.0, 0.35, 2.5], [4.2, 0.25, 1.8], [5.4, 0.15, 1.2], [0.5, 0.25, 3]],
      bowl: [[1, 1, 7], [2.71, 0.5, 5], [5.1, 0.2, 3], [8.3, 0.08, 1.5]],
      musicbox: [[1, 1, 0.9], [3.0, 0.08, 0.4], [5.4, 0.18, 0.22], [12.0, 0.05, 0.08]],
    }[type];
    const f = hz(note); const amp = this.ac.createGain(); amp.gain.value = Math.pow(vel, 1.3) * 0.11;
    P.forEach(([r, a, d]) => { const dd = (dk || 1) * d; const os = this._osc('sine', f * r, g, dd * 4 + 0.1, 0); const k = this.ac.createGain();
      k.gain.setValueAtTime(0, A.t(g)); k.gain.linearRampToValueAtTime(a, A.t(g) + 0.002); k.gain.setTargetAtTime(0, A.t(g) + 0.003, dd); os.connect(k); k.connect(amp); });
    this._out(amp, { ...o, bus: bus || o.bus }, type === 'bowl' || type === 'tubular' ? A.space : A.hall, 0.35);
  }
  // ── SUB / BASS ──────────────────────────────────────────────────────────────
  sub(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 2)) return; const { vel = 0.6, attack = 0.05, release = 0.4 } = o;
    const os = this._osc('sine', hz(note), g, dur + release + 0.2); const sat = this.ac.createWaveShaper(); sat.curve = this._curve(1.5);
    const amp = this.ac.createGain(); os.connect(sat); sat.connect(amp);
    A.env(amp.gain, g, { a: attack, d: 0.3, s: 0.9, r: release, peak: Math.pow(vel, 1.2) * 0.16, dur });
    this._out(amp, { ...o, bus: bus || o.bus, send: null }, null, 0);
  }
  bass(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 2)) return; const { vel = 0.6, cutoff = 600, release = 0.2 } = o; const f = hz(note);
    const mix = this.ac.createGain(); mix.gain.value = 0.09;
    this._osc('sawtooth', f, g, dur + release + 0.2, -4).connect(mix); this._osc('square', f / 2, g, dur + release + 0.2, 3).connect(mix);
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(cutoff * 2.5, A.t(g)); lp.frequency.setTargetAtTime(cutoff, A.t(g), 0.08);
    const amp = this.ac.createGain(); mix.connect(lp); lp.connect(amp);
    A.env(amp.gain, g, { a: 0.006, d: 0.25, s: 0.7, r: release, peak: Math.pow(vel, 1.2), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.room, 0.08);
  }
  // ── REED: bayan / accordion (musette tuning) — Soviet colour ────────────────
  reed(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 2)) return; const { vel = 0.55, attack = 0.05, release = 0.15, musette = 9, tremolo = 0.08 } = o; const f = hz(note);
    const mix = this.ac.createGain(); mix.gain.value = 0.09;
    [this._osc('pulse', f, g, dur + release + 0.1, -musette), this._osc('pulse', f, g, dur + release + 0.1, musette), this._osc('sawtooth', f / 2, g, dur + release + 0.1, 0)].forEach((os, i) => { if (i === 2) { const k = this.ac.createGain(); k.gain.value = 0.4; os.connect(k); k.connect(mix); } else os.connect(mix); });
    const bp = this.ac.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 1300; bp.gain.value = 5; bp.Q.value = 1.4;
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const amp = this.ac.createGain(); mix.connect(bp); bp.connect(lp); lp.connect(amp);
    A.env(amp.gain, g, { a: attack, d: 0.2, s: 0.85, r: release, peak: Math.pow(vel, 1.2), dur });
    if (tremolo) this._lfo(5.5, tremolo * Math.pow(vel, 1.2), amp.gain, g, dur + release);
    this._out(amp, { ...o, bus: bus || o.bus }, A.room, 0.25);
  }
  // ── THEREMIN: eerie glide (hallucination / dread) ───────────────────────────
  theremin(bus, g, dur, from, to = from, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 3)) return; const { vel = 0.4, release = 1.2, vib = 30 } = o;
    const os = this._osc('sine', hz(from), g, dur + release + 0.2); os.frequency.setValueAtTime(hz(from), A.t(g)); os.frequency.exponentialRampToValueAtTime(hz(to), A.t(g + dur));
    const h2 = this._osc('sine', hz(from) * 2, g, dur + release + 0.2); h2.frequency.setValueAtTime(hz(from) * 2, A.t(g)); h2.frequency.exponentialRampToValueAtTime(hz(to) * 2, A.t(g + dur));
    const hk = this.ac.createGain(); hk.gain.value = 0.12; h2.connect(hk);
    this._lfo(6.2, vib, os.detune, g, dur + release); this._lfo(6.2, vib, h2.detune, g, dur + release);
    const amp = this.ac.createGain(); os.connect(amp); hk.connect(amp);
    A.env(amp.gain, g, { a: 0.4, d: 0.5, s: 0.9, r: release, peak: Math.pow(vel, 1.2) * 0.033, dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.space, 0.5);
  }
  // ── GLASS HARMONICA: wonder / bioluminescence ──────────────────────────────
  glass(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 4)) return; const { vel = 0.4, attack = 0.5, release = 2.5 } = o; const f = hz(note);
    const amp = this.ac.createGain();
    [[1, 1, -3], [1, 0.8, 3], [2, 0.25, 0], [3, 0.08, 1]].forEach(([r, a, dt]) => { const os = this._osc('sine', f * r, g, dur + release + 0.3, dt); const k = this.ac.createGain(); k.gain.value = a * 0.06; os.connect(k); k.connect(amp); });
    A.env(amp.gain, g, { a: attack, d: 1, s: 0.75, r: release, peak: Math.pow(vel, 1.2), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.space, 0.55);
  }
  // ── DRONE: evolving low bed ─────────────────────────────────────────────────
  drone(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 4)) return; const { vel = 0.5, attack = 3, release = 4, cutoff = 500, fifth = true, noise = 0.3, dark = false } = o; const f = hz(note);
    const mix = this.ac.createGain(); mix.gain.value = 0.05;
    [-7, 6].forEach((dt) => this._osc('sawtooth', f, g, dur + release + 0.3, dt).connect(mix));
    if (fifth) { const os = this._osc('sawtooth', f * 1.4983, g, dur + release + 0.3, 2); const k = this.ac.createGain(); k.gain.value = 0.5; os.connect(k); k.connect(mix); }
    if (dark) { const os = this._osc('sawtooth', f * 1.0595, g, dur + release + 0.3, 0); const k = this.ac.createGain(); k.gain.value = 0.35; os.connect(k); k.connect(mix); }
    if (noise) { const n = A.noiseSource(g, dur + release); const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 4; const k = this.ac.createGain(); k.gain.value = noise * 0.5; n.connect(bp); bp.connect(k); k.connect(mix); }
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.value = cutoff;
    this._lfo(0.05, cutoff * 0.5, lp.frequency, g, dur + release);
    const amp = this.ac.createGain(); mix.connect(lp); lp.connect(amp);
    A.env(amp.gain, g, { a: attack, d: 1, s: 1, r: release, peak: Math.pow(vel, 1.2), dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.hall, 0.4);
  }
  // ── BRAAM: huge distorted brass cluster (use ≤ 3 times in the film!) ───────
  braam(bus, g, dur, note, o = {}) {
    const A = this.A; if (!A.inRange(g, dur + 5)) return; const { vel = 0.7, minor = true } = o; const f = hz(note);
    const mix = this.ac.createGain(); mix.gain.value = 0.05;
    [1, 2, 1.4983, minor ? 1.1892 : 1.2599, 0.5].forEach((r, i) => [-10, 9].forEach((dt) => this._osc('sawtooth', f * r, g, dur + 3, dt + i).connect(mix)));
    const sh = this.ac.createWaveShaper(); sh.curve = this._curve(4);
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(120, A.t(g)); lp.frequency.exponentialRampToValueAtTime(1700 * vel + 300, A.t(g) + 0.35); lp.frequency.exponentialRampToValueAtTime(260, A.t(g + dur));
    const amp = this.ac.createGain(); mix.connect(sh); sh.connect(lp); lp.connect(amp);
    A.env(amp.gain, g, { a: 0.06, d: dur * 0.6, s: 0.5, r: 2, peak: Math.pow(vel, 1.2) * 0.28, dur });
    this._out(amp, { ...o, bus: bus || o.bus }, A.hall, 0.5);
  }
  _curve(k) { const key = 'curve' + k; if (this.cache.has(key)) return this.cache.get(key); const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } this.cache.set(key, c); return c; }

  // ════════════════════════ BUFFER-SYNTH VOICES ═════════════════════════════
  _cached(key, make) { if (!this.cache.has(key)) this.cache.set(key, make()); return this.cache.get(key); }
  /** Karplus-Strong plucked string. body: guitar | harp | balalaika | pizz | koto */
  pluck(bus, g, note, o = {}) {
    if (!this.A.inRange(g, 6)) return;
    const body = o.body || 'guitar'; const m = toMidi(note);
    const P = { guitar: { decay: 3.2, bright: 0.55, damp: 0.996 }, harp: { decay: 4.5, bright: 0.7, damp: 0.998 }, balalaika: { decay: 1.6, bright: 0.9, damp: 0.993 }, pizz: { decay: 0.7, bright: 0.45, damp: 0.985 }, koto: { decay: 2.6, bright: 0.8, damp: 0.995 } }[body];
    const buf = this._cached(`ks:${m}:${body}`, () => {
      const f = hz(m); const len = Math.floor(this.sr * P.decay); const b = this._buf(len);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); const r = rng(m * 31 + ch * 7 + body.length);
        const N = Math.max(2, Math.round(this.sr / (f * (1 + (ch ? 0.0007 : -0.0007))))); const line = new Float32Array(N);
        let lp = 0; for (let i = 0; i < N; i++) { const x = r() * 2 - 1; lp += (x - lp) * P.bright; line[i] = lp; }
        let idx = 0, prev = 0; const damp = Math.pow(P.damp, 440 / Math.max(80, f) * 0.25 + 0.75);
        for (let i = 0; i < len; i++) { const cur = line[idx]; const nxt = 0.5 * (cur + prev) * damp; prev = cur; line[idx] = nxt; idx = (idx + 1) % N; d[i] = cur * (body === 'pizz' ? 0.6 : 0.5); }
        // pluck transient
        for (let i = 0; i < 200; i++) d[i] *= i / 200;
      }
      return b;
    });
    this._play(buf, g, { gain: 0.7, ...o, bus: bus || o.bus }, body === 'harp' ? this.A.hall : this.A.room, 0.25);
  }
  /** additive piano with inharmonicity, unison beating & hammer noise */
  piano(bus, g, note, o = {}) {
    if (!this.A.inRange(g, 7)) return;
    const m = toMidi(note); const vb = o.vel == null ? 1 : o.vel < 0.4 ? 0 : o.vel < 0.75 ? 1 : 2;
    const buf = this._cached(`pno:${m}:${vb}`, () => {
      const f = hz(m); const dur = Math.max(1.6, 6.5 - (m - 40) * 0.07); const len = Math.floor(this.sr * dur); const b = this._buf(len);
      const B = 0.00012 * Math.pow(2, (m - 60) / 18); const nP = Math.min(24, Math.floor(9000 / f));
      const bright = [0.55, 0.8, 1.1][vb];
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); const det = ch ? 1.0006 : 0.9995;
        for (let n = 1; n <= nP; n++) {
          const fn = f * n * Math.sqrt(1 + B * n * n) * det; if (fn > this.sr / 2.2) break;
          const amp = (1 / Math.pow(n, 1.15)) * Math.exp(-(n - 1) * (0.35 / bright)) * (n === 1 ? 1 : 0.8);
          const t1 = (0.35 + 3.2 / (1 + n * 0.6)) * (1.4 - (m - 40) * 0.01), t2 = t1 * 4;
          const w = (TAU * fn) / this.sr; let c = Math.cos(w), s = Math.sin(w), x = 1, y = 0;
          const k1 = Math.exp(-1 / (t1 * this.sr)), k2 = Math.exp(-1 / (t2 * this.sr)); let e1 = 0.7, e2 = 0.3;
          for (let i = 0; i < len; i++) { const nx = x * c - y * s; y = x * s + y * c; x = nx; e1 *= k1; e2 *= k2; d[i] += y * amp * (e1 + e2) * 0.16; }
        }
        const r = rng(m * 3 + ch); let lp = 0; for (let i = 0; i < 900; i++) { lp += ((r() * 2 - 1) - lp) * 0.3; d[i] += lp * 0.06 * bright * (1 - i / 900); }
        for (let i = 0; i < 60; i++) d[i] *= i / 60;
      }
      return b;
    });
    this._play(buf, g, { gain: 0.9, ...o, bus: bus || o.bus }, this.A.hall, 0.22);
  }
  marimba(bus, g, note, o = {}) {
    if (!this.A.inRange(g, 3)) return; const m = toMidi(note);
    const buf = this._cached(`mar:${m}`, () => { const f = hz(m); const len = Math.floor(this.sr * 1.8); const b = this._buf(len);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch);
        [[1, 1, 0.7 - (m - 60) * 0.006], [3.93, 0.35, 0.18], [9.2, 0.12, 0.05]].forEach(([r, a, dk]) => { const w = (TAU * f * r) / this.sr; for (let i = 0; i < len; i++) d[i] += Math.sin(w * i + ch * 0.3) * a * Math.exp(-i / (Math.max(0.05, dk) * this.sr)) * 0.3; });
        const rr = rng(m + ch); for (let i = 0; i < 240; i++) d[i] += (rr() * 2 - 1) * 0.08 * (1 - i / 240); }
      return b; });
    this._play(buf, g, { gain: 0.55, ...o, bus: bus || o.bus }, this.A.room, 0.25);
  }
  musicbox(bus, g, note, o = {}) { this.bell(bus, g, note, { ...o, type: 'musicbox' }); }

  // ── percussion ──────────────────────────────────────────────────────────────
  _drum(key, dur, fn) { return this._cached(key, () => { const len = Math.floor(this.sr * dur); const b = this._buf(len); for (let ch = 0; ch < 2; ch++) fn(b.getChannelData(ch), len, ch, rng(key.length * 97 + ch)); return b; }); }
  kick(bus, g, o = {}) { const b = this._drum('kick', 0.8, (d, len) => { let ph = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const f = 42 + 110 * Math.exp(-t * 28); ph += TAU * f / this.sr; d[i] = Math.sin(ph) * Math.exp(-t * 5.5) * 0.9 + (i < 90 ? (1 - i / 90) * 0.25 : 0); } });
    this._play(b, g, { gain: 0.5, ...o, bus: bus || o.bus }, null, 0); }
  snare(bus, g, o = {}) { const b = this._drum('snare', 0.5, (d, len, ch, r) => { let hp = 0, prev = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const n = r() * 2 - 1; hp = 0.92 * (hp + n - prev); prev = n; d[i] = hp * Math.exp(-t * 14) * 0.45 + Math.sin(TAU * 185 * t) * Math.exp(-t * 22) * 0.5; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.plate, 0.18); }
  hat(bus, g, o = {}) { const open = o.open ? 1 : 0; const b = this._drum('hat' + open, open ? 0.6 : 0.12, (d, len, ch, r) => { let hp = 0, prev = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const n = r() * 2 - 1; hp = 0.6 * (hp + n - prev); prev = n; d[i] = hp * Math.exp(-t * (open ? 7 : 45)) * 0.3; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.room, 0.1); }
  taiko(bus, g, o = {}) { const pitch = o.pitch || 1; const b = this._drum('taiko' + pitch, 2.2, (d, len, ch, r) => { let ph = 0, lp = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const f = (48 + 40 * Math.exp(-t * 18)) * pitch; ph += TAU * f / this.sr; lp += ((r() * 2 - 1) - lp) * 0.08; d[i] = Math.sin(ph) * Math.exp(-t * 2.6) * 0.85 + lp * Math.exp(-t * 18) * 0.9 + Math.sin(ph * 2.3) * Math.exp(-t * 9) * 0.15; } });
    this._play(b, g, { gain: 0.24, ...o, bus: bus || o.bus }, this.A.hall, 0.3); }
  tom(bus, g, note, o = {}) { const m = toMidi(note); const b = this._drum('tom' + m, 1.2, (d, len, ch, r) => { const f0 = hz(m); let ph = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; ph += TAU * f0 * (1 + 0.5 * Math.exp(-t * 30)) / this.sr; d[i] = Math.sin(ph) * Math.exp(-t * 6) * 0.7 + (r() * 2 - 1) * Math.exp(-t * 60) * 0.2; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.room, 0.2); }
  timpani(bus, g, note, o = {}) { const m = toMidi(note); const b = this._drum('timp' + m, 3.5, (d, len, ch, r) => { const f0 = hz(m); for (let i = 0; i < len; i++) { const t = i / this.sr; const fm = f0 * (1 + 0.04 * Math.exp(-t * 6)); d[i] = (Math.sin(TAU * fm * t) * Math.exp(-t * 1.1) + Math.sin(TAU * fm * 1.5 * t) * 0.4 * Math.exp(-t * 1.8) + Math.sin(TAU * fm * 1.99 * t) * 0.25 * Math.exp(-t * 2.5)) * 0.4 + (r() * 2 - 1) * Math.exp(-t * 40) * 0.15; } });
    this._play(b, g, { gain: 0.35, ...o, bus: bus || o.bus }, this.A.hall, 0.3); }
  /** cinematic trailer hit */
  boom(bus, g, o = {}) { const b = this._drum('boom', 4, (d, len, ch, r) => { let ph = 0, lp = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const f = 30 + 50 * Math.exp(-t * 7); ph += TAU * f / this.sr; lp += ((r() * 2 - 1) - lp) * (0.02 + 0.3 * Math.exp(-t * 10)); d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 1.2) * 1.2 + lp * Math.exp(-t * 3) * 1.4) * 1.5) * 0.7; } });
    this._play(b, g, { gain: 0.17, ...o, bus: bus || o.bus }, this.A.hall, 0.2); }
  crash(bus, g, o = {}) { const b = this._drum('crash', 4, (d, len, ch, r) => { let hp = 0, prev = 0; for (let i = 0; i < len; i++) { const t = i / this.sr; const n = r() * 2 - 1; hp = 0.85 * (hp + n - prev); prev = n; d[i] = hp * (Math.exp(-t * 1.3) * 0.22 + Math.exp(-t * 18) * 0.2); } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.hall, 0.25); }
  /** reverse-cymbal swell that ENDS at time gEnd */
  swell(bus, gEnd, dur = 1.5, o = {}) { const L = Math.round(dur * 10) / 10; const b = this._drum('swell' + L, L, (d, len, ch, r) => { let hp = 0, prev = 0; for (let i = 0; i < len; i++) { const t = i / len; const n = r() * 2 - 1; hp = 0.8 * (hp + n - prev); prev = n; d[i] = hp * Math.pow(t, 2.4) * 0.35; } });
    this._play(b, gEnd - L, { ...o, bus: bus || o.bus }, this.A.hall, 0.3); }
  tick(bus, g, o = {}) { const hi = o.hi ? 1 : 0; const b = this._drum('tick' + hi, 0.08, (d, len) => { for (let i = 0; i < len; i++) { const t = i / this.sr; d[i] = Math.sin(TAU * (hi ? 2400 : 1500) * t) * Math.exp(-t * 90) * 0.5; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.room, 0.15); }
  clap(bus, g, o = {}) { const b = this._drum('clap', 0.4, (d, len, ch, r) => { for (let i = 0; i < len; i++) { const t = i / this.sr; const burst = [0, 0.011, 0.022].reduce((s, o2) => s + (t >= o2 ? Math.exp(-(t - o2) * 160) : 0), 0) + Math.exp(-t * 18) * 0.5; d[i] = (r() * 2 - 1) * burst * 0.3; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.plate, 0.2); }
  shaker(bus, g, o = {}) { const b = this._drum('shaker', 0.15, (d, len, ch, r) => { let hp = 0, prev = 0; for (let i = 0; i < len; i++) { const t = i / len; const n = r() * 2 - 1; hp = 0.5 * (hp + n - prev); prev = n; d[i] = hp * Math.sin(t * Math.PI) * 0.18; } });
    this._play(b, g, { ...o, bus: bus || o.bus }, this.A.room, 0.1); }
}
