import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { world } from '../world/store';
import { rng } from '../world/util';

/** Placeholder dust that fills any stretch of time no real scene covers yet. Weight is driven by the engine. */
export default function Ambient({ weight }: { weight: { current: number } }) {
  const pts = useRef<THREE.Points>(null);
  const col = useRef(new THREE.Color('#c4b5ff'));
  const geo = useMemo(() => {
    const r = rng(7);
    const n = Math.floor(1800 * world.quality);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const rad = 4 + r() * 40, th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      a[i * 3] = rad * Math.sin(ph) * Math.cos(th);
      a[i * 3 + 1] = rad * Math.sin(ph) * Math.sin(th);
      a[i * 3 + 2] = rad * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  useFrame(() => {
    const p = pts.current;
    if (!p) return;
    p.visible = weight.current > 0.003;
    col.current.lerp(new THREE.Color(world.eraAccent), 0.05);
    const m = p.material as THREE.PointsMaterial;
    m.color.copy(col.current);
    m.opacity = weight.current * 0.8;
    p.rotation.y = world.stationF * 0.08 + (world.reduced ? 0 : world.time * 0.01);
  });
  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial size={0.06} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
