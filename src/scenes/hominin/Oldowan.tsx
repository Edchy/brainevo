import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeOutCubic, eventPos, near, range, rng, smoothstep } from '../../world/util';
import { Brain, makeGlowMat, makeRim, newBrain, Shell } from './common';

const STRIKES = 6, FL = 7, SP = 22;
const H = new THREE.Vector3(0, -0.45, 0); // impact point
const GROUND = -1.35;
const UP = new THREE.Vector3(0, 1, 0);

function limb(m: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return;
  m.position.copy(a).add(b).multiplyScalar(0.5);
  const d = new THREE.Vector3().subVectors(b, a);
  m.scale.set(1, d.length() / 1.34, 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}

export default function Oldowan() {
  const scene = useScene();
  const q = world.quality;
  const brain = useMemo(newBrain, []);
  const shellCtl = useMemo(() => ({ alpha: 0.5 }), []);
  const refs = {
    core: useRef<THREE.Group>(null), hammer: useRef<THREE.Group>(null), arm: useRef<THREE.Mesh>(null), arm2: useRef<THREE.Mesh>(null),
    flakes: useRef<THREE.InstancedMesh>(null), sparks: useRef<THREE.Points>(null), flash: useRef<THREE.Mesh>(null), beam: useRef<THREE.Mesh>(null),
    edge: useRef<THREE.Mesh>(null),
  };
  const R = useMemo(() => {
    const r = rng(21);
    const fl = Array.from({ length: STRIKES * FL }, () => ({ v: new THREE.Vector3((r() - 0.25) * 2.4, 1.2 + r() * 1.6, (r() - 0.5) * 1.6), s: 0.07 + r() * 0.1, sp: new THREE.Vector3(r() * 9, r() * 9, r() * 9), gx: (r() - 0.3) * 2.8, gz: (r() - 0.5) * 1.6 }));
    const sp = Array.from({ length: STRIKES * SP }, () => ({ v: new THREE.Vector3((r() - 0.3) * 4, 0.5 + r() * 3, (r() - 0.5) * 3), life: 0.1 + r() * 0.2 }));
    const coreGeo = new THREE.IcosahedronGeometry(0.72, 1);
    const pa = coreGeo.attributes.position, rr = rng(3);
    const disp = new Map<string, number>();
    for (let i = 0; i < pa.count; i++) {
      const k = `${pa.getX(i).toFixed(3)},${pa.getY(i).toFixed(3)},${pa.getZ(i).toFixed(3)}`;
      if (!disp.has(k)) disp.set(k, 0.85 + rr() * 0.3);
      const d = disp.get(k)!; pa.setXYZ(i, pa.getX(i) * d, pa.getY(i) * d * 0.9, pa.getZ(i) * d);
    }
    coreGeo.computeVertexNormals();
    const flakeGeo = new THREE.TetrahedronGeometry(1, 0); flakeGeo.scale(1, 0.25, 0.7);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRIKES * SP * 3), 3));
    sg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(STRIKES * SP), 1));
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(8.+aA*26.)/-mv.z*3.; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(3.,1.7,.6)*a*a*vA*uAlpha,1.); }',
    });
    const rim = makeRim('#ffc891', 0.12, 2.0),
      armRim = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#ffc891') } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vL; void main(){ vL=position.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vL; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.); float k=smoothstep(-.6,.5,vL); gl_FragColor=vec4(uColor*(.12+f*1.3)*k,1.); }',
      }), stoneRim = makeRim('#e8d6bd', 0.28, 1.3), hot = makeRim('#ffd9a0', 0.2, 1.4);
    const armGeo = new THREE.CapsuleGeometry(0.17, 1, 4, 12); armGeo.scale(1, 1, 1);
    const fingerGeo = new THREE.CapsuleGeometry(0.045, 0.2, 3, 8);
    const flash = makeGlowMat('#ffb060', 2.5);
    const beam = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2, 1.4), wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { armRim, fingerGeo, fl, sp, coreGeo, flakeGeo, sg, sparkMat, rim, stoneRim, hot, armGeo, flash, beam, edgeMat };
  }, []);
  useEffect(() => () => { R.coreGeo.dispose(); R.flakeGeo.dispose(); R.sg.dispose(); R.sparkMat.dispose(); R.rim.dispose(); R.armRim.dispose(); R.stoneRim.dispose(); R.hot.dispose(); R.armGeo.dispose(); R.fingerGeo.dispose(); R.flash.dispose(); R.beam.dispose(); R.edgeMat.dispose(); }, [R]);

  const dum = useMemo(() => new THREE.Object3D(), []);
  const hp = useMemo(() => new THREE.Vector3(), []);
  const shoulderR = useMemo(() => new THREE.Vector3(3.6, 2.4, -0.3), []);
  const shoulderL = useMemo(() => new THREE.Vector3(-3.6, -1.4, 0.2), []);
  const coreP = useMemo(() => new THREE.Vector3(-0.15, -0.8, 0), []);
  const nS = Math.max(8, Math.floor(SP * Math.max(0.5, q)));

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight;
    const prog = range(0.12, 0.9, t) * STRIKES;
    const k = Math.min(STRIKES - 1, Math.floor(prog)), f = prog - k;
    const done = Math.min(1, prog / STRIKES);
    // swing: raise (0..0.6), strike at 0.7, rebound
    const raise = f < 0.6 ? easeOutCubic(f / 0.6) : f < 0.7 ? 1 - (f - 0.6) / 0.1 : Math.max(0, 0.12 - (f - 0.7) * 0.5);
    const active = prog > 0.01 && prog < STRIKES ? 1 : 0;
    hp.set(H.x + 1.35 * raise * (0.7 + 0.3 * (k % 2)), H.y + 1.5 * raise + 0.38, H.z + 0.2 * raise);
    if (refs.hammer.current) { refs.hammer.current.position.copy(hp); refs.hammer.current.scale.setScalar(w); }
    limb(refs.arm.current, shoulderR, hp);
    const holdP = coreP.clone().add(new THREE.Vector3(-0.35, -0.55, 0.2));
    limb(refs.arm2.current, shoulderL, holdP);
    const hit = Math.max(0, 1 - Math.abs(f - 0.72) * 9) * active;
    if (refs.core.current) {
      const s = 1 - 0.38 * done;
      refs.core.current.position.set(coreP.x, coreP.y - hit * 0.03, coreP.z);
      refs.core.current.scale.set(s * 1.05, s * (1 - 0.1 * done), s * (1 + 0.15 * done)); refs.core.current.rotation.set(0, k * 0.7 + f * 0.3, hit * 0.04);
      refs.core.current.visible = true;
    }
    R.edgeMat.opacity = done * 0.35 * w + hit * 0.3;
    if (refs.flash.current) { refs.flash.current.scale.setScalar(0.4 + hit * 1.3); R.flash.uniforms.uAlpha.value = hit * w * 0.22; }
    // flakes
    const F = refs.flakes.current;
    if (F) {
      for (let i = 0; i < STRIKES * FL; i++) {
        const fk = Math.floor(i / FL), a = R.fl[i];
        const tau = prog - fk - 0.72;
        if (tau < 0 || fk >= STRIKES) { dum.scale.setScalar(0); dum.position.set(0, -9, 0); } else {
          const T = Math.min(tau * 1.6, 1.4);
          const air = Math.min(T, 0.5 + a.v.y * 0.12);
          let y = H.y + a.v.y * air - 3.8 * air * air;
          let x = H.x + a.v.x * air, z = a.v.z * air * 0.5;
          if (y < GROUND + a.s * 0.3) { y = GROUND + a.s * 0.3; x = H.x + (a.gx * Math.min(1, T * 1.4)) ; z = a.gz * Math.min(1, T * 1.4); }
          dum.position.set(x, y, z);
          const spin = Math.min(1, T * 2.2) < 1 ? T : 0.9;
          dum.rotation.set(a.sp.x * spin, a.sp.y * spin, a.sp.z * spin);
          dum.scale.setScalar(a.s * w);
        }
        dum.updateMatrix(); F.setMatrixAt(i, dum.matrix);
      }
      F.instanceMatrix.needsUpdate = true;
    }
    // sparks
    const P = refs.sparks.current;
    if (P) {
      const pos = P.geometry.attributes.position as THREE.BufferAttribute, aA = P.geometry.attributes.aA as THREE.BufferAttribute;
      for (let i = 0; i < STRIKES * SP; i++) {
        const sk = Math.floor(i / SP), a = R.sp[i];
        const tau = (prog - sk - 0.72) / a.life * 0.3;
        if (i % SP >= nS || tau < 0 || tau > 1) { aA.setX(i, 0); continue; }
        pos.setXYZ(i, H.x + a.v.x * tau * 0.6, H.y + 0.1 + a.v.y * tau * 0.6 - 2.2 * tau * tau, a.v.z * tau * 0.6);
        aA.setX(i, (1 - tau) * (1 - tau) * w);
      }
      pos.needsUpdate = true; aA.needsUpdate = true;
    }
    // brain: motor + parietal ignite with each strike
    const pulse = hit;
    brain.alpha = w * 0.95; brain.s = 1.25 + 0.15 * done;
    brain.motor = Math.min(1.2, 0.05 + done * 0.9 + pulse * 0.5);
    brain.par = Math.min(1.2, done * 0.8 + pulse * 0.4);
    brain.glow = pulse * 0.6; shellCtl.alpha = w * 0.35;
    R.beam.opacity = (pulse * 0.5 + done * 0.05) * w;
    if (refs.beam.current) { refs.beam.current.visible = R.beam.opacity > 0.01; }
    void eventPos; void near; void smoothstep;
  });

  return (
    <group>
      <group position={[0.2, 2.2, -0.5]} rotation={[0, -0.55, 0]} scale={0.95}>
        <Brain ctl={brain} />
        <Shell ctl={shellCtl} scale={[1.38, 1.1, 1]} />
      </group>
      <mesh ref={refs.beam} position={[0, 0.9, -0.5]} material={R.beam}><cylinderGeometry args={[0.012, 0.05, 2.4, 6]} /></mesh>
      <mesh ref={refs.arm2} geometry={R.armGeo} material={R.armRim} />
      <group position={[-0.5, -1.35, 0.25]}>
        <mesh material={R.rim} scale={[1.1, 0.7, 1]}><sphereGeometry args={[0.24, 18, 12]} /></mesh>
        {[-0.14, -0.05, 0.05, 0.14].map((z, i) => <mesh key={i} geometry={R.fingerGeo} material={R.rim} position={[0.2, 0.2, z]} rotation={[0, 0, -0.5]} />)}
      </group>
      <group ref={refs.core}>
        <mesh geometry={R.coreGeo} material={R.stoneRim} />
        <mesh ref={refs.edge} geometry={R.coreGeo} material={R.edgeMat} scale={1.01} />
      </group>
      <mesh ref={refs.arm} geometry={R.armGeo} material={R.armRim} />
      <group ref={refs.hammer}>
        <mesh material={R.hot}><sphereGeometry args={[0.28, 24, 16]} /></mesh>
        <mesh position={[0, 0.34, 0]} material={R.rim} scale={[1, 0.8, 1]}><sphereGeometry args={[0.24, 20, 14]} /></mesh>
        {[-0.15, -0.05, 0.05, 0.15].map((z, i) => <mesh key={i} geometry={R.fingerGeo} material={R.rim} position={[-0.12, 0.08, z]} rotation={[0, 0, 0.9]} />)}
      </group>
      <mesh ref={refs.flash} position={[H.x, H.y, 0.3]} material={R.flash}><planeGeometry args={[2, 2]} /></mesh>
      <instancedMesh ref={refs.flakes} args={[R.flakeGeo, R.stoneRim, STRIKES * FL]} frustumCulled={false} />
      <points ref={refs.sparks} geometry={R.sg} material={R.sparkMat} frustumCulled={false} />
    </group>
  );
}

export const oldowanCamera = (t: number) => ({ pos: [Math.sin(t * 2) * 0.5, 0.6, 6] as [number, number, number], look: [0, 0.75, 0] as [number, number, number], fov: 52 });
