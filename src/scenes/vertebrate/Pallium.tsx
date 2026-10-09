import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM, latheX, makeBodyMat } from './shared';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const BOX: [number, number, number] = [20, 11, 8];

function odorMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 1 }, uFlow: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uFlow,uTime; varying float vA;
      void main(){ float k=fract(aR.x+uFlow); float x=mix(8.,4.0,k); float nar=(x-3.7)/4.3;
        vec3 p=vec3(x,0.05+(aR.y-.5)*2.4*nar+sin(k*9.+aR.w*20.)*.12,(aR.z-.5)*2.4*nar+cos(k*8.+aR.w*17.)*.12);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.07+aR.w*.06)*480./max(.3,-mv.z);
        vA=smoothstep(0.,.1,k)*(1.-smoothstep(.85,1.,k)); }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d);
        gl_FragColor=vec4(vec3(.5,1.,.7)*a*a*vA*uOp*1.4,1.); }`,
  });
}

/** fish forebrain: the pallium expands, fills with neurons and receives streams of smell */
export default function Pallium() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const brain = useBrainCtl({ grow: stageGrow('fish'), tissue: '#d6cdc9' });
  const regs = useMemo(() => [
    { at: 'pallium' as const, color: '#ffb23c', i: 0 },
    { at: 'olfactory' as const, color: '#3cffb0', i: 0 },
  ], []);
  brain.regions = regs;
  const S = useMemo(() => {
    const on = Math.floor(500 * world.quality);
    const og = new THREE.BufferGeometry();
    const r = rng(22);
    const orr = new Float32Array(on * 4);
    for (let i = 0; i < orr.length; i++) orr[i] = r();
    og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(on * 3), 3)); og.setAttribute('aR', new THREE.BufferAttribute(orr, 4));
    const head = latheX((x) => 1.05 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 0.2) / 3.3, 2))) * (x > 1.5 ? 0.9 : 1), -3.1, 3.5, 80, 44, 0.95);
    return { og, om: odorMat(), head, headM: makeBodyMat('#58b8ff', { rim: 0.4, base: 0.008 }) };
  }, []);
  useEffect(() => () => { S.og.dispose(); S.om.dispose(); S.head.dispose(); S.headM.dispose(); }, [S]);
  const p22 = eventPos('pallium-fish-forebrain');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, tm = TM(), n = near(p22, 0.8);
    const ex = smoothstep(0.1, 0.85, scene.t);
    brain.alpha = w;
    brain.shape = { cerS: 0.8 + ex * 0.75, fold: ex * 0.12, fiss: 0.7 - ex * 0.15, hemi: 1 - ex * 0.35 };
    const pulse = 0.5 + 0.5 * Math.sin(tm * 2.2);
    regs[0].i = ex * (0.35 + 0.5 * pulse) + n * 0.5;
    regs[1].i = (0.3 + 0.5 * Math.sin(scene.t * 28)) * (1 - ex * 0.4) * 0.8 + n * 0.3;
    S.om.uniforms.uOp.value = w; S.om.uniforms.uFlow.value = scene.t * 5 + tm * 0.05; S.om.uniforms.uTime.value = tm;
    S.headM.uniforms.uOpacity.value = w * 0.8;
    if (grp.current) grp.current.rotation.y = -0.55 + scene.t * 0.7;
  });
  return (
    <group>
      <Backdrop top="#3a1a2a" bottom="#02030a" ray={0.25} />
      <Plankton count={500} box={BOX} color="#ffb3a0" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={grp} position={[-0.4, 0.1, 0]} scale={1.35}>
        <mesh geometry={S.head} material={S.headM} position={[0, -0.3, 0]} scale={[1.0, 0.95, 0.95]} frustumCulled={false} />
        <Brain ctl={brain} position={[-0.6, 0.15, 0]} />
        <points geometry={S.og} material={S.om} frustumCulled={false} position={[-0.6, 0.15, 0]} />
      </group>
    </group>
  );
}
