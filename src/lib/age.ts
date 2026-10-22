import { useSyncExternalStore } from 'react';

/**
 * The visitor's age, if they choose to give it (the "Four Thousand Weeks" station fills in the weeks they have lived).
 * It stays in this browser: kept in localStorage as a convenience, never sent anywhere.
 */
const KEY = 'brainevo.age';
const subs = new Set<() => void>();

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 && v < 120 ? v : null;
  } catch { return null; }
}

let age: number | null = typeof window !== 'undefined' ? read() : null;

export const getAge = () => age;
export function setAge(v: number | null) {
  age = v != null && Number.isFinite(v) && v > 0 && v < 120 ? v : null;
  try { if (age == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(age)); } catch { /* storage unavailable */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useAge = () => useSyncExternalStore(subscribe, getAge);
export const onAge = subscribe;
