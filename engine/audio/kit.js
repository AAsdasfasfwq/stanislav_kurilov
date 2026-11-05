// ─────────────────────────────────────────────────────────────────────────────
//  engine/audio/kit.js — offline audio for one segment.
//
//  A segment exports  audio(A)  and schedules music + SFX in GLOBAL film time:
//
//    audio(A) {
//      const { inst, sfx } = A;
//      inst.pad(A.music, 342.4, 8, chord('Dm9', 3), { vel: 0.5, cutoff: 1400 });
//      sfx.whoosh(346.1, { dur: 0.7 });
//    }
//
//  Signal flow (do not bypass):  instruments → A.music / A.sfx / A.amb buses
//    → [reverb sends: A.hall A.plate A.room A.space A.under]
//    → sum → HPF 28 Hz → glue compressor → peak limiter → master
//  LEVELS: this track sits UNDER a voice-over. The final mix (render.js) also
//  ducks it under the voice. Aim: music bus peaks ≈ −16 dBFS, SFX accents
//  ≈ −12 dBFS, ambience ≈ −24 dBFS. Never stack many loud hits.
// ─────────────────────────────────────────────────────────────────────────────
import { rng } from '../math.js';
import { Instruments } from './instruments.js';
import { SFX } from './sfx.js';
import * as theory from './theory.js';

export const SR = 48000;
export const AUDIO_TAIL = 4.0; // seconds rendered after segment end (reverb tails)

export class AudioKit {
  constructor(ac, seg) {
    this.ac = ac; this.seg = seg; this.sr = ac.sampleRate;
    this.t0 = seg.start; this.tEnd = seg.end + AUDIO_TAIL;
    this.theory = theory;
    this._noise = null; this._irs = {};
  }
  /** global film time → context time (seconds) */
  t(g) { return Math.max(0, g - this.t0); }
  /** true if a global time falls inside the renderable window */
  inRange(g, dur = 0) { return g + dur >= this.t0 - 0.05 && g <= this.tEnd; }
  db(x) { return Math.pow(10, x / 20); }

  async init() {
    const ac = this.ac;
    this.sum = ac.createGain();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.7;
    const glue = ac.createDynamicsCompressor(); glue.threshold.value = -20; glue.ratio.value = 2.2; glue.knee.value = 12; glue.attack.value = 0.025; glue.release.value = 0.28;
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -9; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.12;
    this.masterGain = ac.createGain(); this.masterGain.gain.value = 0.9;
    this.sum.connect(hp); hp.connect(glue); glue.connect(lim); lim.connect(this.masterGain); this.masterGain.connect(ac.destination);
    this.music = this.bus(0.5); this.sfxBus = this.bus(0.7); this.amb = this.bus(0.45);
    // reverbs (shared returns)
    this.room = await this.reverb(0.7, 0.5, 0.008);
    this.plate = await this.reverb(1.8, 0.35, 0.012);
    this.hall = await this.reverb(3.4, 0.28, 0.022);
    this.space = await this.reverb(7.5, 0.22, 0.04);
    this.under = await this.reverb(2.6, 0.08, 0.01, 900); // muffled underwater space
    this.inst = new Instruments(this);
    this.sfx = new SFX(this);
    return this;
  }
  /** a bus feeding the master sum */
  bus(gain = 1, dest = this.sum) { const g = this.ac.createGain(); g.gain.value = gain; g.connect(dest); return g; }
  /** create a reverb return; returns its input GainNode (connect sends into it) */
  async reverb(seconds, brightness = 0.3, predelay = 0.02, lowpass = 0) {
    const ac = this.ac; const conv = ac.createConvolver(); conv.normalize = true;
    conv.buffer = this.makeIR(seconds, brightness, seconds * 1000 | 0);
    const inp = ac.createGain(); const pd = ac.createDelay(1); pd.delayTime.value = predelay;
    const ret = ac.createGain(); ret.gain.value = 0.9;
    inp.connect(pd); pd.connect(conv);
    if (lowpass) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass; conv.connect(lp); lp.connect(ret); }
    else conv.connect(ret);
    ret.connect(this.sum);
    return inp;
  }
  makeIR(seconds, brightness, seed) {
    const len = Math.floor(this.sr * seconds); const buf = this.ac.createBuffer(2, len, this.sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); const r = rng(seed * 7 + ch * 13 + 1); let lp = 0;
      for (let i = 0; i < len; i++) {
        const tt = i / this.sr; const env = Math.pow(1 - i / len, 2.2) * Math.exp(-tt * 3 / seconds);
        const n = r() * 2 - 1; const a = Math.max(0.02, brightness * Math.exp(-tt * 2.5 / seconds)); lp += (n - lp) * a;
        const early = i < this.sr * 0.08 && r() < 0.004 ? (r() * 2 - 1) * 2 : 0;
        d[i] = (lp * 1.6 + early) * env;
      }
    }
    return buf;
  }
  /** shared white-noise buffer (seeded, 4 s, stereo-decorrelated) */
  noise() {
    if (this._noise) return this._noise;
    const len = this.sr * 4; const b = this.ac.createBuffer(2, len, this.sr);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); const r = rng(991 + ch); for (let i = 0; i < len; i++) d[i] = r() * 2 - 1; }
    this._noise = b; return b;
  }
  noiseSource(when, dur, { loop = true, offset = 0 } = {}) {
    const s = this.ac.createBufferSource(); s.buffer = this.noise(); s.loop = loop;
    s.start(this.t(when), offset % 3.5); s.stop(this.t(when + dur) + 0.05); return s;
  }
  /** route a node to a bus with optional pan & reverb send. Returns the gain node at the end. */
  route(node, { bus = this.music, gain = 1, pan = 0, send = null, sendAmt = 0.25 } = {}) {
    const g = this.ac.createGain(); g.gain.value = gain;
    node.connect(g);
    let out = g;
    if (pan) { const p = this.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(bus);
    if (send) { const s = this.ac.createGain(); s.gain.value = sendAmt; out.connect(s); s.connect(send); }
    return g;
  }
  /**
   * Automate an AudioParam in global time: keys = [[time, value], ...] (linear ramps).
   * Use exp:true for gains in dB-feel ramps.
   */
  automate(param, keys, { exp = false } = {}) {
    keys.forEach(([g, v], i) => {
      const tt = this.t(g);
      if (i === 0) param.setValueAtTime(v, tt);
      else if (exp) param.exponentialRampToValueAtTime(Math.max(1e-4, v), tt);
      else param.linearRampToValueAtTime(v, tt);
    });
  }
  /**
   * AHDSR envelope on a gain AudioParam, starting at GLOBAL time g, gate length dur.
   * Returns the global time at which the voice is silent (for stop()).
   */
  env(param, g, { a = 0.01, d = 0.2, s = 0.6, r = 0.3, peak = 1, dur = 1, curve = 'lin' } = {}) {
    const t = this.t(g); const gate = t + Math.max(dur, a);
    param.setValueAtTime(0.0001, t);
    if (curve === 'exp') param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); else param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(peak * s, t + a, Math.max(0.002, d / 3));
    param.setTargetAtTime(0, gate, Math.max(0.002, r / 4));
    return g + Math.max(dur, a) + r * 1.6;
  }
}

/** Render a segment module's audio to an AudioBuffer (stereo, SR) */
export async function renderSegmentAudio(mod, seg, { sampleRate = SR } = {}) {
  const dur = seg.end - seg.start + AUDIO_TAIL;
  const ac = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const A = new AudioKit(ac, seg); await A.init();
  if (mod && mod.audio) await mod.audio(A);
  return ac.startRendering();
}

/** AudioBuffer → WAV (32-bit float) ArrayBuffer */
export function toWav(buf) {
  const nch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const bytes = 44 + len * nch * 4; const ab = new ArrayBuffer(bytes); const v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); v.setUint16(22, nch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nch * 4, true);
  v.setUint16(32, nch * 4, true); v.setUint16(34, 32, true); ws(36, 'data'); v.setUint32(40, len * nch * 4, true);
  const chans = []; for (let c = 0; c < nch; c++) chans.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) { v.setFloat32(o, chans[c][i], true); o += 4; }
  return ab;
}
/** peak / RMS stats in dBFS for QA */
export function stats(buf) {
  let peak = 0, sum = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 4) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; } }
  return { peakDb: 20 * Math.log10(peak + 1e-9), rmsDb: 10 * Math.log10(sum / n + 1e-12) };
}
