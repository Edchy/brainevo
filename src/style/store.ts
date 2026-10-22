import { useSyncExternalStore } from 'react';
import type { BrushId, HeadlinePlace, PaletteId, Settings, TextLayout } from './types';

const PALETTES: PaletteId[] = ['prussian', 'grisaille', 'umber', 'verdigris', 'oxblood'];
const BRUSHES: BrushId[] = ['fine', 'full'];
const TEXTS: TextLayout[] = ['scrim', 'band', 'overlay'];
const HEADLINES: HeadlinePlace[] = ['text', 'top'];
const KEY = 'brainevo.settings.v3';

const DEFAULTS: Settings = {
  palette: 'prussian', brush: 'fine', text: 'scrim', titles: true, headline: 'text', lab: true,
  sound: false, narration: true, music: true, ambience: true,
};

function load(): Settings {
  const d: Settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    Object.assign(d, saved);
  } catch { /* storage unavailable */ }
  // `sound` is remembered, but audio still needs a click/tap/key in this visit before the browser lets it play
  // (src/audio/engine.ts unlocks on the first gesture)
  const q = new URLSearchParams(location.search);
  const p = q.get('palette') as PaletteId | null;
  const b = q.get('brush') as BrushId | null;
  const t = q.get('text') as TextLayout | null;
  if (p && PALETTES.includes(p)) d.palette = p;
  if (b && BRUSHES.includes(b)) d.brush = b;
  if (t && TEXTS.includes(t)) d.text = t;
  const h = q.get('headline') as HeadlinePlace | null;
  if (h && HEADLINES.includes(h)) d.headline = h;
  if (q.has('titles')) d.titles = q.get('titles') !== '0';
  if (q.has('lab')) d.lab = q.get('lab') !== '0';
  if (!PALETTES.includes(d.palette)) d.palette = DEFAULTS.palette;
  if (!BRUSHES.includes(d.brush)) d.brush = DEFAULTS.brush;
  if (!TEXTS.includes(d.text)) d.text = DEFAULTS.text;
  if (!HEADLINES.includes(d.headline)) d.headline = DEFAULTS.headline;
  return d;
}

let state: Settings = load();
const subs = new Set<() => void>();

function apply() {
  const el = document.documentElement;
  el.dataset.palette = state.palette;
  el.dataset.brush = state.brush;
  el.dataset.text = state.text;
  el.dataset.titles = state.titles ? 'on' : 'off';
  el.dataset.headline = state.headline;
}
apply();

export const getSettings = () => state;
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  if (state[k] === v) return;
  state = { ...state, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  apply();
  subs.forEach((f) => f());
}
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
export { PALETTES, BRUSHES, TEXTS, HEADLINES };

if (import.meta.env.DEV) {
  // dev hooks: window.__set('palette','umber'), window.__set('text','band'), window.__set('titles', false)
  (window as unknown as Record<string, unknown>).__set = setSetting;
}
