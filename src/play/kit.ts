import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Breakthrough } from '../types';

/**
 * "Try it yourself": a short interactive moment for each of the five breakthroughs, opened from the breakthrough's
 * chapter card. Each is a small canvas toy that lets the visitor's own brain do the breakthrough, then says what
 * happened and where the science comes from.
 */
let open: Breakthrough | null = null;
const subs = new Set<() => void>();
export const openPlay = (b: Breakthrough | null) => { open = b; subs.forEach((f) => f()); };
export const getPlay = () => open;
export const onPlay = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const usePlay = () => useSyncExternalStore(onPlay, () => open);

/** the site's palette, read from CSS so the toys match the theme */
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { ink: v('--ui-ink', '#efe6d4'), dim: v('--ui-ink-dim', '#b9ae9a'), gilt: v('--gilt', '#d8b46a'), line: v('--ui-line', 'rgba(255,255,255,.14)'), ground: v('--ground-deep', '#0b0e1a'), cool: '#7fb2ff' };
}

/**
 * A canvas that keeps its backing store at device resolution and calls `frame(g, w, h, dt, t)` every animation frame
 * in CSS pixels. `frame` may be swapped every render; the loop always calls the latest.
 */
export function useCanvas(frame: (g: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fr = useRef(frame);
  fr.current = frame;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fr.current(g, w, h, dt, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ref;
}

export interface Src { label: string; url: string }
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
