/**
 * The score gathers history. Each of Bennett's five breakthroughs adds a voice to the music, and it stays, so the
 * present is played by everything the brain has acquired:
 *
 *   1 steering     a slow bass pulse on the chord's root and fifth: going somewhere
 *   2 reinforcing  a rising three-note chime now and then: the reward
 *   3 simulating   a soft melody note that echoes left and right: futures tried in the head
 *   4 mentalizing  a second, lower voice that answers the melody: another mind
 *   5 speaking     a hummed choir on the chord: voices
 *
 * Going back in time takes the voices away again. Everything is synthesized and tuned to the score's chord; the
 * ensemble plays into the score's own level, so it ducks under the narration with the rest of the music. Like the
 * instruments, it only uses the `now` it is given (src/audio/dev.ts renders it offline).
 */
type Ctx = BaseAudioContext;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** level of each voice (into the score's level node) */
const MIX = [0.5, 0.34, 0.3, 0.26, 0.2];

export class Ensemble {
  private ctx: Ctx;
  private gains: GainNode[] = [];
  private next = [0, 0, 0, 0, 0];
  private beat = 0;
  private echoIn: GainNode;
  private choir: { oscs: OscillatorNode[]; bands: BiquadFilterNode[]; key: string } | null = null;
  private melody = 76;

  constructor(ctx: Ctx, out: AudioNode) {
    this.ctx = ctx;
    for (let i = 0; i < 5; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(out);
      this.gains.push(g);
    }
    // ping-pong echo for the simulating melody: two delays feeding each other through a darkening filter
    this.echoIn = ctx.createGain();
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2);
    dl.delayTime.value = 0.43; dr.delayTime.value = 0.65;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
    const merge = ctx.createChannelMerger(2);
    this.echoIn.connect(dl);
    dl.connect(merge, 0, 0);
    dl.connect(dr);
    dr.connect(merge, 0, 1);
    dr.connect(tone).connect(fb).connect(dl);
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    merge.connect(wet).connect(this.gains[2]);
  }

  /** fade everything out (music switched off) */
  silence(now: number) {
    for (const g of this.gains) { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.3); }
    if (this.choir) { for (const o of this.choir.oscs) o.stop(now + 1.5); this.choir = null; }
  }

  /** `have`: how many breakthroughs the story has reached (0..5); `chord`: the score's chord, MIDI low to high */
  update(now: number, until: number, have: number, chord: number[]) {
    this.gains.forEach((g, i) => g.gain.setTargetAtTime(have > i ? MIX[i] : 0, now, have > i ? 1.6 : 0.8));
    if (have > 0) this.pulse(now, until, chord);
    if (have > 1) this.reward(now, until, chord);
    if (have > 2) this.imagine(now, until, chord, have > 3);
    this.voices(now, have > 4, chord);
  }

  private due(i: number, now: number, until: number, gap: () => number, fire: (t: number) => void) {
    if (this.next[i] < now) this.next[i] = now + gap() * Math.random();
    for (let guard = 0; this.next[i] < until && guard < 16; guard++) { fire(this.next[i]); this.next[i] += gap(); }
  }

  /** a soft note with an exponential tail: sine plus a little of its octave, through a low-pass */
  private note(t: number, midi: number, amp: number, decay: number, into: AudioNode, type: OscillatorType = 'sine', cutoff = 4000) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = mtof(midi);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.012);
    g.gain.setTargetAtTime(0, t + 0.012, decay / 4);
    o.connect(lp).connect(g).connect(into);
    o.start(t); o.stop(t + decay + 0.1);
    return g;
  }

  // 1 steering: root and fifth, alternating, about 27 beats a minute
  private pulse(now: number, until: number, chord: number[]) {
    this.due(0, now, until, () => 2.2, (t) => {
      let root = chord[0];
      while (root > 45) root -= 12;
      const m = this.beat++ % 2 ? root + 7 : root;
      this.note(t, m, 0.32, 1.2, this.gains[0], 'triangle', 420);
      this.note(t, m - 12, 0.22, 0.9, this.gains[0], 'sine', 300);
    });
  }

  // 2 reinforcing: three chord tones rising quickly, two octaves up, every ten seconds or so
  private reward(now: number, until: number, chord: number[]) {
    this.due(1, now, until, () => rand(8, 14), (t) => {
      const tones = chord.slice(1, 4);
      tones.forEach((n, k) => {
        let m = n + 24;
        while (mtof(m) > 2400) m -= 12;
        this.note(t + k * 0.11, m, 0.11, 1.4, this.gains[1]);
        this.note(t + k * 0.11, m + 19, 0.018, 0.5, this.gains[1]); // a glint of the 3rd harmonic
      });
    });
  }

  // 3 simulating: a slow melody wandering over the chord, each note echoing; 4 mentalizing: a lower voice answers
  private imagine(now: number, until: number, chord: number[], answer: boolean) {
    this.due(2, now, until, () => rand(3.4, 6), (t) => {
      const pool: number[] = [];
      for (let m = 69; m <= 86; m++) if (chord.some((c) => (m - c) % 12 === 0)) pool.push(m);
      if (!pool.length) return;
      // step to a near chord tone
      pool.sort((a, b) => Math.abs(a - this.melody) - Math.abs(b - this.melody));
      this.melody = pick(pool.slice(0, 3));
      const g = this.note(t, this.melody, 0.16, 1.6, this.gains[2]);
      g.connect(this.echoIn);
      if (answer && Math.random() < 0.65) {
        const under = this.melody - pick([3, 4, 8, 9]);
        let a = under;
        while (!chord.some((c) => (a - c) % 12 === 0) && a > under - 5) a--;
        this.note(t + rand(1.2, 1.8), a - 12, 0.2, 1.8, this.gains[3], 'triangle', 1500);
      }
    });
  }

  // 5 speaking: a hummed choir, three voices on the chord through the resonances of a vocal tract
  private voices(now: number, on: boolean, chord: number[]) {
    const ctx = this.ctx;
    if (on && !this.choir) {
      const sum = ctx.createGain(); sum.gain.value = 0.25;
      const bands: BiquadFilterNode[] = [];
      [[650, 8, 1.4], [1080, 11, 0.7], [2650, 14, 0.3]].forEach(([f, q, a]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = a;
        sum.connect(bp).connect(g).connect(this.gains[4]);
        bands.push(bp);
      });
      const vib = ctx.createOscillator(); vib.frequency.value = 4.8;
      const vibG = ctx.createGain(); vibG.gain.value = 6;
      vib.connect(vibG); vib.start(now);
      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = rand(-6, 6);
        vibG.connect(o.detune);
        o.connect(sum); o.start(now);
        oscs.push(o);
      }
      oscs.push(vib);
      this.choir = { oscs, bands, key: '' };
    }
    if (!this.choir) return;
    if (!on) {
      // keep it alive while the gain fades; stop once silent for a while
      if (this.gains[4].gain.value < 0.002) { for (const o of this.choir.oscs) o.stop(now + 0.1); this.choir = null; }
      return;
    }
    const key = chord.join(',');
    if (key !== this.choir.key) {
      this.choir.key = key;
      const tones = [chord[1], chord[2], chord[3] ?? chord[2] + 5].map((n) => { let m = n; while (m < 52) m += 12; while (m > 67) m -= 12; return m; });
      this.choir.oscs.slice(0, 3).forEach((o, i) => o.frequency.setTargetAtTime(mtof(tones[i]), now, 0.9));
      const v = pick([[650, 1080, 2650], [400, 800, 2600], [500, 1700, 2500], [560, 900, 2450]]);
      this.choir.bands.forEach((b, i) => b.frequency.setTargetAtTime(v[i], now, 2));
    }
  }
}
