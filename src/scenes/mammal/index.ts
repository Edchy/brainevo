import type { SceneDef } from '../../world/types';
import { smoothstep } from '../../world/util';

const K_LEAD = 1.4, K_TAIL = 1.2;
const kS = (t: number) => -K_LEAD + t * (K_LEAD + K_TAIL); // station offset from the K-Pg event
import Cynodont from './Cynodont';
import NightForest from './NightForest';
import Neocortex from './Neocortex';
import MiddleEar from './MiddleEar';
import Hippocampus from './Hippocampus';
import Futures from './Futures';
import KPg from './KPg';

export const mammalScenes: SceneDef[] = [
  {
    id: 'cynodont-endothermy', from: 'cynodont-endothermy', to: 'cynodont-endothermy', lead: 1.2, tail: 0.2, fade: 0.5,
    Component: Cynodont,
    camera: (t) => ({ pos: [t * 0.6 - 0.3, 0.3, 6 - t * 0.8], look: [t * 0.5 - 0.2, -0.3, -1], fov: 55 }),
    mood: (t) => ({ bg: t < 0.3 ? '#05060f' : '#04051a', bloom: 0.9 + t * 0.8 }),
  },
  {
    id: 'nocturnal-bottleneck', from: 'nocturnal-bottleneck', to: 'nocturnal-bottleneck', lead: 0.6, tail: 0.2, fade: 0.4,
    Component: NightForest,
    camera: (t) => ({ pos: [-0.6 + t * 1.6, 0.1, 7.5 - t * 1.0], look: [0.2 + t * 1.2, 0.2, 0], fov: 52 }),
    mood: () => ({ bg: '#040a18', bloom: 1.1 }),
  },
  {
    id: 'neocortex', from: 'neocortex', to: 'neocortex', lead: 0.6, tail: 0.3, fade: 0.5,
    Component: Neocortex,
    camera: (t) => {
      const k = smoothstep(0.0, 0.9, t);
      return { pos: [7 * (1 - k) - 3.5 * k, 1.0 + 1.8 * k, 4.5 + 3.5 * k], look: [0, 0, -2.2 * k], fov: 55 };
    },
    mood: () => ({ bg: '#04060f', bloom: 1.2 }),
  },
  {
    id: 'mammalian-middle-ear', from: 'mammalian-middle-ear', to: 'mammalian-middle-ear', lead: 0.55, tail: 0.3, fade: 0.5,
    Component: MiddleEar,
    camera: (t) => ({ pos: [0.3 + t * 0.6, -0.3, 9.2 - t * 1.4], look: [0.3 + t * 0.6, 0.1, 0], fov: 50 }),
    mood: () => ({ bg: '#05070f', bloom: 1.2 }),
  },
  {
    id: 'hippocampus-replay', from: 'limbic-hippocampus', to: 'vicarious-trial-and-error-replay', lead: 0.6, tail: 0.3, fade: 0.35,
    Component: Hippocampus,
    camera: (t) => ({ pos: [0, 7.2 - t * 1.2, 5.8 + t * 0.2], look: [0, 0, 0.7], fov: 50 }),
    mood: () => ({ bg: '#04060f', bloom: 1.3 }),
  },
  {
    id: 'prefrontal-futures', from: 'agranular-prefrontal-simulation', to: 'agranular-prefrontal-simulation', lead: 0.5, tail: 0.5, fade: 0.5,
    Component: Futures,
    camera: (t) => ({ pos: [Math.sin(t * 1.8 - 0.9) * 4, 0.8, 10 - t * 1.5], look: [0, 0.6, 0], fov: 52 }),
    mood: () => ({ bg: '#04050f', bloom: 1.4 }),
  },
  {
    id: 'kpg-radiation', from: 'kpg-mammal-radiation', to: 'kpg-mammal-radiation', lead: K_LEAD, tail: K_TAIL, fade: 0.6,
    Component: KPg,
    camera: (t) => {
      const s = kS(t);
      const impact = Math.exp(-Math.pow((s + 0.5) / 0.15, 2));
      return { pos: [0, -0.3 + smoothstep(0, 1, t) * 0.5, 8 - smoothstep(0, 1, t) * 1.5 + impact * 0.8], look: [1 * (1 - smoothstep(-1, -0.4, s)), 0.2, -20], fov: 55 };
    },
    mood: (t) => {
      const s = kS(t);
      const burst = Math.exp(-Math.pow((s + 0.52) / 0.07, 2));
      const fire = smoothstep(-0.58, -0.45, s) * (1 - smoothstep(-0.2, 0.2, s));
      return { bg: '#03050b', bloom: 0.9 + burst * 1.6 + fire * 0.5 + smoothstep(0.1, 0.8, s) * 0.5 };
    },
  },
];
