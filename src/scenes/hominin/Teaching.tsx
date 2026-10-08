import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { makeGlowMat, makeRim } from './common';
import { ik, makeSkin, seg, taperGeo } from './limbs';
import { smoothstep } from '../../world/util';

const N = 7, TR = 46;
const SP = 1.28;
const pos = (i: number, out: THREE.Vector3) => out.set(-3.1 + i * SP, 0, -0.4 * i);
const sc = (i: number) => (i === 0 ? 1.28 : 1.12 - i * 0.015);
const COOL = new THREE.Color('#6b4a3a'), GOLD = new THREE.Color('#f0b872');
const A = 0.4, B = 0.38;

interface Shared { s: number; w: number; tm: number; hand: THREE.Vector3[]; lit: number[] }

function Person({ i, S, geo, shard, ringG, shardM, ringM }: {
  i: number; S: Shared; geo: Record<string, THREE.BufferGeometry>; shard: THREE.BufferGeometry; ringG: THREE.BufferGeometry;
  shardM: THREE.Material; ringM: THREE.Material;
}) {
  const grp = useRef<THREE.Group>(null);
  const skin = useMemo(() => makeSkin('#6b4a3a', '#ffcf94', { rimPow: 2.0 }), []);
  const eyeM = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false }), []);
  const m = {
    torso: useRef<THREE.Mesh>(null), lL: useRef<THREE.Mesh>(null), lR: useRef<THREE.Mesh>(null), sL: useRef<THREE.Mesh>(null), sR: useRef<THREE.Mesh>(null),
    uR: useRef<THREE.Mesh>(null), fR: useRef<THREE.Mesh>(null), uL: useRef<THREE.Mesh>(null), fL: useRef<THREE.Mesh>(null),
    hand: useRef<THREE.Mesh>(null), halo: useRef<THREE.Group>(null), pool: useRef<THREE.Mesh>(null), tool: useRef<THREE.Mesh>(null),
    shards: useRef<Array<THREE.Mesh | null>>([]), head: useRef<THREE.Group>(null),
  };
  const V = useMemo(() => ({ sh: new THREE.Vector3(), el: new THREE.Vector3(), ha: new THREE.Vector3(), pole: new THREE.Vector3(0.2, -1, 0.6), a: new THREE.Vector3(), b: new THREE.Vector3(), w: new THREE.Vector3(), poolM: makeGlowMat('#ffb468', 2.2) }), []);
  useEffect(() => () => { skin.dispose(); eyeM.dispose(); V.poolM.dispose(); }, [skin, eyeM, V]);
  const fwd = useMemo(() => {
    const a = pos(i, new THREE.Vector3()), b = pos(Math.min(N - 1, i + 1), new THREE.Vector3());
    if (i === N - 1) { b.copy(pos(i - 1, new THREE.Vector3())); const d = a.clone().sub(b); return Math.atan2(-d.z, d.x) - 0.95; }
    const d = b.sub(a); return Math.atan2(-d.z, d.x) - 0.95;
  }, [i]);

  useFrame(() => {
    const g = grp.current; if (!g) return;
    const { s, w, tm } = S;
    const lit = smoothstep(i - 0.45, i + 0.05, s);
    const near = Math.exp(-(s - i) * (s - i) * 6);
    S.lit[i] = lit;
    const bright = 0.5 + lit * 0.85 + near * 0.55;
    skin.uniforms.uInt.value = bright; skin.uniforms.uAlpha.value = w; skin.uniforms.uHotAmt.value = (lit * 0.16 + near * 0.45) * w;
    (skin.uniforms.uColor.value as THREE.Color).copy(COOL).lerp(GOLD, lit * 0.8);
    eyeM.color.setRGB(2.6, 1.9, 1.0).multiplyScalar(lit * (0.6 + near));
    const sw = 1 + 0.012 * Math.sin(tm * 1.7 + i) ;
    g.updateMatrixWorld();
    // arm: raise to give / receive
    const r = Math.max(0.12, smoothstep(i - 0.65, i - 0.1, s) * (1 - 0.6 * smoothstep(i + 0.55, i + 1.1, s)));
    V.sh.set(0, 1.42, -0.27);
    V.ha.set(0.1 + 0.42 * r, 1.0 + 0.32 * r, -0.2 + 0.0 * r);
    ik(V.sh, V.ha, A, B, V.pole, V.el);
    seg(m.uR.current, V.sh, V.el, 0.062); seg(m.fR.current, V.el, V.ha, 0.047);
    if (m.hand.current) { m.hand.current.position.copy(V.ha); }
    S.hand[i].copy(V.ha).add(V.w.set(0.1, 0.02, 0)).applyMatrix4(g.matrixWorld);
    // left arm relaxed, slightly swinging
    V.a.set(0, 1.42, 0.27); V.b.set(0.02, 0.93 + 0.02 * Math.sin(tm + i), 0.3);
    ik(V.a, V.b, A, B, V.w.set(-0.2, -0.3, 1), V.el);
    seg(m.uL.current, V.a, V.el, 0.062); seg(m.fL.current, V.el, V.b, 0.047);
    // tool + halo (complexity grows down the chain)
    const tool = m.tool.current;
    if (tool) { tool.position.set(V.ha.x + 0.1, V.ha.y + 0.03, V.ha.z); tool.scale.setScalar(Math.max(0.0001, lit * w * 0.07 * (1 + near * 0.6))); tool.rotation.y = tm * 1.4 + i; tool.rotation.z = 0.4; }
    const halo = m.halo.current;
    if (halo) {
      halo.position.y = 2.2 + Math.sin(tm * 1.4 + i) * 0.03; halo.rotation.y = tm * 0.7 + i; halo.scale.setScalar(Math.max(0.0001, lit * w));
      const n = Math.min(8, i + 1);
      for (let k = 0; k < 8; k++) {
        const sh = m.shards.current![k]; if (!sh) continue;
        if (k >= n) { sh.visible = false; continue; }
        sh.visible = true;
        const a = (k / n) * Math.PI * 2 + tm * (0.5 + 0.1 * i), rad = 0.3 + 0.025 * i;
        sh.position.set(Math.cos(a) * rad, Math.sin(a * 1.7 + k) * 0.05 * (1 + i * 0.2), Math.sin(a) * rad);
        sh.rotation.set(a, a * 1.3, 0);
      }
    }
    if (m.pool.current) { V.poolM.uniforms.uAlpha.value = (0.22 + lit * 0.5 + near * 0.35) * w; }
    void sw;
  });

  const L = 0.0;
  return (
    <group position={pos(i, new THREE.Vector3()).toArray()} scale={sc(i)}>
      <mesh ref={m.pool} material={V.poolM} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[1.2 + i * 0.05, 1.2 + i * 0.05, 1]}><planeGeometry args={[2, 2]} /></mesh>
      <group ref={grp} rotation={[0, fwd, 0]}>
        {/* legs */}
        <mesh geometry={geo.limb} material={skin} position={[0, 0.9, 0.12]} rotation={[0, 0, Math.PI]} scale={[0.1, 0.9, 0.1]} />
        <mesh geometry={geo.limb} material={skin} position={[0, 0.9, -0.12]} rotation={[0, 0, Math.PI]} scale={[0.1, 0.9, 0.1]} />
        <mesh geometry={geo.foot} material={skin} position={[0.1, 0.04, 0.12]} scale={[0.17, 0.05, 0.075]} />
        <mesh geometry={geo.foot} material={skin} position={[0.1, 0.04, -0.12]} scale={[0.17, 0.05, 0.075]} />
        {/* torso: tapered from hips to shoulders */}
        <mesh ref={m.torso} geometry={geo.limb} material={skin} position={[0, 1.45, 0]} rotation={[0, 0, Math.PI]} scale={[0.17, 0.6, 0.17]} />
        <mesh geometry={geo.sph} material={skin} position={[0, 0.9, 0]} scale={[0.17, 0.11, 0.15]} />
        <mesh geometry={geo.sph} material={skin} position={[0, 1.4, 0]} scale={[0.12, 0.1, 0.33]} />
        <mesh geometry={geo.sph} material={skin} position={[0, 1.42, 0.27]} scale={0.075} />
        <mesh geometry={geo.sph} material={skin} position={[0, 1.42, -0.27]} scale={0.075} />
        {/* neck + head */}
        <mesh geometry={geo.limb} material={skin} position={[0.02, 1.47, 0]} scale={[0.065, 0.1, 0.065]} />
        <group ref={m.head} position={[0.05, 1.7, 0]}>
          <mesh geometry={geo.sph} material={skin} scale={[0.17, 0.19, 0.15]} />
          <mesh geometry={geo.sph} material={skin} position={[0.09, -0.07, 0]} scale={[0.1, 0.085, 0.1]} />
          <mesh geometry={geo.sph} material={skin} position={[0.11, 0.045, 0]} scale={[0.09, 0.04, 0.15]} />
          <mesh geometry={geo.sph} material={eyeM} position={[0.135, 0.03, 0.055]} scale={0.02} />
          <mesh geometry={geo.sph} material={eyeM} position={[0.135, 0.03, -0.055]} scale={0.02} />
        </group>
        {/* arms */}
        <mesh ref={m.uR} geometry={geo.limb} material={skin} />
        <mesh ref={m.fR} geometry={geo.limb} material={skin} />
        <mesh ref={m.uL} geometry={geo.limb} material={skin} />
        <mesh ref={m.fL} geometry={geo.limb} material={skin} />
        <mesh ref={m.hand} geometry={geo.sph} material={skin} scale={[0.065, 0.05, 0.055]} />
        <mesh ref={m.tool} geometry={shard} material={shardM} />
        {/* skill halo: more orbiting fragments + rings each step along the chain */}
        <group ref={m.halo} position={[0, 2.2 + L, 0]}>
          {Array.from({ length: 8 }, (_, k) => <mesh key={k} ref={(e) => { m.shards.current![k] = e; }} geometry={shard} material={shardM} scale={0.045 + 0.004 * i} />)}
          {i > 1 && <mesh geometry={ringG} material={ringM} scale={0.26} rotation={[Math.PI / 2.2, 0, 0]} />}
          {i > 3 && <mesh geometry={ringG} material={ringM} scale={0.36} rotation={[Math.PI / 3, 0.6, 0]} />}
          {i > 5 && <mesh geometry={ringG} material={ringM} scale={0.46} rotation={[0.3, 0.2, 1.1]} />}
        </group>
      </group>
    </group>
  );
}

export default function Teaching() {
  const scene = useScene();
  const S = useMemo<Shared>(() => ({ s: 0, w: 1, tm: 0, hand: Array.from({ length: N }, () => new THREE.Vector3()), lit: new Array(N).fill(0) }), []);
  const orb = useMemo(() => ({ m: null as THREE.Mesh | null, h: null as THREE.Mesh | null }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const geo = { limb: taperGeo(0.72), sph: new THREE.SphereGeometry(1, 18, 12), foot: new THREE.SphereGeometry(1, 10, 8) };
    const shard = new THREE.OctahedronGeometry(1, 0); shard.scale(0.7, 1.15, 0.45);
    const ringG = new THREE.TorusGeometry(1, 0.03, 6, 48);
    const shardM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.8), toneMapped: false, transparent: true });
    const ringM = makeRim('#ffc07a', 0.7, 1.0);
    const halo = makeGlowMat('#ffc080', 2);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    const lm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 3), 3));
    tg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TR), 1));
    const tm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(90.*aA)/-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.,1.3,.6)*a*a*vA*uAlpha,1.); }',
    });
    const orbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.5), toneMapped: false });
    const haze = makeGlowMat('#ff9a50', 1.6);
    return { geo, shard, ringG, shardM, ringM, halo, lg, lm, tg, tm, orbM, haze };
  }, []);
  useEffect(() => () => {
    Object.values(R.geo).forEach((g) => g.dispose()); R.shard.dispose(); R.ringG.dispose(); R.shardM.dispose(); R.ringM.dispose(); R.halo.dispose();
    R.lg.dispose(); R.lm.dispose(); R.tg.dispose(); R.tm.dispose(); R.orbM.dispose(); R.haze.dispose();
  }, [R]);

  const orbAt = (s: number, out: THREE.Vector3) => {
    const i = Math.min(N - 2, Math.max(0, Math.floor(s))), f = Math.min(1, Math.max(0, s - i));
    const e = f * f * (3 - 2 * f);
    out.lerpVectors(S.hand[i], S.hand[i + 1], e); out.y += 0.3 * Math.sin(Math.PI * e) + 0.0;
    return out;
  };

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    const s = smoothstep(0.06, 0.94, t) * (N - 1);
    S.s = s; S.w = w; S.tm = tm;
    const lp = R.lg.attributes.position as THREE.BufferAttribute, lc = R.lg.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < N - 1; i++) {
      const a = S.hand[i], b = S.hand[i + 1];
      lp.setXYZ(i * 2, a.x, a.y, a.z); lp.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      const c = smoothstep(i, i + 1, s) * w * 0.9; lc.setXYZ(i * 2, c, c * 0.6, c * 0.25); lc.setXYZ(i * 2 + 1, c, c * 0.6, c * 0.25);
    }
    lp.needsUpdate = true; lc.needsUpdate = true; R.lm.opacity = w;
    orbAt(Math.min(s, N - 1.0001), tmp);
    if (orb.m) { orb.m.position.copy(tmp); orb.m.scale.setScalar(0.07 * w); }
    if (orb.h) { orb.h.position.copy(tmp); orb.h.quaternion.copy(st.camera.quaternion); orb.h.scale.setScalar(1.3); R.halo.uniforms.uAlpha.value = w; }
    const tp = R.tg.attributes.position as THREE.BufferAttribute, ta = R.tg.attributes.aA as THREE.BufferAttribute;
    for (let i = 0; i < TR; i++) { orbAt(Math.min(Math.max(0, s - i * 0.03), N - 1.0001), tmp); tp.setXYZ(i, tmp.x, tmp.y, tmp.z); ta.setX(i, (1 - i / TR) * 0.8); }
    tp.needsUpdate = true; ta.needsUpdate = true; R.tm.uniforms.uAlpha.value = w;
    R.shardM.opacity = w; R.haze.uniforms.uAlpha.value = 0.25 * w;
  });

  return (
    <group>
      <mesh material={R.haze} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -1.4]} scale={[7.5, 3.0, 1]}><planeGeometry args={[2, 2]} /></mesh>
      {Array.from({ length: N }, (_, i) => <Person key={i} i={i} S={S} geo={R.geo} shard={R.shard} ringG={R.ringG} shardM={R.shardM} ringM={R.ringM} />)}
      <lineSegments geometry={R.lg} material={R.lm} frustumCulled={false} />
      <points geometry={R.tg} material={R.tm} frustumCulled={false} />
      <mesh ref={(m) => { orb.m = m; }} material={R.orbM}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh ref={(m) => { orb.h = m; }} material={R.halo}><planeGeometry args={[1.4, 1.4]} /></mesh>
    </group>
  );
}

export const teachingCamera = (t: number) => ({ pos: [-0.2 + t * 0.4, 1.55, 5.6] as [number, number, number], look: [0.1, 1.05, -1.2] as [number, number, number], fov: 50 });
