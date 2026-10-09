import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range, rng, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const R = 2.5;
const NS = 240;

/** an archaeal host swallows a bacterium; it becomes the mitochondrion, multiplies and powers the cell (ATP sparks) */
export default function Eukaryote() {
  const scene = useScene();
  const h = useRef<AquaHandle>(null);
  const grp = useRef<THREE.Group>(null);
  // ATP sparks: drift outward from the daughter mitochondria
  const sparkGeo = useMemo(() => {
    const n = Math.floor(NS * world.quality), r = rng(66);
    const p = new Float32Array(n * 3), a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a.set([r(), r(), r(), r()], i * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(a, 4)); return g;
  }, []);
  const sparkMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uTime: { value: 0 }, uAtp: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx,uW,uTime,uAtp; attribute vec4 aR; varying vec3 vC; varying float vA;
      void main(){ float a=aR.x*6.2832, k=aR.y*6.2832; float rr=${(R * 0.62).toFixed(2)}*(.55+.45*aR.z);
        vec3 m=vec3(.25+cos(a)*rr*.9, sin(a)*rr*.8, (aR.w-.5)*1.2);
        float s=fract(aR.y+uTime*.12*(.5+aR.z)); vec3 dir=normalize(vec3(cos(k),sin(k)*cos(aR.x*9.),sin(aR.w*20.))+.001);
        vec3 p=m+dir*s*1.1; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,.06*(1.-s)*uPx/-mv.z); vC=vec3(1.6,1.15,.3); vA=uW*uAtp*(1.-s)*smoothstep(0.,.1,s); }`,
    fragmentShader: POINT_FRAG,
  }), []);
  useDispose(sparkGeo, sparkMat);
  const pEv = eventPos('eukaryotes');

  useFrame((state) => {
    if (!scene.active) return;
    const a = h.current; if (!a) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const approach = range(0.0, 0.26, t), contact = smoothstep(0.2, 0.34, t), inside = smoothstep(0.32, 0.48, t);
    const becomes = smoothstep(0.45, 0.66, t), clone = smoothstep(0.62, 0.95, t);
    const pulse = near(pEv, 0.55);
    const st = a.state;
    const d0 = THREE.MathUtils.lerp(3.2, 1.08, smoothstep(0, 1, approach));
    st.morph = THREE.MathUtils.lerp(d0, 0.5, inside);
    st.aux = contact * (1 - inside) * 1.0;
    st.grow = becomes; st.beat = clone;
    st.net = 0.35 + 0.65 * smoothstep(0.42, 0.75, t);
    a.look.w = w; a.look.glowK = 0.9 + pulse * 0.7 + becomes * 0.3;
    sparkMat.uniforms.uW.value = w; sparkMat.uniforms.uTime.value = time; sparkMat.uniforms.uPx.value = pxScale(state);
    sparkMat.uniforms.uAtp.value = becomes * (0.8 + pulse);
    if (grp.current) { grp.current.rotation.y = Math.sin(t * 2) * 0.2; grp.current.rotation.x = 0.1; }
  });

  return (
    <group>
      <Backdrop color="#6d6bff" caustics={0.08} shafts={0.08} haze={0.12} />
      <Plankton count={260} box={[20, 12, 8]} color="#a0b4ff" size={0.04} dir={[0.02, 0.0, 0]} />
      <group ref={grp}>
        <AquaCreature ref={h} kind="cell" params={{ radius: R }} />
        <points geometry={sparkGeo} material={sparkMat} frustumCulled={false} />
      </group>
    </group>
  );
}
