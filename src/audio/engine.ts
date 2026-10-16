import { getSettings, subscribe } from '../style/store';

/**
 * Web Audio graph shared by narration, score and sound effects:
 *
 *   voice ─────────────────────────┐
 *   music ── duck ──┬──────────────┼── master ── limiter ── out
 *   fx ─────────────┤              │
 *                   └── reverb ────┘   (music + fx also feed one long hall reverb)
 *
 * Browsers only start audio after a click, tap or key press in the visit (a wheel scroll does not count), so the
 * context is created lazily and resumed from the first such gesture once the visitor has sound switched on.
 */
export interface Bus { ctx: AudioContext; voice: GainNode; music: GainNode; fx: GainNode; reverb: ConvolverNode; master: GainNode }

let bus: Bus | null = null;
const listeners = new Set<() => void>();
export const onAudioChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const emit = () => listeners.forEach((f) => f());

export const getBus = () => bus;
export const isRunning = () => !!bus && bus.ctx.state === 'running';

/** long, dark, slightly modulated hall: decaying stereo noise, low-passed as it decays */
function hall(ctx: AudioContext, seconds = 4.2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = 0.08 + 0.9 * t; // one-pole low-pass that closes as the tail decays
      lp += (Math.random() * 2 - 1 - lp) * (1 - a * 0.97);
      const pre = Math.min(1, i / (ctx.sampleRate * 0.02)); // 20ms soft onset
      d[i] = lp * pre * Math.pow(1 - t, 2.6);
    }
  }
  return ir;
}

function build(): Bus {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ latencyHint: 'playback' });
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.004; limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);
  const voice = ctx.createGain();
  const music = ctx.createGain();
  const fx = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = hall(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  voice.connect(master);
  music.connect(master); music.connect(reverb);
  fx.connect(master); fx.connect(reverb);
  reverb.connect(wet).connect(master);
  master.gain.value = 0;
  return { ctx, voice, music, fx, reverb, master };
}

function target() {
  const s = getSettings();
  return s.sound ? 1 : 0;
}
function applyMaster(time = 0.6) {
  if (!bus) return;
  const now = bus.ctx.currentTime;
  bus.master.gain.cancelScheduledValues(now);
  bus.master.gain.setTargetAtTime(target(), now, time / 3);
}

/** Call from inside a user gesture (click / key / tap). Safe to call repeatedly. */
export function unlock() {
  if (!getSettings().sound) return;
  if (!bus) bus = build();
  if (bus.ctx.state !== 'running') bus.ctx.resume().then(() => { applyMaster(); emit(); }, () => {});
  applyMaster();
  emit();
}

let duckLevel = 1;
/** music sinks under the voice; fx are left alone */
export function duck(on: boolean) {
  const v = on ? 0.42 : 1;
  if (!bus || v === duckLevel) return;
  duckLevel = v;
  bus.music.gain.setTargetAtTime(v, bus.ctx.currentTime, on ? 0.25 : 1.2);
}

if (typeof window !== 'undefined') {
  // first real gesture of the visit unlocks audio when sound is (still) switched on from a previous visit
  const gesture = () => { if (getSettings().sound && !isRunning()) unlock(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, gesture, { capture: true, passive: true });
  subscribe(() => { if (bus) applyMaster(); emit(); });
  // a backgrounded tab keeps playing the voice, but rAF-driven parts stop: let the OS handle it, just resume on return
  document.addEventListener('visibilitychange', () => { if (!document.hidden && bus && getSettings().sound) bus.ctx.resume().catch(() => {}); });
}
