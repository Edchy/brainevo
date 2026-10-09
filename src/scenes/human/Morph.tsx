import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

/** Archaic -> globular: one brain reshapes from the long, low hominin form into the rounded modern human one,
 *  while an amber hologram of the old outline lingers behind it. */
export default function Morph() {
  const scene = useScene();
  const root = useRef<THREE.Group>(null);
  const brain = useBrainCtl({ grow: stageGrow('hominin') });
  const ghost = useBrainCtl({ grow: stageGrow('hominin'), holo: 1, holoColor: '#ff9a3c' });
  const regs = useRef([
    { at: 'parietal' as const, color: '#ffb23c', i: 0 },
    { at: 'occipital' as const, color: '#ff7a1a', i: 0 },
  ]);
  brain.regions = regs.current;

  useFrame(() => {
    if (!scene.active) return;
    const f = world.stationF;
    const e0 = eventPos('jebel-irhoud-sapiens'), e1 = eventPos('globular-brain');
    const um = range(e0 + 0.15, e1 + 0.35, f);
    const pulse = Math.max(near(e0, 0.5), near(e1, 0.5));
    brain.grow = stageGrow('hominin') + (stageGrow('human') - stageGrow('hominin')) * um;
    brain.alpha = scene.weight;
    ghost.grow = stageGrow('hominin');
    ghost.alpha = scene.weight * (0.55 * Math.sin(Math.min(1, um * 1.2) * 1.5) + 0.2) * (1 - 0.5 * um);
    const mid = Math.sin(um * Math.PI);
    regs.current[0].i = (mid * 1.2 + um * 0.5) * (0.85 + 0.4 * pulse);
    regs.current[1].i = mid * 0.6;
    const g = root.current;
    if (g) {
      g.rotation.y = -0.75 + scene.t * 1.5;
      g.rotation.x = 0.08;
      g.position.y = 1.35 + Math.sin(scene.t * 3) * 0.05;
    }
  });
  return (
    <group ref={root} position={[0.8, 1.35, 0]} scale={1.25}>
      <Brain ctl={ghost} />
      <Brain ctl={brain} />
    </group>
  );
}
