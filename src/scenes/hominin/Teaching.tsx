import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp, range, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, makeGlowMat, setKnap, strikeCurve } from './common';
import { makeSkin } from './limbs';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';

const STRIKES = 5, FL = 5, G = 7;
const ST = 1.45, SL = 1.05;                      // teacher (Heidelbergensis) and learner (young Erectus) scales
const XT = -0.95, XL = 0.85;                     // creature origins; teacher faces +x, learner faces -x
const tNow = () => (world.reduced ? 0 : world.time);
// world point of a creature-local point
const tw = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(XT + ST * x, ST * y, ST * z);
const lw = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(XL - SL * x, SL * y, -SL * z);

export default function Teaching() {
  const scene = useScene();
  const q = world.quality;
  const hT = useRef<CreatureHandle>(null), hL = useRef<CreatureHandle>(null);
  const flakes = useRef<THREE.InstancedMesh>(null), orb = useRef<THREE.Mesh>(null), orbG = useRef<THREE.Mesh>(null), trail = useRef<THREE.Points>(null);
  const dum = useMemo(() => new THREE.Object3D(), []);
  const A = useMemo(() => new THREE.Vector3(), []), B = useMemo(() => new THREE.Vector3(), []), C = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const r = rng(33);
    const fl = Array.from({ length: STRIKES * FL * 2 }, () => ({ v: new THREE.Vector3((r() - 0.5) * 2, 0.6 + r() * 1.5, (r() - 0.5) * 1.6), s: 0.02 + r() * 0.025, sp: new THREE.Vector3((r() - 0.5) * 12, (r() - 0.5) * 12, (r() - 0.5) * 12) }));
    const flakeGeo = new THREE.TetrahedronGeometry(1, 0); flakeGeo.scale(1, 0.24, 0.7);
    const flake = makeSkin('#34312c', '#fff2dc', { flat: true, rimPow: 1.4 });
    const floor = new THREE.ShaderMaterial({
      transparent: true, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          float n = n3(vec3(p*3., 0.))*.5 + n3(vec3(p*14., 1.))*.3 + n3(vec3(p*60., 2.))*.2;
          float pool = exp(-dot(p*vec2(.45,.9), p*vec2(.45,.9))*.6);
          vec3 c = vec3(.07,.062,.06)*(.35 + n*.9)*(.1 + pool*1.4);
          c = mix(c, vec3(.012,.011,.016), smoothstep(3., 10., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    // the 'transmission' accent: a warm orb carrying each strike from teacher to learner, with a short comet tail
    const orbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.6), toneMapped: false, transparent: true });
    const glow = makeGlowMat('#ff9a30', 2.2);
    const TR = 28;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 3), 3));
    tg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TR), 1));
    const tm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(34.*aA)/-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.6,1.0,.25)*a*a*vA*uAlpha,1.); }',
    });
    return { fl, flakeGeo, flake, floor, orbM, glow, tg, tm, TR };
  }, []);
  useEffect(() => () => { R.flakeGeo.dispose(); R.flake.dispose(); R.floor.dispose(); R.orbM.dispose(); R.glow.dispose(); R.tg.dispose(); R.tm.dispose(); }, [R]);
  const orbAt = (u: number, out: THREE.Vector3) => { // arc from the teacher's hammer to the learner's
    out.lerpVectors(A, B, u); out.y += Math.sin(Math.PI * u) * 0.55; return out;
  };

  useFrame((st) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tm = tNow();
    const prog = range(0.1, 0.9, t) * STRIKES;
    const k = Math.min(STRIKES - 1, Math.floor(prog)), f = prog - k;
    const lag = 0.45;                                             // the learner repeats each blow shortly after
    const pl = prog - lag, kl = Math.max(0, Math.floor(pl)), fl2 = pl - kl;
    const cT = strikeCurve(f, prog > 0.01 && prog < STRIKES ? 1 : 0);
    const cL = strikeCurve(Math.max(0, fl2), pl > 0.01 && pl < STRIKES ? 1 : 0);
    const hTm = hT.current, hLm = hL.current;
    if (hTm) {
      setKnap(hTm.state, cT.raise, cT.hit, tm, 1, 0.9, 0.85);
      hTm.state.headPitch = -0.2 + 0.03 * Math.sin(tm * 0.7); hTm.state.headYaw = 0; hTm.state.mouth = 0;
      hTm.look.w = w; hTm.look.keyK = 0.4 + cT.hit * 0.9; hTm.look.rimK = 0.6; hTm.look.sss = 0.5; hTm.look.amb = 0.14;
    }
    if (hLm) {
      // the learner watches the teacher's hands, then tries it
      const watch = 1 - smoothstep(0.0, 0.5, fl2) * (pl > 0 ? 1 : 0);
      setKnap(hLm.state, cL.raise * (pl > 0 ? 1 : 0.0), cL.hit, tm + 1.7, -1, 0.55, 0.85);
      hLm.state.headPitch = -0.22 + 0.04 * watch; hLm.state.headYaw = 0; hLm.state.mouth = 0;
      hLm.look.w = w; hLm.look.keyK = 0.38 + cL.hit * 0.9; hLm.look.rimK = 0.6; hLm.look.sss = 0.5; hLm.look.amb = 0.14;
    }
    R.floor.uniforms.uAlpha.value = w; R.flake.uniforms.uAlpha.value = w; R.flake.uniforms.uHotAmt.value = 0;
    if (hTm) tw(hTm.state.pLx, hTm.state.pLy + 0.05, hTm.state.pLz, A);
    if (hLm) lw(hLm.state.pRx, hLm.state.pRy + 0.05, hLm.state.pRz, B);
    // the warm orb: leaves the teacher's core at each blow, lands on the learner's core as the learner repeats it
    const phaseU = f >= 0.72 ? Math.min(1, (f - 0.72) / (1 - 0.72 + lag)) : 0;
    const flight = (k > 0 || f > 0.72) && prog < STRIKES + lag ? (f >= 0.72 ? phaseU : (f < lag * 0.9 ? Math.min(1, (f + 0.28) / (0.28 + lag)) : 0)) : 0;
    const u = smoothstep(0, 1, flight);
    orbAt(u, C);
    const vis = flight > 0.001 && flight < 0.999 ? 1 : 0;
    if (orb.current) { orb.current.position.copy(C); orb.current.scale.setScalar(0.035 * w * vis * (0.8 + 0.2 * Math.sin(tm * 20))); }
    if (orbG.current) { orbG.current.position.copy(C); orbG.current.quaternion.copy(st.camera.quaternion); orbG.current.scale.setScalar(0.9); R.glow.uniforms.uAlpha.value = 0.8 * w * vis; }
    const tp = R.tg.attributes.position as THREE.BufferAttribute, ta = R.tg.attributes.aA as THREE.BufferAttribute;
    for (let i = 0; i < R.TR; i++) {
      const uu = Math.max(0, u - i * 0.012); orbAt(uu, dum.position); tp.setXYZ(i, dum.position.x, dum.position.y, dum.position.z);
      ta.setX(i, vis * (1 - i / R.TR) * 0.8);
    }
    tp.needsUpdate = true; ta.needsUpdate = true; R.tm.uniforms.uAlpha.value = w;
    // flakes from both knapping sites
    const F = flakes.current;
    if (F) {
      for (let i = 0; i < STRIKES * FL * 2; i++) {
        const site = i % 2, idx = Math.floor(i / 2), fk = Math.floor(idx / FL), a = R.fl[i];
        const tau = (site === 0 ? prog : pl) - fk - 0.72;
        if (tau < 0 || (idx % FL) >= Math.max(3, Math.floor(FL * Math.max(0.6, q)))) { dum.scale.setScalar(0); dum.position.set(0, -9, 0); } else {
          const P0 = site === 0 ? A : B, dir = site === 0 ? -1 : 1;
          const T = tau * 1.7, rest = a.s * 0.3;
          const tl = (a.v.y + Math.sqrt(a.v.y * a.v.y + 2 * G * Math.max(0.01, P0.y - rest))) / G;
          const Tm = Math.min(T, tl);
          const y = T < tl ? P0.y + a.v.y * T - 0.5 * G * T * T : rest;
          dum.position.set(P0.x + dir * Math.abs(a.v.x) * Tm * 0.7, y, P0.z + a.v.z * Tm * 0.5);
          dum.rotation.set(a.sp.x * Tm, a.sp.y * Tm, a.sp.z * Tm);
          dum.scale.setScalar(a.s * w * Math.min(1, tau * 20));
        }
        dum.updateMatrix(); F.setMatrixAt(i, dum.matrix);
      }
      F.instanceMatrix.needsUpdate = true;
    }
    void lerp;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.floor}><circleGeometry args={[14, 40]} /></mesh>
      <instancedMesh ref={flakes} args={[R.flakeGeo, R.flake, STRIKES * FL * 2]} frustumCulled={false} />
      <points ref={trail} geometry={R.tg} material={R.tm} frustumCulled={false} />
      <mesh ref={orb} material={R.orbM}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh ref={orbG} material={R.glow}><planeGeometry args={[1, 1]} /></mesh>
      <group position={[XT, 0, 0]}><group scale={ST}>
        <Creature ref={hT} rig="biped" preset="heidelbergensis" look={{ rimDir: [-0.5, 0.5], keyDir: [0.6, 0.55, 0.6], gloss: 0.15 }} palette={{ rim: '#f2e6d8', key: '#e8dccb', skin: '#8f7a6c' }} />
      </group></group>
      <group position={[XL, 0, 0]} rotation={[0, Math.PI, 0]}><group scale={SL}>
        <Creature ref={hL} rig="biped" preset="erectus" look={{ rimDir: [0.5, 0.5], keyDir: [-0.6, 0.55, 0.6], gloss: 0.15 }} palette={{ rim: '#f2e6d8', key: '#e8dccb', skin: '#806a5c' }} />
      </group></group>
    </group>
  );
}

export const teachingCamera = (t: number) => ({ pos: [-0.05 + Math.sin(t * 1.5) * 0.25, 0.95, 6.3] as [number, number, number], look: [-0.05, 0.68, 0] as [number, number, number], fov: 36 });
