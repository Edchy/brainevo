import type { SceneDef } from '../../world/types';
import Minds from './Minds';
import Weeks from './Weeks';
import SunEnd from './SunEnd';
import Coda from './Coda';

export const futureScenes: SceneDef[] = [
  {
    id: 'future-minds', from: 'minds-and-machines', to: 'minds-and-machines', lead: 0.5, tail: 0.4, fade: 0.45,
    Component: Minds,
    camera: (t) => ({ pos: [0.4 - t * 0.6, 0.4, 9.2 - t * 0.8], look: [0.2, 0.1, 0], fov: 50 }),
    mood: () => ({ bg: '#07070b', bloom: 1.1 }),
  },
  {
    id: 'future-weeks', from: 'your-lifetime', to: 'your-lifetime', lead: 0.5, tail: 0.4, fade: 0.45,
    // the grid itself is drawn crisp over the painting (src/components/WeeksChart.tsx); the scene keeps a faint echo of it
    Component: Weeks,
    // start close on the first years, pull back to the whole life (the grid stands right of the text)
    camera: (t) => {
      const k = Math.min(1, t / 0.55), e = k * k * (3 - 2 * k);
      return { pos: [0.6 + 1.4 * e, 3.0 - 2.8 * e, 4.4 + 5.8 * e], look: [0.9 + 0.7 * e, 2.8 - 2.8 * e, 0], fov: 50 };
    },
    mood: () => ({ bg: '#07070b', bloom: 1.0 }),
  },
  {
    id: 'future-sun', from: 'sun-brightens', to: 'last-stars', lead: 0.6, tail: 0.6, fade: 0.5,
    Component: SunEnd,
    camera: (t) => ({ pos: [-0.2 + t * 1.0, 0.6, 15 + t * 7], look: [0.6, 0.2, 0], fov: 50 }),
    mood: (t) => ({ bg: t < 0.7 ? '#05040a' : '#020205', bloom: 1.5 - 0.6 * t }),
  },
  {
    id: 'coda', from: 'coda-imagine', to: 'coda-heartbeats', lead: 0.6, tail: 2.2, fade: 0.6,
    Component: Coda,
    camera: (t) => ({ pos: [Math.sin(t * 2) * 0.3, 0.2, 10 - t * 1.5], look: [0, 0, 0], fov: 50 }),
    mood: () => ({ bg: '#010103', bloom: 1.4 }),
  },
];
