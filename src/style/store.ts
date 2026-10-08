import { useSyncExternalStore } from 'react';
import type { Settings, StyleId, UiVariant } from './types';

const STYLES: StyleId[] = ['ink', 'specimen', 'signal', 'cartoon', 'oil'];
const UIS: UiVariant[] = ['minimal', 'hud', 'tidy'];
const KEY = 'brainevo.settings.v1';

function load(): Settings {
  const d: Settings = { style: 'ink', ui: 'minimal', titles: true, lab: true };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    Object.assign(d, saved);
  } catch { /* storage unavailable */ }
  const q = new URLSearchParams(location.search);
  const s = q.get('style') as StyleId | null;
  const u = q.get('ui') as UiVariant | null;
  if (s && STYLES.includes(s)) d.style = s;
  if (u && UIS.includes(u)) d.ui = u;
  if (q.has('titles')) d.titles = q.get('titles') !== '0';
  if (q.has('lab')) d.lab = q.get('lab') !== '0';
  if (!STYLES.includes(d.style)) d.style = 'ink';
  if (!UIS.includes(d.ui)) d.ui = 'minimal';
  return d;
}

let state: Settings = load();
const subs = new Set<() => void>();

function apply() {
  const el = document.documentElement;
  el.dataset.style = state.style;
  el.dataset.ui = state.ui;
  el.dataset.titles = state.titles ? 'on' : 'off';
}
apply();

export const getSettings = () => state;
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  state = { ...state, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  apply();
  subs.forEach((f) => f());
}
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
export { STYLES, UIS };

if (import.meta.env.DEV) {
  // dev hooks: window.__set('style','oil'), window.__set('ui','hud'), window.__set('titles', false), window.__set('lab', false)
  (window as unknown as Record<string, unknown>).__set = setSetting;
}
