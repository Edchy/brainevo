import type { SceneDef } from '../../world/types';
import Protocells from './Protocells';
import Membrane from './Membrane';
import Chemotaxis from './Chemotaxis';
import Eukaryote from './Eukaryote';
import Multicell from './Multicell';
import Sponge from './Sponge';
import NerveNet from './NerveNet';
import Worm from './Worm';
import Cambrian from './Cambrian';
import { near, smoothstep } from '../../world/util';
import { Color } from 'three';

const c1 = new Color(), c2 = new Color();
const mixHex = (a: string, b: string, t: number) => '#' + c1.set(a).lerp(c2.set(b), t).getHexString();
import { eventPos } from '../../world/util';

export const lifeScenes: SceneDef[] = [
  {
    id: 'life-protocells', from: 'first-life', to: 'first-life', lead: 0.6, tail: 0.45, fade: 0.3, Component: Protocells, // lead: the first cells are formed when their caption shows
    camera: (t) => ({ pos: [Math.sin(t * 2) * 0.6, 0.3 + t * 0.4, 7.5 - t * 1.2], look: [0, 0.2 + t * 0.4, 0], fov: 55 }),
    mood: (t) => ({ bg: mixHex('#03050b', '#041320', smoothstep(0.1, 0.8, t)), bloom: 1.0 + t * 0.4 }),
  },
  {
    id: 'life-membrane', from: 'chemical-signalling', to: 'ion-channels', lead: 0.15, tail: 0.3, fade: 0.4, Component: Membrane,
    camera: (t) => ({ pos: [-1.5 + t * 3, 1.5, 8 - t * 0.5], look: [t * 0.6 - 0.3, 0, 0], fov: 55 }),
    mood: () => ({ bg: '#03060e', bloom: 0.8 }),
  },
  {
    id: 'life-chemotaxis', from: 'bacterial-chemotaxis', to: 'bacterial-chemotaxis', lead: 0.45, tail: 0.45, fade: 0.3, Component: Chemotaxis,
    camera: (t) => ({ pos: [t * 1.6 - 0.8, 0, 8.5], look: [t * 1.0 - 0.5, 0, 0], fov: 55 }),
    mood: () => ({ bg: '#030a09', bloom: 1.1 }),
  },
  {
    id: 'life-eukaryote', from: 'eukaryotes', to: 'eukaryotes', lead: 0.45, tail: 0.45, fade: 0.3, Component: Eukaryote,
    camera: (t) => ({ pos: [0.6 - t * 0.6, 0.3, 8 - t * 1.2], look: [0.3, 0, 0], fov: 55 }),
    mood: () => ({ bg: '#04050f', bloom: 1.2 }),
  },
  {
    id: 'life-multicell', from: 'multicellularity', to: 'multicellularity', lead: 0.45, tail: 0.45, fade: 0.3, Component: Multicell,
    camera: (t) => ({ pos: [0, 0.2, 7.2 - t * 1.0], look: [0, 0.4, 0], fov: 55 }),
    mood: () => ({ bg: '#03090a', bloom: 1.1 }),
  },
  {
    id: 'life-sponge', from: 'sponges-no-neurons', to: 'sponges-no-neurons', lead: 0.45, tail: 0.45, fade: 0.3, Component: Sponge,
    camera: (t) => ({ pos: [-1.5 + t * 3, 1.2 + t * 0.6, 7.6 - t * 1.2], look: [0, 0.8, 0], fov: 52 }),
    mood: () => ({ bg: '#03090d', bloom: 1.0 }),
  },
  {
    id: 'life-nerve-net', from: 'first-neurons-nerve-net', to: 'first-neurons-nerve-net', lead: 0.45, tail: 0.45, fade: 0.3, Component: NerveNet,
    camera: (t) => ({ pos: [Math.sin(t * 3) * 0.8, 1.0, 7.8 - t * 1.0], look: [0, 0.6, 0], fov: 55 }),
    mood: () => ({ bg: '#030617', bloom: 1.5 }),
  },
  {
    id: 'life-worm', from: 'bilateral-symmetry-ganglia', to: 'cephalization', lead: 0.3, tail: 0.4, fade: 0.4, Component: Worm,
    camera: (t) => ({ pos: [-0.3 + t * 1.2, 4.4, 2.2], look: [t * 1.2, 0, 0], fov: 55 }),
    mood: () => ({ bg: '#030a0b', bloom: 1.3 }),
  },
  {
    id: 'life-cambrian', from: 'cambrian-explosion-eyes', to: 'cambrian-explosion-eyes', lead: 0.45, tail: 0.55, fade: 0.3, Component: Cambrian,
    camera: (t) => ({ pos: [0, 0.4, 8.5 - 2.5 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) + 2.5 * Math.max(0, (t - 0.65) / 0.35)], look: [0, 0.4, 0], fov: 55 }),
    mood: (t) => ({
      bg: t > 0.9 ? '#03050b' : '#020609',
      bloom: 0.8 + near(eventPos('cambrian-explosion-eyes'), 0.3) * 0.5,
    }),
  },
];
