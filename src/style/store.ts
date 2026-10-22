import { useSyncExternalStore } from 'react';
import type { Settings } from './types';

const KEY = 'brainevo.settings.v3';

const DEFAULTS: Settings = { sound: false, narration: true, music: true, ambience: true };

function load(): Settings {
  const d: Settings = { ...DEFAULTS };
  try {
    // only the known switches: earlier visits also saved the Lab's look settings, which are fixed now
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<keyof Settings, unknown>>;
    for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) if (typeof saved[k] === 'boolean') d[k] = saved[k] as boolean;
  } catch { /* storage unavailable */ }
  // `sound` is remembered, but audio still needs a click/tap/key in this visit before the browser lets it play
  // (src/audio/engine.ts unlocks on the first gesture)
  return d;
}

let state: Settings = load();
const subs = new Set<() => void>();

export const getSettings = () => state;
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  if (state[k] === v) return;
  state = { ...state, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);

if (import.meta.env.DEV) {
  // dev hook: window.__set('sound', false)
  (window as unknown as Record<string, unknown>).__set = setSetting;
}
