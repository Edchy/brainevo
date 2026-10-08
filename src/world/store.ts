import { events } from '../data';
import { ERA_META } from '../lib/eras';
import { focusX, type Layout } from '../lib/layout';

const eventIndex: Record<string, number> = {};
events.forEach((e, i) => { eventIndex[e.id] = i; });

const lowPower =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4);

/**
 * Mutable, non-React world state. Written by the scroller, read every frame by 3D scenes.
 * Never put this in React state.
 */
export const world = {
  /** continuous station index: 2.0 = exactly on event #2, 2.5 = halfway to #3. Negative = in the intro, > last = outro */
  stationF: -1,
  /** scroll speed in viewport-widths per second, signed (+ = forward in time), smoothed */
  velocity: 0,
  /** px moved since last frame (internal) */
  pendingDx: 0,
  /** seconds since start */
  time: 0,
  /** user prefers reduced motion: skip ambient animation, keep scroll-driven motion */
  reduced: false,
  /** particle budget multiplier 0.35..1. Use: Math.floor(N * world.quality) */
  quality: lowPower ? 0.4 : 1,
  /** accent colour of the era currently under the viewport centre */
  eraAccent: ERA_META.cosmic.accent as string,
  /** event id -> sorted index (matches stationF units) */
  eventIndex,
  /** dev only: pin stationF (window.__setF(3.5)) */
  override: null as number | null,
};

const OUTSIDE = 600; // px of intro/outro mapped to one station unit

export function updateWorld(layout: Layout, scrollLeft: number, vw: number) {
  const st = layout.stations;
  if (!st.length) return;
  const trackX = scrollLeft + focusX(vw) - vw; // intro panel is one viewport wide
  world.pendingDx += trackX - lastX;
  lastX = trackX;
  if (world.override !== null) { world.stationF = world.override; return; }
  let f: number;
  if (trackX <= st[0].x) f = (trackX - st[0].x) / ((focusX(vw) + st[0].x) / 1.6); // scroll 0 -> f = -1.6, whatever the viewport
  else if (trackX >= st[st.length - 1].x) f = st.length - 1 + Math.min(2, (trackX - st[st.length - 1].x) / OUTSIDE);
  else {
    let i = 0;
    while (i < st.length - 2 && st[i + 1].x <= trackX) i++;
    f = i + (trackX - st[i].x) / (st[i + 1].x - st[i].x);
  }
  world.stationF = f;
  const near = st[Math.max(0, Math.min(st.length - 1, Math.round(f)))];
  world.eraAccent = ERA_META[near.event.era].accent;
}
let lastX = 0;

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__world = world;
  w.__setF = (f: number | null) => { world.override = f; if (f !== null) world.stationF = f; };
}
