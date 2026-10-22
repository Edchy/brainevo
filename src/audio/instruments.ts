/**
 * The soundscape's instruments: the sounds of each scene (sea, wind, fire, crickets, a bone flute, neurons firing...),
 * every one synthesized here from oscillators, noise and filters. Nothing is a recording.
 *
 * A layer is created when its scene comes near, follows a 0..1 level that the soundscape eases as you move, schedules
 * its own one-shots (a drip, a chirp, a spike) a little ahead of time, and is stopped when it has been silent a while.
 * Layers only use the `now` they are given, so the same code renders offline (src/audio/dev.ts measures them).
 */

export type Ctx = BaseAudioContext;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
/** seconds to the next event of a Poisson process with this mean gap */
const expo = (mean: number) => -Math.log(1 - Math.random() * 0.995) * mean;
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ── noise ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Noise { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }

/** stereo (decorrelated) noise loops, crossfaded into themselves so the loop point has no click */
function noiseLoop(ctx: Ctx, kind: 'white' | 'pink' | 'brown', seconds: number) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds), x = Math.floor(sr * 0.1);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(n + x);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        // Paul Kellet's pink filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      } else { br = (br + 0.02 * w) / 1.02; raw[i] = br; }
    }
    let ss = 0;
    for (let i = 0; i < raw.length; i++) ss += raw[i] * raw[i];
    const norm = 0.25 / Math.sqrt(ss / raw.length); // every kind at the same RMS (-12 dB)
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = raw[i] * norm;
    for (let i = 0; i < x; i++) { const a = i / x; d[i] = (raw[i] * a + raw[n + i] * (1 - a)) * norm; }
  }
  return buf;
}

const noiseCache = new WeakMap<Ctx, Noise>();
export function sharedNoise(ctx: Ctx): Noise {
  let nz = noiseCache.get(ctx);
  if (!nz) {
    nz = { white: noiseLoop(ctx, 'white', 3), pink: noiseLoop(ctx, 'pink', 7), brown: noiseLoop(ctx, 'brown', 7) };
    noiseCache.set(ctx, nz);
  }
  return nz;
}

// ── plumbing ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Drive {
  /** 0..1, how fast the visitor is travelling through time (smoothed) */
  speed: number;
  /** 0..1, how far along the story we are: the brain's own chatter grows denser with it */
  age: number;
  /** MIDI notes of the chord the score is playing, low to high */
  chord: number[];
}

export interface Kit { ctx: Ctx; out: AudioNode; wet: AudioNode; noise: Noise }

export interface Layer {
  /** every ~100 ms: follow `level` (0..1) and schedule whatever is due before `until` */
  update(now: number, until: number, level: number, d: Drive): void;
  stop(at: number): void;
}

/** a clock for sparse events; `fire` may return extra seconds to wait (e.g. the length of a phrase) */
class Clock {
  next = NaN;
  tick(now: number, until: number, gap: () => number, fire: (t: number) => number | void) {
    if (!(this.next >= now)) { const g = gap(); this.next = now + (Number.isFinite(g) ? g * Math.random() : 0.5); }
    for (let guard = 0; this.next < until && guard < 64; guard++) {
      const g = gap();
      if (!Number.isFinite(g)) { this.next = until; return; }
      const extra = fire(this.next) || 0;
      this.next += Math.max(0.004, g) + extra;
    }
  }
}

abstract class Base implements Layer {
  protected k: Kit;
  protected ctx: Ctx;
  protected g: GainNode;
  private scale: number;
  private send: GainNode;
  private loops: AudioScheduledSourceNode[] = [];
  /** scale: level 1 -> this gain; wet: how much goes to the hall reverb */
  constructor(k: Kit, scale: number, wet: number) {
    this.k = k;
    this.ctx = k.ctx;
    this.scale = scale;
    this.g = k.ctx.createGain();
    this.g.gain.value = 0;
    this.g.connect(k.out);
    this.send = k.ctx.createGain();
    this.send.gain.value = wet;
    this.g.connect(this.send).connect(k.wet);
  }
  update(now: number, until: number, level: number, d: Drive) {
    this.g.gain.setTargetAtTime(level * this.scale, now, 0.45);
    this.run(now, until, level, d);
  }
  protected abstract run(now: number, until: number, level: number, d: Drive): void;
  stop(at: number) {
    this.g.gain.cancelScheduledValues(at);
    this.g.gain.setValueAtTime(this.g.gain.value, at);
    this.g.gain.setTargetAtTime(0, at, 0.3);
    for (const s of this.loops) s.stop(at + 1.6);
    if (typeof window !== 'undefined') setTimeout(() => { this.g.disconnect(); this.send.disconnect(); }, 4000);
  }
  /** a looping noise source started at a random point (so layers never share a phase) */
  protected loop(buf: AudioBuffer, at = this.ctx.currentTime) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(at, rand(0, buf.duration));
    this.loops.push(s);
    return s;
  }
  protected keep<T extends AudioScheduledSourceNode>(s: T) { this.loops.push(s); return s; }
  protected pan(p: number, into: AudioNode = this.g) {
    const n = this.ctx.createStereoPanner();
    n.pan.value = Math.max(-1, Math.min(1, p));
    n.connect(into);
    return n;
  }
  protected filter(type: BiquadFilterType, f: number, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  protected gain(v: number) { const n = this.ctx.createGain(); n.gain.value = v; return n; }
  /** a short slice of noise (a click, a scrape) starting at t */
  protected burst(buf: AudioBuffer, t: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.start(t, rand(0, buf.duration - dur - 0.01), dur);
    return s;
  }
  /** a sine (or other) blip with an exponential decay, from the given start frequency to an end one */
  protected ping(t: number, f0: number, f1: number, sweep: number, amp: number, decay: number, into: AudioNode, type: OscillatorType = 'sine') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 > 0 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(into);
    o.start(t); o.stop(t + decay + 0.02);
  }
}

// ── water ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** waves on a shore: on each side, swells of pink noise whose low-pass opens as the wave breaks, then washes back */
class Surf extends Base {
  private sides: { g: GainNode; lp: BiquadFilterNode; clock: Clock }[] = [];
  constructor(k: Kit) {
    super(k, 0.38, 0.12);
    for (const p of [-0.6, 0.6]) {
      const lp = this.filter('lowpass', 420, 0.4);
      const g = this.gain(0.14);
      this.loop(k.noise.pink).connect(lp).connect(g).connect(this.pan(p));
      this.sides.push({ g, lp, clock: new Clock() });
    }
  }
  protected run(now: number, until: number) {
    for (const s of this.sides) s.clock.tick(now, until, () => rand(6.5, 11), (t) => {
      const rise = rand(2.2, 3.4), peak = rand(0.55, 1);
      s.g.gain.setTargetAtTime(peak, t, rise / 3);
      s.lp.frequency.setTargetAtTime(900 + peak * 2400, t, rise / 2.5);
      s.g.gain.setTargetAtTime(0.14, t + rise, rand(1.1, 1.8));
      s.lp.frequency.setTargetAtTime(420, t + rise, 1.4);
    });
  }
}

/** under water: a dark pressure of brown noise and a muffled band above it, slowly shifting */
class Under extends Base {
  private lp: BiquadFilterNode;
  private mid: BiquadFilterNode;
  constructor(k: Kit) {
    super(k, 0.17, 0.06);
    this.lp = this.filter('lowpass', 240, 0.6);
    this.loop(k.noise.brown).connect(this.lp).connect(this.g);
    this.mid = this.filter('bandpass', 520, 0.9);
    this.loop(k.noise.pink).connect(this.mid).connect(this.gain(0.22)).connect(this.g);
  }
  protected run(now: number) {
    if (Math.random() < 0.12) this.lp.frequency.setTargetAtTime(rand(170, 340), now, 1.6);
    if (Math.random() < 0.12) this.mid.frequency.setTargetAtTime(rand(380, 700), now, 2);
  }
}

/** bubbles: sines that rise in pitch as they ring (a bubble's resonance), sometimes in little streams */
class Bubbles extends Base {
  private clock = new Clock();
  private lp: BiquadFilterNode;
  constructor(k: Kit) {
    super(k, 1.6, 0.2);
    this.lp = this.filter('lowpass', 3200, 0.5);
    this.lp.connect(this.g);
  }
  protected run(now: number, until: number, level: number) {
    this.clock.tick(now, until, () => (level > 0.01 ? expo(0.8 / (0.4 + level)) : Infinity), (t) => {
      const n = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 4) : 1;
      const p = this.pan(rand(-0.75, 0.75), this.lp);
      for (let i = 0, x = t; i < n; i++, x += rand(0.03, 0.09)) {
        const f0 = rand(380, 1400);
        this.ping(x, f0, f0 * rand(1.6, 2.4), rand(0.05, 0.1), rand(0.05, 0.13), rand(0.06, 0.12), p);
      }
    });
  }
}

/** cave drips: a few fixed spots, each dripping at its own steady-ish pace and pitch, deep in the reverb */
class Drips extends Base {
  private spots: { f: number; per: number; out: StereoPannerNode; clock: Clock }[] = [];
  constructor(k: Kit) {
    super(k, 1.8, 0.95);
    for (let i = 0; i < 3; i++) this.spots.push({ f: rand(700, 1900), per: rand(1.4, 3.6), out: this.pan(rand(-0.8, 0.8)), clock: new Clock() });
  }
  protected run(now: number, until: number) {
    for (const s of this.spots) s.clock.tick(now, until, () => s.per * rand(0.88, 1.12), (t) => {
      this.ping(t, s.f, s.f * rand(1.5, 1.8), 0.03, rand(0.07, 0.12), rand(0.09, 0.14), s.out);
    });
  }
}

// ── air and earth ────────────────────────────────────────────────────────────────────────────────────────────────────

/** wind: two bands of pink noise, left and right, whose pitch and strength wander in gusts */
class Wind extends Base {
  private bands: { bp: BiquadFilterNode; g: GainNode }[] = [];
  constructor(k: Kit) {
    super(k, 0.55, 0.1);
    for (const p of [-0.65, 0.65]) {
      const bp = this.filter('bandpass', rand(300, 600), 0.9);
      const g = this.gain(0.6);
      this.loop(k.noise.pink).connect(bp).connect(g).connect(this.pan(p));
      this.bands.push({ bp, g });
    }
  }
  protected run(now: number) {
    for (const b of this.bands) {
      if (Math.random() < 0.22) b.bp.frequency.setTargetAtTime(rand(260, 950), now, rand(1, 2.6));
      if (Math.random() < 0.22) b.g.gain.setTargetAtTime(rand(0.3, 1), now, rand(0.8, 2.2));
    }
  }
}

/** a molten, restless earth: a low swelling rumble with the odd deep crack */
class Rumble extends Base {
  private swell: GainNode;
  private clock = new Clock();
  constructor(k: Kit) {
    super(k, 0.32, 0.15);
    this.swell = this.gain(0.6);
    this.loop(k.noise.brown).connect(this.filter('lowpass', 120, 0.8)).connect(this.swell).connect(this.g);
    // a band within reach of small speakers
    this.loop(k.noise.pink).connect(this.filter('bandpass', 190, 1.1)).connect(this.gain(0.3)).connect(this.swell);
  }
  protected run(now: number, until: number, level: number) {
    if (Math.random() < 0.15) this.swell.gain.setTargetAtTime(rand(0.4, 1), now, rand(0.6, 1.8));
    this.clock.tick(now, until, () => (level > 0.05 ? expo(7 / level) : Infinity), (t) => {
      const lp = this.filter('lowpass', 1800, 0.7);
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(160, t + 0.7);
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(rand(0.3, 0.6), t + 0.01);
      g.gain.setTargetAtTime(0, t + 0.02, 0.18);
      this.burst(this.k.noise.brown, t, 1.2).connect(lp).connect(g).connect(this.pan(rand(-0.5, 0.5)));
    });
  }
}

/** fire: a low flickering roar, a thin hiss, and crackles of every size (a few loud pops among many small ticks) */
class Fire extends Base {
  private roar: GainNode;
  private crack: BiquadFilterNode;
  private clock = new Clock();
  constructor(k: Kit) {
    super(k, 0.5, 0.14);
    this.roar = this.gain(0.35);
    this.loop(k.noise.brown).connect(this.filter('lowpass', 420, 0.6)).connect(this.roar).connect(this.g);
    this.loop(k.noise.pink).connect(this.filter('highpass', 2600, 0.6)).connect(this.gain(0.07)).connect(this.g);
    this.crack = this.filter('highpass', 1400, 0.6);
    this.crack.connect(this.g);
  }
  protected run(now: number, until: number, level: number) {
    this.roar.gain.setTargetAtTime(rand(0.18, 0.45), now, 0.07);
    this.clock.tick(now, until, () => (level > 0.01 ? expo(0.1 / (0.3 + level)) : Infinity), (t) => {
      const n = Math.random() < 0.1 ? 3 + Math.floor(Math.random() * 4) : 1;
      const p = this.pan(rand(-0.6, 0.6), this.crack);
      for (let i = 0, x = t; i < n; i++, x += rand(0.008, 0.03)) {
        const g = this.gain(Math.min(0.6, 0.12 * Math.pow(expo(1), 1.6)));
        this.burst(this.k.noise.white, x, rand(0.002, 0.012)).connect(g).connect(p);
      }
    });
  }
}

// ── creatures ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** night insects: three crickets, each a pure tone chirping in short trains of pulses at its own pace */
class Crickets extends Base {
  private voices: { g: GainNode; clock: Clock; per: number; amp: number }[] = [];
  constructor(k: Kit) {
    super(k, 0.85, 0.14);
    for (let i = 0; i < 3; i++) {
      const o = this.keep(k.ctx.createOscillator());
      o.frequency.value = rand(3900, 5200);
      const g = this.gain(0);
      o.connect(g).connect(this.pan(rand(-0.85, 0.85)));
      o.start();
      this.voices.push({ g, clock: new Clock(), per: rand(0.38, 0.7), amp: rand(0.025, 0.06) });
    }
  }
  protected run(now: number, until: number) {
    for (const v of this.voices) v.clock.tick(now, until, () => v.per * rand(0.94, 1.06), (t) => {
      const n = Math.random() < 0.4 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const p = t + i * 0.034;
        v.g.gain.setValueAtTime(0, p);
        v.g.gain.linearRampToValueAtTime(v.amp, p + 0.004);
        v.g.gain.setValueAtTime(v.amp, p + 0.013);
        v.g.gain.linearRampToValueAtTime(0, p + 0.017);
      }
    });
  }
}

/** birdsong: whistled slurs with a warble, quick trills and two-note calls, from all around */
class Birds extends Base {
  private clock = new Clock();
  constructor(k: Kit) { super(k, 2, 0.3); }
  protected run(now: number, until: number, level: number) {
    this.clock.tick(now, until, () => (level > 0.01 ? expo(2.4 / (0.3 + level)) : Infinity), (t) => this.call(t));
  }
  private call(t: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = this.gain(0);
    o.connect(g).connect(this.pan(rand(-0.9, 0.9)));
    const amp = rand(0.03, 0.07);
    const kind = Math.random();
    let x = t;
    const env = (a: number, b: number) => {
      g.gain.setValueAtTime(0, a);
      g.gain.linearRampToValueAtTime(amp, a + Math.min(0.02, (b - a) / 3));
      g.gain.setValueAtTime(amp, Math.max(a + 0.01, b - 0.02));
      g.gain.linearRampToValueAtTime(0, b);
    };
    if (kind < 0.45) {
      // whistled phrase of one to three slurred notes, with a warble
      const base = rand(2200, 3600);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rand(18, 40);
      const depth = this.gain(base * rand(0.015, 0.04));
      lfo.connect(depth).connect(o.frequency);
      const notes = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < notes; i++) {
        const f1 = base * rand(0.9, 1.15), f2 = f1 * pick([0.75, 0.85, 1.2, 1.3]), d = rand(0.12, 0.3);
        o.frequency.setValueAtTime(f1, x);
        o.frequency.exponentialRampToValueAtTime(f2, x + d);
        env(x, x + d);
        x += d + rand(0.05, 0.15);
      }
      lfo.start(t); lfo.stop(x + 0.05);
    } else if (kind < 0.75) {
      // trill: a run of quick falling chirps
      const f = rand(3200, 4600), n = 6 + Math.floor(Math.random() * 9);
      for (let i = 0; i < n; i++) {
        o.frequency.setValueAtTime(f * 1.12, x);
        o.frequency.exponentialRampToValueAtTime(f * 0.88, x + 0.03);
        env(x, x + 0.034);
        x += 0.05;
      }
    } else {
      // two rising calls
      const f = rand(1700, 2400);
      for (let i = 0; i < 2; i++) {
        o.frequency.setValueAtTime(f, x);
        o.frequency.exponentialRampToValueAtTime(f * rand(1.6, 1.9), x + 0.08);
        env(x, x + 0.09);
        x += 0.16;
      }
    }
    o.start(t); o.stop(x + 0.05);
  }
}

/** a heartbeat (lub-dub) at a resting 70 a minute, quickening when you rush through time */
class Heart extends Base {
  private clock = new Clock();
  private bpm = 70;
  constructor(k: Kit) { super(k, 0.4, 0.06); }
  protected run(now: number, until: number, _level: number, d: Drive) {
    this.bpm += (70 + 45 * d.speed - this.bpm) * 0.08;
    this.clock.tick(now, until, () => (60 / this.bpm) * rand(0.97, 1.03), (t) => {
      this.thump(t, 0.5, 54);
      this.thump(t + 0.27, 0.32, 62);
    });
  }
  private thump(t: number, a: number, f: number) {
    this.ping(t, f, f * 0.7, 0.12, a, 0.24, this.g);
    this.ping(t, f * 2, f * 1.4, 0.1, a * 0.45, 0.16, this.g); // a harmonic small speakers can play
  }
}

/**
 * A slow breath, in for 4 s and out for 6, on the same page clock as the breathing light at "Here, now"
 * (src/scenes/future/Coda.tsx breathAt): air through the nose, louder while it flows, brighter breathing in.
 */
class Breath extends Base {
  private bp: BiquadFilterNode;
  private flow: GainNode;
  constructor(k: Kit) {
    super(k, 0.9, 0.18);
    this.bp = this.filter('bandpass', 1100, 0.8);
    this.flow = this.gain(0);
    this.loop(k.noise.pink).connect(this.filter('highpass', 350, 0.7)).connect(this.bp).connect(this.flow).connect(this.g);
  }
  protected run(now: number) {
    const s = (typeof performance !== 'undefined' ? performance.now() : now * 1000) / 1000 + 0.1;
    const p = (s % 10) / 10;
    const inhale = p < 0.4;
    // airflow is the rate of change of the breath: a rounded bump in, a longer softer bump out
    const flow = inhale ? Math.sin((p / 0.4) * Math.PI) : 0.7 * Math.sin(((p - 0.4) / 0.6) * Math.PI);
    this.flow.gain.setTargetAtTime(Math.max(0, flow) * 0.9, now, 0.09);
    this.bp.frequency.setTargetAtTime(inhale ? 1500 : 850, now, 0.3);
  }
}

// ── the brain ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** one action potential as an electrode hears it: a sharp dip and a slower overshoot, about 3 ms */
function spikeShape(ctx: Ctx) {
  const sr = ctx.sampleRate, n = Math.floor(sr * 0.004);
  const b = ctx.createBuffer(1, n, sr);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const ms = (i / sr) * 1000;
    d[i] = -Math.exp(-(((ms - 0.5) / 0.14) ** 2)) + 0.42 * Math.exp(-(((ms - 1.15) / 0.36) ** 2));
  }
  return b;
}

/**
 * Neurons firing, as heard through an amplified electrode: clicks over a faint hiss. The population fires faster the
 * further along the story (bigger brains) and the faster you travel; now and then a cell bursts.
 */
class Spikes extends Base {
  private cells: { g: GainNode; clock: Clock; rate: number; pr: number }[] = [];
  private shape: AudioBuffer;
  constructor(k: Kit) {
    super(k, 1.25, 0.12);
    this.shape = spikeShape(k.ctx);
    const hp = this.filter('highpass', 250, 0.7);
    hp.connect(this.g);
    for (let i = 0; i < 6; i++) {
      const g = this.gain(rand(0.08, 0.3));
      g.connect(this.pan(rand(-0.8, 0.8), hp));
      this.cells.push({ g, clock: new Clock(), rate: rand(0.6, 2.4), pr: rand(0.8, 1.25) });
    }
    this.loop(k.noise.white).connect(this.filter('highpass', 1800, 0.7)).connect(this.gain(0.012)).connect(this.g);
  }
  protected run(now: number, until: number, level: number, d: Drive) {
    const k = Math.min(6, (0.4 + 1.6 * d.age) * (1 + 3 * d.speed) * (0.3 + level));
    for (const c of this.cells) c.clock.tick(now, until, () => (level > 0.01 ? expo(1 / (c.rate * k)) : Infinity), (t) => {
      const n = Math.random() < 0.14 ? 2 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0, x = t; i < n; i++, x += rand(0.004, 0.009)) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.shape; s.playbackRate.value = c.pr;
        s.connect(c.g);
        s.start(x);
      }
    });
  }
}

/** a voice before words: a hummed tone through the resonances of a vocal tract, drifting from vowel to vowel */
const VOWELS: [number, number, number][] = [[730, 1090, 2440], [570, 840, 2410], [300, 870, 2240], [530, 1840, 2480], [390, 1990, 2550]];
class Vowel extends Base {
  private srcs: OscillatorNode[] = [];
  private bands: BiquadFilterNode[] = [];
  private breath: GainNode;
  private clock = new Clock();
  constructor(k: Kit) {
    super(k, 0.8, 0.45);
    this.breath = this.gain(0.5);
    this.breath.connect(this.g);
    const qs = [9, 12, 14], gs = [1.6, 0.8, 0.4];
    const sum = this.gain(1);
    VOWELS[0].forEach((f, i) => {
      const bp = this.filter('bandpass', f, qs[i]);
      sum.connect(bp).connect(this.gain(gs[i])).connect(this.breath);
      this.bands.push(bp);
    });
    const vib = this.keep(k.ctx.createOscillator());
    vib.frequency.value = 5.1;
    const vibG = this.gain(7); // cents
    vib.connect(vibG);
    vib.start();
    for (const [mul, a, det] of [[1, 0.5, 0], [1, 0.35, 9], [1.5, 0.25, -5]] as const) {
      const o = this.keep(k.ctx.createOscillator());
      o.type = 'sawtooth'; o.frequency.value = 120 * mul; o.detune.value = det;
      vibG.connect(o.detune);
      o.connect(this.gain(a)).connect(sum);
      o.start();
      this.srcs.push(o);
    }
  }
  protected run(now: number, until: number, _level: number, d: Drive) {
    let root = d.chord[0] ?? 45;
    while (mtof(root) < 95) root += 12;
    while (mtof(root) > 165) root -= 12;
    const f = mtof(root);
    this.srcs.forEach((o, i) => o.frequency.setTargetAtTime(f * (i === 2 ? 1.5 : 1), now, 0.4));
    this.clock.tick(now, until, () => rand(2.8, 5), (t) => {
      const v = pick(VOWELS);
      this.bands.forEach((b, i) => b.frequency.setTargetAtTime(v[i], t, 0.5));
      this.breath.gain.setTargetAtTime(rand(0.3, 1), t, rand(0.8, 1.6));
    });
  }
}

// ── tools and hands ──────────────────────────────────────────────────────────────────────────────────────────────────

/** stone knapping: two to four sharp strikes, a pause, again; each a ringing click over a dull knock */
class Knap extends Base {
  private clock = new Clock();
  private left = 0;
  constructor(k: Kit) { super(k, 0.68, 0.22); }
  protected run(now: number, until: number, level: number) {
    const gap = () => {
      if (level < 0.01) return Infinity;
      if (this.left-- > 0) return rand(0.45, 0.85);
      this.left = 1 + Math.floor(Math.random() * 3);
      return rand(2.2, 5) / (0.4 + level);
    };
    this.clock.tick(now, until, gap, (t) => {
      const a = rand(0.6, 1);
      const out = this.pan(rand(-0.25, 0.25));
      const g = this.gain(0);
      g.gain.setValueAtTime(1.6 * a, t);
      g.gain.setTargetAtTime(0, t + 0.002, 0.02);
      this.burst(this.k.noise.white, t, 0.014).connect(this.filter('bandpass', rand(2200, 3800), 4)).connect(g).connect(out);
      this.ping(t, rand(1700, 3100), 0, 0, 0.07 * a, 0.08, out);
      this.ping(t, 150, 80, 0.06, 0.18 * a, 0.09, out);
    });
  }
}

/** writing: a stylus or quill scratching in little clusters of strokes */
class Scratch extends Base {
  private clock = new Clock();
  private left = 0;
  constructor(k: Kit) { super(k, 1.6, 0.12); }
  protected run(now: number, until: number, level: number) {
    const gap = () => {
      if (level < 0.01) return Infinity;
      if (this.left-- > 0) return rand(0.09, 0.22);
      this.left = 1 + Math.floor(Math.random() * 4);
      return rand(0.6, 2.4);
    };
    this.clock.tick(now, until, gap, (t) => {
      const d = rand(0.04, 0.14);
      const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rand(0.5, 1), t + d * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      this.burst(this.k.noise.pink, t, d + 0.02).connect(this.filter('bandpass', rand(2400, 4200), 1.6)).connect(g).connect(this.pan(rand(-0.2, 0.2)));
    });
  }
}

/** a bone flute: short breathy phrases on the notes of the score's chord, with vibrato, ringing in the cave */
class Flute extends Base {
  private clock = new Clock();
  private wave: PeriodicWave;
  constructor(k: Kit) {
    super(k, 0.85, 0.75);
    const h = [0, 1, 0.32, 0.12, 0.05, 0.02];
    this.wave = k.ctx.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
  }
  protected run(now: number, until: number, level: number, d: Drive) {
    this.clock.tick(now, until, () => (level > 0.05 ? rand(3, 7) : Infinity), (t) => this.phrase(t, d.chord));
  }
  private phrase(t: number, chord: number[]) {
    const ctx = this.ctx;
    const pcs = [...new Set(chord.map((n) => n % 12))];
    const pool: number[] = [];
    for (let n = 72; n <= 89; n++) if (pcs.includes(n % 12)) pool.push(n);
    if (!pool.length) return 0;
    const o = ctx.createOscillator();
    o.setPeriodicWave(this.wave);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(4.6, 5.6);
    const vib = this.gain(0);
    lfo.connect(vib).connect(o.detune);
    const env = this.gain(0);
    o.connect(env);
    const out = this.pan(rand(-0.3, 0.3));
    env.connect(out);
    // breath: noise through a resonance that follows the note
    const bp = this.filter('bandpass', 1000, 3);
    const breath = this.gain(0);
    const air = ctx.createBufferSource();
    air.buffer = this.k.noise.pink; air.loop = true;
    air.connect(bp).connect(breath).connect(out);
    const a = 0.09;
    let i = Math.floor(pool.length * rand(0.2, 0.6)), x = t;
    const notes = 3 + Math.floor(Math.random() * 4);
    o.frequency.setValueAtTime(mtof(pool[i]), t);
    bp.frequency.setValueAtTime(mtof(pool[i]), t);
    for (let k = 0; k < notes && x - t < 6.5; k++) {
      const f = mtof(pool[i]);
      const dur = pick([0.45, 0.6, 0.9, 1.2]) * (k === notes - 1 ? 1.8 : 1);
      o.frequency.setTargetAtTime(f, x, 0.025);
      bp.frequency.setTargetAtTime(f, x, 0.025);
      env.gain.setTargetAtTime(a, x, 0.05);
      breath.gain.setTargetAtTime(a * 2.2, x, 0.03);
      breath.gain.setTargetAtTime(a * 0.9, x + 0.08, 0.1);
      vib.gain.setValueAtTime(0, x);
      vib.gain.linearRampToValueAtTime(dur > 0.7 ? 16 : 6, x + dur * 0.8);
      env.gain.setTargetAtTime(a * 0.4, x + dur - 0.07, 0.025);
      x += dur;
      i = Math.max(0, Math.min(pool.length - 1, i + pick([-2, -1, -1, 1, 1, 2])));
    }
    env.gain.setTargetAtTime(0, x - 0.05, 0.12);
    breath.gain.setTargetAtTime(0, x - 0.05, 0.08);
    o.start(t); lfo.start(t); air.start(t, rand(0, 5));
    o.stop(x + 1); lfo.stop(x + 1); air.stop(x + 1);
    return x - t;
  }
}

/** an early printing press: the screw creaks down, the platen lands with a thunk, the bed slides back with a clack */
class Press extends Base {
  private clock = new Clock();
  constructor(k: Kit) { super(k, 0.6, 0.28); }
  protected run(now: number, until: number, level: number) {
    this.clock.tick(now, until, () => (level > 0.05 ? 2.6 * rand(0.94, 1.06) : Infinity), (t) => {
      const creak = this.filter('bandpass', 280, 9);
      creak.frequency.setValueAtTime(280, t);
      creak.frequency.exponentialRampToValueAtTime(620, t + 0.7);
      const cg = this.gain(0);
      cg.gain.setValueAtTime(0.0001, t);
      cg.gain.exponentialRampToValueAtTime(1.2, t + 0.2);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      this.burst(this.k.noise.pink, t, 0.8).connect(creak).connect(cg).connect(this.pan(0.15));
      const th = t + 0.9;
      this.ping(th, 95, 55, 0.15, 0.4, 0.3, this.g);
      const tg = this.gain(0);
      tg.gain.setValueAtTime(1.2, th);
      tg.gain.setTargetAtTime(0, th + 0.002, 0.03);
      this.burst(this.k.noise.white, th, 0.04).connect(this.filter('bandpass', 650, 2.5)).connect(tg).connect(this.g);
      const cl = t + 1.55;
      const kg = this.gain(0);
      kg.gain.setValueAtTime(1, cl);
      kg.gain.setTargetAtTime(0, cl + 0.002, 0.015);
      this.burst(this.k.noise.white, cl, 0.02).connect(this.filter('bandpass', 1900, 4)).connect(kg).connect(this.pan(-0.2));
    });
  }
}

/** a pendulum clock: tick, tock */
class Tick extends Base {
  private clock = new Clock();
  private n = 0;
  constructor(k: Kit) { super(k, 1, 0.25); }
  protected run(now: number, until: number, level: number) {
    this.clock.tick(now, until, () => (level > 0.02 ? 1 : Infinity), (t) => {
      const f = this.n++ % 2 ? 2500 : 3100;
      const g = this.gain(0);
      g.gain.setValueAtTime(2.5, t);
      g.gain.setTargetAtTime(0, t + 0.002, 0.012);
      this.burst(this.k.noise.white, t, 0.008).connect(this.filter('bandpass', f, 12)).connect(g).connect(this.g);
      this.ping(t, f * 0.8, 0, 0, 0.02, 0.05, this.g);
    });
  }
}

/** an MRI scanner at work: blocks of rapid knocking from the switching gradients */
class Mri extends Base {
  private gate: GainNode;
  private clock = new Clock();
  private left = 0;
  constructor(k: Kit) {
    super(k, 0.5, 0.08);
    const o = this.keep(k.ctx.createOscillator());
    o.type = 'square'; o.frequency.value = 760;
    this.gate = this.gain(0);
    o.connect(this.filter('lowpass', 2400, 0.7)).connect(this.gate).connect(this.g);
    o.start();
  }
  protected run(now: number, until: number, level: number) {
    const gap = () => {
      if (level < 0.02) return Infinity;
      if (this.left-- > 0) return 0.1;
      this.left = 21;
      return 0.9;
    };
    this.clock.tick(now, until, gap, (t) => {
      this.gate.gain.setValueAtTime(0, t);
      this.gate.gain.linearRampToValueAtTime(0.12, t + 0.003);
      this.gate.gain.setValueAtTime(0.12, t + 0.042);
      this.gate.gain.linearRampToValueAtTime(0, t + 0.045);
    });
  }
}

/** computation: soft blips on a quick grid, on the notes of the score's chord */
class Data extends Base {
  private clock = new Clock();
  private side = 1;
  constructor(k: Kit) { super(k, 1.8, 0.35); }
  protected run(now: number, until: number, level: number, d: Drive) {
    this.clock.tick(now, until, () => (level > 0.02 ? 60 / 112 / 4 : Infinity), (t) => {
      if (Math.random() > 0.16 + 0.3 * level) return;
      let n = pick(d.chord) + pick([24, 36]);
      while (mtof(n) > 3600) n -= 12;
      this.side = -this.side;
      this.ping(t, mtof(n), mtof(n), 0, rand(0.04, 0.08), rand(0.05, 0.12), this.pan(this.side * rand(0.2, 0.5)));
    });
  }
}

/** starlight: rare high glints on the notes of the score's chord, far off in the hall */
class Sparkle extends Base {
  private clock = new Clock();
  constructor(k: Kit) { super(k, 1.25, 0.85); }
  protected run(now: number, until: number, level: number, d: Drive) {
    this.clock.tick(now, until, () => (level > 0.02 ? expo(0.5 / (0.3 + level)) : Infinity), (t) => {
      let n = pick(d.chord.slice(1)) + pick([24, 36]);
      while (mtof(n) > 6000) n -= 12;
      const out = this.pan(rand(-0.9, 0.9));
      const dur = rand(0.5, 1.4);
      this.ping(t, mtof(n), mtof(n), 0, 0.04, dur, out);
      this.ping(t, mtof(n) * 2.76, mtof(n) * 2.76, 0, 0.008, dur * 0.4, out);
    });
  }
}

export const LAYERS = {
  surf: Surf, under: Under, bubbles: Bubbles, drips: Drips,
  wind: Wind, rumble: Rumble, fire: Fire,
  crickets: Crickets, birds: Birds, heart: Heart, breath: Breath,
  spikes: Spikes, voice: Vowel,
  knap: Knap, scratch: Scratch, flute: Flute, press: Press, clock: Tick, mri: Mri, data: Data,
  sparkle: Sparkle,
} satisfies Record<string, new (k: Kit) => Layer>;

export type LayerId = keyof typeof LAYERS;
export const LAYER_IDS = Object.keys(LAYERS) as LayerId[];
