import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, smoothstep } from '../../world/util';
import { GLSL_NOISE, makeGlowMat } from './common';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';

const SM = 1.12, SH = 1.02;                       // mother (adult) and helper (younger female) scales
const XM = -0.72, XH = 0.72;                      // mother faces +x, helper faces -x
const tNow = () => (world.reduced ? 0 : world.time);

export default function Coop() {
  const scene = useScene();
  const hM = useRef<CreatureHandle>(null), hH = useRef<CreatureHandle>(null);
  const glow = useRef<THREE.Mesh>(null);
  const Wm = useMemo(() => new THREE.Vector3(XM + SM * 0.3, SM * 1.08, 0), []);
  const Wh = useMemo(() => new THREE.Vector3(XH - SH * 0.3, SH * 1.04, 0), []);
  const W = useMemo(() => new THREE.Vector3(), []);
  const Mid = useMemo(() => new THREE.Vector3(0, 1.2, 0), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const floor = new THREE.ShaderMaterial({
      transparent: true, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          float n = n3(vec3(p*3., 0.))*.5 + n3(vec3(p*14., 1.))*.3 + n3(vec3(p*60., 2.))*.2;
          float pool = exp(-dot(p*vec2(.4,.8), p*vec2(.4,.8))*.7);
          vec3 c = vec3(.08,.07,.07)*(.35 + n*.9)*(.08 + pool*1.3);
          c = mix(c, vec3(.012,.011,.016), smoothstep(3., 10., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    const halo = makeGlowMat('#ffa040', 2.2);
    return { floor, halo };
  }, []);
  useEffect(() => () => { R.floor.dispose(); R.halo.dispose(); }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tm = tNow();
    // the infant travels mother -> helper along a soft arc; ownership switches at the midpoint
    const u = smoothstep(0, 1, range(0.22, 0.78, t));
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    W.set(a * Wm.x + b * Mid.x + c * Wh.x, a * Wm.y + b * (Mid.y + 0.06) + c * Wh.y, 0);
    const mine = u < 0.5;
    const mm = hM.current, hh = hH.current;
    // local coordinates of the infant
    const km = { x: (W.x - XM) / SM, y: W.y / SM, z: W.z / SM };
    const kh = { x: -(W.x - XH) / SH, y: W.y / SH, z: -W.z / SH };
    const setCarry = (h: CreatureHandle, k: { x: number; y: number; z: number }, yaw: number, wgt: number, own: boolean) => {
      const s = h.state;
      s.carry = own ? 1 : 0; s.kx = k.x; s.ky = k.y; s.kz = k.z; s.kyaw = yaw;
      s.armsFree = 0; s.rollR = Math.PI / 2; s.rollL = -Math.PI / 2; s.gripR = 0.12; s.gripL = 0.12;
      s.hRw = wgt; s.hRx = k.x - 0.12; s.hRy = k.y - 0.055; s.hRz = k.z + 0.04;
      s.hLw = wgt; s.hLx = k.x - 0.01; s.hLy = k.y - 0.055; s.hLz = k.z - 0.04;
    };
    const wM = mine ? 1 : 1 - smoothstep(0.56, 0.86, t), wH = mine ? smoothstep(0.14, 0.46, t) : 1;
    if (mm) {
      setCarry(mm, km, 0, wM, mine);
      mm.state.headPitch = -0.3 * (mine ? 1 : 0.4) + 0.03 * Math.sin(tm * 0.6); mm.state.headYaw = 0; mm.state.mouth = 0;
      mm.look.w = w; mm.look.rimK = 1.0; mm.look.keyK = 0.55; mm.look.amb = 0.2; mm.look.sss = 0.55;
    }
    if (hh) {
      setCarry(hh, kh, Math.PI, wH, !mine);
      hh.state.headPitch = -0.12 - 0.2 * smoothstep(0.5, 0.75, t) + 0.03 * Math.sin(tm * 0.5 + 1); hh.state.headYaw = 0; hh.state.mouth = 0;
      hh.look.w = w; hh.look.rimK = 1.0; hh.look.keyK = 0.55; hh.look.amb = 0.2; hh.look.sss = 0.55;
    }
    look.copy(W);
    R.floor.uniforms.uAlpha.value = w;
    // a small warm glow follows the infant: the one deliberate colour accent
    R.halo.uniforms.uAlpha.value = w * (0.34 + 0.06 * Math.sin(tm * 1.7));
    if (glow.current) { glow.current.position.set(W.x, W.y + 0.02, W.z - 0.1); glow.current.quaternion.copy(st.camera.quaternion); glow.current.scale.setScalar(0.85); }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.floor}><circleGeometry args={[14, 40]} /></mesh>
      <mesh ref={glow} material={R.halo} renderOrder={1}><planeGeometry args={[1, 1]} /></mesh>
      <group position={[XM, 0, 0]}><group scale={SM}>
        <Creature ref={hM} rig="biped" preset="erectus" lookAt={look} look={{ rimDir: [-0.55, 0.6], keyDir: [0.5, 0.45, 0.75], gloss: 0.25 }} palette={{ rim: '#ffe6cc', key: '#ffe0c0', skin: '#8f7466' }} />
      </group></group>
      <group position={[XH, 0, 0]} rotation={[0, Math.PI, 0]}><group scale={SH}>
        <Creature ref={hH} rig="biped" preset="erectus" lookAt={look} params={{ hair: 0.9, hairLen: 0.5, brow: 0.018, prognath: 0.05, chestHalfW: 0.145, shoulderHalf: 0.17 }} look={{ rimDir: [0.55, 0.6], keyDir: [-0.5, 0.45, 0.75], gloss: 0.25 }} palette={{ rim: '#ffe6cc', key: '#ffe0c0', skin: '#806658' }} />
      </group></group>
    </group>
  );
}

export const coopCamera = (t: number) => ({ pos: [Math.sin(t * 1.6) * 0.5, 1.1, 4.4] as [number, number, number], look: [0, 1.0, 0] as [number, number, number], fov: 38 });
