import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Figure, ambientTime, makePose } from './common';
import type { Arm, Pose } from './common';

const MZ = -2.4; // mirror plane z
const MY = 2.0;

const GLASS_V = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const GLASS_F = /* glsl */ `varying vec2 vUv; uniform float uOp, uWake, uTime;
void main(){
  vec2 q = vUv-.5;
  float diag = smoothstep(.06,.0,abs(fract((vUv.x*1.2+vUv.y*.9)*1.1-uTime*.02)-.5)-.44);
  float sheen = smoothstep(.015,.0,abs(vUv.x*.8+vUv.y-.95+sin(uTime*.2)*.05)) *.5;
  float vig = smoothstep(.75,.1,length(q*vec2(1.,1.3)));
  float a = (.02+vig*.035+diag*.02+sheen*.1)*uOp;
  vec3 c = vec3(.7,.8,1.)*(.6+sheen*.6) + vec3(1.8,1.7,1.5)*uWake*vig*.5;
  a += uWake*vig*.25*uOp;
  gl_FragColor = vec4(c*a, a);
}`;

function mirrorPose(src: Pose, dst: Pose) {
  const flip = (a: Arm): Arm => [a[0], -a[1], a[2]];
  dst.aL = flip(src.aR); dst.aR = flip(src.aL);
  dst.lean = src.lean; dst.headPitch = src.headPitch; dst.headYaw = -src.headYaw;
  dst.mark = src.mark;
}

export default function Mirror() {
  const scene = useScene();
  const ape = useMemo(makePose, []);
  const refl = useMemo(makePose, []);
  const tmpP = useMemo(makePose, []);
  const gApe = useRef<THREE.Group>(null);
  const gRef = useRef<THREE.Group>(null);
  const glass = useRef<THREE.ShaderMaterial>(null);
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef<THREE.Mesh>(null);

  const pose = (p: Pose, wave: number, touch: number, head: number) => {
    // test-waving arm swings, then the hand goes to the marked forehead
    const sx = -0.3 - 1.3 * wave;
    p.aR = [lerp(sx, -1.35, touch), lerp(-0.2, 0.05, touch), lerp(-0.4 - 0.4 * wave, -2.3, touch)];
    p.aL = [0.1, 0.15, -0.2];
    p.lean = 0.08 + 0.08 * wave;
    p.headPitch = -0.05 + 0.1 * head + 0.25 * touch;
    p.headYaw = 0;
  };

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = ambientTime();
    const beat = near(eventPos('mirror-self-recognition'), 0.55);
    const rec = smoothstep(0.38, 0.55, t);
    const touch = smoothstep(0.7, 0.86, t);
    const markOn = smoothstep(0.02, 0.14, t);
    const wv = (x: number) => Math.max(0, Math.sin(x * 20)) * (1 - smoothstep(0.62, 0.7, t)) * smoothstep(0.1, 0.18, t);

    pose(ape, wv(t), touch, 0);
    ape.mark = markOn * (1 + touch * 0.8);
    ape.glow = touch * 0.6 + beat * 0.3;
    ape.tail = 0;

    // the reflection first behaves like a stranger: delayed, offset, bigger gestures; then it locks to the ape
    const lag = lerp(0.12, 0, rec);
    const stranger = 1 - rec;
    pose(tmpP, wv(t - lag) * (1 + 0.5 * stranger), touch, stranger);
    mirrorPose(tmpP, refl);
    refl.mark = ape.mark;
    refl.headYaw = (stranger * 0.5) * Math.sin(t * 25);
    refl.headPitch += stranger * 0.12 * Math.sin(t * 17);
    refl.eye = lerp(0.15, 1, rec);
    refl.glow = rec * 0.8 + beat * 1.2;
    refl.alpha = lerp(0.55, 1, rec);
    refl.tail = 0;
    // lean offset for stranger reading
    refl.lean += stranger * 0.12;

    if (gApe.current) { gApe.current.position.set(0, 0, 0); gApe.current.rotation.y = Math.PI; gApe.current.scale.setScalar(1.3); }
    if (gRef.current) {
      gRef.current.position.set(stranger * 0.12 * Math.sin(t * 9), 0, 2 * MZ);
      gRef.current.rotation.y = 0; gRef.current.scale.setScalar(1.7);
    }
    if (glass.current) {
      glass.current.uniforms.uOp.value = w;
      glass.current.uniforms.uWake.value = beat * 1.2 + rec * 0.15;
      glass.current.uniforms.uTime.value = tm + t * 3;
    }
    if (frame.current) frame.current.opacity = w;
    if (pulse.current) {
      const k = smoothstep(0.38, 0.62, t);
      const kk = (k * 1.6) % 1;
      pulse.current.scale.setScalar(0.4 + kk * 3.2);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = w * (k > 0.02 && k < 0.99 ? (1 - kk) * 0.3 : 0) + beat * 0;
    }
  });

  return (
    <group>
      <group ref={gApe}><Figure tail={false} pose={ape} rim="#ffddb8" rimGlow={2.3} /></group>
      <group ref={gRef}><Figure tail={false} pose={refl} rim="#d6e6ff" rimGlow={2.2} eyeColor="#dbeaff" /></group>
      {/* mirror */}
      <mesh position={[0, MY, MZ]} renderOrder={8}>
        <planeGeometry args={[6.2, 4.2]} />
        <shaderMaterial ref={glass} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={GLASS_V} fragmentShader={GLASS_F}
          uniforms={{ uOp: { value: 0 }, uWake: { value: 0 }, uTime: { value: 0 } }} />
      </mesh>
      {[[0, 2.15, 6.5, 0.14], [0, -2.15, 6.5, 0.14], [3.18, 0, 0.14, 4.44], [-3.18, 0, 0.14, 4.44]].map(([x, y, sw, sh], i) => (
        <mesh key={i} position={[x, MY + y, MZ - 0.02]}>
          <boxGeometry args={[sw, sh, 0.12]} />
          <meshBasicMaterial ref={i === 0 ? frame : undefined} color={[0.3, 0.32, 0.38]} toneMapped={false} transparent />
        </mesh>
      ))}
      <mesh ref={pulse} position={[0, 2.1, MZ + 0.02]}>
        <ringGeometry args={[0.9, 1, 56]} />
        <meshBasicMaterial color={[1.7, 1.6, 1.4]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export const mirrorCamera = (t: number) => ({
  pos: [lerp(2.6, 1.2, t), lerp(2.0, 2.3, t), lerp(5.0, 4.0, t)] as [number, number, number],
  look: [0, 1.9, -2.6] as [number, number, number],
  fov: 50,
});
