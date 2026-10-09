import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, range, rng, smoothstep } from '../../world/util';
import { Brain, makeGlowMat, newBrain } from './common';

const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
interface Br { pts: THREE.Vector3[]; col: [number, number, number]; t0: number; t1: number; r: number }
const BR: Br[] = [
  { pts: [V(0, -5.2), V(0.05, -3.6), V(0, -2.5), V(0, -1.3)], col: [1.2, 0.85, 0.5], t0: -1, t1: 0.04, r: 0.045 },
  { pts: [V(0, -2.5), V(1.2, -2.0, 0.2), V(2.6, -0.9, 0.5), V(3.3, 0.6, 0.3), V(3.5, 2.0, 0.2)], col: [0.7, 1.4, 1.1], t0: 0.33, t1: 0.64, r: 0.035 },
  { pts: [V(0, -1.3), V(0.5, -0.3), V(1.0, 0.8), V(0.8, 2.2), V(1.0, 3.6)], col: [0.7, 1.0, 2.0], t0: 0.06, t1: 1.0, r: 0.05 },
  { pts: [V(0, -1.3), V(-0.4, -0.7), V(-0.7, -0.1)], col: [1.2, 0.85, 0.5], t0: 0.0, t1: 0.1, r: 0.04 },
  { pts: [V(-0.7, -0.1), V(-1.3, 0.7, -0.2), V(-2.1, 1.7, -0.3), V(-2.5, 3.0, -0.2)], col: [2.0, 0.9, 0.45], t0: 0.04, t1: 0.32, r: 0.05 },
  { pts: [V(-0.7, -0.1), V(-0.4, 0.9, 0.3), V(-0.6, 2.1, 0.2), V(-0.3, 3.2, 0.3)], col: [1.8, 0.5, 1.4], t0: 0.66, t1: 0.95, r: 0.04 },
];
const FLOW = [
  { a: V(1.0, 2.0), b: V(-2.2, 2.2, -0.3), c: [2.0, 0.9, 0.5], t0: 0.55 },
  { a: V(0.9, 2.5), b: V(-0.5, 2.4, 0.3), c: [1.8, 0.5, 1.4], t0: 0.8 },
];

export default function Lineages() {
  const scene = useScene();
  const q = world.quality;
  const bN = useMemo(newBrain, []), bL = useMemo(newBrain, []);
  const R = useMemo(() => {
    const mk = (col: [number, number, number], flow = false) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uG: { value: 0 }, uAlpha: { value: 1 }, uT: { value: 0 }, uC: { value: new THREE.Vector3(...col) } },
      vertexShader: 'varying float vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv.x; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: `uniform float uG,uAlpha,uT; uniform vec3 uC; varying float vU; varying vec3 vN; varying vec3 vV;
        void main(){ ${flow ? 'float dash=step(.5,fract(vU*40.-uT*1.5)); if(dash<.5) discard;' : ''} if(vU>uG) discard;
          float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.2);
          float head=exp(-(uG-vU)*18.)*1.8; float flow=.5+.5*sin(vU*40.-uT*2.);
          gl_FragColor=vec4(uC*(.25+f*.9+head+flow*.25)*uAlpha,1.); }`,
    });
    const branches = BR.map((b) => ({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b.pts), 140, b.r, 8), mat: mk(b.col), b, curve: new THREE.CatmullRomCurve3(b.pts) }));
    const flows = FLOW.map((f) => {
      const mid = f.a.clone().add(f.b).multiplyScalar(0.5).add(V(0, 0.9, 0.6));
      const curve = new THREE.QuadraticBezierCurve3(f.a, mid, f.b);
      return { geo: new THREE.TubeGeometry(curve, 100, 0.02, 6), mat: mk(f.c as [number, number, number], true), f };
    });
    const halo = makeGlowMat('#ffffff', 2);
    const leafM = [new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, .6), toneMapped: false, transparent: true }), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.4, 2), toneMapped: false, transparent: true }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, .7, 2), toneMapped: false, transparent: true })];
    const nS = Math.floor(140 * q), r = rng(30), sp = new Float32Array(nS * 3);
    for (let i = 0; i < nS; i++) { sp[i * 3] = (r() - .5) * 26; sp[i * 3 + 1] = (r() - .5) * 20; sp[i * 3 + 2] = -r() * 14 - 1; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.PointsMaterial({ size: 0.05, color: '#cdb8ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    return { branches, flows, halo, leafM, sg, sm };
  }, [q]);
  useEffect(() => () => { R.branches.forEach((b) => { b.geo.dispose(); b.mat.dispose(); }); R.flows.forEach((b) => { b.geo.dispose(); b.mat.dispose(); }); R.halo.dispose(); R.leafM.forEach((m) => m.dispose()); R.sg.dispose(); R.sm.dispose(); }, [R]);
  const leaves = useMemo(() => [
    { p: BR[4].pts[3], m: 0, base: 0.2, ev: 'neanderthals' }, { p: BR[1].pts[4], m: 1, base: 0.1, ev: 'homo-naledi' }, { p: BR[5].pts[3], m: 2, base: 0.16, ev: 'denisovans' },
  ], []);
  const leafRef = useMemo(() => leaves.map(() => ({ m: null as THREE.Mesh | null })), [leaves]);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    R.branches.forEach(({ mat, b }) => { mat.uniforms.uG.value = range(b.t0, b.t1, t); mat.uniforms.uAlpha.value = w; mat.uniforms.uT.value = tm + t * 10; });
    R.flows.forEach(({ mat, f }) => { mat.uniforms.uG.value = range(f.t0, f.t0 + 0.12, t); mat.uniforms.uAlpha.value = w * 0.0; mat.uniforms.uT.value = tm + t * 10; });
    leaves.forEach((l, i) => {
      const b = BR[l.m === 0 ? 4 : l.m === 1 ? 1 : 5];
      const g = smoothstep(b.t1 - 0.05, b.t1 + 0.04, t), ev = near(eventPos(l.ev), 0.6);
      const m = leafRef[i].m; if (m) m.scale.setScalar(Math.max(0.0001, (l.base * 0.5 + ev * l.base * 0.4) * g * w));
    });
    const gN = smoothstep(0.28, 0.36, t), gL = smoothstep(0.62, 0.7, t);
    bN.s = 0.42 * gN; bN.alpha = w * gN; bN.glow = near(eventPos('neanderthals'), 0.6); bN.motor = 0.3;
    bL.s = 0.29 * gL; bL.alpha = w * gL; bL.glow = near(eventPos('homo-naledi'), 0.6); bL.motor = 0.3;
    R.sm.opacity = w * 0.3;
    void lerp;
  });

  return (
    <group>
      <points geometry={R.sg} material={R.sm} frustumCulled={false} />
      {R.branches.map((b, i) => <mesh key={i} geometry={b.geo} material={b.mat} frustumCulled={false} />)}
      {R.flows.map((b, i) => <mesh key={'f' + i} geometry={b.geo} material={b.mat} frustumCulled={false} />)}
      {leaves.map((l, i) => (
        <mesh key={i} ref={(m) => { leafRef[i].m = m; }} position={l.p} material={R.leafM[l.m]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      ))}
      <group position={[-2.5, 3.65, -0.2]} rotation={[0, -0.4, 0]}><Brain ctl={bN} color="#ffc08a" hot="#ffd9a0" /></group>
      <group position={[3.5, 2.5, 0.2]} rotation={[0, -0.4, 0]}><Brain ctl={bL} color="#9ff0d4" hot="#ffd9a0" /></group>
    </group>
  );
}

export const lineagesCamera = (t: number) => ({ pos: [-2.1, lerp(-0.6, 1.9, t), 9.2 - t * 0.6] as [number, number, number], look: [-2.1, lerp(-0.6, 1.9, t), 0] as [number, number, number], fov: 52 });
