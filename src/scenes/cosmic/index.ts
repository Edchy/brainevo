import type { SceneDef } from '../../world/types';
import { world } from '../../world/store';
import { easeInOutCubic, eventPos, range, smoothstep, lerp } from '../../world/util';
import BigBang, { BANG_SHIFT } from './BigBang';
import FirstStars from './FirstStars';
import Planet from './Planet';
import Soup, { SURF_Y, flashAt } from './Soup';
import { Color } from 'three';

const c1 = new Color(), c2 = new Color();
const mixHex = (a: string, b: string, t: number) => '#' + c1.set(a).lerp(c2.set(b), t).getHexString();

export const cosmicScenes: SceneDef[] = [
  {
    id: 'big-bang', from: 'big-bang', to: 'big-bang', lead: 2, tail: 0.5, fade: 0.5, Component: BigBang,
    camera: () => {
      const f = world.stationF - eventPos('big-bang') + BANG_SHIFT;
      const pre = easeInOutCubic(range(-2, -0.1, f));
      const z = 7 - 3.2 * pre + 24 * smoothstep(-0.05, 0.3, f) - 21 * smoothstep(0.4, 1.0, f);
      const shake = Math.exp(-Math.abs(f + 0.02) * 9) * 0.12 * Math.sin(world.time * 55) * (world.reduced ? 0 : 1);
      return { pos: [shake, shake * 0.7, z], look: [0, 0, 0], fov: 55 - 8 * pre + 14 * Math.exp(-Math.abs(f) * 6) };
    },
    mood: () => {
      const f = world.stationF - eventPos('big-bang') + BANG_SHIFT;
      const fl = Math.exp(-Math.abs(f + 0.02) * 8);
      const cmb = smoothstep(0.1, 0.35, f) * (1 - smoothstep(0.5, 1, f));
      return { bg: mixHex('#000001', '#1a0600', Math.min(1, fl * 0.7 + cmb * 0.3)), bloom: 1.0 + 1.5 * fl + 0.3 * cmb };
    },
  },
  {
    id: 'first-stars', layer: true, from: 'first-stars-heavy-elements', to: 'first-stars-heavy-elements', lead: 0.8, tail: 0.5, fade: 0.5, Component: FirstStars,
    camera: (t) => ({ pos: [0.9 * Math.sin(t * 2.4), 0.3 + 0.4 * Math.sin(t * 1.7), 6 - 3.2 * smoothstep(0, 1, t)], look: [0, 0, -14], fov: 55 }),
    mood: (t) => ({ bg: mixHex('#010208', '#03050b', t), bloom: 1.0 + 0.9 * Math.sin(Math.PI * t) }),
  },
  {
    id: 'planet', layer: true, from: 'earth-forms', to: 'oceans-prebiotic-chemistry', lead: 0.75, tail: -0.3, fade: 0.35, Component: Planet,
    camera: () => {
      const f = world.stationF;
      const a = smoothstep(1.1, 2.0, f), b = smoothstep(2.0, 2.2, f), c = smoothstep(2.25, 2.7, f);
      const p = [lerp(0, 0, a), lerp(3, 0.4, a), lerp(14, 6, a)];
      const x = lerp(p[0], 1.8, b) * (1 - c);
      const y = lerp(p[1], 1.0, b) * (1 - c) + 0.2 * c;
      const z = lerp(p[2], 8.5, b) * (1 - c) + 5.2 * c;
      return { pos: [x, y, z], look: [0, 0, 0], fov: 55 };
    },
    mood: () => {
      const f = world.stationF;
      const im = Math.exp(-Math.abs(f - 2.07) * 10);
      return { bg: mixHex('#03050b', '#0a0402', im * 0.6), bloom: 1.0 + 1.1 * im + 0.4 * (1 - smoothstep(2.3, 2.7, f)) };
    },
  },
  {
    id: 'primordial-soup', from: 'oceans-prebiotic-chemistry', to: 'oceans-prebiotic-chemistry', lead: 0.0, tail: 0.7, fade: 0.3, Component: Soup,
    camera: () => {
      const f = world.stationF;
      const dive = easeInOutCubic(range(3.3, 3.5, f));
      const settle = smoothstep(3.5, 3.75, f);
      const y = lerp(SURF_Y + 1.4, 0.2, dive);
      return { pos: [Math.sin(f * 1.5) * 0.35 * dive, y, lerp(7, 9, settle)], look: [0, lerp(SURF_Y + 2, 0.3, dive), lerp(-10, 0, dive)], fov: 46 };
    },
    mood: () => {
      const f = world.stationF;
      const fl = flashAt(f);
      const under = smoothstep(3.33, 3.5, f);
      const deep = smoothstep(3.5, 3.75, f);
      const sky = mixHex('#02050c', '#1c2644', Math.min(1, fl * 0.5));
      return { bg: mixHex(mixHex(sky, '#031a27', under), '#03050b', deep), bloom: 1.05 + 0.5 * fl };
    },
  },
];
