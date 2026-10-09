import type { SceneDef } from '../../world/types';
import Stereo, { stereoCamera } from './Stereo';
import Trichromacy, { trichromacyCamera } from './Trichromacy';
import Prefrontal, { prefrontalCamera } from './Prefrontal';
import Social, { socialCamera } from './Social';
import Imitation, { imitationCamera } from './Imitation';
import TheoryOfMind, { tomCamera } from './TheoryOfMind';
import Mirror, { mirrorCamera } from './Mirror';
import Canopy, { canopyCamera } from './Canopy';

export const primateScenes: SceneDef[] = [
  {
    id: 'primate-canopy', from: 'first-primates', to: 'first-primates', lead: 0.25, tail: 0.25, fade: 0.25,
    Component: Canopy, camera: canopyCamera,
    mood: () => ({ bg: '#020203', bloom: 1.1 }),
  },
  {
    id: 'primate-stereo', from: 'forward-eyes-visual-cortex', to: 'forward-eyes-visual-cortex', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Stereo, camera: stereoCamera, mood: () => ({ bg: '#020203', bloom: 1.3 }),
  },
  {
    id: 'primate-trichromacy', from: 'trichromatic-vision', to: 'trichromatic-vision', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Trichromacy, camera: trichromacyCamera, mood: () => ({ bg: '#020203', bloom: 1.1 }),
  },
  {
    id: 'primate-prefrontal', from: 'prefrontal-expansion', to: 'prefrontal-expansion', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Prefrontal, camera: prefrontalCamera, mood: () => ({ bg: '#020203', bloom: 1.5 }),
  },
  {
    id: 'primate-social', from: 'social-brain', to: 'social-brain', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Social, camera: socialCamera, mood: () => ({ bg: '#020203', bloom: 1.4 }),
  },
  {
    id: 'primate-imitation', from: 'imitation-learning-primates', to: 'great-ape-cognition', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Imitation, camera: imitationCamera, mood: () => ({ bg: '#020203', bloom: 1.2 }),
  },
  {
    id: 'primate-theory-of-mind', from: 'mental-state-inference-primates', to: 'mental-state-inference-primates', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: TheoryOfMind, camera: tomCamera, mood: () => ({ bg: '#020203', bloom: 1.3 }),
  },
  {
    id: 'primate-mirror', from: 'mirror-self-recognition', to: 'mirror-self-recognition', lead: 0.3, tail: 0.25, fade: 0.25,
    Component: Mirror, camera: mirrorCamera, mood: () => ({ bg: '#020203', bloom: 1.3 }),
  },
];
