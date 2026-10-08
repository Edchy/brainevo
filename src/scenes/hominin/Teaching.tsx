import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { makeGlowMat, makeRim, Bust, type BustCtl } from './common';
import { smoothstep } from '../../world/util';

const N = 9, TR = 40;
const pos = (i: number, out: THREE.Vector3) => out.set(-4.4 + i * 1.15, 0, -i * 0.85);
const head = (s: number, out: THREE.Vector3) => {
  const i = Math.min(N - 2, Math.floor(s)), f = s - i;
  const a = pos(i, new THREE.Vector3()), b = pos(i + 1, new THREE.Vector3());
  return out.lerpVectors(a, b, f).add(new THREE.Vector3(0.18, 1.25 + 0.35 * Math.sin(Math.PI * f), 0.0));
};

export default function Teaching() {
  const scene = useScene();
  const busts = useMemo<BustCtl[]>(() => Array.from({ length: N }, () => ({ int: 0.4, alpha: 1 })), []);
  const glyph = useMemo(() => Array.from({ length: N }, () => ({ g: null as THREE.Group | null })), []);
  const orb = useMemo(() => ({ m: null as THREE.Mesh | null, h: null as THREE.Mesh | null }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const glyphM = makeRim('#ffd9a0', 0.6, 1.2), ringM = makeRim('#ffb060', 0.8, 1.0);
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
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(80.*aA)/-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.,1.3,.6)*a*a*vA*uAlpha,1.); }',
    });
    const orbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.5), toneMapped: false });
    const oct = new THREE.OctahedronGeometry(1, 0); oct.scale(0.7, 1.15, 0.35);
    const ring = new THREE.TorusGeometry(1, 0.03, 6, 40);
    const floor = new THREE.GridHelper(40, 80, '#ffb070', '#ffb070'); const fm = floor.material as THREE.LineBasicMaterial; fm.transparent = true; fm.blending = THREE.AdditiveBlending; fm.depthWrite = false;
    return { glyphM, ringM, halo, lg, lm, tg, tm, orbM, oct, ring, floor };
  }, []);
  useEffect(() => () => { R.glyphM.dispose(); R.ringM.dispose(); R.halo.dispose(); R.lg.dispose(); R.lm.dispose(); R.tg.dispose(); R.tm.dispose(); R.orbM.dispose(); R.oct.dispose(); R.ring.dispose(); R.floor.geometry.dispose(); (R.floor.material as THREE.Material).dispose(); }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    const s = smoothstep(0.06, 0.94, t) * (N - 1);
    const lp = R.lg.attributes.position as THREE.BufferAttribute, lc = R.lg.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const lit = smoothstep(i - 0.45, i + 0.05, s);
      busts[i].alpha = w; busts[i].int = 0.3 + lit * 1.0 + Math.exp(-(s - i) * (s - i) * 5) * 0.8;
      const g = glyph[i].g;
      if (g) {
        const k = lit * w;
        g.scale.setScalar(Math.max(0.0001, k * (0.14 + i * 0.022)));
        g.rotation.y = tm * 0.8 + i; g.position.y = 1.85 + i * 0.03 + Math.sin(tm * 1.5 + i) * 0.03;
      }
      if (i < N - 1) {
        const a = pos(i, tmp); lp.setXYZ(i * 2, a.x, 1.2, a.z); const b = pos(i + 1, tmp); lp.setXYZ(i * 2 + 1, b.x, 1.2, b.z);
        const c = smoothstep(i, i + 1, s) * w * 0.9; lc.setXYZ(i * 2, c, c * 0.6, c * 0.25); lc.setXYZ(i * 2 + 1, c, c * 0.6, c * 0.25);
      }
    }
    lp.needsUpdate = true; lc.needsUpdate = true; R.lm.opacity = w;
    head(Math.min(s, N - 1.0001), tmp);
    if (orb.m) { orb.m.position.copy(tmp); orb.m.scale.setScalar(0.09 * w); }
    if (orb.h) { orb.h.position.copy(tmp); orb.h.quaternion.copy(st.camera.quaternion); R.halo.uniforms.uAlpha.value = w; }
    const tp = R.tg.attributes.position as THREE.BufferAttribute, ta = R.tg.attributes.aA as THREE.BufferAttribute;
    for (let i = 0; i < TR; i++) { head(Math.min(Math.max(0, s - i * 0.04), N - 1.0001), tmp); tp.setXYZ(i, tmp.x, tmp.y, tmp.z); ta.setX(i, (1 - i / TR) * 0.7); }
    tp.needsUpdate = true; ta.needsUpdate = true; R.tm.uniforms.uAlpha.value = w;
    (R.floor.material as THREE.Material).opacity = w * 0.1;
  });

  return (
    <group>
      <primitive object={R.floor} position={[0, -0.02, 0]} />
      {busts.map((b, i) => (
        <group key={i} position={pos(i, new THREE.Vector3()).toArray()} rotation={[0, -0.1, 0]}>
          <Bust ctl={b} scale={i === 0 ? 1.15 : 0.95} color={i === 0 ? '#ffd8a8' : '#ffb98a'} />
          <group ref={(g) => { glyph[i].g = g; }}>
            <mesh geometry={R.oct} material={R.glyphM} />
            {i > 1 && <mesh geometry={R.ring} material={R.ringM} scale={1.2} rotation={[Math.PI / 2.2, 0, 0]} />}
            {i > 3 && <mesh geometry={R.ring} material={R.ringM} scale={1.6} rotation={[Math.PI / 3, 0.6, 0]} />}
            {i > 5 && <mesh geometry={R.ring} material={R.ringM} scale={2.0} rotation={[0.3, 0.2, 1.1]} />}
          </group>
        </group>
      ))}
      <lineSegments geometry={R.lg} material={R.lm} frustumCulled={false} />
      <points geometry={R.tg} material={R.tm} frustumCulled={false} />
      <mesh ref={(m) => { orb.m = m; }} material={R.orbM}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh ref={(m) => { orb.h = m; }} material={R.halo}><planeGeometry args={[1.4, 1.4]} /></mesh>
    </group>
  );
}

export const teachingCamera = (t: number) => ({ pos: [-0.5 + t * 1.2, 1.7, 4.8] as [number, number, number], look: [0.4, 1.0, -3] as [number, number, number], fov: 56 });
