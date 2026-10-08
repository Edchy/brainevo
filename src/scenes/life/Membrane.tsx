import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, range, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const NCH = 9;
const IONS = 16;
const chX = (i: number) => -7.2 + i * 1.8;
const NREC = 7;
const recX = (i: number) => -6 + i * 2;

/** Cutaway membrane: receptors catch signal molecules (chemical-signalling), channels open and a voltage spike sweeps (ion-channels). */
export default function Membrane() {
  const scene = useScene();
  const { headM, tailM } = useMemo(() => {
    const r = rng(77);
    const heads: THREE.Matrix4[] = [], tails: THREE.Matrix4[] = [];
    const d = new THREE.Object3D();
    for (let side = 0; side < 2; side++) {
      for (let ix = 0; ix < 60; ix++) for (let iz = 0; iz < 5; iz++) {
        const x = -9.5 + ix * 0.32 + (iz % 2) * 0.16, z = -0.8 + iz * 0.4 + (r() - 0.5) * 0.06;
        if (chX(0) > -99 && Array.from({ length: NCH }, (_, k) => Math.abs(x - chX(k)) < 0.5 && Math.abs(z) < 0.5).some(Boolean)) continue;
        const y = (side ? -1 : 1) * (0.55 + (r() - 0.5) * 0.03);
        d.position.set(x, y, z); d.scale.set(0.15, 0.15, 0.15); d.rotation.set(0, 0, 0); d.updateMatrix(); heads.push(d.matrix.clone());
        d.position.set(x, y * 0.48, z); d.scale.set(0.045, 0.52, 0.045); d.updateMatrix(); tails.push(d.matrix.clone());
      }
    }
    return { headM: heads, tailM: tails };
  }, []);

  const headMat = useMemo(() => makeGlass('#ffb86b', { rim: 0.8, fill: 0.12, power: 1.5 }), []);
  const tailMat = useMemo(() => makeGlass('#5fa0ff', { rim: 0.15, fill: 0.04, power: 1 }), []);
  const chMat = useMemo(() => makeGlass('#7fd0ff', { rim: 0.9, fill: 0.1, power: 1.6, noise: 3 }), []);
  const recMat = useMemo(() => makeGlass('#d58bff', { rim: 1.6, fill: 0.55, power: 1.4, noise: 3 }), []);
  const molMat = useMemo(() => makeGlass('#ffe28a', { rim: 2, fill: 1.8, power: 1 }), []);
  const heads = useRef<THREE.InstancedMesh>(null), tails = useRef<THREE.InstancedMesh>(null);
  const chs = useRef<THREE.InstancedMesh>(null), recs = useRef<THREE.InstancedMesh>(null), mols = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);

  // field: outside (+) / inside (-)
  const fieldMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uV: { value: 0 }, uSpike: { value: -20 }, uCas: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){vUv=uv;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec2 vUv; varying vec3 vP; uniform float uW,uTime,uV,uSpike,uCas; ${NOISE}
      void main(){
        float up=smoothstep(.55,4.,vP.y), dn=smoothstep(-.55,-4.,vP.y);
        float n=fbm(vec3(vP.xy*.6,uTime*.1));
        vec3 c=vec3(.9,.45,.15)*up*(.25+uV*.5)*(.4+n)+vec3(.1,.35,1.)*dn*(.15+uV*.7)*(.4+n);
        float sp=exp(-pow((vP.x-uSpike)*.7,2.));
        c+=vec3(.5,1.,1.4)*sp*smoothstep(1.2,.3,abs(vP.y))*1.6;
        c+=vec3(.9,.4,1.2)*uCas*dn*exp(-pow((vP.x),2.)*.04)*(.5+.5*sin(vP.y*3.-uTime*3.))*.5;
        c*=smoothstep(8.,2.5,abs(vP.y)); gl_FragColor=vec4(c*uW*.55,1.); }`,
  }), []);
  const ionMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx,uW; attribute vec4 aC; varying vec3 vC; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,aC.w*.2*uPx/-mv.z); vC=aC.xyz; vA=uW*clamp(aC.w*4.,0.,1.); }`,
    fragmentShader: POINT_FRAG,
  }), []);
  const ionGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NCH * IONS * 3), 3));
    const c = new Float32Array(NCH * IONS * 4);
    for (let i = 0; i < NCH * IONS; i++) {
      const na = i % 3 !== 0; c.set(na ? [1.6, 1.1, 0.35] : [0.4, 1.4, 1.9], i * 4); c[i * 4 + 3] = 0;
    }
    g.setAttribute('aC', new THREE.BufferAttribute(c, 4));
    return g;
  }, []);
  // intracellular cascade
  const casGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NREC * 6 * 3), 3));
    const c = new Float32Array(NREC * 6 * 4);
    for (let i = 0; i < NREC * 6; i++) { c.set([1.5, 0.6, 1.8, 0], i * 4); }
    g.setAttribute('aC', new THREE.BufferAttribute(c, 4));
    return g;
  }, []);
  useDispose(headMat, tailMat, chMat, recMat, molMat, fieldMat, ionMat, ionGeo, casGeo);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const ph2 = smoothstep(0.42, 0.55, t); // ion phase
    const volt = smoothstep(0.45, 0.65, t);
    for (const m of [headMat, tailMat, chMat, recMat, molMat]) { m.uniforms.uW.value = w; m.uniforms.uTime.value = time; }
    chMat.uniforms.uW.value = w * (0.35 + 0.4 * ph2);
    const spikeX = THREE.MathUtils.lerp(-11, 11, range(0.6, 0.95, t));
    fieldMat.uniforms.uW.value = w; fieldMat.uniforms.uTime.value = time; fieldMat.uniforms.uV.value = volt;
    fieldMat.uniforms.uSpike.value = t > 0.58 && t < 0.97 ? spikeX : -30;
    fieldMat.uniforms.uCas.value = smoothstep(0.12, 0.3, t) * (1 - ph2);
    ionMat.uniforms.uPx.value = px; ionMat.uniforms.uW.value = w;
    const flash = near(eventPos('ion-channels'), 0.6);
    chMat.uniforms.uGlow.value = flash * 0.4;

    // receptors + signal molecules
    if (recs.current && mols.current) {
      for (let i = 0; i < NREC; i++) {
        const x = recX(i), start = 0.02 + i * 0.045;
        const bind = smoothstep(start + 0.06, start + 0.1, t);
        const open = bind * (1 - ph2);
        d.position.set(x, 1.05 + 0.35, 0); d.rotation.set(0, 0, 0); d.scale.set(0.27 + 0.1 * bind, 0.7 + 0.1 * bind, 0.27 + 0.1 * bind);
        d.scale.multiplyScalar(1 - ph2 * 0.8 + 0.0001);
        d.updateMatrix(); recs.current.setMatrixAt(i, d.matrix);
        const p = range(start, start + 0.1, t);
        const e = p * p * (3 - 2 * p);
        const mx = x + (1 - e) * (1.5 + (i % 3) * 0.7) * (i % 2 ? 1 : -1), my = 1.62 + (1 - e) * 4.2 + Math.sin(time * 2 + i) * 0.05 * (1 - e);
        d.position.set(mx, my, 0.1 * (i % 3)); d.scale.setScalar((0.14 + 0.05 * Math.sin(time * 6 + i) * (1 - bind)) * (1 - ph2) * (0.2 + 0.8 * Math.min(1, p * 8)));
        d.updateMatrix(); mols.current.setMatrixAt(i, d.matrix);
        // cascade nodes
        const pos = casGeo.attributes.position as THREE.BufferAttribute, col = casGeo.attributes.aC as THREE.BufferAttribute;
        for (let k = 0; k < 6; k++) {
          const q = range(start + 0.1 + k * 0.012, start + 0.14 + k * 0.012, t);
          const f = k / 5;
          pos.setXYZ(i * 6 + k, x + (0 - x) * f * 0.6 + Math.sin(f * 6 + i) * 0.25, -0.9 - f * 2.6, 0.1);
          col.setW(i * 6 + k, q * (1 - ph2) * (1.2 + 0.6 * Math.sin(time * 5 - k)));
        }
        pos.needsUpdate = true; col.needsUpdate = true;
        void open;
      }
      recs.current.instanceMatrix.needsUpdate = true; mols.current.instanceMatrix.needsUpdate = true;
    }
    // channels
    if (chs.current) {
      const pos = ionGeo.attributes.position as THREE.BufferAttribute, col = ionGeo.attributes.aC as THREE.BufferAttribute;
      for (let i = 0; i < NCH; i++) {
        const x = chX(i);
        const first = i === 0 ? 1 : 0;
        const op = Math.max(smoothstep(spikeX - 1.5, spikeX + 0.2, x) * smoothstep(spikeX + 6, spikeX + 2.5, x) * smoothstep(0.58, 0.64, t), first * ph2 * smoothstep(0.5, 0.6, t) * (1 - range(0.6, 0.7, t)));
        const open = Math.min(1, op + ph2 * 0.18);
        const gap = 0.11 + 0.3 * open;
        for (let s = 0; s < 2; s++) {
          d.position.set(x + (s ? 1 : -1) * (gap + 0.18), 0, 0); d.rotation.set(0, 0, 0);
          d.scale.set(0.15, 0.95, 0.4); d.updateMatrix(); chs.current.setMatrixAt(i * 2 + s, d.matrix);
        }
        for (let k = 0; k < IONS; k++) {
          const id = i * IONS + k;
          const s = (k / IONS + time * (0.28 + 0.1 * (k % 3))) % 1;
          const y = 2.8 - s * 5.6;
          const spread = Math.abs(y) < 0.6 ? 0.07 : 0.3 + Math.abs(y) * 0.08;
          pos.setXYZ(id, x + Math.sin(k * 7.3 + time * 1.3) * spread, y, Math.cos(k * 5.1 + time) * spread * 0.8);
          col.setW(id, ph2 * (0.3 + 0.7 * open) * (0.4 + 0.6 * (k % 4) / 3) * 1.4);
        }
      }
      chs.current.instanceMatrix.needsUpdate = true; pos.needsUpdate = true; col.needsUpdate = true;
    }
  });

  return (
    <group rotation={[0.18, 0, 0]}>
      <Backdrop color="#3bb3e0" caustics={0.12} shafts={0.1} haze={0.12} z={-12} />
      <Plankton count={400} box={[20, 10, 8]} color="#9fe8ff" size={0.04} dir={[0, 0, 0]} />
      <mesh material={fieldMat} position={[0, 0, -1.8]} frustumCulled={false}>
        <planeGeometry args={[30, 20]} />
      </mesh>
      <instancedMesh ref={(im) => { heads.current = im; if (im) { headM.forEach((x, i) => im.setMatrixAt(i, x)); im.instanceMatrix.needsUpdate = true; } }} args={[undefined, undefined, headM.length]} material={headMat} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
      </instancedMesh>
      <instancedMesh ref={(im) => { tails.current = im; if (im) { tailM.forEach((x, i) => im.setMatrixAt(i, x)); im.instanceMatrix.needsUpdate = true; } }} args={[undefined, undefined, tailM.length]} material={tailMat} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6, 1]} />
      </instancedMesh>
      <instancedMesh ref={chs} args={[undefined, undefined, NCH * 2]} material={chMat} frustumCulled={false}>
        <sphereGeometry args={[1, 20, 14]} />
      </instancedMesh>
      <instancedMesh ref={recs} args={[undefined, undefined, NREC]} material={recMat} frustumCulled={false}>
        <capsuleGeometry args={[0.5, 0.8, 4, 12]} />
      </instancedMesh>
      <instancedMesh ref={mols} args={[undefined, undefined, NREC]} material={molMat} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <points geometry={ionGeo} material={ionMat} frustumCulled={false} />
      <points geometry={casGeo} material={ionMat} frustumCulled={false} />
    </group>
  );
}
