import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Brain, newBrain, Shell } from './common';

/** One brain, one form: it swells from habilis (~610 cc) to erectus (~900 cc), alone in the dark. */
const rad = (cc: number) => Math.cbrt(cc / 610);
export const skullsCamera = (t: number) => ({ pos: [Math.sin(t * 2) * 0.2, 0.15, 6.2 - t * 0.4] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 46 });

export default function Skulls() {
  const scene = useScene();
  const brain = useMemo(newBrain, []);
  const shell = useMemo(() => ({ alpha: 0.18 }), []);
  const grp = useRef<THREE.Group>(null), sh = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t;
    const k = smoothstep(0.1, 0.9, t);
    const cc = lerp(560, 960, k);
    const pulse = near(eventPos('homo-habilis'), 0.5) + near(eventPos('homo-erectus'), 0.5);
    brain.alpha = w * 0.95; brain.glow = 0.25 + 0.35 * pulse; brain.motor = 0.1 + 0.3 * k; brain.par = 0.1 + 0.3 * k; brain.broca = 0.3 * k;
    brain.s = rad(cc) * 1.15;
    shell.alpha = w * 0.14; sh.current?.scale.setScalar(brain.s);
    if (grp.current) grp.current.rotation.y = -0.7 + t * 0.9 + (world.reduced ? 0 : Math.sin(world.time * 0.25) * 0.08);
  });

  return (
    <group position={[1.0, -0.1, 0]}>
      <group ref={grp}>
        <Brain ctl={brain} color="#dfeaff" />
        <group ref={sh}><Shell ctl={shell} scale={[1.45, 1.1, 1.0]} color="#e8f3ff" /></group>
      </group>
    </group>
  );
}
