import type { TimelineEvent } from '../types';
import { cosmicOriginEvents } from './events.early';
import { nervesVertebrateEvents } from './events.vertebrate';
import { mammalPrimateEvents } from './events.mammal';
import { hominEvents } from './events.hominin';
import { sapiensModernEvents } from './events.sapiens';
import { futureEvents, codaEvents } from './events.future';

export const events: TimelineEvent[] = [
  ...cosmicOriginEvents,
  ...nervesVertebrateEvents,
  ...mammalPrimateEvents,
  ...hominEvents,
  ...sapiensModernEvents,
  ...futureEvents,
].sort((a, b) => b.yearsAgo - a.yearsAgo).concat(codaEvents); // the closing reflection comes last, in its own order
