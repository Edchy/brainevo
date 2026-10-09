import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeOutCubic, range, rng, smoothstep } from '../../world/util';
import { makeGlowMat, newBrain } from './common';
import { ik, makeSkin, seg, taperGeo } from './limbs';

const STRIKES = 6, FL = 5, SP = 34;
const GROUND = -1.2;
const G = 7;
const H = new THREE.Vector3(0.32, 0.02, 0.1); // contact point on the core edge
const C = new THREE.Vector3(-0.12, -0.32, 0); // core centre
const BRAIN = new THREE.Vector3(0.3, 2.55, -0.6);
const SH_R = new THREE.Vector3(3.9, 0.9, -0.3);
const SH_L = new THREE.Vector3(-3.5, -1.7, 0.3);
const A = 1.95, B = 1.9;

function lumpy(radius: number, seed: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pa = g.attributes.position, r = rng(seed), disp = new Map<string, number>();
  for (let i = 0; i < pa.count; i++) {
    const k = `${pa.getX(i).toFixed(3)},${pa.getY(i).toFixed(3)},${pa.getZ(i).toFixed(3)}`;
    if (!disp.has(k)) disp.set(k, 0.82 + r() * 0.36);
    const d = disp.get(k)!; pa.setXYZ(i, pa.getX(i) * d, pa.getY(i) * d * 0.9, pa.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

export default function Oldowan() {
  const scene = useScene();
  const q = world.quality;
  const brain = useMemo(newBrain, []);
  const shellCtl = useMemo(() => ({ alpha: 0.5 }), []);
  const refs = {
    core: useRef<THREE.Group>(null), hammer: useRef<THREE.Group>(null),
    uR: useRef<THREE.Mesh>(null), fR: useRef<THREE.Mesh>(null), eR: useRef<THREE.Mesh>(null), hR: useRef<THREE.Group>(null),
    uL: useRef<THREE.Mesh>(null), fL: useRef<THREE.Mesh>(null), eL: useRef<THREE.Mesh>(null), hL: useRef<THREE.Group>(null),
    flakes: useRef<THREE.InstancedMesh>(null), sparks: useRef<THREE.Points>(null),
    flash: useRef<THREE.Mesh>(null), ring: useRef<THREE.Mesh>(null), pulse: useRef<THREE.Mesh>(null), beam: useRef<THREE.Mesh>(null),
    ground: useRef<THREE.Mesh>(null),
  };
  const R = useMemo(() => {
    const r = rng(21);
    const fl = Array.from({ length: STRIKES * FL }, () => ({
      v: new THREE.Vector3(1.0 + r() * 2.6, 0.9 + r() * 2.4, (r() - 0.5) * 2.2), s: 0.07 + r() * 0.08,
      sp: new THREE.Vector3((r() - 0.5) * 16, (r() - 0.5) * 16, (r() - 0.5) * 16), e: r(),
    }));
    const sp = Array.from({ length: STRIKES * SP }, () => ({ v: new THREE.Vector3(-1 + r() * 5, -0.4 + r() * 3.2, (r() - 0.5) * 3), life: 0.25 + r() * 0.35 }));
    const coreGeo = lumpy(0.62, 3), hamGeo = lumpy(0.34, 11, 1);
    const flakeGeo = new THREE.TetrahedronGeometry(1, 0); flakeGeo.scale(1.0, 0.22, 0.65);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRIKES * SP * 3), 3));
    sg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(STRIKES * SP), 1));
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(6.+aA*20.)/-mv.z*3.; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.4,1.9,1.3)*a*a*vA*uAlpha,1.); }',
    });
    const skin = makeSkin('#c98f66', '#ffcf9a', { rimPow: 2.0 });
    const stone = makeSkin('#4a4740', '#fff6e8', { flat: true, rimPow: 1.5 });
    const hamStone = makeSkin('#44413a', '#fff3de', { flat: true, rimPow: 1.5 });
    const flake = makeSkin('#2a2823', '#fff6e6', { flat: true, rimPow: 1.4 });
    const flash = makeGlowMat('#fff2dc', 3);
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.95, 0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const beam = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const groundM = makeGlowMat('#ffb878', 2.2);
    const pulseM = makeGlowMat('#ffd9a0', 2.5);
    return {
      fl, sp, coreGeo, hamGeo, flakeGeo, sg, sparkMat, skin, stone, hamStone, flake, flash, ringM, beam, groundM, pulseM,
      limb: taperGeo(0.62), finger: new THREE.CapsuleGeometry(0.052, 0.2, 3, 8), joint: new THREE.SphereGeometry(1, 16, 12),
      ringG: new THREE.RingGeometry(0.92, 1, 48),
    };
  }, []);
  useEffect(() => () => {
    R.coreGeo.dispose(); R.hamGeo.dispose(); R.flakeGeo.dispose(); R.sg.dispose(); R.sparkMat.dispose(); R.skin.dispose(); R.stone.dispose(); R.hamStone.dispose(); R.flake.dispose();
    R.flash.dispose(); R.ringM.dispose(); R.beam.dispose(); R.groundM.dispose(); R.pulseM.dispose(); R.limb.dispose(); R.finger.dispose(); R.joint.dispose(); R.ringG.dispose();
  }, [R]);

  const dum = useMemo(() => new THREE.Object3D(), []);
  const V = useMemo(() => ({ P: new THREE.Vector3(), W: new THREE.Vector3(), E: new THREE.Vector3(), W2: new THREE.Vector3(), pole: new THREE.Vector3(0.6, -0.55, -0.2), poleA: new THREE.Vector3(0.9, 0.4, -0.2), poleB: new THREE.Vector3(0.4, -0.35, -0.2), poleL: new THREE.Vector3(-0.25, -0.6, 0.7), tmp: new THREE.Vector3() }), []);
  const nS = Math.max(10, Math.floor(SP * Math.max(0.5, q)));

  useFrame((st) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight;
    const prog = range(0.1, 0.92, t) * STRIKES;
    const k = Math.min(STRIKES - 1, Math.floor(prog)), f = prog - k;
    const done = Math.min(1, prog / STRIKES);
    const active = prog > 0.01 && prog < STRIKES ? 1 : 0;
    // swing: wind-up (0..0.6), fast fall (0.6..0.72), rebound
    const reach = 0.7 + 0.3 * (k % 2);
    let raise: number;
    if (f < 0.6) raise = easeOutCubic(f / 0.6); else if (f < 0.72) { const u = (f - 0.6) / 0.12; raise = 1 - u * u; } else raise = Math.max(0, 0.16 * Math.exp(-(f - 0.72) * 10) * Math.sin((f - 0.72) * 22 + 0.5));
    const sinceHit = f - 0.72;
    const hit = f >= 0.72 && active ? Math.exp(-sinceHit * 15) : Math.max(0, 1 - (0.72 - f) * 14) * 0.25 * active;
    // positions
    V.P.set(H.x + 0.17 + 0.2 * raise * reach, H.y + 0.19 + 0.34 * raise, H.z + 0.1);
    V.W.set(V.P.x + 0.32, V.P.y + 0.42, V.P.z + 0.05);
    if (refs.hammer.current) { refs.hammer.current.position.copy(V.P); refs.hammer.current.rotation.set(0, 0, -0.5 * raise + 0.2); refs.hammer.current.scale.setScalar(w); }
    V.pole.lerpVectors(V.poleB, V.poleA, raise);
    ik(SH_R, V.W, A, B, V.pole, V.E);
    seg(refs.uR.current, SH_R, V.E, 0.14); seg(refs.fR.current, V.E, V.W, 0.105);
    if (refs.eR.current) { refs.eR.current.position.copy(V.E); refs.eR.current.scale.setScalar(0.125); }
    if (refs.hR.current) { refs.hR.current.position.copy(V.P); refs.hR.current.scale.setScalar(w * 1.15); }
    // core + holding hand
    const s = 1 - 0.36 * done;
    if (refs.core.current) {
      refs.core.current.position.set(C.x - hit * 0.0, C.y - hit * 0.05, C.z);
      refs.core.current.scale.set(s * 1.05, s * (1 - 0.08 * done), s * (1 + 0.1 * done));
      refs.core.current.rotation.set(0.1, k * 0.7 + f * 0.25, hit * 0.05);
    }
    V.tmp.set(C.x - 0.12, C.y - 0.38 * s - 0.1, C.z + 0.12); // hand centre under core
    V.W2.set(V.tmp.x - 0.22, V.tmp.y - 0.12, V.tmp.z + 0.08);
    ik(SH_L, V.W2, A, B, V.poleL, V.E);
    seg(refs.uL.current, SH_L, V.E, 0.14); seg(refs.fL.current, V.E, V.W2, 0.105);
    if (refs.eL.current) { refs.eL.current.position.copy(V.E); refs.eL.current.scale.setScalar(0.125); }
    if (refs.hL.current) { refs.hL.current.position.copy(V.tmp); refs.hL.current.scale.setScalar(w); refs.hL.current.rotation.z = -0.2; }
    for (const m of [R.skin, R.stone, R.hamStone, R.flake]) { m.uniforms.uAlpha.value = w; }
    R.hamStone.uniforms.uHotAmt.value = hit * 0.5; R.stone.uniforms.uHotAmt.value = hit * 0.9;
    // flash, ring, ground
    if (refs.flash.current) {
      refs.flash.current.position.set(H.x, H.y, H.z + 0.35); refs.flash.current.quaternion.copy(st.camera.quaternion);
      const fs = 0.5 + hit * 1.6; refs.flash.current.scale.set(fs, fs, 1); R.flash.uniforms.uAlpha.value = hit * hit * 1.1 * w;
    }
    if (refs.ring.current) {
      refs.ring.current.position.set(H.x, H.y, H.z + 0.3); refs.ring.current.quaternion.copy(st.camera.quaternion);
      const rs = 0.15 + Math.max(0, sinceHit) * 5; refs.ring.current.scale.set(rs, rs, 1);
      R.ringM.opacity = f >= 0.72 ? Math.exp(-sinceHit * 11) * 0.5 * w * active : 0;
    }
    R.groundM.uniforms.uAlpha.value = 0;
    // flakes: ballistic arcs with one bounce
    const F = refs.flakes.current;
    if (F) {
      for (let i = 0; i < STRIKES * FL; i++) {
        const fk = Math.floor(i / FL), a = R.fl[i];
        const tau = prog - fk - 0.72;
        if (tau < 0 || fk >= STRIKES || (i % FL) >= Math.max(4, Math.floor(FL * Math.max(0.5, q)))) { dum.scale.setScalar(0); dum.position.set(0, -9, 0); } else {
          const T = tau * 1.9, rest = GROUND + a.s * 0.25;
          const tl = (a.v.y + Math.sqrt(a.v.y * a.v.y + 2 * G * Math.max(0.01, H.y - rest))) / G;
          const vb = 0.3 * (G * tl - a.v.y), tb = 2 * vb / G;
          let y: number, Tm: number;
          if (T < tl) { y = H.y + a.v.y * T - 0.5 * G * T * T; Tm = T; } else { const T2 = T - tl; y = T2 < tb ? rest + vb * T2 - 0.5 * G * T2 * T2 : rest; Tm = Math.min(T, tl + tb); }
          const xv = a.v.x * (T < tl ? T : tl + (Math.min(T, tl + tb) - tl) * 0.35);
          dum.position.set(H.x + 0.15 + xv, y, H.z + a.v.z * Math.min(Tm, tl) * 0.55);
          dum.rotation.set(a.sp.x * Tm, a.sp.y * Tm, a.sp.z * Tm);
          dum.scale.setScalar(a.s * w * Math.min(1, tau * 14) * (1 - smoothstep(0.3, 0.75, tau)));
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
        const tau = (prog - sk - 0.72) * 1.9;
        if (i % SP >= nS || tau < 0 || tau > a.life) { aA.setX(i, 0); continue; }
        const u = tau / a.life;
        pos.setXYZ(i, H.x + a.v.x * tau * 0.8, H.y + a.v.y * tau * 0.8 - 3 * tau * tau, H.z + 0.1 + a.v.z * tau * 0.6);
        aA.setX(i, (1 - u) * (1 - u) * w);
      }
      pos.needsUpdate = true; aA.needsUpdate = true;
    }
    // neural pulse travels from impact to brain, then the brain ignites
    const travel = f >= 0.72 && active ? Math.min(1, (f - 0.72) / 0.14) : 0;
    const arrive = f >= 0.86 && active ? Math.exp(-(f - 0.86) * 9) : (k > 0 && f < 0.72 ? Math.exp(-(f + 0.14) * 9) * 0.6 : 0);
    if (refs.pulse.current) {
      const e = travel * travel * (3 - 2 * travel);
      refs.pulse.current.position.set(H.x + (BRAIN.x - H.x) * e, H.y + (BRAIN.y - 0.7 - H.y) * e, 0.2); refs.pulse.current.quaternion.copy(st.camera.quaternion);
      const ps = 0.35 + 0.15 * Math.sin(travel * 3.14); refs.pulse.current.scale.set(ps, ps, 1);
      R.pulseM.uniforms.uAlpha.value = travel > 0 && travel < 1 ? 0.8 * w : 0;
    }
    brain.alpha = w * 0.95; brain.s = 1.0 + 0.1 * done + arrive * 0.03;
    brain.motor = Math.min(1.3, 0.05 + done * 0.7 + arrive * 0.9);
    brain.par = Math.min(1.2, done * 0.7 + arrive * 0.6);
    brain.glow = arrive * 0.7; shellCtl.alpha = w * 0.35;
    R.beam.opacity = (travel > 0 && travel < 1 ? 0.18 : 0) * w + done * 0.03 * w;
  });

    return (
    <group>
      <group ref={refs.core}>
        <mesh geometry={R.coreGeo} material={R.stone} />
      </group>

      <group ref={refs.hammer}>
        <mesh geometry={R.hamGeo} material={R.hamStone} />
      </group>

      <mesh ref={refs.flash} material={R.flash}><planeGeometry args={[2, 2]} /></mesh>
      <mesh ref={refs.ring} material={R.ringM} geometry={R.ringG} />
      <instancedMesh ref={refs.flakes} args={[R.flakeGeo, R.flake, STRIKES * FL]} frustumCulled={false} />
      <points ref={refs.sparks} geometry={R.sg} material={R.sparkMat} frustumCulled={false} />
    </group>
  );
}

export const oldowanCamera = (t: number) => ({ pos: [Math.sin(t * 2) * 0.25, 0.25, 4.0] as [number, number, number], look: [0.35, 0.15, 0] as [number, number, number], fov: 42 });
