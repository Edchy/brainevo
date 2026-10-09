import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, Plankton, timeNow } from './common';

const NP = 6;
const JELLIES = [
  { pos: [0.5, 0.9, 0] as [number, number, number], scale: 1.9, phase: 0, main: true, tilt: 0.12 },
  { pos: [-6.4, 2.6, -6] as [number, number, number], scale: 1.1, phase: 0.33, main: false, tilt: 0.25 },
  { pos: [6.8, -0.2, -8] as [number, number, number], scale: 1.4, phase: 0.61, main: false, tilt: -0.3 },
];

/** a diffuse nerve net lighting up a jellyfish: signals ripple outward from a point of the bell and ring the margin, the bell squeezes */
export default function NerveNet() {
  const scene = useScene();
  const hs = useRef<(AquaHandle | null)[]>([]);
  const gs = useRef<(THREE.Group | null)[]>([]);
  const origins = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: NP }, () => new THREE.Vector3(r() * 2 - 1, 0.35 + r() * 0.65, r() * 2 - 1).normalize());
  }, []);
  const pEv = eventPos('first-neurons-nerve-net');
  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const net = smoothstep(0.08, 0.5, t);
    const pulse = near(pEv, 0.6);
    JELLIES.forEach((j, i) => {
      const a = hs.current[i], g = gs.current[i];
      if (!a || !g) return;
      const q = t * NP + j.phase * 3;
      const k = Math.floor(q) % NP, fr = q - Math.floor(q);
      const front = fr * 3.1 - 0.3;
      const o = origins[(k + i * 2) % NP];
      const st = a.state;
      const squeeze = Math.exp(-Math.pow((front - 2.15) * 1.5, 2));
      st.aux = j.main ? Math.min(1, 0.04 + squeeze) : 0.5 + 0.5 * Math.sin(time * 0.9 + j.phase * 9);
      st.sig = Math.max(0, Math.min(1, (front - 1.2) / 1.3));
      a.netO.set(o.x * 0.95, o.y * 0.7, o.z * 0.95, j.main ? front : -1);
      a.look.w = w * (j.main ? 1 : 0.6);
      a.look.glowK = (0.35 + 1.1 * net) * (1 + pulse * 0.8) * (j.main ? 1 : 0.7);
      a.look.sigK = 3 * net;
      g.position.set(j.pos[0], j.pos[1] + squeeze * 0.28 + Math.sin(t * 6 + j.phase * 9) * 0.1, j.pos[2]);
      g.rotation.set(j.tilt, time * 0.05 + t * 0.6, 0);
    });
  });
  return (
    <group>
      <Backdrop color="#2a5fd0" caustics={0.16} shafts={0.2} haze={0.1} />
      <Plankton count={800} box={[24, 14, 12]} color="#8fb8ff" size={0.04} dir={[0.0, 0.05, 0]} />
      {JELLIES.map((j, i) => (
        <group key={i} ref={(g) => { gs.current[i] = g; }}>
          <group scale={j.scale}>
            <AquaCreature ref={(a) => { hs.current[i] = a; }} kind="jellyfish" params={{ net: j.main ? 1 : 0 }} resolution={j.main ? 'auto' : 0.6} />
          </group>
        </group>
      ))}
    </group>
  );
}
