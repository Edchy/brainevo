import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, range, smoothstep } from '../../world/util';
import { Backdrop, Plankton, makeBodyMat, makeTubeMat } from './shared';

const BOX: [number, number, number] = [20, 14, 8];
type P = [number, number, number];
const path = (pts: P[], r: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 90, r, 10, false);

/** amniote family tree splits: one side-window skull lineage (synapsids) vs the reptile lineage */
export default function Synapsids() {
  const scene = useScene();
  const burst = useRef<THREE.Mesh>(null);
  const S = useMemo(() => {
    const trunk = path([[0, -4, 0], [0, -2.6, 0], [0, -1.0, 0]], 0.1);
    const rep = [
      path([[0, -1.0, 0], [-0.9, 0.2, 0], [-1.7, 1.6, 0], [-2.2, 3.0, 0]], 0.065),
      path([[-0.9, 0.2, 0], [-2.3, 0.7, 0], [-3.6, 1.0, 0]], 0.045),
      path([[-1.7, 1.6, 0], [-3.0, 2.3, 0], [-4.1, 3.0, 0]], 0.04),
      path([[-1.7, 1.6, 0], [-1.3, 2.7, 0], [-0.7, 3.6, 0]], 0.04),
    ];
    const syn = [
      path([[0, -1.0, 0], [0.9, 0.2, 0], [1.6, 1.4, 0], [2.0, 2.8, 0]], 0.08),
      path([[0.9, 0.2, 0], [2.2, 0.5, 0], [3.5, 1.0, 0]], 0.045),
      path([[1.6, 1.4, 0], [2.8, 2.0, 0], [3.9, 2.6, 0]], 0.04),
    ];
    const mam = path([[2.0, 2.8, 0], [2.4, 3.6, 0], [2.8, 4.4, 0]], 0.09);
    const trunkM = makeTubeMat('#cfe6ff', { base: 0.5, count: 1.5 });
    const repM = makeTubeMat('#6fe08a', { base: 0.45, count: 1.2 });
    const synM = makeTubeMat('#58b8ff', { base: 0.55, count: 1.2 });
    const mamM = makeTubeMat('#ffcf6b', { base: 0.7, count: 1.2 });
    const repSubM = makeTubeMat('#6fe08a', { base: 0.45, count: 1.2 });
    const synSubM = makeTubeMat('#58b8ff', { base: 0.55, count: 1.2 });
    for (const m of [trunkM, repM, synM, mamM, repSubM, synSubM]) m.uniforms.uR0.value = 0.08;
    const nodeG = new THREE.SphereGeometry(0.2, 24, 16);
    const nodeM = makeBodyMat('#ffffff', { rim: 2.5, base: 0.9 });
    const ringG = new THREE.TorusGeometry(0.16, 0.025, 8, 32);
    const ringGreen = makeBodyMat('#6fe08a', { rim: 2, base: 0.8 });
    const ringBlue = makeBodyMat('#58b8ff', { rim: 2, base: 0.8 });
    const burstG = new THREE.TorusGeometry(1, 0.02, 8, 80);
    const burstM = makeBodyMat('#ffffff', { rim: 1, base: 1.2 });
    return { trunk, rep, syn, mam, trunkM, repM, synM, mamM, repSubM, synSubM, nodeG, nodeM, ringG, ringGreen, ringBlue, burstG, burstM };
  }, []);
  useEffect(() => () => {
    [S.trunk, ...S.rep, ...S.syn, S.mam, S.nodeG, S.ringG, S.burstG].forEach((g) => g.dispose());
    [S.trunkM, S.repM, S.synM, S.mamM, S.repSubM, S.synSubM, S.nodeM, S.ringGreen, S.ringBlue, S.burstM].forEach((m) => m.dispose());
  }, [S]);
  const p25 = eventPos('synapsids');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, n = near(p25, 0.7);
    const g1 = range(0.0, 0.3, t), g2 = range(0.3, 0.6, t), g2b = range(0.55, 0.85, t), g3 = range(0.75, 1, t);
    const set = (m: THREE.ShaderMaterial, grow: number, boost: number) => {
      m.uniforms.uOpacity.value = w; m.uniforms.uGrow.value = grow; m.uniforms.uSig.value = t * 6; m.uniforms.uBoost.value = boost; m.uniforms.uRad.value = 1 + n * 0.3;
    };
    set(S.trunkM, g1, 1.5); set(S.repM, g2, 1.0); set(S.synM, g2, 1.8 + n); set(S.mamM, g3, 2.0); set(S.repSubM, g2b, 1.0); set(S.synSubM, g2b, 1.8 + n);
    S.nodeM.uniforms.uOpacity.value = w * smoothstep(0.25, 0.35, t); S.nodeM.uniforms.uBoost.value = 0.6 + n * 2.5;
    S.ringGreen.uniforms.uOpacity.value = w * smoothstep(0.8, 0.95, t); S.ringBlue.uniforms.uOpacity.value = w * smoothstep(0.8, 0.95, t);
    if (burst.current) burst.current.scale.setScalar(0.6 + ((t * 4) % 1) * 1.8);
    S.burstM.uniforms.uOpacity.value = w * n * (1 - smoothstep(0, 1, (t * 4) % 1)) * 0.7;
  });
  return (
    <group>
      <Backdrop top="#10264a" bottom="#02030a" ray={0.2} rays={false} />
      <Plankton count={600} box={BOX} color="#9ec4ff" size={0.04} flow={2} center={[0, 0, -2]} />
      <group position={[0, -0.6, 0]} scale={1.25}>
        <mesh geometry={S.trunk} material={S.trunkM} frustumCulled={false} />
        {S.rep.map((g, i) => <mesh key={'r' + i} geometry={g} material={i === 0 ? S.repM : S.repSubM} frustumCulled={false} />)}
        {S.syn.map((g, i) => <mesh key={'s' + i} geometry={g} material={i === 0 ? S.synM : S.synSubM} frustumCulled={false} />)}
        <mesh geometry={S.mam} material={S.mamM} frustumCulled={false} />
        <mesh geometry={S.nodeG} material={S.nodeM} position={[0, -1.0, 0]} />
        <mesh ref={burst} geometry={S.burstG} material={S.burstM} position={[0, -1.0, 0]} />
        <mesh geometry={S.ringG} material={S.ringBlue} position={[2.0, 3.2, 0]} />
        <mesh geometry={S.ringG} material={S.ringGreen} position={[-2.0, 3.3, 0]} />
        <mesh geometry={S.ringG} material={S.ringGreen} position={[-2.45, 3.3, 0]} />
      </group>
    </group>
  );
}
