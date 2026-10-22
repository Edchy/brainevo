import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Layout } from './layout';
import type { TimelineEvent } from '../types';
import { getSettings } from '../style/store';
import { canNarrate, getNarration, toggleNarration } from '../audio/narration';
import { getMirror } from './mirror';
import { getPlay } from '../play/kit';

/**
 * "Watch": the whole piece plays itself, like a film. It glides from stop to stop (chapter cards, breakthroughs and
 * events, in order), lets each event's narration finish (or, in silence, gives the words time to be read), holds a
 * silence after "Try to imagine being dead", and ends on the way back to the beginning. Any scroll, drag or key press
 * hands control back to the visitor; Space pauses.
 */
interface WatchState { on: boolean; paused: boolean }
let state: WatchState = { on: false, paused: false };
const subs = new Set<() => void>();
const set = (p: Partial<WatchState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useWatch = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
export const startWatch = () => set({ on: true, paused: false });
export const stopWatch = () => set({ on: false, paused: false });
export const toggleWatchPause = () => set({ paused: !state.paused });

interface Stop { x: number; kind: 'banner' | 'marker' | 'station' | 'end'; event?: TimelineEvent }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const words = (s: string) => s.split(/\s+/).length;

/** seconds to rest at a stop once it has said (or shown) what it has to say */
function restAfter(s: Stop) {
  if (s.kind === 'banner') return 3.2;
  if (s.kind === 'marker') return 6; // time to notice "Try it yourself"
  const e = s.event!;
  if (e.id === 'mirror-self-recognition' || e.id === 'now' || e.extra === 'weeks') return 6; // an invitation is open here
  if (e.extra === 'imagine') return 6.5; // a real silence to try it in
  if (e.extra === 'breath') return 3.5;
  if (e.kind === 'coda') return 2.2;
  return 1.3;
}

/** drives the scroll while watching; `scrollTo(x)` writes an exact track position, `trackX()` reads the focus */
export function useWatchDirector(layout: Layout, scrollTo: (trackX: number) => void, trackX: () => number) {
  const w = useWatch();
  const st = useRef({ i: -1, phase: 'idle' as 'idle' | 'glide' | 'dwell', t0: 0, from: 0, to: 0, dur: 0, spoke: false, heard: 0, pausedAt: 0, heldNarration: false });
  const stops = useRef<Stop[]>([]);
  useEffect(() => {
    stops.current = [
      ...layout.banners.map((b) => ({ x: b.x, kind: 'banner' as const })),
      ...layout.markers.map((m) => ({ x: m.x, kind: 'marker' as const })),
      ...layout.stations.map((s) => ({ x: s.x, kind: 'station' as const, event: s.event })),
      { x: layout.endX, kind: 'end' as const },
    ].sort((a, b) => a.x - b.x);
  }, [layout]);

  // hand control back on any scroll, drag or key (Space pauses instead)
  useEffect(() => {
    if (!w.on) return;
    const stop = () => stopWatch();
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('dialog, input')) return;
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); toggleWatchPause(); return; } // not the page's own Space-to-scroll
      if (!['Shift', 'Alt', 'Control', 'Meta', 'Tab'].includes(e.key)) stop();
    };
    const arm = setTimeout(() => {
      window.addEventListener('wheel', stop, { passive: true });
      window.addEventListener('touchmove', stop, { passive: true });
      window.addEventListener('keydown', key, true);
    }, 300);
    return () => { clearTimeout(arm); window.removeEventListener('wheel', stop); window.removeEventListener('touchmove', stop); window.removeEventListener('keydown', key, true); };
  }, [w.on]);

  // pausing the film pauses the voice too, and resuming resumes it
  useEffect(() => {
    const s = st.current;
    const n = getNarration();
    const cur = stops.current[s.i]?.event;
    if (w.paused && cur && n.id === cur.id && n.playing) { toggleNarration(cur); s.heldNarration = true; }
    if (!w.paused && s.heldNarration && cur) { toggleNarration(cur); s.heldNarration = false; }
    if (w.paused) s.pausedAt = performance.now() / 1000;
    else if (s.pausedAt) { s.t0 += performance.now() / 1000 - s.pausedAt; s.pausedAt = 0; }
  }, [w.paused]);

  useEffect(() => {
    if (!w.on) { st.current.phase = 'idle'; return; }
    let raf = 0;
    const s = st.current;
    // start from where the visitor is: the next stop ahead (or this one, if it is centred)
    const x0 = trackX();
    s.i = stops.current.findIndex((p) => p.x > x0 - 30);
    if (s.i < 0) { stopWatch(); return; }
    const begin = (i: number, now: number) => {
      s.i = i; s.phase = 'glide'; s.from = trackX(); s.to = stops.current[i].x; s.t0 = now;
      s.dur = Math.abs(s.to - s.from) < 12 ? 0 : Math.min(5, 1.8 + Math.abs(s.to - s.from) / 1500);
      s.spoke = false; s.heard = 0;
    };
    begin(s.i, performance.now() / 1000);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // the visitor is doing something (a toy, the mirror test, typing their age): the film waits for them
      const m = getMirror();
      const busy = !!getPlay() || (m.wanted && m.status === 'on' && !['touched', 'answered'].includes(m.phase) && stops.current[s.i]?.event?.id === 'mirror-self-recognition')
        || document.activeElement?.closest?.('.age-field') != null;
      if (busy && s.phase === 'dwell') { s.t0 = performance.now() / 1000 - Math.min(performance.now() / 1000 - s.t0, 2); if (s.heard) s.heard = performance.now() / 1000; return; }
      if (state.paused) {
        // a line that starts on its own during the pause is held too
        const cur = stops.current[s.i]?.event, n = getNarration();
        if (cur && n.id === cur.id && n.playing && !s.heldNarration) { toggleNarration(cur); s.heldNarration = true; }
        return;
      }
      const now = performance.now() / 1000;
      const stop = stops.current[s.i];
      if (!stop) { stopWatch(); return; }
      if (s.phase === 'glide') {
        const u = s.dur ? Math.min(1, (now - s.t0) / s.dur) : 1;
        scrollTo(s.from + (s.to - s.from) * ease(u));
        if (u >= 1) { s.phase = 'dwell'; s.t0 = now; if (stop.kind === 'end') stopWatch(); }
        return;
      }
      // dwell: wait for the voice (or reading time), then rest a moment and move on
      const el = now - s.t0;
      let done: boolean;
      if (stop.kind !== 'station') done = el > restAfter(stop);
      else {
        const e = stop.event!;
        const cfg = getSettings();
        const voice = cfg.sound && cfg.narration && canNarrate(e);
        const n = getNarration();
        if (voice) {
          if (n.id === e.id && n.playing) s.spoke = true;
          const finished = s.spoke && n.id === e.id && !n.playing && n.progress > 0.95;
          if (finished && !s.heard) s.heard = now;
          // if the voice never starts (blocked audio, no voice), fall back to reading time
          const fallback = !s.spoke && el > 3 ? el > Math.max(5, words(e.summary) / 2.4) + restAfter(stop) : false;
          done = (s.heard > 0 && now - s.heard > restAfter(stop)) || fallback || el > 60;
        } else done = el > Math.max(5, words(e.summary) / 2.4) + restAfter(stop);
      }
      if (done) {
        if (s.i + 1 >= stops.current.length) { stopWatch(); return; }
        begin(s.i + 1, now);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.on]);
}

