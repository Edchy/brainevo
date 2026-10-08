import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
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

const GLOW_V = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const GLOW_F = /* glsl */ `varying vec2 vUv; uniform vec3 uCol; uniform float uI;
void main(){ float d=length(vUv-.5)*2.; float g=pow(smoothstep(1.,0.,d),2.2); gl_FragColor=vec4(uCol*g*uI, g*uI); }`;

function Glow({ meshRef, col }: { meshRef: React.RefObject<THREE.Mesh | null>; col: [number, number, number] }) {
  const u = useMemo(() => ({ uCol: { value: new THREE.Color(...col) }, uI: { value: 0 } }), [col]);
  return (
    <mesh ref={meshRef} renderOrder={4}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={GLOW_V} fragmentShader={GLOW_F} uniforms={u} />
    </mesh>
  );
}

export default function Imitation() {
  const scene = useScene();
  const pA = useMemo(makePose, []);
  const pB = useMemo(makePose, []);
  const gA = useRef<THREE.Group>(null);
  const gB = useRef<THREE.Group>(null);
  const glA = useRef<THREE.Mesh>(null);
  const glB = useRef<THREE.Mesh>(null);
  const spark = useRef<THREE.Mesh>(null);
  const nut = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);

  const dustGeo = useMemo(() => {
    const r = rng(3);
    const n = Math.floor(260 * world.quality);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([(r() - 0.5) * 24, r() * 7 - 0.5, -3 - r() * 9], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  const arcGeo = useMemo(() => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(A_X, HEAD_Y_A + 0.5, 0), new THREE.Vector3(0, 4.4, 0), new THREE.Vector3(B_X, HEAD_Y_B + 0.5, 0));
    return new THREE.TubeGeometry(c, 40, 0.012, 5);
  }, []);
  useEffect(() => () => { dustGeo.dispose(); arcGeo.dispose(); }, [dustGeo, arcGeo]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
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

    const gl = (m: THREE.Mesh | null, x: number, y: number, k: number, s: number) => {
      if (!m) return;
      m.position.set(x, y, 0.4);
      m.scale.setScalar(s * (0.7 + k * 0.7));
      (m.material as THREE.ShaderMaterial).uniforms.uI.value = w * (0.25 + k * 1.6);
      m.quaternion.copy(state.camera.quaternion);
    };
    gl(glA.current, A_X, HEAD_Y_A + 0.3, pA.glow, 1.7);
    gl(glB.current, B_X, HEAD_Y_B + 0.3, pB.glow, 1.4);

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
      (ring.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - k) * (p > 0.55 ? 0.8 : 0);
    }
    if (dust.current) {
      (dust.current.material as THREE.PointsMaterial).opacity = w * 0.6;
      dust.current.position.x = -t * 1.5;
    }
  });

  return (
    <group>
      <group ref={gA}><Figure tail={false} pose={pA} base="#0a0806" rim="#ffb86a" rimGlow={2.6} /></group>
      <group ref={gB}><Figure tail={false} pose={pB} base="#07090c" rim="#7fd7ff" rimGlow={2.6} eyeColor="#cfeaff" /></group>
      <Glow meshRef={glA} col={[1.5, 0.8, 0.25]} />
      <Glow meshRef={glB} col={[0.3, 1.0, 1.7]} />
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshBasicMaterial color="#0b0b0d" />
      </mesh>
      <mesh ref={nut} position={[0, 0.58, 0]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={[2.6, 1.7, 0.6]} toneMapped={false} transparent />
      </mesh>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color={[2, 1.3, 0.5]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={[3, 2.6, 1.6]} toneMapped={false} blending={THREE.AdditiveBlending} transparent />
      </mesh>
      <mesh ref={arc} geometry={arcGeo}>
        <meshBasicMaterial color={[1.2, 1.4, 1.8]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 48]} />
        <meshBasicMaterial color="#05080a" />
      </mesh>
      <points ref={dust} geometry={dustGeo}>
        <pointsMaterial size={0.09} color="#9fc9a8" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

export const imitationCamera = (t: number) => ({
  pos: [lerp(-0.6, 0.6, t), 2.0, 7.2] as [number, number, number],
  look: [0, 1.4, 0] as [number, number, number],
  fov: 48,
});
