import { useSyncExternalStore } from 'react';
import { events } from '../data';
import type { TimelineEvent } from '../types';
import { world } from '../world/store';
import { getSettings, setSetting } from '../style/store';
import { duck, getBus, isRunning, onUnlock, unlock } from './engine';

/**
 * Narration that plays itself as you travel. When an event's caption settles at the point of focus, its recording
 * starts; moving on fades it out and the next one takes over. Rules, so it feels calm rather than jumpy:
 *  - an event must hold the focus for a moment (DWELL) before it speaks, so flicking past events stays silent;
 *  - a clip keeps playing while you drift slowly away, and stops when another event takes over or you are far away;
 *  - returning to an interrupted clip resumes it; one that finished recently is not repeated (press Listen for that);
 *  - Pause holds the current clip; the next event still speaks on its own.
 *
 * Recordings: `<event-id>.mp3` files in src/assets/narration/ (see narration/SCRIPT.md). An event without a file stays
 * quiet: no Listen button, and Watch gives it reading time instead.
 */
const FILES = import.meta.glob('../assets/narration/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.mp3$/, '')] = url;
export const hasRecording = (id: string) => id in URLS;

const DWELL = 0.45; // s an event must hold the focus before it speaks
const FOCUS = 0.26; // stations from an event at which it has the focus (its caption is fully shown)
const AWAY = 0.95; // stations away at which a playing clip fades out
const FADE = 0.45; // s

export interface NarrationState {
  /** event whose narration is loaded (playing or paused) */
  id: string | null;
  playing: boolean;
  /** 0..1 */
  progress: number;
}
let state: NarrationState = { id: null, playing: false, progress: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<NarrationState>) => {
  const n = { ...state, ...p };
  if (n.id === state.id && n.playing === state.playing && Math.abs(n.progress - state.progress) < 0.004) return;
  state = n;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useNarration = () => useSyncExternalStore(subscribe, () => state);
export const getNarration = () => state;

interface Clip {
  ev: TimelineEvent;
  index: number;
  stop: (fade: boolean) => void;
  pause: () => void;
  resume: () => void;
  position: () => number;
  progress: () => number;
  playing: () => boolean;
}

// ---- file playback through the Web Audio voice bus (two elements so one can fade out while the next starts) ----
interface Player { el: HTMLAudioElement; gain: GainNode | null; busy: boolean; primed: boolean }
const pool: Player[] = [];
function create() {
  const el = new Audio();
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  const p: Player = { el, gain: null, busy: false, primed: false };
  pool.push(p);
  return p;
}
function connect(p: Player) {
  const bus = getBus();
  if (bus && !p.gain) {
    p.gain = bus.ctx.createGain();
    bus.ctx.createMediaElementSource(p.el).connect(p.gain).connect(bus.voice);
  }
}
function element() {
  const p = pool.find((x) => !x.busy) ?? create();
  connect(p);
  p.busy = true;
  return p;
}

// iOS (every browser there) lets an audio element start by itself, as a line does when you arrive at its event, only
// after it has once played from a tap. The tap that switches sound on plays a moment of silence on each player, so the
// lines that follow may start on their own. Elsewhere it is harmless.
let silence = '';
function silentWav() {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer); // 0.1 s, 8 kHz, 8-bit mono
  const tag = (o: number, t: string) => { for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE'); tag(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); tag(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
onUnlock(() => {
  while (pool.length < 3) create();
  silence ||= silentWav();
  for (const p of pool) {
    if (p.busy || p.primed) continue;
    connect(p);
    p.primed = true;
    p.el.src = silence;
    // a line may have claimed the player meanwhile: leave it playing
    p.el.play().then(() => { if (!p.busy) p.el.pause(); }, () => { p.primed = false; });
  }
});

function fileClip(ev: TimelineEvent, index: number, from: number, onEnd: () => void): Clip {
  const p = element();
  const { el } = p;
  const bus = getBus();
  el.src = URLS[ev.id];
  const seek = () => { if (from > 0 && isFinite(el.duration)) el.currentTime = Math.min(from, el.duration - 0.5); };
  el.addEventListener('loadedmetadata', seek, { once: true });
  if (p.gain && bus) { p.gain.gain.cancelScheduledValues(bus.ctx.currentTime); p.gain.gain.setValueAtTime(0, bus.ctx.currentTime); p.gain.gain.setTargetAtTime(1, bus.ctx.currentTime, 0.06); }
  const ended = () => { release(); onEnd(); };
  el.addEventListener('ended', ended);
  el.play().catch(() => {});
  let released = false;
  const release = () => { if (released) return; released = true; el.removeEventListener('ended', ended); p.busy = false; };
  return {
    ev, index,
    stop(fade) {
      el.removeEventListener('ended', ended);
      if (fade && p.gain && bus) {
        p.gain.gain.setTargetAtTime(0, bus.ctx.currentTime, FADE / 4);
        setTimeout(() => { el.pause(); release(); }, FADE * 1000 + 60);
      } else { el.pause(); release(); }
    },
    pause: () => el.pause(),
    resume: () => { el.play().catch(() => {}); },
    position: () => el.currentTime,
    progress: () => (el.duration > 0 && isFinite(el.duration) ? el.currentTime / el.duration : 0),
    playing: () => !el.paused && !el.ended,
  };
}

// ---- director ----
let clip: Clip | null = null;
let cand = -1, candSince = 0;
const finishedAt: Record<string, number> = {};
const leftAt: Record<string, { at: number; pos: number }> = {};
let held: string | null = null; // event the visitor paused; it stays quiet until they press play

function start(index: number, manual = false) {
  const ev = events[index];
  if (!ev || !hasRecording(ev.id)) return;
  const now = performance.now() / 1000;
  stopCurrent(true);
  const left = leftAt[ev.id];
  const from = !manual && left && now - left.at < 60 ? Math.max(0, left.pos - 1.5) : 0;
  const end = () => { finishedAt[ev.id] = performance.now() / 1000; if (clip?.ev.id === ev.id) { clip = null; duck(false); set({ playing: false, progress: 1 }); } };
  clip = fileClip(ev, index, from, end);
  duck(true);
  set({ id: ev.id, playing: true, progress: 0 });
}

function stopCurrent(fade: boolean) {
  if (!clip) return;
  if (clip.playing() || clip.progress() < 0.98) leftAt[clip.ev.id] = { at: performance.now() / 1000, pos: clip.position() };
  clip.stop(fade);
  clip = null;
  duck(false);
}

/** while the (dev-only) voice guide is talking with the visitor, the recorded narration keeps quiet */
let guideHold = false;
export function holdNarration(on: boolean) { guideHold = on; }

function tick() {
  const s = getSettings();
  const live = s.sound && s.narration && isRunning() && !guideHold;
  const f = world.stationF;
  const i = Math.round(f);
  const focus = i >= 0 && i < events.length && Math.abs(f - i) < FOCUS ? i : -1;
  const now = performance.now() / 1000;
  if (focus !== cand) { cand = focus; candSince = now; if (held && events[focus]?.id !== held) held = null; }

  if (!live) {
    if (clip && clip.playing() && (!s.sound || !s.narration || guideHold)) { stopCurrent(true); set({ playing: false }); }
  } else {
    if (clip && Math.abs(f - clip.index) > AWAY) { stopCurrent(true); set({ id: null, playing: false, progress: 0 }); }
    if (cand >= 0 && now - candSince > DWELL && events[cand].id !== clip?.ev.id && events[cand].id !== held) {
      const id = events[cand].id;
      const recent = finishedAt[id] !== undefined && now - finishedAt[id] < 45;
      if (!recent) start(cand);
    }
  }
  if (clip) set({ progress: clip.progress(), playing: clip.playing() });
  else if (state.playing) set({ playing: false });
}
if (typeof window !== 'undefined') setInterval(tick, 100);

/** The caption's Listen / Pause control for `ev` (also switches sound on: the click is the gesture that unlocks it). */
export function toggleNarration(ev: TimelineEvent) {
  if (!getSettings().sound) setSetting('sound', true);
  if (!getSettings().narration) setSetting('narration', true);
  unlock();
  if (clip && clip.ev.id === ev.id) {
    if (clip.playing()) { clip.pause(); held = ev.id; duck(false); set({ playing: false }); }
    else { clip.resume(); held = null; duck(true); set({ playing: true }); }
    return;
  }
  held = null;
  const idx = events.findIndex((e) => e.id === ev.id);
  // after an unlock the context may still be starting; the element starts on its own once it runs
  start(idx, true);
}

export const canNarrate = (ev: TimelineEvent) => hasRecording(ev.id);

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // dev: window.__narration() -> current narration state
  (window as unknown as Record<string, unknown>).__narration = () => ({ ...state, clip: clip?.ev.id ?? null });
}
