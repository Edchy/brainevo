import type { Breakthrough, Era, TimelineEvent } from '../types';

export const CARD_W = 380;

/** x (px from viewport left) of the point of focus: the active card sits here. Left third on wide screens so the 3D scene's centre stays clear. */
export const focusX = (vw: number) => (vw < 760 ? vw / 2 : vw * 0.3);
const BANNER_W = 520;
export const MARKER_W = 440;

export interface Station { event: TimelineEvent; x: number; index: number }
export interface Banner { era: Era; x: number; stationIndex: number }
export interface Marker { breakthrough: Breakthrough; x: number; stationIndex: number }
export interface Anchor { x: number; y: number }
export interface Layout {
  stations: Station[];
  banners: Banner[];
  /** chapter markers at the first event of each breakthrough; empty when data is untagged */
  markers: Marker[];
  anchors: Anchor[];
  endX: number;
  total: number;
}

const lg = (a: number, b: number) => Math.log10(1 + Math.abs(a - b));

/**
 * Non-linear layout: gap between neighbours = constant + logarithm of the time gap,
 * so every event gets comfortable room while huge gaps still read as longer.
 */
export function buildLayout(events: TimelineEvent[]): Layout {
  const stations: Station[] = [];
  const banners: Banner[] = [];
  const markers: Marker[] = [];
  const seen = new Set<Breakthrough>();
  let prevX = 0;
  let prevEra: Era | null = null;
  let prevY = 0;
  events.forEach((event, index) => {
    const gap = prevEra === null ? 0 : lg(prevY, event.yearsAgo);
    let x: number;
    if (event.era !== prevEra) {
      const bx = prevEra === null ? BANNER_W / 2 + 40 : prevX + CARD_W / 2 + BANNER_W / 2 + 30 + gap * 24;
      banners.push({ era: event.era, x: bx, stationIndex: index });
      x = bx + BANNER_W / 2 + CARD_W / 2 + 30 + gap * 24;
    } else {
      x = prevX + CARD_W + 60 + gap * 60;
    }
    if (event.breakthrough && !seen.has(event.breakthrough)) {
      seen.add(event.breakthrough);
      markers.push({ breakthrough: event.breakthrough, x: x - CARD_W / 2 + MARKER_W / 2, stationIndex: index });
      x += MARKER_W + 20;
    }
    stations.push({ event, x, index });
    prevX = x;
    prevEra = event.era;
    prevY = event.yearsAgo;
  });
  // far enough past the last station that its line has faded before the way back comes into view
  const endX = prevX + CARD_W / 2 + 980;
  return {
    stations,
    banners,
    markers,
    // the closing reflection is here and now, not a point on the time line: the readout holds before it
    anchors: stations.filter((s) => s.event.era !== 'after').map((s) => ({ x: s.x, y: s.event.yearsAgo })),
    endX,
    total: endX + 420,
  };
}

/** signed log scale, so time interpolates smoothly from the past through now into the future */
const l1 = (y: number) => Math.sign(y) * Math.log1p(Math.abs(y));
const l1inv = (v: number) => Math.sign(v) * Math.expm1(Math.abs(v));

/** Years-ago at a track x (log interpolation between neighbouring events). */
export function xToYears(L: Layout, x: number): number {
  const a = L.anchors;
  if (!a.length) return 0;
  if (x <= a[0].x) return a[0].y;
  if (x >= a[a.length - 1].x) return a[a.length - 1].y;
  for (let i = 0; i < a.length - 1; i++) {
    if (x <= a[i + 1].x) {
      const t = (x - a[i].x) / (a[i + 1].x - a[i].x || 1);
      return l1inv(l1(a[i].y) + (l1(a[i + 1].y) - l1(a[i].y)) * t);
    }
  }
  return 0;
}

/** Track x for a given years-ago, or null when out of the covered range. */
export function yearsToX(L: Layout, y: number): number | null {
  const a = L.anchors;
  if (a.length < 2) return null;
  if (y > a[0].y || y < a[a.length - 1].y) return null;
  for (let i = 0; i < a.length - 1; i++) {
    if (y <= a[i].y && y >= a[i + 1].y) {
      const d = l1(a[i].y) - l1(a[i + 1].y);
      const t = d === 0 ? 0 : (l1(a[i].y) - l1(y)) / d;
      return a[i].x + (a[i + 1].x - a[i].x) * t;
    }
  }
  return null;
}
