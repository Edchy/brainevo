import type { Breakthrough } from '../types';

export interface BreakthroughMeta {
  id: Breakthrough;
  number: number;
  name: string;
  blurb: string;
  accent: string;
  /** approximate, for display */
  date: string;
}

/** Narrative framework after Max Bennett, "A Brief History of Intelligence" (2023). */
export const BREAKTHROUGHS: BreakthroughMeta[] = [
  { id: 'steering', number: 1, name: 'Steering', date: 'about 550 million years ago', accent: '#5eead4',
    blurb: 'Tiny worm-like animals learn to sort the world into good and bad, and turn toward one and away from the other.' },
  { id: 'reinforcing', number: 2, name: 'Reinforcing', date: 'about 500 million years ago', accent: '#8ab4ff',
    blurb: 'Early vertebrates learn from trial and error, repeating what paid off and dropping what did not.' },
  { id: 'simulating', number: 3, name: 'Simulating', date: 'about 100 million years ago', accent: '#ffb35c',
    blurb: 'The mammal neocortex builds an inner model of the world, so an animal can imagine a move before making it.' },
  { id: 'mentalizing', number: 4, name: 'Mentalizing', date: 'about 30 million years ago', accent: '#ff86bd',
    blurb: 'Primates start to model minds, including their own, and can guess what others want, know and intend.' },
  { id: 'speaking', number: 5, name: 'Speaking', date: 'about 100 thousand years ago', accent: '#ffe066',
    blurb: 'Humans share what is in their heads through language, so ideas can pile up across people and generations.' },
];

export const BREAKTHROUGH_BY_ID = Object.fromEntries(BREAKTHROUGHS.map((b) => [b.id, b])) as Record<Breakthrough, BreakthroughMeta>;
export const BREAKTHROUGH_COUNT = BREAKTHROUGHS.length;
