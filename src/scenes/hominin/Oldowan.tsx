import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeOutCubic, range, rng } from '../../world/util';
import { makeGlowMat, GLSL_NOISE } from './common';
import { makeSkin } from './limbs';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';

const STRIKES = 6, FL = 6, SP = 26, G = 7;
const S = 1.5;                       // hero scale (a ~1.2 m Homo habilis, crouched)
const PX = 1.55;                     // hero stands at +x and faces -x (toward screen-left) so the headline corner stays clear
const wx = (x: number) => PX - S * x, wy = (y: number) => S * y, wz = (z: number) => -S * z;
const tNow = () => (world.reduced ? 0 : world.time);

export default function Oldowan() {
  const scene = useScene();
  const q = world.quality;
  const hero = useRef<CreatureHandle>(null);
  const flakes = useRef<THREE.InstancedMesh>(null), sparks = useRef<THREE.Points>(null), flash = useRef<THREE.Mesh>(null);
  const dum = useMemo(() => new THREE.Object3D(), []);
  const R = useMemo(() => {
    const r = rng(21);
    const fl = Array.from({ length: STRIKES * FL }, () => ({
      v: new THREE.Vector3(-(0.5 + r() * 1.7), 0.7 + r() * 1.7, (r() - 0.5) * 1.9), s: 0.022 + r() * 0.03, sp: new THREE.Vector3((r() - 0.5) * 14, (r() - 0.5) * 14, (r() - 0.5) * 14),
      ox: (r() - 0.5) * 0.05, rest: r(),
    }));
    const sp = Array.from({ length: STRIKES * SP }, () => ({ v: new THREE.Vector3(-(0.2 + r() * 2.2), (r() - 0.2) * 2.4, (r() - 0.5) * 1.6), life: 0.18 + r() * 0.3 }));
    const flakeGeo = new THREE.TetrahedronGeometry(1, 0); flakeGeo.scale(1.0, 0.24, 0.7);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRIKES * SP * 3), 3));
    sg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(STRIKES * SP), 1));
    // flint sparks: a warm, saturated accent (hot orange cores)
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(4.+aA*16.)/-mv.z*3.2; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); vec3 c=mix(vec3(3.,.9,.2), vec3(3.2,2.4,1.2), a*a); gl_FragColor=vec4(c*a*a*vA*uAlpha,1.); }',
    });
    const flake = makeSkin('#34312c', '#fff2dc', { flat: true, rimPow: 1.4 });
    const flash = makeGlowMat('#ffb060', 3);
    const floor = new THREE.ShaderMaterial({
      transparent: true, uniforms: { uAlpha: { value: 1 }, uHit: { value: 0 }, uC: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha, uHit; uniform vec2 uC; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          float n = n3(vec3(p*3., 0.))*.5 + n3(vec3(p*14., 1.))*.3 + n3(vec3(p*60., 2.))*.2;
          float pool = exp(-dot(p - uC, p - uC)*.55);
          vec3 c = vec3(.07,.062,.06)*(.35 + n*.9)*(.12 + pool*1.5);
          c += vec3(1.,.45,.15)*uHit*exp(-dot(p - uC, p - uC)*5.)*.5;
          c = mix(c, vec3(.012,.011,.016), smoothstep(3., 9., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    return { fl, sp, flakeGeo, sg, sparkMat, flake, flash, floor };
  }, []);
  useEffect(() => () => { R.flakeGeo.dispose(); R.sg.dispose(); R.sparkMat.dispose(); R.flake.dispose(); R.flash.dispose(); R.floor.dispose(); }, [R]);
  const nS = Math.max(10, Math.floor(SP * Math.max(0.5, q)));
  const H = useMemo(() => new THREE.Vector3(), []);

  useFrame((st) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tm = tNow();
    const prog = range(0.08, 0.93, t) * STRIKES;
    const k = Math.min(STRIKES - 1, Math.floor(prog)), f = prog - k;
    const active = prog > 0.01 && prog < STRIKES ? 1 : 0;
    // swing: lift (0..0.6), fast fall (0.6..0.72), rebound
    let raise: number;
    if (f < 0.6) raise = easeOutCubic(f / 0.6); else if (f < 0.72) { const u = (f - 0.6) / 0.12; raise = 1 - u * u; } else raise = Math.max(0, 0.12 * Math.exp(-(f - 0.72) * 9) * Math.sin((f - 0.72) * 24 + 0.5));
    const sinceHit = f - 0.72;
    const hit = f >= 0.72 && active ? Math.exp(-sinceHit * 14) : 0;
    const h = hero.current;
    if (h) {
      const s = h.state, jitter = Math.sin(tm * 1.3) * 0.004;
      s.crouch = 0.85; s.headPitch = -0.28 + 0.03 * Math.sin(tm * 0.7); s.headYaw = 0.0; s.armsFree = 0;
      s.hRw = 1; s.hRx = 0.3; s.hRy = 0.27 + jitter - hit * 0.006; s.hRz = 0.06;        // holds the core (R, far side)
      s.propR = 7; s.gripR = 0.75;
      const reach = 0.5 + 0.35 * (k % 2);
      s.hLw = 1; s.hLx = 0.278 - 0.03 * raise * reach + 0.06 * raise; s.hLy = 0.39 + 0.42 * raise; s.hLz = -0.075 - 0.02 * raise;   // strikes with the hammerstone (L, near side)
      s.propL = 6; s.gripL = 0.85; s.rollL = 0.2 * raise;
      s.mouth = 0;
      h.look.w = w;
      h.look.keyK = 0.7 + hit * 1.1; h.look.rimK = 1.0 + hit * 1.2; h.look.amb = 0.1; h.look.sss = 0.55;
      // contact point on the core, in world space
      H.set(wx(s.pRx + 0.0), wy(s.pRy + 0.05), wz(s.pRz));
    }
    const floorU = R.floor.uniforms;
    floorU.uAlpha.value = w; floorU.uHit.value = hit * w; floorU.uC.value.set(H.x, H.z);
    R.flake.uniforms.uAlpha.value = w; R.flake.uniforms.uHotAmt.value = 0;
    R.sparkMat.uniforms.uAlpha.value = w;
    if (flash.current) {
      flash.current.position.set(H.x, H.y, H.z + 0.3); flash.current.quaternion.copy(st.camera.quaternion);
      const fs = 0.3 + hit * 1.3; flash.current.scale.set(fs, fs, 1); R.flash.uniforms.uAlpha.value = hit * hit * 0.9 * w;
    }
    // flakes: ballistic arc, then they stay where they land
    const F = flakes.current;
    if (F) {
      for (let i = 0; i < STRIKES * FL; i++) {
        const fk = Math.floor(i / FL), a = R.fl[i];
        const tau = prog - fk - 0.72;
        if (tau < 0 || (i % FL) >= Math.max(4, Math.floor(FL * Math.max(0.6, q)))) { dum.scale.setScalar(0); dum.position.set(0, -9, 0); } else {
          const T = tau * 1.7, rest = a.s * 0.3;
          const tl = (a.v.y + Math.sqrt(a.v.y * a.v.y + 2 * G * Math.max(0.01, H.y - rest))) / G;
          const Tm = Math.min(T, tl);
          const y = T < tl ? H.y + a.v.y * T - 0.5 * G * T * T : rest;
          dum.position.set(H.x + a.ox + a.v.x * Tm * 0.8, y, H.z + a.v.z * Tm * 0.55);
          dum.rotation.set(a.sp.x * Tm, a.sp.y * Tm, a.sp.z * Tm);
          dum.scale.setScalar(a.s * w * Math.min(1, tau * 20));
        }
        dum.updateMatrix(); F.setMatrixAt(i, dum.matrix);
      }
      F.instanceMatrix.needsUpdate = true;
    }
    const P = sparks.current;
    if (P) {
      const pos = P.geometry.attributes.position as THREE.BufferAttribute, aA = P.geometry.attributes.aA as THREE.BufferAttribute;
      for (let i = 0; i < STRIKES * SP; i++) {
        const sk = Math.floor(i / SP), a = R.sp[i];
        const tau = (prog - sk - 0.72) * 1.9;
        if (i % SP >= nS || tau < 0 || tau > a.life) { aA.setX(i, 0); continue; }
        const u = tau / a.life;
        pos.setXYZ(i, H.x + a.v.x * tau * 0.5, H.y + a.v.y * tau * 0.5 - 2.6 * tau * tau, H.z + a.v.z * tau * 0.45);
        aA.setX(i, (1 - u) * (1 - u) * w);
      }
      pos.needsUpdate = true; aA.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.floor}><circleGeometry args={[14, 40]} /></mesh>
      <mesh ref={flash} material={R.flash}><planeGeometry args={[2, 2]} /></mesh>
      <instancedMesh ref={flakes} args={[R.flakeGeo, R.flake, STRIKES * FL]} frustumCulled={false} />
      <points ref={sparks} geometry={R.sg} material={R.sparkMat} frustumCulled={false} />
      <group position={[PX, 0, 0]} rotation={[0, Math.PI, 0]}>
        <group scale={S}>
          <Creature ref={hero} rig="biped" preset="habilis" look={{ rimDir: [-0.5, 0.5], keyDir: [0.6, 0.55, 0.6], gloss: 0.15 }} palette={{ rim: '#f2e6d8', key: '#e8dccb', skin: '#7d675c' }} />
        </group>
      </group>
    </group>
  );
}

export const oldowanCamera = (t: number) => ({ pos: [0.8 + Math.sin(t * 2) * 0.2, 0.85, 4.1] as [number, number, number], look: [1.0, 0.62, 0] as [number, number, number], fov: 36 });
