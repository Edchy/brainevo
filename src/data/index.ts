import type { TimelineEvent } from '../types';
import { cosmicOriginEvents } from './events.early';
import { nervesVertebrateEvents } from './events.vertebrate';
import { mammalPrimateEvents } from './events.mammal';
import { hominEvents } from './events.hominin';
import { sapiensModernEvents } from './events.sapiens';

export const events: TimelineEvent[] = [
  ...cosmicOriginEvents,
  ...nervesVertebrateEvents,
  ...mammalPrimateEvents,
  ...hominEvents,
  ...sapiensModernEvents,
].sort((a, b) => b.yearsAgo - a.yearsAgo);
