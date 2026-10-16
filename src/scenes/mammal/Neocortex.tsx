import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, smoothstep } from '../../world/util';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

// The neocortex as the new layered sheet over a small early-mammal brain: the cortex grows and starts to wrinkle, a sagittal cut
// reveals its six strata, and one soft ripple of activity travels across the surface.
export default function Neocortex() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const brain = useBrainCtl({ grow: stageGrow('mammal') * 0.85, tissue: '#bcb0b3' });
  const wave = useMemo(() => ({ at: [1, 0, 0] as [number, number, number], r: 0.5, sym: true, color: '#8fd0ff', i: 0 }), []);
  const wave2 = useMemo(() => ({ at: [1, 0, 0] as [number, number, number], r: 0.3, sym: true, color: '#ffd27a', i: 0 }), []);
  brain.regions = [wave, wave2];

  useFrame(() => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const grow = smoothstep(0.05, 0.8, t);
    brain.alpha = w;
    brain.grow = stageGrow('mammal') * (0.8 + 0.2 * grow) + 0.03 * grow;
    brain.shape = { cerS: 0.7 + 0.35 * grow, fold: 0.04 + 0.28 * smoothstep(0.2, 0.95, t) };
    const beat = near(eventPos('neocortex'), 0.8);
    const ph = (time * 0.2 + t * 1.6) % 1; // front -> back across the dorsal surface
    const a = 1.2 - ph * 2.6;
    wave.at[0] = Math.cos(a); wave.at[1] = Math.sin(a) * 0.9 + 0.2; wave.at[2] = 0.1;
    wave.i = 0.9 * Math.sin(ph * Math.PI) * (0.7 + 0.5 * beat);
    const a2 = a - 0.5;
    wave2.at[0] = Math.cos(a2); wave2.at[1] = Math.sin(a2) * 0.9 + 0.2; wave2.at[2] = 0.1;
    wave2.i = 0.8 * Math.sin(ph * Math.PI) * (0.5 + 0.8 * beat);
    const cut = smoothstep(0.45, 0.62, t);
    brain.cut = cut > 0.01 ? 1 : 0; brain.cutAxis = 'sagittal'; brain.cutPos = 0.55 - 0.2 * cut; // a parasagittal slice: cortex ribbon over white matter, not the midline ventricles
    if (grp.current) { grp.current.rotation.y = -0.15 - 0.35 * cut + 0.05 * Math.sin(time * 0.2); grp.current.rotation.x = 0.06; }
  });

  return (
    <group ref={grp} position={[1.0, -0.2, 0]} scale={1.45}>
      <Brain ctl={brain} />
    </group>
  );
}
