import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM, makeBodyMat, makeTubeMat } from './shared';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const BOX: [number, number, number] = [20, 11, 8];
const TOPS: [number, number, number][] = [[-2.2, 2.5, 0], [0, 2.7, 0], [2.2, 2.5, 0]];
const BOTS: [number, number, number][] = [[-2.2, -2.3, 0], [0, -2.5, 0], [2.2, -2.3, 0]];
const CRITIC = new THREE.Vector3(-5.2, 0.2, 0);

/** actor (three action channels through the striatum) and critic (value orb); dopamine strengthens the chosen channel */
export default function BasalGanglia() {
  const scene = useScene();
  const brain = useBrainCtl({ grow: stageGrow('mammal'), glass: 0.85, inner: 1, holo: 0.25, holoColor: '#6a8cff', tissue: '#aeb8ff' });
  const S = useMemo(() => {
    const chan = TOPS.map((tp, i) => {
      const b = BOTS[i];
      const mx = tp[0] * 0.55;
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(...tp), new THREE.Vector3(mx + 0.3, 1.2, 0.2), new THREE.Vector3(mx * 0.8, 0.1, -0.1),
        new THREE.Vector3(mx * 0.9 - 0.2, -1.2, 0.2), new THREE.Vector3(...b)]), 120, 0.07, 10, false);
      const m = makeTubeMat(i === 1 ? '#ffb43c' : '#4fa8ff', { base: 0.3, count: 1.5 });
      m.uniforms.uR0.value = 0.07;
      return { g, m };
    });
    const dopG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([CRITIC.clone(), new THREE.Vector3(-3.2, -1.0, 0.8),
      new THREE.Vector3(-1.4, -0.7, 0.9), new THREE.Vector3(-0.1, 0.0, 0.3)]), 80, 0.04, 8, false);
    const dopM = makeTubeMat('#ffc24a', { base: 0.2, count: 1 });
    const nodeG = new THREE.SphereGeometry(0.24, 24, 16);
    const nodeM = TOPS.map((_, i) => makeBodyMat(i === 1 ? '#ffd27a' : '#79b8ff', { rim: 2.2, base: 0.5 }));
    const botM = TOPS.map((_, i) => makeBodyMat(i === 1 ? '#ffd27a' : '#79b8ff', { rim: 2, base: 0.3 }));
    const critG = new THREE.SphereGeometry(0.55, 40, 28);
    const critM = makeBodyMat('#6fd4ff', { rim: 2.4, base: 0.35 });
    const ringG = new THREE.TorusGeometry(1, 0.014, 8, 96);
    const rings = [0, 1, 2].map(() => makeBodyMat('#7fdcff', { rim: 1, base: 1 }));
    return { chan, dopG, dopM, nodeG, nodeM, botM, critG, critM, ringG, rings };
  }, []);
  useEffect(() => () => {
    S.chan.forEach((c) => { c.g.dispose(); c.m.dispose(); }); S.dopG.dispose(); S.dopM.dispose(); S.nodeG.dispose();
    S.nodeM.forEach((m) => m.dispose()); S.botM.forEach((m) => m.dispose()); S.critG.dispose(); S.critM.dispose();
    S.ringG.dispose(); S.rings.forEach((m) => m.dispose());
  }, [S]);

  const p20 = eventPos('basal-ganglia-actor-critic');
  useFrame((state) => {
    if (!scene.active) return;
    void state;
    const w = scene.weight, t = scene.t, tm = TM(), n = near(p20, 0.8);
    const learn = smoothstep(0.1, 0.85, t);
    const str = [0.35 - 0.2 * learn, 0.25 + 0.95 * learn, 0.35 - 0.25 * learn];
    S.chan.forEach((c, i) => {
      const u = c.m.uniforms;
      u.uOpacity.value = w; u.uRad.value = 0.55 + str[i] * 1.5; u.uBase.value = 0.12 + str[i] * 0.9;
      u.uSig.value = t * 8 * (0.6 + str[i]); u.uBoost.value = 0.6 + str[i] * 2.2 + (i === 1 ? n * 1.0 : 0);
    });
    const dopPhase = (t * 5) % 1;
    S.dopM.uniforms.uOpacity.value = w; S.dopM.uniforms.uSig.value = t * 5; S.dopM.uniforms.uBoost.value = 1.2 + n * 1.5;
    S.dopM.uniforms.uBase.value = 0.15 + 0.3 * Math.sin(dopPhase * Math.PI);
    S.nodeM.forEach((m, i) => { m.uniforms.uOpacity.value = w; m.uniforms.uBoost.value = 0.4 + str[i] * 1.6; });
    S.botM.forEach((m, i) => { m.uniforms.uOpacity.value = w; m.uniforms.uBoost.value = 0.3 + str[i] * 2.0 * (0.5 + 0.5 * Math.sin(t * 40 * (i + 1) + i)); });
    S.critM.uniforms.uOpacity.value = w; S.critM.uniforms.uBoost.value = 1 + 0.2 * Math.sin(tm * 2) + n * 0.8;
    S.rings.forEach((m, i) => {
      const f = (t * 3 + i / 3) % 1;
      m.uniforms.uOpacity.value = w * (1 - f) * (1 - f) * 0.9;
    });
    brain.alpha = w; brain.nuc.striatum = 0.5 + learn * 1.2 + n * 0.5; brain.nuc.thalamus = 0.3 + learn * 0.3; brain.nuc.hippocampus = 0.1; brain.nuc.amygdala = 0.1;
  });
  return (
    <group>
      <Backdrop top="#1a1450" bottom="#02030a" ray={0.25} />
      <Plankton count={600} box={BOX} color="#9aa8ff" size={0.04} flow={-2} center={[0, 0, -2]} />
      <Brain ctl={brain} position={[0.4, -0.2, -1.2]} rotation={[0, -0.15, 0]} scale={1.9} />
      {S.chan.map((c, i) => <mesh key={i} geometry={c.g} material={c.m} frustumCulled={false} />)}
      {TOPS.map((p, i) => <mesh key={'t' + i} geometry={S.nodeG} material={S.nodeM[i]} position={p} />)}
      {BOTS.map((p, i) => <mesh key={'b' + i} geometry={S.nodeG} material={S.botM[i]} position={p} scale={0.8} />)}
      <mesh geometry={S.dopG} material={S.dopM} frustumCulled={false} />
      <mesh geometry={S.critG} material={S.critM} position={CRITIC} />
      {S.rings.map((m, i) => <RingPulse key={i} i={i} mat={m} geo={S.ringG} />)}
    </group>
  );
}

function RingPulse({ i, mat, geo }: { i: number; mat: THREE.ShaderMaterial; geo: THREE.BufferGeometry }) {
  const scene = useScene();
  const ref = useMemo(() => ({ current: null as THREE.Mesh | null }), []);
  useFrame(() => {
    if (!scene.active || !ref.current) return;
    const f = (scene.t * 3 + i / 3) % 1;
    ref.current.scale.setScalar(0.6 + f * 2.6);
  });
  return <mesh ref={(m) => { ref.current = m; }} geometry={geo} material={mat} position={CRITIC} />;
}
