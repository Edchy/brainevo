import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM, makeBodyMat } from './shared';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const BOX: [number, number, number] = [20, 11, 8];

/** lamprey brain with a large, finely ruffled cerebellum (folia) and image-forming eyes */
export default function Cerebellum() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const brain = useBrainCtl({ grow: stageGrow('fish') * 1.12, tissue: '#b2a5ab' });
  const regs = useMemo(() => [
    { at: 'cerebellum' as const, color: '#b36bff', i: 0 },
    { at: 'tectum' as const, color: '#5fe8ff', i: 0 },
  ], []);
  brain.regions = regs;
  const S = useMemo(() => {
    const eyeG = new THREE.SphereGeometry(0.3, 28, 20);
    const eyeM = makeBodyMat('#ffe9b0', { rim: 1.2, base: 0.12 });
    const irisM = makeBodyMat('#5fe8ff', { rim: 1, base: 0.7 });
    const irisG = new THREE.SphereGeometry(0.14, 20, 14);
    return { eyeG, eyeM, irisM, irisG };
  }, []);
  useEffect(() => () => { S.eyeG.dispose(); S.eyeM.dispose(); S.irisM.dispose(); S.irisG.dispose(); }, [S]);
  const p19 = eventPos('lampreys-brain-and-cerebellum');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, f = world.stationF, tm = TM();
    const n = near(p19, 0.9);
    const grow = smoothstep(0.1, 0.6, scene.t);
    brain.alpha = w;
    brain.shape = { cbS: 0.5 + grow * 0.5, cbFolia: 0.1 + grow * 0.95, cbK: 22 + grow * 22, tecS: 1 - grow * 0.15 };
    const sweep = 0.5 + 0.5 * Math.sin(f * 7 + tm * 0.8);
    regs[0].i = grow * (0.5 + 0.9 * sweep) * (0.6 + n * 0.9);
    regs[1].i = 0.15 + 0.2 * Math.sin(tm * 1.5) + n * 0.25;
    S.eyeM.uniforms.uOpacity.value = w * smoothstep(0.2, 0.5, scene.t); S.irisM.uniforms.uOpacity.value = S.eyeM.uniforms.uOpacity.value * (0.6 + n);
    if (grp.current) grp.current.rotation.y = -0.5 + scene.t * 1.0;
  });
  return (
    <group>
      <Backdrop top="#2a0d52" bottom="#02030a" ray={0.3} />
      <Plankton count={600} box={BOX} color="#b99bff" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={grp} position={[0.2, 0.2, 0]} scale={1.6}>
        <Brain ctl={brain} position={[-1.1, 0, 0]} />
        <mesh geometry={S.eyeG} material={S.eyeM} position={[0.4, 0.15, 1.15]} />
        <mesh geometry={S.eyeG} material={S.eyeM} position={[0.4, 0.15, -1.15]} />
        <mesh geometry={S.irisG} material={S.irisM} position={[0.55, 0.15, 1.38]} />
        <mesh geometry={S.irisG} material={S.irisM} position={[0.55, 0.15, -1.38]} />
      </group>
    </group>
  );
}
