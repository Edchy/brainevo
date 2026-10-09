import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { rng } from '../../world/util';
import { Bust, makeGlowMat, type BustCtl } from './common';

const NB = 7, RAD = 2.3, TR = 36;
const SCL = [1, 0.95, 1.05, 0.72, 0.9, 1, 0.85];
const ang = (i: number) => (i / NB) * Math.PI * 2 + 0.3;

/** infant position along its journey: s in [0, NB*k] hand to hand */
function infant(s: number, out: THREE.Vector3) {
  const i = Math.floor(s), f = s - i;
  const a0 = ang(i), a1 = ang(i + 1);
  const a = a0 + (a1 - a0) * (f * f * (3 - 2 * f));
  const r = 1.55 - 0.5 * Math.sin(Math.PI * f) ;
  return out.set(Math.cos(a) * r, 0.95 + 0.35 * Math.sin(Math.PI * f), Math.sin(a) * r);
}

export default function Coop() {
  const scene = useScene();
  const busts = useMemo<BustCtl[]>(() => Array.from({ length: NB }, () => ({ int: 0.4, alpha: 1 })), []);
  const orb = useRef<THREE.Mesh>(null), halo = useRef<THREE.Mesh>(null), floorGlow = useRef<THREE.Mesh>(null), links = useRef<THREE.LineSegments>(null), trail = useRef<THREE.Points>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const halo = makeGlowMat('#ffb878', 2.2);
    const floor = makeGlowMat('#ff9a50', 1.6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 6), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NB * 6), 3));
    const lm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 3), 3));
    tg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TR), 1));
    const tm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(60.*aA)/-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.,1.1,.5)*a*a*vA*uAlpha,1.); }',
    });
    const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.4, 1.2), toneMapped: false, transparent: true });
    const r = rng(9);
    return { halo, floor, lg, lm, tg, tm, orbMat, ph: Array.from({ length: NB }, () => r() * 6) };
  }, []);
  useEffect(() => () => { R.halo.dispose(); R.floor.dispose(); R.lg.dispose(); R.lm.dispose(); R.tg.dispose(); R.tm.dispose(); R.orbMat.dispose(); }, [R]);
  const hand = useMemo(() => new THREE.Vector3(), []);

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t;
    const s = t * NB * 1.35 + 0.0;
    infant(s, p);
    orb.current?.position.copy(p);
    if (orb.current) { orb.current.scale.setScalar(0.13 * w); }
    if (halo.current) { halo.current.position.copy(p); halo.current.quaternion.copy(st.camera.quaternion); halo.current.scale.setScalar(2.1 + Math.sin(world.reduced ? 0 : world.time * 3) * 0.08); R.halo.uniforms.uAlpha.value = w; }
    if (floorGlow.current) { floorGlow.current.position.set(p.x, 0.02, p.z); R.floor.uniforms.uAlpha.value = w * 0.35; }
    const lp = R.lg.attributes.position as THREE.BufferAttribute, lc = R.lg.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < NB; i++) {
      const a = ang(i), cur = ((s % NB) + NB) % NB;
      let d = Math.abs(cur - i); d = Math.min(d, NB - d);
      const hold = Math.exp(-d * d * 1.3);
      busts[i].int = 0.07 + hold * 1.35; busts[i].alpha = w;
      hand.set(Math.cos(a) * (RAD - 0.7), 0.75 * SCL[i], Math.sin(a) * (RAD - 0.7));
      lp.setXYZ(i * 2, hand.x, hand.y, hand.z); lp.setXYZ(i * 2 + 1, p.x, p.y, p.z);
      const c = hold * w * 1.2; lc.setXYZ(i * 2, c, c * 0.55, c * 0.2); lc.setXYZ(i * 2 + 1, c * 0.2, c * 0.1, 0);
    }
    lp.needsUpdate = true; lc.needsUpdate = true;
    const tp = R.tg.attributes.position as THREE.BufferAttribute, ta = R.tg.attributes.aA as THREE.BufferAttribute;
    for (let i = 0; i < TR; i++) { infant(Math.max(0, s - i * 0.035), hand); tp.setXYZ(i, hand.x, hand.y, hand.z); ta.setX(i, (1 - i / TR) * 0.8); }
    tp.needsUpdate = true; ta.needsUpdate = true; R.tm.uniforms.uAlpha.value = w;
    R.lm.opacity = w;
  });

  return (
    <group>
      <mesh ref={floorGlow} rotation={[-Math.PI / 2, 0, 0]} material={R.floor}><planeGeometry args={[3.2, 3.2]} /></mesh>
      {busts.map((b, i) => {
        const a = ang(i);
        return (
          <group key={i} position={[Math.cos(a) * RAD, 0, Math.sin(a) * RAD]} rotation={[0, Math.PI - a, 0]}>
            <Bust ctl={b} scale={SCL[i]} color={i === 3 ? '#ffd8a8' : '#ffb98a'} />
          </group>
        );
      })}
      <lineSegments ref={links} geometry={R.lg} material={R.lm} frustumCulled={false} />
      <points ref={trail} geometry={R.tg} material={R.tm} frustumCulled={false} />
      <mesh ref={orb} material={R.orbMat}><sphereGeometry args={[1, 20, 14]} /></mesh>
      <mesh ref={halo} material={R.halo}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}

export const coopCamera = (t: number) => ({ pos: [Math.sin(t * 1.6) * 1.0, 2.2 - t * 0.3, 5.0] as [number, number, number], look: [0, 0.9, 0] as [number, number, number], fov: 48 });
