import type { Era } from '../types';

export interface EraMeta {
  name: string;
  tagline: string;
  top: string;
  bottom: string;
  accent: string;
}

export const ERA_ORDER: Era[] = [
  'cosmic', 'origin', 'nerves', 'vertebrate', 'mammal', 'primate', 'hominin', 'sapiens', 'modern',
];

export const ERA_META: Record<Era, EraMeta> = {
  cosmic: { name: 'The Dark Beginning', tagline: 'Before eyes, before minds: matter, light and time.', top: '#02020a', bottom: '#170b33', accent: '#c4b5ff' },
  origin: { name: 'Spark of Life', tagline: 'Single cells learn to sense and respond.', top: '#031a1c', bottom: '#0c3e3b', accent: '#6ee7c8' },
  nerves: { name: 'First Nerves', tagline: 'Neurons wire together into nets and ganglia.', top: '#071a33', bottom: '#0e3b5e', accent: '#74ccff' },
  vertebrate: { name: 'The Vertebrate Plan', tagline: 'A hindbrain, midbrain and forebrain take shape.', top: '#06302a', bottom: '#165a41', accent: '#86e496' },
  mammal: { name: 'Warm-Blooded Minds', tagline: 'The neocortex arrives, and with it, flexible learning.', top: '#2b1a08', bottom: '#5c3612', accent: '#ffbd73' },
  primate: { name: 'Seeing and Social', tagline: 'Vision, hands and group life reshape the cortex.', top: '#2b0f2b', bottom: '#5b2046', accent: '#ff98c8' },
  hominin: { name: 'Upright and Inventive', tagline: 'Walking, tools and fire feed a growing brain.', top: '#3a1306', bottom: '#6c2b11', accent: '#ff9366' },
  sapiens: { name: 'Language and Symbol', tagline: 'Speech, art and shared imagination.', top: '#33270a', bottom: '#6b4e10', accent: '#ffd966' },
  modern: { name: 'The Reflective Brain', tagline: 'Farming, writing, science: the brain studies itself.', top: '#0d2227', bottom: '#1f5260', accent: '#92f0ff' },
};

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpColor(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  const k = Math.min(1, Math.max(0, t));
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
