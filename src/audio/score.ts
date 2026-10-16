import { events } from '../data';
import type { Era } from '../types';
import { world } from '../world/store';
import { getSettings, subscribe } from '../style/store';
import { getBus, isRunning, onAudioChange } from './engine';

/**
 * Generative score. Each era has a key and a slow progression; the bed is played by detuned, low-passed sawtooth pads
 * (string-like, through the long hall), over a quiet drone on the era's root. Sparse glass bells pick notes from the
 * current chord. Moving through time breathes: a band of air opens with the scroll speed. Story beats (the Big Bang,
 * the asteroid, each breakthrough) land with a deep impact.
 *
 * A recorded track can replace an era's bed: drop `src/assets/music/<era>.mp3` (era ids in src/types.ts); it loops and
 * crossfades like the generated bed, and the bells stay quiet over it. Air and impacts still play.
 */
const TRACKS_RAW = import.meta.glob('../assets/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const TRACKS: Partial<Record<Era, string>> = {};
for (const [p, url] of Object.entries(TRACKS_RAW)) TRACKS[p.split('/').pop()!.replace(/\.mp3$/, '') as Era] = url;

interface Harmony { chords: number[][]; bright: number; bells: number; }
// MIDI notes, voiced low to high. bright 0..1 opens the pad filter; bells = mean seconds between bell notes (0 = none)
const HARMONY: Record<Era, Harmony> = {
  cosmic: { bright: 0.1, bells: 7, chords: [[38, 45, 50, 52, 57], [34, 41, 46, 50, 53], [36, 43, 48, 50, 55], [33, 40, 45, 48, 52]] },
  origin: { bright: 0.3, bells: 5, chords: [[40, 47, 52, 56, 59, 63], [42, 49, 54, 58, 61], [37, 44, 49, 52, 56], [45, 52, 57, 61, 64]] },
  nerves: { bright: 0.3, bells: 4.5, chords: [[42, 49, 54, 57, 61], [38, 45, 50, 54, 57], [35, 42, 47, 50, 54], [37, 44, 49, 53, 56]] },
  vertebrate: { bright: 0.35, bells: 5, chords: [[43, 50, 55, 58, 62], [36, 43, 48, 52, 55], [41, 48, 53, 57, 60], [46, 53, 58, 62, 65]] },
  mammal: { bright: 0.45, bells: 5, chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [36, 43, 48, 52, 55], [43, 50, 55, 59, 62]] },
  primate: { bright: 0.5, bells: 4.5, chords: [[41, 48, 53, 57, 64], [45, 52, 57, 60, 67], [40, 47, 52, 55, 62], [43, 50, 55, 59, 62]] },
  hominin: { bright: 0.4, bells: 6, chords: [[38, 45, 50, 53, 57], [36, 43, 48, 52, 55], [34, 41, 46, 50, 53], [33, 40, 45, 49, 52]] },
  sapiens: { bright: 0.55, bells: 4, chords: [[39, 46, 51, 55, 58, 62], [36, 43, 48, 51, 55], [44, 51, 56, 60, 63], [46, 53, 58, 62, 65]] },
  modern: { bright: 0.65, bells: 3.5, chords: [[40, 47, 52, 56, 59, 63], [37, 44, 49, 52, 56, 59], [45, 52, 57, 61, 64, 68], [47, 54, 59, 63, 66]] },
};
const CHORD_S = 13; // seconds per chord (+ a little jitter)
const ATTACK = 4.5, RELEASE = 6;
const LEVEL = 0.7; // bed level into the music bus (bed alone renders at about -28 dB RMS)
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Ctx = BaseAudioContext;

/** one sustained chord: detuned saw pairs (+ a sine sub under the root) through a slowly breathing low-pass */
function chordVoice(ctx: Ctx, out: AudioNode, notes: number[], bright: number, at: number) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.5;
  lp.frequency.value = 480 + bright * 1300;
  lp.connect(g);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rand(0.05, 0.09);
  const lfoG = ctx.createGain();
  lfoG.gain.value = 120 + bright * 260;
  lfo.connect(lfoG).connect(lp.frequency);
  lfo.start(at);
  const srcs: OscillatorNode[] = [lfo];
  notes.forEach((n, i) => {
    const f = mtof(n);
    const w = i === 0 ? 1.1 : 1 - i * 0.06; // upper voices a touch softer
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + rand(-3, 3);
      const og = ctx.createGain();
      og.gain.value = 0.02 * w;
      o.connect(og).connect(lp);
      o.start(at);
      srcs.push(o);
    }
    if (i === 0) {
      const sub = ctx.createOscillator();
      sub.type = 'sine'; sub.frequency.value = f / 2;
      const sg = ctx.createGain(); sg.gain.value = 0.07;
      sub.connect(sg).connect(g);
      sub.start(at);
      srcs.push(sub);
    }
  });
  g.gain.setValueAtTime(0, at);
  g.gain.setTargetAtTime(1, at, ATTACK / 3);
  return {
    release(t: number) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(0, t, RELEASE / 3);
      for (const s of srcs) s.stop(t + RELEASE * 1.6);
      setTimeout(() => g.disconnect(), (RELEASE * 1.6 + 0.5) * 1000);
    },
  };
}

/** a glassy bell: inharmonic sine partials with their own decays */
function bell(ctx: Ctx, out: AudioNode, note: number, at: number, vel: number) {
  const f = mtof(note);
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.65, 0.65);
  pan.connect(out);
  const parts: [number, number, number][] = [[1, 1, 4.2], [2.0, 0.32, 2.6], [2.76, 0.2, 1.8], [5.4, 0.06, 0.9]];
  for (const [ratio, amp, dec] of parts) {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(amp * vel, at + 0.012);
    g.gain.setTargetAtTime(0, at + 0.012, dec / 4.5);
    o.connect(g).connect(pan);
    o.start(at); o.stop(at + dec + 0.2);
  }
}

/** deep story beat: a falling sub, a dark noise bloom, and a low cluster that hangs in the hall */
function impact(ctx: Ctx, out: AudioNode, noise: AudioBuffer, at: number, size: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(92, at);
  o.frequency.exponentialRampToValueAtTime(30, at + 2.6);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0, at);
  og.gain.linearRampToValueAtTime(0.36 * size, at + 0.025);
  og.gain.setTargetAtTime(0, at + 0.1, 0.9);
  o.connect(og).connect(out);
  o.start(at); o.stop(at + 4.5);
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, at); lp.frequency.exponentialRampToValueAtTime(120, at + 1.8);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, at);
  ng.gain.linearRampToValueAtTime(0.14 * size, at + 0.02);
  ng.gain.setTargetAtTime(0, at + 0.05, 0.45);
  n.connect(lp).connect(ng).connect(out);
  n.start(at); n.stop(at + 3);
}

function noiseBuffer(ctx: Ctx, seconds = 2) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let p = 0;
  for (let i = 0; i < d.length; i++) { p = 0.97 * p + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.6 + p * 4; } // pinkish
  return b;
}

const eraAt = (f: number): Era => events[Math.max(0, Math.min(events.length - 1, Math.round(f)))].era;

// beats that land with an impact, as station positions (crossed going forward)
function beats() {
  const idx = (id: string) => events.findIndex((e) => e.id === id);
  const out: { at: number; size: number }[] = [{ at: -0.22, size: 1.3 }];
  const kpg = idx('kpg-mammal-radiation');
  if (kpg >= 0) out.push({ at: kpg - 0.18, size: 1 });
  const seen = new Set<string>();
  events.forEach((e, i) => { if (e.breakthrough && !seen.has(e.breakthrough)) { seen.add(e.breakthrough); out.push({ at: i - 0.35, size: 0.7 }); } });
  return out;
}

class Score {
  private bed: ReturnType<typeof chordVoice> | null = null;
  private track: { el: HTMLAudioElement; gain: GainNode; era: Era } | null = null;
  private era: Era | null = null;
  private chordIx = 0;
  private nextChord = 0;
  private nextBell = 0;
  private level: GainNode | null = null;
  private air: { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private lastF = world.stationF;
  private beats = beats();
  private on = false;

  tick() {
    const bus = getBus();
    const s = getSettings();
    const want = !!bus && isRunning() && s.sound && s.music;
    if (!bus) return;
    const ctx = bus.ctx, now = ctx.currentTime;
    if (!this.level) {
      this.level = ctx.createGain();
      this.level.gain.value = 0;
      this.level.connect(bus.music);
      this.noise = noiseBuffer(ctx);
    }
    if (want !== this.on) {
      this.on = want;
      this.level.gain.setTargetAtTime(want ? LEVEL : 0, now, want ? 1.2 : 0.5);
      if (!want) { this.stopAll(now + 1.5); return; }
      this.startAir(ctx);
    }
    if (!this.on) { this.lastF = world.stationF; return; }

    const f = world.stationF;
    const era = eraAt(f);
    const h = HARMONY[era];
    if (era !== this.era) {
      this.era = era;
      this.chordIx = 0;
      this.nextChord = now; // move to the new key at once
      this.setTrack(ctx, era, now);
    }
    if (now >= this.nextChord) {
      if (!TRACKS[era]) {
        const prev = this.bed;
        this.bed = chordVoice(ctx, this.level, h.chords[this.chordIx % h.chords.length], h.bright, now + 0.05);
        prev?.release(now + 0.05);
      } else if (this.bed) { this.bed.release(now); this.bed = null; }
      this.chordIx++;
      this.nextChord = now + CHORD_S + rand(-1.5, 2.5);
    }
    // bells, from the current chord, an octave or two up
    if (h.bells > 0 && !TRACKS[era] && now >= this.nextBell) {
      const ch = h.chords[(this.chordIx + h.chords.length - 1) % h.chords.length];
      const n = ch[1 + Math.floor(Math.random() * (ch.length - 1))] + (Math.random() < 0.5 ? 24 : 12);
      bell(ctx, this.level, n, now + 0.02, rand(0.035, 0.07));
      this.nextBell = now + h.bells * rand(0.55, 1.6);
    }
    // air follows the scroll speed
    if (this.air) {
      const v = Math.min(1, Math.abs(world.velocity) / 2.5);
      this.air.bp.frequency.setTargetAtTime(260 + v * 2600, now, 0.18);
      this.air.g.gain.setTargetAtTime(0.012 + v * v * 0.16, now, 0.2);
    }
    // story beats, only when crossed going forward at a travelling pace (not on jumps from the menu)
    const df = f - this.lastF;
    if (df > 0 && df < 1.5) for (const b of this.beats) if (this.lastF < b.at && f >= b.at) impact(ctx, bus.fx, this.noise!, now + 0.02, b.size);
    this.lastF = f;
  }

  private startAir(ctx: AudioContext) {
    if (this.air || !this.noise || !this.level) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.level);
    src.start();
    this.air = { src, bp, g };
  }

  private setTrack(ctx: AudioContext, era: Era, now: number) {
    const url = TRACKS[era];
    const old = this.track;
    if (old && old.era !== era) {
      old.gain.gain.setTargetAtTime(0, now, 1.2);
      setTimeout(() => { old.el.pause(); }, 5000);
      this.track = null;
    }
    if (!url || this.track?.era === era || !this.level) return;
    const el = new Audio(url);
    el.loop = true; el.crossOrigin = 'anonymous';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(this.level);
    gain.gain.setTargetAtTime(1.4, now, 1.5);
    el.play().catch(() => {});
    this.track = { el, gain, era };
  }

  private stopAll(t: number) {
    this.bed?.release(t); this.bed = null;
    if (this.air) { this.air.src.stop(t + 1); this.air = null; }
    if (this.track) { const tr = this.track; tr.gain.gain.setTargetAtTime(0, t - 1.2, 0.4); setTimeout(() => tr.el.pause(), 2500); this.track = null; }
    this.era = null;
  }
}

const score = new Score();
if (typeof window !== 'undefined') {
  setInterval(() => score.tick(), 100);
  const kick = () => score.tick();
  subscribe(kick);
  onAudioChange(kick);
}

/**
 * Dev: render `seconds` of an era's bed offline and report its level, so gain staging can be checked without
 * listening. window.__scoreTest('mammal', 20) -> { peak, rms } (linear, pre-limiter).
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__scoreTest = async (era: Era = 'cosmic', seconds = 20) => {
    const sr = 44100;
    const ctx = new OfflineAudioContext(2, sr * seconds, sr);
    const lvl = ctx.createGain(); lvl.gain.value = LEVEL; lvl.connect(ctx.destination);
    const h = HARMONY[era];
    let t = 0, i = 0;
    const voices: ReturnType<typeof chordVoice>[] = [];
    while (t < seconds) { const v = chordVoice(ctx, lvl, h.chords[i % h.chords.length], h.bright, t); voices.at(-1)?.release(t); voices.push(v); t += CHORD_S; i++; }
    for (let b = 1; b < seconds; b += h.bells || 99) bell(ctx, lvl, h.chords[0][2] + 24, b, 0.07);
    impact(ctx, ctx.destination, noiseBuffer(ctx), seconds - 4, 1.3);
    const buf = await ctx.startRendering();
    let peak = 0, sum = 0;
    const d = buf.getChannelData(0);
    for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > peak) peak = a; sum += d[k] * d[k]; }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), rmsDb: +(20 * Math.log10(Math.sqrt(sum / d.length))).toFixed(1) };
  };
}
