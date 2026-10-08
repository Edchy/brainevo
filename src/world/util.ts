import { world } from './store';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** maps x from [a,b] to 0..1 (clamped, linear) */
export const range = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** deterministic RNG so scenes look identical on every load */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** station position of an event id (same units as world.stationF) */
export const eventPos = (id: string) => world.eventIndex[id] ?? 0;

/**
 * How "on" an event is, 0..1: 1 exactly when the viewer is on that event, falling to 0 at `width` stations away.
 * Use for beats tied to a specific event, e.g. pulse(eventPos('big-bang'), 1).
 */
export const near = (pos: number, width = 0.8) => 1 - smoothstep(0, width, Math.abs(world.stationF - pos));
