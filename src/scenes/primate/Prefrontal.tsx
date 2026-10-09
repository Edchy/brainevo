import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { ambientTime } from './common';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const LOOP_V = /* glsl */ `
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute float aPh;
uniform float uTime, uOp, uLit, uGrow;
varying float vA;
void main(){
  float u = fract(aPh + uTime*.16);
  vec3 p0=aP0, p2=aP2; 
  vec3 p = (1.-u)*(1.-u)*p0 + 2.*(1.-u)*u*aP1 + u*u*p2;
  float head = smoothstep(0.,.1,u)*(1.-smoothstep(.85,1.,u));
  vA = head*uOp*uLit;
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_PointSize = (2.+head*2.)*30./ -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const LOOP_F = /* glsl */ `varying float vA;
void main(){ float g = smoothstep(.5,.0,length(gl_PointCoord-.5)); gl_FragColor = vec4(vec3(2.2,2.0,1.6)*g*vA, g*vA); }`;

export default function Prefrontal() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const lm = useRef<THREE.ShaderMaterial>(null);
  const brain = useBrainCtl({ grow: stageGrow('primate') * 0.97, tissue: '#d8d0cc' });
  const regs = useMemo(() => [
    { at: 'prefrontal' as const, color: '#ffc23c', i: 0 },
    { at: 'frontal' as const, color: '#ff9a1c', i: 0 },
  ], []);
  brain.regions = regs;

  const loopGeo = useMemo(() => {
    const defs = [
      [[1.7, 0.7, 0.45], [0.7, 2.5, 0.8], [-0.5, 1.35, 0.7]],
      [[1.6, 0.3, -0.5], [0, 2.2, -1.1], [-1.9, 0.5, -0.6]],
      [[1.9, 0.0, 0.3], [-0.2, -1.9, 0.9], [-1.5, -0.4, 0.8]],
    ];
    const per = Math.floor(34 * world.quality) + 10;
    const n = defs.length * per;
    const a0 = new Float32Array(n * 3), a1 = new Float32Array(n * 3), a2 = new Float32Array(n * 3), ph = new Float32Array(n);
    const pos = new Float32Array(n * 3);
    defs.forEach((d, k) => {
      for (let i = 0; i < per; i++) {
        const j = k * per + i;
        a0.set(d[0], j * 3); a1.set(d[1], j * 3); a2.set(d[2], j * 3);
        ph[j] = i / per + k * 0.17;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aP0', new THREE.BufferAttribute(a0, 3));
    g.setAttribute('aP1', new THREE.BufferAttribute(a1, 3));
    g.setAttribute('aP2', new THREE.BufferAttribute(a2, 3));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    return g;
  }, []);
  useEffect(() => () => { loopGeo.dispose(); }, [loopGeo]);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t;
    const tm = ambientTime();
    const beat = near(eventPos('prefrontal-expansion'), 0.7);
    const grow = smoothstep(0.1, 0.75, t);
    const lit = smoothstep(0.05, 0.6, t) * (0.85 + 0.3 * beat);
    const wave = lerp(-2.6, 3.2, (t * 2.2) % 1);
    brain.alpha = scene.weight;
    brain.grow = stageGrow('primate') * 0.95 + 0.05 * grow;
    brain.shape = { frontal: 0.25 + 0.75 * grow, cx: 1.7 + 0.2 * grow, cerS: 0.95 };
    regs[0].i = lit * (0.8 + 0.3 * Math.sin(tm * 2)) * 1.9;
    regs[1].i = lit * 0.8 * smoothstep(0.3, 0.8, t);
    for (const m of [lm.current]) {
      if (!m) continue;
      const u = m.uniforms;
      u.uTime.value = tm + t * 3; u.uOp.value = scene.weight; u.uGrow.value = grow; u.uLit.value = lit;
      if (u.uWave) u.uWave.value = wave;
    }
    if (grp.current) {
      grp.current.rotation.y = -1.2 + t * 0.8 + (world.reduced ? 0 : Math.sin(world.time * 0.2) * 0.05);
      grp.current.position.x = -0.6 * grow;
    }
  });

  return (
    <group ref={grp} scale={1.3} rotation={[0.08, 0, 0]}>
      <Brain ctl={brain} />
      <points geometry={loopGeo} frustumCulled={false}>
        <shaderMaterial ref={lm} transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={LOOP_V} fragmentShader={LOOP_F}
          uniforms={{ uGrow: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 }, uOp: { value: 0 } }} />
      </points>
    </group>
  );
}

export const prefrontalCamera = (t: number) => ({
  pos: [lerp(0.5, 2.5, t), lerp(1.4, 0.8, t), lerp(8.5, 7.2, t)] as [number, number, number],
  look: [lerp(-1.4, -0.8, t), 0.2, 0] as [number, number, number],
  fov: 50,
});
