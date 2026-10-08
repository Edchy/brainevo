import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near } from '../../world/util';
import { Backdrop, Plankton, TM, latheX, makeBodyMat, makeTubeMat, setOpacity } from './shared';

const BOX: [number, number, number] = [22, 12, 10];
const BOX2: [number, number, number] = [14, 8, 4];

/** Lancelet-like chordate: translucent body, stiff notochord, hollow dorsal nerve cord lit as a bright line. */
export default function Chordate() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const { bodyG, noto, cord, vesicle, mats } = useMemo(() => {
    const prof = (x: number) => {
      const t = x / 3.4;
      const tail = t < 0 ? 1 - Math.pow(Math.abs(t), 1.8) : 1 - Math.pow(t, 2.6);
      return 0.68 * Math.pow(Math.max(0, tail), 0.55);
    };
    const bodyG = latheX(prof, -3.4, 3.4, 120, 40, 0.8);
    const mk = (y: number, r: number) =>
      new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(3.0, y, 0), new THREE.Vector3(-3.1, y, 0)), 200, r, 12, false);
    const body = makeBodyMat('#5fd8ff', { rim: 1.5, base: 0.05, stripe: 15 });
    const notoM = makeTubeMat('#ff9a3c', { base: 0.32, count: 1, stripe: 160 });
    notoM.uniforms.uPulseAmt.value = 0;
    const cordM = makeTubeMat('#5cf3ff', { base: 1.1, count: 1.4 });
    cordM.uniforms.uR0.value = 0.05;
    const vesM = makeBodyMat('#9ff8ff', { rim: 2.4, base: 0.5 });
    const gv = new THREE.SphereGeometry(0.15, 24, 16);
    gv.translate(3.0, 0.27, 0);
    return { bodyG, noto: mk(-0.12, 0.08), cord: mk(0.27, 0.04), vesicle: gv, mats: { body, notoM, cordM, vesM } };
  }, []);
  useEffect(() => () => { bodyG.dispose(); noto.dispose(); cord.dispose(); vesicle.dispose(); Object.values(mats).forEach((m) => m.dispose()); }, [bodyG, noto, cord, vesicle, mats]);

  const pos = eventPos('chordates-notochord-nerve-cord');
  useFrame(() => {
    if (!scene.active) return;
    const g = grp.current;
    const ph = scene.t * 26 + TM() * 2.2;
    const amp = 0.17;
    const near1 = near(pos, 0.9);
    for (const m of Object.values(mats)) { m.uniforms.uPhase.value = ph; m.uniforms.uAmp.value = amp; }
    setOpacity(Object.values(mats), scene.weight);
    mats.cordM.uniforms.uSig.value = scene.t * 7;
    mats.cordM.uniforms.uBoost.value = 1.0 + near1 * 1.8;
    mats.cordM.uniforms.uBase.value = 0.45 + near1 * 0.5;
    mats.cordM.uniforms.uRad.value = 1 + near1 * 0.5;
    mats.notoM.uniforms.uBase.value = 0.3 + near1 * 0.25;
    mats.vesM.uniforms.uBoost.value = 1 + near1 * 2;
    mats.body.uniforms.uBoost.value = 1 - near1 * 0.35;
    if (g) {
      g.position.x = -0.8 + scene.t * 1.6;
      g.position.y = Math.sin(scene.t * 9) * 0.1;
      g.rotation.z = -0.04 + Math.sin(ph * 0.5) * 0.015;
    }
  });
  return (
    <group>
      <Backdrop top="#0a5568" bottom="#020a14" ray={0.45} />
      <Plankton count={1400} box={BOX} color="#6fe9ff" size={0.05} flow={-3} drift={[-0.12, 0.02, 0]} center={[0, 0, -1]} />
      <Plankton count={400} box={BOX2} color="#c8fbff" size={0.09} flow={-5} drift={[-0.25, 0.04, 0]} center={[0, 0, 2.5]} />
      <group ref={grp} scale={1.0}>
        <mesh geometry={bodyG} material={mats.body} frustumCulled={false} />
        <mesh geometry={noto} material={mats.notoM} frustumCulled={false} />
        <mesh geometry={cord} material={mats.cordM} frustumCulled={false} />
        <mesh geometry={vesicle} material={mats.vesM} frustumCulled={false} />
      </group>
    </group>
  );
}
