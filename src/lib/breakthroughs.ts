import type { Breakthrough } from '../types';

export interface BreakthroughMeta {
  id: Breakthrough;
  number: number;
  name: string;
  blurb: string;
  accent: string;
  /** for display: the animal group Bennett ties the breakthrough to, dated from its fossil record (not quoted from the book) */
  date: string;
}

/** Narrative framework after Max Bennett, "A Brief History of Intelligence" (2023). */
export const BREAKTHROUGHS: BreakthroughMeta[] = [
  { id: 'steering', number: 1, name: 'Steering', date: 'with the first bilaterian animals, over 550 million years ago', accent: '#5eead4',
    blurb: 'Tiny worm-like animals learn to sort the world into good and bad, and turn toward one and away from the other.' },
  { id: 'reinforcing', number: 2, name: 'Reinforcing', date: 'with the first vertebrates, about 520 million years ago', accent: '#8ab4ff',
    blurb: 'Early vertebrates learn from trial and error, repeating what paid off and dropping what did not.' },
  { id: 'simulating', number: 3, name: 'Simulating', date: 'with the first mammals, over 200 million years ago', accent: '#ffb35c',
    blurb: 'The mammal neocortex builds an inner model of the world, so an animal can imagine a move before making it.' },
  { id: 'mentalizing', number: 4, name: 'Mentalizing', date: 'with the first primates, about 60 million years ago', accent: '#ff86bd',
    blurb: 'Primates start to model minds, including their own, and can guess what others want, know and intend.' },
  { id: 'speaking', number: 5, name: 'Speaking', date: 'with the first humans, the genus Homo, over 2 million years ago', accent: '#ffe066',
    blurb: 'Humans share what is in their heads through language, so ideas can pile up across people and generations.' },
];

export const BREAKTHROUGH_BY_ID = Object.fromEntries(BREAKTHROUGHS.map((b) => [b.id, b])) as Record<Breakthrough, BreakthroughMeta>;
export const BREAKTHROUGH_COUNT = BREAKTHROUGHS.length;
