import * as THREE from 'three';
import type { SceneDef } from '../../world/types';
import { smoothstep } from '../../world/util';
import Savanna, { savannaCamera } from './Savanna';
import Laetoli, { laetoliCamera } from './Laetoli';
import Oldowan, { oldowanCamera } from './Oldowan';
import Skulls, { skullsCamera } from './Skulls';
import Coop, { coopCamera } from './Coop';
import Handaxe, { handaxeCamera } from './Handaxe';
import Tissue, { tissueCamera } from './Tissue';
import Broca, { brocaCamera } from './Broca';
import Fire, { fireCamera } from './Fire';
import Teaching, { teachingCamera } from './Teaching';
import Lineages, { lineagesCamera } from './Lineages';

const c1 = new THREE.Color(), c2 = new THREE.Color();
const mixHex = (a: string, b: string, t: number) => c1.set(a).lerp(c2.set(b), t).getStyle();

export const hominScenes: SceneDef[] = [
  { id: 'hominin-savanna', from: 'sahelanthropus', to: 'ardipithecus', lead: 0.6, tail: 0.5, Component: Savanna, camera: savannaCamera,
    mood: (t) => ({ bg: mixHex('#04100d', '#0d0805', smoothstep(0.1, 0.85, t)), bloom: 0.9 }) },
  { id: 'hominin-laetoli', from: 'laetoli-footprints', to: 'australopithecus-lucy', lead: 0.5, tail: 0.5, fade: 0.4, Component: Laetoli, camera: laetoliCamera,
    mood: () => ({ bg: '#0a0709', bloom: 1.1 }) },
  { id: 'hominin-oldowan', from: 'oldowan-tools', to: 'oldowan-tools', lead: 0.5, tail: 0.35, fade: 0.4, Component: Oldowan, camera: oldowanCamera,
    mood: () => ({ bg: '#07060c', bloom: 1.2 }) },
  { id: 'hominin-skulls', from: 'homo-habilis', to: 'homo-erectus', lead: 0.25, tail: 0.5, fade: 0.4, Component: Skulls, camera: skullsCamera,
    mood: () => ({ bg: '#05070f', bloom: 1.1 }) },
  { id: 'hominin-coop', from: 'cooperative-breeding', to: 'cooperative-breeding', lead: 0.5, tail: 0.5, fade: 0.4, Component: Coop, camera: coopCamera,
    mood: () => ({ bg: '#0a0706', bloom: 1.2 }) },
  { id: 'hominin-handaxe', from: 'acheulean-handaxe', to: 'acheulean-handaxe', lead: 0.5, tail: 0.5, fade: 0.4, Component: Handaxe, camera: handaxeCamera,
    mood: () => ({ bg: '#07060a', bloom: 1.3 }) },
  { id: 'hominin-tissue', from: 'expensive-tissue', to: 'expensive-tissue', lead: 0.5, tail: 0.5, fade: 0.4, Component: Tissue, camera: tissueCamera,
    mood: () => ({ bg: '#06060c', bloom: 1.2 }) },
  { id: 'hominin-broca', from: 'broca-vocal-tract', to: 'broca-vocal-tract', lead: 0.5, tail: 0.5, fade: 0.4, Component: Broca, camera: brocaCamera,
    mood: () => ({ bg: '#05070e', bloom: 1.3 }) },
  { id: 'hominin-fire', from: 'control-of-fire', to: 'homo-heidelbergensis', lead: 0.5, tail: 0.5, fade: 0.4, Component: Fire, camera: fireCamera,
    mood: (t) => ({ bg: mixHex('#04060a', '#0c0604', smoothstep(0.1, 0.5, t)), bloom: 1.5 }) },
  { id: 'hominin-teaching', from: 'teaching-cumulative-culture', to: 'teaching-cumulative-culture', lead: 0.5, tail: 0.5, fade: 0.4, Component: Teaching, camera: teachingCamera,
    mood: () => ({ bg: '#07060a', bloom: 1.2 }) },
  { id: 'hominin-lineages', from: 'neanderthals', to: 'denisovans', lead: 0.5, tail: 0.5, fade: 0.4, Component: Lineages, camera: lineagesCamera,
    mood: (t) => ({ bg: mixHex('#05060d', '#03050b', t), bloom: 1.4 }) },
];
