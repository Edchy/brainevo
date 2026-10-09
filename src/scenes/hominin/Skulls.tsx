import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Shell } from './common';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

/** One brain, one form: it swells from habilis (~610 cc) to erectus (~900 cc), alone in the dark. */
const rad = (cc: number) => Math.cbrt(cc / 610);
export const skullsCamera = (t: number) => ({ pos: [Math.sin(t * 2) * 0.2, 0.15, 6.2 - t * 0.4] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 46 });

export default function Skulls() {
  const scene = useScene();
  const brain = useBrainCtl({ grow: stageGrow('hominin') * 0.93, tissue: '#d8cfca' });
  const regs = useMemo(() => [
    { at: 'motor' as const, color: '#ffb23c', i: 0 },
    { at: 'parietal' as const, color: '#ffb23c', i: 0 },
    { at: 'broca' as const, color: '#ff7a1a', i: 0 },
  ], []);
  brain.regions = regs;
  const shell = useMemo(() => ({ alpha: 0.18 }), []);
  const grp = useRef<THREE.Group>(null), sh = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t;
    const k = smoothstep(0.1, 0.9, t);
    const cc = lerp(560, 960, k);
    const pulse = near(eventPos('homo-habilis'), 0.5) + near(eventPos('homo-erectus'), 0.5);
    const s = rad(cc) * 0.74;
    brain.alpha = w; brain.size = s;
    brain.grow = stageGrow('hominin') * (0.9 + 0.1 * k);
    brain.shape = { frontal: 0.4 + 0.3 * k, cerS: 0.95 + 0.05 * k };
    regs[0].i = (0.3 + 0.5 * k + 0.7 * pulse) * 1.5; regs[1].i = (0.2 + 0.5 * k + 0.6 * pulse) * 1.3; regs[2].i = 1.4 * k * (0.5 + 0.5 * pulse);
    shell.alpha = w * 0.07; sh.current?.scale.setScalar(s);
    if (grp.current) grp.current.rotation.y = -0.7 + t * 0.9 + (world.reduced ? 0 : Math.sin(world.time * 0.25) * 0.08);
  });

  return (
    <group position={[0.9, 0.0, 0]}>
      <group ref={grp}>
        <Brain ctl={brain} />
        <group ref={sh}><Shell ctl={shell} scale={[2.5, 1.75, 1.9]} color="#e8f3ff" /></group>
      </group>
    </group>
  );
}
