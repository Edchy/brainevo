import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Figure, ambientTime, makePose } from './common';
import type { Pose } from './common';

const A_X = -2.3, B_X = 2.3;
const HEAD_Y_A = 2.5, HEAD_Y_B = 1.95;

/** returns [up, hit] 0..1 pulses for a slam cycle phase */
function slam(ph: number): [number, number] {
  const p = ph - Math.floor(ph);
  const up = smoothstep(0, 0.5, p) * (1 - smoothstep(0.5, 0.6, p));
  const hit = smoothstep(0.55, 0.6, p) * (1 - smoothstep(0.6, 0.78, p));
  return [up, hit];
}
function applyArms(pose: Pose, up: number, hit: number, prec: number) {
  const sx = -0.45 - (2.0 * up + 0.2 * (1 - prec) * Math.sin(up * 9)) * prec - 0.9 * hit;
  const el = -0.4 - 0.9 * up + 0.5 * hit;
  pose.aL = [sx, 0.15, el];
  pose.aR = [sx - 0.1 * (1 - prec), -0.15, el];
  pose.lean = 0.12 - 0.3 * up + 0.4 * hit;
}

export default function Imitation() {
  const scene = useScene();
  const pA = useMemo(makePose, []);
  const pB = useMemo(makePose, []);
  const gA = useRef<THREE.Group>(null);
  const gB = useRef<THREE.Group>(null);
  const spark = useRef<THREE.Mesh>(null);
  const nut = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Mesh>(null);

  const arcGeo = useMemo(() => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(A_X, HEAD_Y_A + 0.5, 0), new THREE.Vector3(0, 4.4, 0), new THREE.Vector3(B_X, HEAD_Y_B + 0.5, 0));
    return new THREE.TubeGeometry(c, 40, 0.012, 5);
  }, []);
  useEffect(() => () => { arcGeo.dispose(); }, [arcGeo]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t;
    const ph = t * 5.5 + ambientTime() * 0.12;
    const lag = lerp(0.34, 0.2, t);
    const [upA, hitA] = slam(ph);
    const [upB, hitB] = slam(ph - lag);
    applyArms(pA, upA, hitA, 1);
    applyArms(pB, upB, hitB, lerp(0.55, 1, smoothstep(0.1, 0.8, t)));
    const tool = smoothstep(0.0, 1, near(eventPos('great-ape-cognition'), 0.5));
    pA.stick = tool; pB.stick = tool;
    pA.tail = 0; pB.tail = 0;
    // seeing = the demonstrator's slam is in progress (observer neurons fire), doing = own slam
    const seeing = Math.max(upA * 0.8, hitA);
    pA.glow = hitA * 0.8 + upA * 0.5;
    pB.glow = Math.max(seeing * 0.8, upB * 0.9, hitB);
    pA.headYaw = 0; pB.headYaw = 0;
    pA.headPitch = 0.1 * hitA; pB.headPitch = 0.15 - 0.2 * hitB;

    if (gA.current) { gA.current.position.set(A_X, 0, 0); gA.current.rotation.y = Math.PI / 2; gA.current.scale.setScalar(1.6); }
    if (gB.current) { gB.current.position.set(B_X, 0, 0); gB.current.rotation.y = -Math.PI / 2; gB.current.scale.setScalar(1.2); }

    // spark packet: leaves the demonstrator at the slam peak and lands in the observer's head
    const p = ph - Math.floor(ph);
    const sp = smoothstep(0.5, 0.72, p);
    if (spark.current) {
      const e = sp;
      tmp.set(lerp(A_X, B_X, e), lerp(HEAD_Y_A + 0.5, HEAD_Y_B + 0.5, e) + Math.sin(e * Math.PI) * 1.5, 0.3);
      spark.current.position.copy(tmp);
      const vis = sp > 0.01 && sp < 0.99 ? 1 : 0;
      spark.current.scale.setScalar(0.001 + 0.16 * vis * w);
    }
    if (arc.current) ((arc.current.material as THREE.MeshBasicMaterial).opacity = w * (0.12 + 0.3 * seeing));
    if (nut.current) {
      const crack = hitA > 0.3 ? 1 : 0;
      nut.current.scale.setScalar(0.12 * (1 + hitA * 2.5));
      (nut.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - 0.0 * crack);
    }
    if (ring.current) {
      const k = smoothstep(0.55, 0.9, p);
      ring.current.scale.setScalar(0.3 + k * 2.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - k) * (p > 0.55 ? 0.3 : 0);
    }
  });

  return (
    <group>
      <group ref={gA}><Figure tail={false} pose={pA} rim="#ffddb8" rimGlow={2.3} /></group>
      <group ref={gB}><Figure tail={false} pose={pB} rim="#cfe2ff" rimGlow={1.8} eyeColor="#dbeaff" /></group>
      <mesh ref={nut} position={[0, 0.58, 0]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={[2.6, 2.4, 2.0]} toneMapped={false} transparent />
      </mesh>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color={[1.6, 1.5, 1.3]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={[3, 2.9, 2.6]} toneMapped={false} blending={THREE.AdditiveBlending} transparent />
      </mesh>
      <mesh ref={arc} geometry={arcGeo}>
        <meshBasicMaterial color={[1.2, 1.4, 1.8]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export const imitationCamera = (t: number) => ({
  pos: [lerp(-0.6, 0.6, t), 2.0, 7.2] as [number, number, number],
  look: [0, 1.4, 0] as [number, number, number],
  fov: 48,
});
