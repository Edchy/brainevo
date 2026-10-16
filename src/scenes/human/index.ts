import type { SceneDef } from '../../world/types';
import Morph from './Morph';
import Ochre from './Ochre';
import Language from './Language';
import Africa from './Africa';
import Cave, { caveX } from './Cave';
import Burial from './Burial';
import Agriculture from './Agriculture';
import Writing from './Writing';
import Enlightenment from './Enlightenment';
import Science from './Science';
import Neuron from './Neuron';
import Imaging from './Imaging';
import Bci from './Bci';
import AiMirror from './AiMirror';
import Now, { NOW_CAM } from './Now';

const BG = '#03050b';

export const humanScenes: SceneDef[] = [
  {
    id: 'human-morph', from: 'jebel-irhoud-sapiens', to: 'globular-brain', lead: 0.8, tail: 0.3, fade: 0.5,
    Component: Morph,
    camera: (t) => ({ pos: [0, 1.35, 8.8 - t * 0.5], look: [0, 1.35, 0], fov: 50 }),
    mood: () => ({ bg: BG, bloom: 1.3 }),
  },
  {
    id: 'human-ochre', from: 'ochre-symbolic-thought', to: 'ochre-symbolic-thought', lead: 0.4, tail: 0.3, fade: 0.35,
    Component: Ochre,
    camera: (t) => ({ pos: [0.3 - t * 0.4, 0.3, 6.4 - t * 0.6], look: [0, 0.3, 0], fov: 50 }),
    mood: () => ({ bg: '#05040a', bloom: 1.2 }),
  },
  {
    id: 'human-language', from: 'language-shares-simulations', to: 'language-foxp2', lead: 0.25, tail: 0.3, fade: 0.4,
    Component: Language,
    camera: (t) => ({ pos: [0, 0.5, 8.2 - t * 0.8], look: [0, 0.6, 0], fov: 50 }),
    mood: () => ({ bg: BG, bloom: 1.3 }),
  },
  {
    id: 'human-africa', from: 'out-of-africa', to: 'out-of-africa', lead: 0.4, tail: 0.3, fade: 0.4,
    Component: Africa,
    camera: () => ({ pos: [0, 0, 7.5], look: [0, 0, 0], fov: 45 }),
    mood: () => ({ bg: BG, bloom: 1.1 }),
  },
  {
    id: 'human-cave', from: 'cave-art', to: 'bone-flutes-music', lead: 0.5, tail: 0.5,
    Component: Cave,
    camera: (t) => ({ pos: [caveX(t), 0.2, 5.8], look: [caveX(t) + 0.5, 0, 0], fov: 50 }),
    mood: () => ({ bg: '#030305', bloom: 1.1 }),
  },
  {
    id: 'human-burial', from: 'burial-ritual', to: 'behavioural-modernity', lead: 0.5, tail: 0.5,
    Component: Burial,
    // close over the beaded grave and the lamp first, then rising to show the network of fires (behavioural modernity)
    camera: (t) => ({ pos: [-0.35, 2.7 + t * 3.6, 2.3 + t * 6.8], look: [-0.3, 0.0, -0.15 - t * 2.3], fov: 50 }),
    mood: () => ({ bg: '#040307', bloom: 1.3 }),
  },
  {
    id: 'human-agriculture', from: 'agriculture', to: 'agriculture', lead: 0.45, tail: 0.3, fade: 0.4,
    Component: Agriculture,
    // just above the ears at the edge of the stand, drifting along it, the low sun on the horizon
    camera: (t) => ({ pos: [-0.9 + t * 1.8, 1.75, 4.4], look: [0.2 + t * 0.5, 0.75, -2], fov: 42 }),
    mood: () => ({ bg: '#03060a', bloom: 1.2 }),
  },
  {
    id: 'human-writing', from: 'writing', to: 'alphabet', lead: 0.5, tail: 0.25, fade: 0.3,
    Component: Writing,
    camera: (t) => ({ pos: [0, 0.5, 6.8 - t * 0.6], look: [0, 0.5, 0], fov: 50 }),
    mood: () => ({ bg: '#040408', bloom: 1.3 }),
  },
  {
    id: 'human-enlightenment', from: 'philosophy-of-mind', to: 'printing-press', lead: 0.2, tail: 0.4, fade: 0.35,
    Component: Enlightenment,
    camera: (t) => ({ pos: [0, 0.8, 7.2 + t * 0.4], look: [0, 0.1, 0], fov: 50 }),
    mood: () => ({ bg: '#05050a', bloom: 1.2 }),
  },
  {
    id: 'human-science', from: 'scientific-revolution', to: 'scientific-revolution', lead: 0.45, tail: 0.4, fade: 0.4,
    Component: Science,
    camera: (t) => ({ pos: [0, 7.2 - t * 0.8, 7.4], look: [0, 0, 0], fov: 45 }),
    mood: () => ({ bg: '#03040a', bloom: 1.2 }),
  },
  {
    id: 'human-neuron', from: 'neuron-doctrine', to: 'neuron-doctrine', lead: 0.7, tail: 0.4,
    Component: Neuron,
    camera: (t) => ({ pos: [0, 0.3, 8.8 - t * 0.9], look: [0, 0, 0], fov: 50 }),
    mood: () => ({ bg: '#05040a', bloom: 1.3 }),
  },
  {
    id: 'human-imaging', from: 'eeg', to: 'fmri', lead: 0.3, tail: 0.2, fade: 0.35,
    Component: Imaging,
    camera: (t) => ({ pos: [0, 0.2, 7.2 - t * 0.5], look: [0, 0.1, 0], fov: 50 }),
    mood: () => ({ bg: '#030610', bloom: 1.3 }),
  },
  {
    id: 'human-bci', from: 'brain-computer-interfaces', to: 'brain-computer-interfaces', lead: 0.3, tail: 0.3, fade: 0.35,
    Component: Bci,
    camera: (t) => ({ pos: [-0.2 + t * 0.6, 1.4, 8.6 - t * 0.6], look: [-0.4, 0, 0], fov: 50 }),
    mood: () => ({ bg: '#03050d', bloom: 1.3 }),
  },
  {
    id: 'human-ai', from: 'ai-mirror', to: 'ai-mirror', lead: 0.6, tail: 0.5,
    Component: AiMirror,
    camera: (t) => ({ pos: [0, 0.2, 9.4 - t * 0.6], look: [0, 0, 0], fov: 50 }),
    mood: () => ({ bg: '#03050d', bloom: 1.3 }),
  },
  {
    id: 'human-now', from: 'now', to: 'now', lead: 0.3, tail: 2.0, fade: 0.35,
    Component: Now,
    camera: NOW_CAM,
    mood: (t) => ({ bg: t < 0.5 ? '#03050b' : '#02030a', bloom: 1.2 + 0.5 * t }),
  },
];
