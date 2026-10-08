import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp } from '../../world/util';
import { Brain, newBrain, Shell } from './common';

const CC = [360, 430, 610, 900, 1200, 1500];
const SP = 3.4;
const rad = (cc: number) => Math.cbrt(cc / 610);
const idxAt = (t: number) => lerp(1.4, 3.6, t);
export const skullsCamera = (t: number) => {
  const x = idxAt(t) * SP;
  return { pos: [x, 0.6, 9.5] as [number, number, number], look: [x, -0.1, 0] as [number, number, number], fov: 50 };
};

export default function Skulls() {
  const scene = useScene();
  const brains = useMemo(() => CC.map(() => newBrain()), []);
  const shells = useMemo(() => CC.map(() => ({ alpha: 0.4 })), []);
  const groups = useMemo(() => CC.map(() => ({ g: null as THREE.Group | null })), []);
  const bars = useMemo(() => CC.map(() => ({ m: null as THREE.Mesh | null })), []);
  const barMats = useMemo(() => CC.map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.2, 0.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), []);
  const barGeo = useMemo(() => new THREE.BoxGeometry(0.12, 1, 0.12), []);
  const floor = useMemo(() => {
    const g = new THREE.GridHelper(80, 160, '#ffb070', '#ffb070');
    const m = g.material as THREE.LineBasicMaterial; m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false;
    return g;
  }, []);
  useEffect(() => () => { barMats.forEach((m) => m.dispose()); barGeo.dispose(); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); }, [barMats, barGeo, floor]);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, cam = idxAt(scene.t);
    (floor.material as THREE.Material).opacity = w * 0.12;
    CC.forEach((cc, i) => {
      const d = Math.abs(cam - i), focus = Math.max(0, 1 - d * 0.9);
      const b = brains[i];
      b.alpha = w * (0.55 + focus * 0.5); b.glow = focus * 0.8;
      b.motor = focus * 0.5; b.par = focus * 0.4; b.broca = i >= 3 ? focus * 0.5 : 0;
      b.s = rad(cc) * (1 + focus * 0.06);
      shells[i].alpha = w * (0.3 + focus * 0.4);
      const g = groups[i].g; if (g) g.rotation.y = -0.6 + Math.sin(scene.t * 3 + i) * 0.2 + (world.reduced ? 0 : Math.sin(world.time * 0.3 + i) * 0.1);
      const m = bars[i].m;
      if (m) { const h = (cc / 800) * w; m.scale.y = Math.max(0.01, h); m.position.y = -2.0 + h / 2; barMats[i].opacity = w * (0.25 + focus * 0.6); }
    });
  });

  return (
    <group>
      <primitive object={floor} position={[0, -1.6, 0]} />
      {CC.map((cc, i) => (
        <group key={cc} position={[i * SP, 0.4, 0]}>
          <group ref={(g) => { groups[i].g = g; }}>
            <Brain ctl={brains[i]} color={i < 3 ? '#9ad7ff' : '#b4a6ff'} />
            <Shell ctl={shells[i]} scale={[1.42 * rad(cc), 1.1 * rad(cc), 1.0 * rad(cc)]} color="#e8f3ff" />
          </group>
          <mesh ref={(m) => { bars[i].m = m; }} geometry={barGeo} material={barMats[i]} position={[1.55, -2, 0.8]} />
        </group>
      ))}
    </group>
  );
}
