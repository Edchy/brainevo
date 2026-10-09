import type { SceneDef } from '../../world/types';
import { smoothstep } from '../../world/util';
import Chordate from './Chordate';
import BrainGrow from './BrainGrow';
import Dopamine from './Dopamine';
import Cerebellum from './Cerebellum';
import BasalGanglia from './BasalGanglia';
import Myelin from './Myelin';
import Shore from './Shore';
import Pallium from './Pallium';
import Egg from './Egg';
import Synapsids from './Synapsids';
import ReptileBrain from './ReptileBrain';

export const vertebrateScenes: SceneDef[] = [
  {
    id: 'v-chordate', from: 'chordates-notochord-nerve-cord', to: 'chordates-notochord-nerve-cord', lead: 0.6, tail: 0.45, fade: 0.35,
    Component: Chordate,
    camera: (t) => ({ pos: [-0.6 + t * 1.4, 0.05 - t * 0.1, 7 - t * 2.4], look: [0, -0.5, 0], fov: 55 }),
    mood: (t) => ({ bg: t < 0.2 ? '#03050b' : '#021019', bloom: 1.1 + smoothstep(0.3, 0.6, t) * 0.5 }),
  },
  {
    id: 'v-braingrow', from: 'first-vertebrates-neural-crest', to: 'tripartite-brain', lead: 0.6, tail: 0.45, fade: 0.35,
    Component: BrainGrow,
    camera: (t) => ({ pos: [0.3, 0.2, 8.2 - t * 1.4], look: [0.1, -0.2, 0], fov: 55 }),
    mood: () => ({ bg: '#02060f', bloom: 1.3 }),
  },
  {
    id: 'v-dopamine', from: 'dopamine-reinforcement-signal', to: 'dopamine-reinforcement-signal', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Dopamine,
    camera: (t) => ({ pos: [0.2 + t * 0.4, 0.6, 9.2 - t * 1.2], look: [0, 0.2, 0], fov: 55 }),
    mood: () => ({ bg: '#05030f', bloom: 1.5 }),
  },
  {
    id: 'v-cerebellum', from: 'lampreys-brain-and-cerebellum', to: 'lampreys-brain-and-cerebellum', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Cerebellum,
    camera: (t) => ({ pos: [0, 1.6 - t * 0.6, 8 - t * 1.2], look: [-0.2, -0.1, 0], fov: 55 }),
    mood: () => ({ bg: '#05030f', bloom: 1.2 }),
  },
  {
    id: 'v-basal-ganglia', from: 'basal-ganglia-actor-critic', to: 'basal-ganglia-actor-critic', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: BasalGanglia,
    camera: (t) => ({ pos: [-0.4 + t * 0.8, 0.2, 11 - t * 1.0], look: [-0.5, -0.9, 0], fov: 55 }),
    mood: () => ({ bg: '#04030d', bloom: 1.3 }),
  },
  {
    id: 'v-myelin', from: 'myelin-jawed-fish', to: 'myelin-jawed-fish', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Myelin,
    camera: (t) => ({ pos: [(t - 0.5) * 1.6, 0.3, 9.8 - t * 1.2], look: [(t - 0.5) * 1.0, -1.3, 0], fov: 50 }),
    mood: () => ({ bg: '#02070a', bloom: 1.3 }),
  },
  {
    id: 'v-pallium', from: 'pallium-fish-forebrain', to: 'pallium-fish-forebrain', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Pallium,
    camera: (t) => ({ pos: [0.3, 0.8 - t * 0.4, 9.2 - t * 1.4], look: [0.4, -0.3, 0], fov: 55 }),
    mood: () => ({ bg: '#05030a', bloom: 1.2 }),
  },
  {
    id: 'v-shore', from: 'tetrapods-move-to-land', to: 'tetrapods-move-to-land', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Shore,
    camera: (t) => ({ pos: [0.6 + t * 3.4, -0.5 + smoothstep(0.15, 0.65, t) * 1.7, 6.4 - t * 1.0], look: [2.4 + t * 2.0, -0.4 + smoothstep(0.2, 0.8, t) * 0.8, 0], fov: 52 }),
    mood: (t) => ({ bg: t < 0.3 ? '#03121a' : '#0a0d14', bloom: 0.7 + smoothstep(0.5, 0.9, t) * 0.2 }),
  },
  {
    id: 'v-egg', from: 'amniotes-first-eggs', to: 'amniotes-first-eggs', lead: 0.45, tail: 0.25, fade: 0.3,
    Component: Egg,
    camera: (t) => ({ pos: [0, 0.8, 8.4 - t * 1.2], look: [0, -0.1, 0], fov: 52 }),
    mood: () => ({ bg: '#06040a', bloom: 1.1 }),
  },
  {
    id: 'v-synapsids', from: 'synapsids', to: 'synapsids', lead: 0.45, tail: 0.45, fade: 0.35,
    Component: Synapsids,
    camera: (t) => ({ pos: [0, 0.2 + t * 0.8, 10.5], look: [0, -0.2 + t * 0.9, 0], fov: 55 }),
    mood: () => ({ bg: '#03050f', bloom: 1.3 }),
  },
  {
    id: 'v-reptile', from: 'reptile-brain-plan', to: 'reptile-brain-plan', lead: 0.45, tail: 0.7, fade: 0.35,
    Component: ReptileBrain,
    camera: (t) => ({ pos: [0, 2.2 - t * 1.8, 9.5 - t * 2.4], look: [0, -0.2 + t * 0.2, 0], fov: 55 }),
    mood: (t) => ({ bg: t > 0.8 ? '#03050b' : '#04080e', bloom: 1.3 }),
  },
];
