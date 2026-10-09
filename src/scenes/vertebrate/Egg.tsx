import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, Plankton, TM } from './shared';

const BOX: [number, number, number] = [18, 10, 8];

/** amniote egg: pitted shell, amnion, yolk, vascular allantois and a curled embryo with a red heartbeat; a slice sweeps the front of the shell away */
export default function Egg() {
  const scene = useScene();
  const h = useRef<AquaHandle>(null);
  const grp = useRef<THREE.Group>(null);
  const p24 = eventPos('amniotes-first-eggs');
  useFrame(() => {
    if (!scene.active) return;
    const a = h.current; if (!a) return;
    const w = scene.weight, tm = TM(), t = scene.t, n = near(p24, 0.8);
    const st = a.state;
    st.aux = smoothstep(0.1, 0.55, t);
    st.grow = 0.2 + 0.8 * smoothstep(0.1, 0.8, t);
    st.phase = t * 3;
    a.look.w = w; a.look.glowK = 1 + n * 0.5;
    a.netO.set(0.55, 0.15, -0.5, -1);
    if (grp.current) { grp.current.rotation.y = -0.45 + t * 0.9; grp.current.position.y = 0.2 + Math.sin(tm * 0.6) * 0.04; }
  });
  return (
    <group>
      <Backdrop top="#4a2a18" bottom="#04030a" ray={0.2} rays={false} />
      <Plankton count={500} box={BOX} color="#ffcf9a" size={0.035} flow={-1.5} drift={[0.05, 0.02, 0]} center={[0, 0, -1]} />
      <group ref={grp} scale={1.3}>
        <AquaCreature ref={h} kind="egg" resolution={0.75} />
      </group>
    </group>
  );
}
