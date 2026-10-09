import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { Primate, ambientTime, neutral, reach } from './common';
import type { CreatureHandle } from './common';
import type { PrimatePose } from '../shared/creatures/rig';

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
  vec3 c = vec3(.7,.8,1.)*(.6+sheen*.6) + vec3(1.8,1.7,1.5)*uWake*vig*.3;
  a += uWake*vig*.07*uOp;
  gl_FragColor = vec4(c*a, a);
}`;

interface MP { wave: number; touch: number; head: number; side: 1 | -1; hx: number; hy: number }
/** seated ape: right hand tests the mirror with a wave, then goes to the marked brow. `side` swaps hands for the reflection */
function poseApe(h: CreatureHandle, p: MP) {
  const pm: PrimatePose = h.state.pm;
  neutral(pm);
  pm.sit = 1; pm.tilt = -0.08 + 0.1 * p.wave;
  const s = p.side;
  const swing = Math.sin(p.wave * 9) * 0.1;
  // wave: hand in front of the face, rocking; touch: hand on the forehead mark
  reach(pm.hand, s, 0.55 + swing, 1.2 + 0.15 * p.wave, 0.22 * s, Math.max(p.wave, p.touch));
  reach(pm.hand, s, lerp(0.55 + swing, p.hx + 0.1, p.touch), lerp(1.2 + 0.15 * p.wave, p.hy + 0.1, p.touch), lerp(0.22, 0.05, p.touch) * s, Math.max(p.wave, p.touch));
  pm.gripL = pm.gripR = 0.35 + 0.4 * p.touch;
  pm.brow = 0.2 + 0.4 * p.head - 0.3 * p.touch;
  h.state.headPitch = -0.05 + 0.1 * p.head + 0.12 * p.touch;
  h.state.headYaw = 0; h.override.walk = 0; h.override.phase = 0;
}

export default function Mirror() {
  const scene = useScene();
  const hApe = useRef<CreatureHandle>(null);
  const hRef = useRef<CreatureHandle>(null);
  const gApe = useRef<THREE.Group>(null);
  const gRef = useRef<THREE.Group>(null);
  const mkA = useRef<THREE.Mesh>(null);
  const mkR = useRef<THREE.Mesh>(null);
  const glass = useRef<THREE.ShaderMaterial>(null);
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = ambientTime();
    const beat = near(eventPos('mirror-self-recognition'), 0.55);
    const rec = smoothstep(0.38, 0.55, t);
    const touch = smoothstep(0.7, 0.86, t);
    const markOn = smoothstep(0.02, 0.14, t);
    const wv = (x: number) => Math.max(0, Math.sin(x * 20)) * (1 - smoothstep(0.62, 0.7, t)) * smoothstep(0.1, 0.18, t);
    const A = hApe.current, R = hRef.current;
    if (A && R) {
      poseApe(A, { wave: wv(t), touch, head: 0, side: -1, hx: A.state.headX, hy: A.state.headY });
      A.look.w = w;
      // the reflection first behaves like a stranger: delayed, offset, bigger gestures; then it locks to the ape
      const lag = lerp(0.12, 0, rec);
      const stranger = 1 - rec;
      poseApe(R, { wave: wv(t - lag) * (1 + 0.5 * stranger), touch, head: stranger, side: 1, hx: R.state.headX, hy: R.state.headY });
      R.state.headYaw = stranger * 0.45 * Math.sin(t * 25);
      R.state.headPitch += stranger * 0.1 * Math.sin(t * 17);
      R.state.pm.tilt += stranger * 0.1;
      R.look.w = w * lerp(0.5, 1, rec);
      R.look.splashK = 0.2 + 0.8 * rec;
      A.look.splashK = 0.2 + 0.4 * touch;
      // the recognition spark: the mark on the brow flares as the reflection becomes "me"
      for (const [m, h] of [[mkA.current, A], [mkR.current, R]] as const) {
        if (!m) continue;
        m.position.set(h.state.headX + 0.13, h.state.headY + 0.13, 0.0);
        m.scale.setScalar(0.0001 + 0.02 * markOn * w * (1 + 1.2 * touch + 0.8 * beat * (h === R ? 1 : 0.5)));
      }
    }
    if (gApe.current) { gApe.current.position.set(0, 0, 0); gApe.current.rotation.y = Math.PI / 2 - 0.6; gApe.current.scale.setScalar(1.5); }
    if (gRef.current) {
      gRef.current.position.set(0, 0, 2 * MZ);
      gRef.current.rotation.y = -(Math.PI / 2 - 0.6); gRef.current.scale.setScalar(1.5);
      gRef.current.position.x = (1 - rec) * 0.12 * Math.sin(t * 9);
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
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = w * (k > 0.02 && k < 0.99 ? (1 - kk) * 0.12 : 0);
    }
  });

  return (
    <group>
      <group ref={gApe}>
        <Primate ref={hApe} preset="ape" rim="#ffddb8" />
        <mesh ref={mkA}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={[4.5, 1.1, 0.25]} toneMapped={false} /></mesh>
      </group>
      <group ref={gRef}>
        <Primate ref={hRef} preset="ape" rim="#d6e6ff" palette={{ base: '#46403c', belly: '#8a8680' }} />
        <mesh ref={mkR}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={[4.5, 1.1, 0.25]} toneMapped={false} /></mesh>
      </group>
      {/* mirror */}
      <mesh position={[0, MY, MZ]} renderOrder={8}>
        <planeGeometry args={[6.2, 4.2]} />
        <shaderMaterial ref={glass} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={GLASS_V} fragmentShader={GLASS_F}
          uniforms={{ uOp: { value: 0 }, uWake: { value: 0 }, uTime: { value: 0 } }} />
      </mesh>
      {[[0, 2.15, 6.5, 0.14], [0, -2.15, 6.5, 0.14], [3.18, 0, 0.14, 4.44], [-3.18, 0, 0.14, 4.44]].map(([x, y, sw, sh], i) => (
        <mesh key={i} position={[x, MY + y, MZ - 0.02]}>
          <boxGeometry args={[sw, sh, 0.12]} />
          <meshBasicMaterial ref={i === 0 ? frame : undefined} color={[0.1, 0.11, 0.14]} toneMapped={false} transparent />
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
  pos: [lerp(5.2, 4.4, t), lerp(2.0, 2.1, t), lerp(5.4, 4.6, t)] as [number, number, number],
  look: [-0.4, 1.45, -2.8] as [number, number, number],
  fov: 50,
});
