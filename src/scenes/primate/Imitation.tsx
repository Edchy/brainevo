import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Primate, ambientTime, neutral, reach } from './common';
import type { CreatureHandle } from './common';
import { silhouetteMaterial } from '../mammal/kit';
import type { PrimatePose } from '../shared/creatures/rig';

// Two seated apes either side of a nut. The elder cracks it with a stone; the younger watches, then copies, a beat late.
// The gold spark is the observer's mirror neurons firing: it leaves the demonstrator at the strike and lands in the watcher's head.
const A_X = -1.55, B_X = 1.55;
const SA = 1.9, SB = 1.7;
const NUT_Y = 0.1;

/** returns [up, hit] 0..1 pulses for a slam cycle phase */
function slam(ph: number): [number, number] {
  const p = ph - Math.floor(ph);
  const up = smoothstep(0, 0.5, p) * (1 - smoothstep(0.5, 0.6, p));
  const hit = smoothstep(0.55, 0.6, p) * (1 - smoothstep(0.6, 0.78, p));
  return [up, hit];
}
/** sit, lean and bring both hands (holding the stone) up and down on the nut; nutX is the nut's distance in creature units */
function slamPose(pm: PrimatePose, up: number, hit: number, prec: number, nutX: number, tool: number) {
  neutral(pm);
  pm.sit = 1;
  const raise = up * (1 - hit);
  const y = lerp(0.22, 1.3, raise) * prec + 0.1 * (1 - prec) + NUT_Y * (1 - raise);
  const x = nutX * (0.74 + 0.1 * (1 - raise)) - 0.1 * raise;
  const w = 0.55 + 0.45 * Math.max(raise, hit, tool * 0.4);
  reach(pm.hand, 1, x, y, 0.13, w);
  reach(pm.hand, -1, x, y + 0.02 * (1 - prec), -0.13, w);
  pm.tilt = -0.28 + 0.38 * raise - 0.15 * hit;
  pm.gripL = pm.gripR = 0.35 + 0.6 * tool;
  pm.brow = 0.2 + 0.5 * hit;
  pm.oy = 0;
}

export default function Imitation() {
  const scene = useScene();
  const hA = useRef<CreatureHandle>(null);
  const hB = useRef<CreatureHandle>(null);
  const gA = useRef<THREE.Group>(null);
  const gB = useRef<THREE.Group>(null);
  const spark = useRef<THREE.Mesh>(null);
  const nut = useRef<THREE.Mesh>(null);
  const stone = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Mesh>(null);
  const stoneMat = useMemo(() => silhouetteMaterial('#ffe2c0', '#07070a', 2.2, 1.6), []);
  const nutMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5), toneMapped: false, transparent: true }), []);

  const arcGeo = useMemo(() => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(A_X, 2.7, 0), new THREE.Vector3(0, 4.2, 0), new THREE.Vector3(B_X, 2.4, 0));
    return new THREE.TubeGeometry(c, 40, 0.01, 5);
  }, []);
  useEffect(() => () => { arcGeo.dispose(); stoneMat.dispose(); nutMat.dispose(); }, [arcGeo, stoneMat, nutMat]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t;
    const ph = t * 5.5 + ambientTime() * 0.12;
    const lag = lerp(0.34, 0.2, t);
    const [upA, hitA] = slam(ph);
    const [upB, hitB] = slam(ph - lag);
    const tool = smoothstep(0.0, 1, near(eventPos('great-ape-cognition'), 0.5));
    const precB = lerp(0.5, 1, smoothstep(0.1, 0.8, t));
    const a = hA.current, b = hB.current;
    if (a && b) {
      slamPose(a.state.pm, upA, hitA, 1, Math.abs(A_X) / SA, tool);
      slamPose(b.state.pm, upB * precB, hitB * precB, precB, Math.abs(B_X) / SB, tool);
      for (const h of [a, b]) { h.override.walk = 0; h.override.phase = 0; h.look.w = w; h.state.sniff = 0; }
      a.state.headPitch = -0.15 * hitA; b.state.headPitch = -0.1 + 0.1 * upA;
      b.state.headYaw = 0; a.state.alert = 0.2;
      b.look.splashK = 0.25 + 0.6 * Math.max(upA, hitA);
    }
    const seeing = Math.max(upA * 0.8, hitA);
    if (gA.current) { gA.current.position.set(A_X, 0, 0); gA.current.scale.setScalar(SA); }
    if (gB.current) { gB.current.position.set(B_X, 0, 0); gB.current.rotation.y = Math.PI; gB.current.scale.setScalar(SB); }

    // the stone rides in A's hands
    if (stone.current && a) {
      const pm = a.state.pm;
      stone.current.position.set(A_X + SA * (pm.hand[0] + 0.03), SA * (pm.hand[1] + 0.02), 0);
      stone.current.scale.setScalar(0.14 * tool * w + 0.0001);
    }

    // spark packet: leaves the demonstrator's head at the strike and lands in the observer's head
    const p = ph - Math.floor(ph);
    const sp = smoothstep(0.5, 0.74, p);
    if (spark.current && a && b) {
      const ax = A_X + SA * (a.state.headX), ay = SA * (a.state.headY + 0.15), bx = B_X - SB * (b.state.headX), by = SB * (b.state.headY + 0.12);
      tmp.set(lerp(ax, bx, sp), lerp(ay, by, sp) + Math.sin(sp * Math.PI) * 1.3, 0.2);
      spark.current.position.copy(tmp);
      const vis = sp > 0.01 && sp < 0.99 ? 1 : 0;
      spark.current.scale.setScalar(0.0001 + 0.13 * vis * w);
    }
    if (arc.current) (arc.current.material as THREE.MeshBasicMaterial).opacity = w * (0.08 + 0.3 * seeing);
    if (nut.current) {
      nut.current.position.set(0, NUT_Y, 0);
      nut.current.scale.set(0.13 * (1 + hitA * 0.6), 0.1 * (1 - hitA * 0.3), 0.13);
      nutMat.color.setRGB(1.0 + 4 * hitA, 0.8 + 2.2 * hitA, 0.5 + 0.5 * hitA).multiplyScalar(w);
    }
    if (ring.current) {
      const k = smoothstep(0.55, 0.9, p);
      ring.current.scale.setScalar(0.3 + k * 2.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - k) * (p > 0.55 ? 0.35 : 0);
    }
    stoneMat.uniforms.uW.value = w;
  });

  return (
    <group>
      <group ref={gA}><Primate ref={hA} preset="ape" rim="#ffddb8" /></group>
      <group ref={gB}><Primate ref={hB} preset="ape" rim="#cfe2ff" palette={{ base: '#4a4440', belly: '#8a8078' }} /></group>
      <mesh ref={stone} material={stoneMat}><icosahedronGeometry args={[1, 1]} /></mesh>
      <mesh ref={nut} material={nutMat}><sphereGeometry args={[1, 18, 14]} /></mesh>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color={[1.8, 1.4, 0.9]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshBasicMaterial color={[4, 2.9, 0.9]} toneMapped={false} blending={THREE.AdditiveBlending} transparent />
      </mesh>
      <mesh ref={arc} geometry={arcGeo}>
        <meshBasicMaterial color={[1.6, 1.2, 0.6]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export const imitationCamera = (t: number) => ({
  pos: [lerp(-0.5, 0.5, t), 1.6, 6.8] as [number, number, number],
  look: [0, 1.3, 0] as [number, number, number],
  fov: 48,
});
