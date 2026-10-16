import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, range, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, makeGlowMat } from './common';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';
import { BIPED_PRESETS, morphBiped } from '../shared/creatures/biped';
import type { BipedParams } from '../shared/creatures/biped';

const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
interface Br { pts: THREE.Vector3[]; col: [number, number, number]; t0: number; t1: number; r: number }
// the family tree: stem from Heidelbergensis, Neanderthal + Denisovan branches (amber), Naledi aside (cool)
const BR: Br[] = [
  { pts: [V(0, -5.2), V(0.05, -3.6), V(0, -2.5), V(0, -1.3)], col: [1.2, 0.85, 0.5], t0: -1, t1: 0.04, r: 0.03 },
  { pts: [V(0, -2.5), V(1.2, -2.0, 0.2), V(2.6, -0.9, 0.5), V(3.3, 0.6, 0.3), V(3.5, 2.0, 0.2)], col: [0.55, 0.95, 0.85], t0: 0.33, t1: 0.64, r: 0.022 },
  { pts: [V(0, -1.3), V(0.5, -0.3), V(1.0, 0.8), V(0.8, 2.2), V(1.0, 3.6)], col: [0.7, 0.8, 1.3], t0: 0.06, t1: 1.0, r: 0.03 },
  { pts: [V(0, -1.3), V(-0.4, -0.7), V(-0.7, -0.1)], col: [1.2, 0.85, 0.5], t0: 0.0, t1: 0.1, r: 0.028 },
  { pts: [V(-0.7, -0.1), V(-1.3, 0.7, -0.2), V(-2.1, 1.7, -0.3), V(-2.5, 3.0, -0.2)], col: [2.4, 1.1, 0.4], t0: 0.04, t1: 0.32, r: 0.032 },
  { pts: [V(-0.7, -0.1), V(-0.4, 0.9, 0.3), V(-0.6, 2.1, 0.2), V(-0.3, 3.2, 0.3)], col: [2.0, 0.9, 0.3], t0: 0.66, t1: 0.95, r: 0.028 },
];

export default function Lineages() {
  const scene = useScene();
  const q = world.quality;
  const hero = useRef<CreatureHandle>(null);
  const heroParams = useMemo(() => ({}), []);
  const leafRef = useRef<(THREE.Mesh | null)[]>([]);
  const R = useMemo(() => {
    const mk = (col: [number, number, number]) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uG: { value: 0 }, uAlpha: { value: 1 }, uT: { value: 0 }, uC: { value: new THREE.Vector3(...col) } },
      vertexShader: 'varying float vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv.x; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: `uniform float uG,uAlpha,uT; uniform vec3 uC; varying float vU; varying vec3 vN; varying vec3 vV;
        void main(){ if(vU>uG) discard;
          float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.2);
          float head=exp(-(uG-vU)*18.)*1.8; float flow=.5+.5*sin(vU*40.-uT*2.);
          gl_FragColor=vec4(uC*(.2+f*.7+head+flow*.18)*uAlpha*.55,1.); }`,
    });
    // branches are drawn ~2.4x their old radius: the oil pass erases lines thinner than a brush stroke
    const branches = BR.map((b) => ({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b.pts), 140, b.r * 2.4, 10), mat: mk(b.col), b }));
    const floor = new THREE.ShaderMaterial({
      transparent: true, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying vec3 vW; varying float vD;
        void main(){ vec2 p = vW.xz; float n = n3(vec3(p*3.,0.))*.5 + n3(vec3(p*14.,1.))*.5;
          float pool = exp(-dot(p - vec2(1.,0.), p - vec2(1.,0.))*.35);
          vec3 c = vec3(.07,.06,.06)*(.3 + n)*(.06 + pool*1.2);
          c = mix(c, vec3(.012,.011,.02), smoothstep(3., 11., vD)); gl_FragColor = vec4(c, uAlpha); }`,
    });
    const leafM = [new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.7, .5), toneMapped: false, transparent: true }), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 2.2), toneMapped: false, transparent: true }), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.5, .5), toneMapped: false, transparent: true })];
    const halo = makeGlowMat('#ff9a40', 2);
    const nS = Math.floor(140 * q), r = rng(30), sp = new Float32Array(nS * 3);
    for (let i = 0; i < nS; i++) { sp[i * 3] = (r() - .5) * 26; sp[i * 3 + 1] = (r() - .5) * 14 + 2; sp[i * 3 + 2] = -r() * 14 - 3; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.PointsMaterial({ size: 0.04, color: '#cdb8ff', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    return { branches, floor, leafM, halo, sg, sm };
  }, [q]);
  useEffect(() => () => { R.branches.forEach((b) => { b.geo.dispose(); b.mat.dispose(); }); R.floor.dispose(); R.leafM.forEach((m) => m.dispose()); R.halo.dispose(); R.sg.dispose(); R.sm.dispose(); }, [R]);
  const leaves = useMemo(() => [
    { p: BR[4].pts[3], m: 0, base: 0.14, ev: 'neanderthals', br: 4 }, { p: BR[1].pts[4], m: 1, base: 0.1, ev: 'homo-naledi', br: 1 }, { p: BR[5].pts[3], m: 2, base: 0.12, ev: 'denisovans', br: 5 },
  ], []);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    R.floor.uniforms.uAlpha.value = w;
    R.branches.forEach(({ mat, b }) => { mat.uniforms.uG.value = range(b.t0, b.t1, t); mat.uniforms.uAlpha.value = w; mat.uniforms.uT.value = tm + t * 10; });
    leaves.forEach((l, i) => {
      const b = BR[l.br], g = smoothstep(b.t1 - 0.05, b.t1 + 0.04, t), ev = near(eventPos(l.ev), 0.6);
      const m = leafRef.current[i]; if (m) m.scale.setScalar(Math.max(0.0001, (l.base * 0.5 + ev * l.base * 0.5) * g * w));
    });
    R.sm.opacity = w * 0.3;
    const h = hero.current;
    if (h) {
      const p = h.params as BipedParams;
      // Neanderthal -> (Naledi aside) -> Denisovan: the same robust build shifts toward the broad-faced, large-jawed Denisovan
      morphBiped(p, BIPED_PRESETS.neanderthal, BIPED_PRESETS.heidelbergensis, smoothstep(0.66, 0.92, t));
      p.jaw += 0.12 * smoothstep(0.66, 0.92, t); p.cheek += 0.12 * smoothstep(0.66, 0.92, t); p.chin -= 0.008 * smoothstep(0.66, 0.92, t);
      const s = h.state;
      s.headYaw = lerp(0.1, -0.35, smoothstep(0.0, 0.5, t)) + Math.sin(tm * 0.35) * 0.08;
      s.headPitch = 0.04 * Math.sin(tm * 0.27); s.mouth = 0;
      s.propR = 3; s.gripR = 0.65; s.rollR = 3.0; s.armsFree = 0;
      h.look.w = w; h.look.rimK = 1.1 + near(eventPos('neanderthals'), 0.5) * 0.5; h.look.keyK = 1.1; h.look.amb = 0.05; h.look.sss = 0.45;
    }
  });

  return (
    <group>
      <points geometry={R.sg} material={R.sm} frustumCulled={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.floor}><circleGeometry args={[16, 40]} /></mesh>
      <group position={[-2.3, -0.75, -2.6]} scale={0.95}>
        {R.branches.map((b, i) => <mesh key={i} geometry={b.geo} material={b.mat} frustumCulled={false} />)}
        {leaves.map((l, i) => (
          <mesh key={i} ref={(m) => { leafRef.current[i] = m; }} position={l.p} material={R.leafM[l.m]}><sphereGeometry args={[1, 16, 12]} /></mesh>
        ))}
      </group>
      <group position={[0.95, 0, 0]} rotation={[0, -Math.PI * 0.7, 0]}>
        <group scale={1.28}>
          <Creature ref={hero} rig="biped" preset="neanderthal" params={heroParams} look={{ rimDir: [0.75, 0.3], keyDir: [-1, 0.25, 0.12], gloss: 0.3 }} palette={{ rim: '#ffcf9a', key: '#c8b4a0' }} />
        </group>
      </group>
    </group>
  );
}

export const lineagesCamera = (t: number) => ({ pos: [0.7 + t * 0.3, 1.3, 3.9 - t * 0.3] as [number, number, number], look: [0.35, 1.15, 0] as [number, number, number], fov: 36 });
