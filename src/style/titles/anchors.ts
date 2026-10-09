/**
 * Art-directed headline placement (used by themes with --title-placement: art).
 *
 * Resolution order for an event: the owning scene's `SceneDef.titleAnchor`, then ANCHORS[scene.id] below, then DEFAULT.
 * The owning scene is the one whose [from, to] window contains the event (narrowest wins), else the nearest one.
 * x,y are fractions of the frame; x is the left edge / centre / right edge according to `align`.
 * The event caption card lives bottom-left, scene heroes are usually centred: DEFAULT is the upper-left.
 */
import { SCENES } from '../../scenes';
import { events } from '../../data';

export interface TitleAnchor { x: number; y: number; align: 'left' | 'center' | 'right'; size?: number }

export const DEFAULT: TitleAnchor = { x: 0.06, y: 0.2, align: 'left' };

/** keyed by scene id (src/scenes/*\/index.ts) */
export const ANCHORS: Record<string, Partial<TitleAnchor>> = {
  'life-nerve-net': { x: 0.94, y: 0.7, align: 'right' },
  'hominin-laetoli': { size: 0.85 },
  'human-neuron': { size: 0.8 },
  'v-myelin': { y: 0.7, size: 0.8 },
};

const evIndex: Record<string, number> = {};
events.forEach((e, i) => { evIndex[e.id] = i; });
const cache = new Map<number, TitleAnchor>();

export function resolveAnchor(idx: number): TitleAnchor {
  const hit = cache.get(idx);
  if (hit) return hit;
  let best: (typeof SCENES)[number] | undefined, bestScore = Infinity;
  for (const s of SCENES) {
    const a = evIndex[s.from], b = evIndex[s.to];
    if (a === undefined || b === undefined) continue;
    const dist = idx < a ? a - idx : idx > b ? idx - b : 0;
    const score = dist * 100 + (b - a);
    if (score < bestScore) { bestScore = score; best = s; }
  }
  const o = best ? { ...ANCHORS[best.id], ...best.titleAnchor } : {};
  const r: TitleAnchor = { ...DEFAULT, ...o } as TitleAnchor;
  cache.set(idx, r);
  return r;
}
