import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
import { ambientTime } from './common';

const BRAIN_V = /* glsl */ `
attribute vec4 aD; // xyz dir, w part id
attribute float aS;
uniform float uGrow, uLit, uTime, uOp, uWave;
varying vec3 vC; varying float vA;
void main(){
  vec3 d = aD.xyz; float part = aD.w;
  vec3 p; float front = 0.;
  float gy = sin(d.x*9.+sin(d.y*6.)*1.5)*sin(d.y*8.+d.z*5.)*sin(d.z*7.+d.x*3.);
  if(part<.5){
    front = smoothstep(.15,.95,d.x);
    float r = 1.+.055*gy;
    vec3 rad = vec3(2.3,1.5,1.35);
    p = d*rad*r;
    p.x += front*uGrow*.55; p.y += front*uGrow*.12*d.y; p.z *= 1.+front*uGrow*.12;
    if(d.y<-.35) p.y *= .75; // temporal underside
  } else if(part<1.5){
    p = d*vec3(.85,.55,.8)+vec3(-1.45,-1.12,0.); p += .02*sin(d*40.);
  } else {
    p = vec3(-.2+d.x*.18,-1.1-abs(d.y)*.9, d.z*.18)+vec3(0.,-.2,0.)+vec3(.5,0.,0.)*d.y*.0;
  }
  float tw = .5+.5*sin(uTime*2.2+aS*40.);
  float wave = exp(-pow((p.x-uWave)*1.1,2.));
  float lit = front*uLit*(.55+.45*tw);
  vec3 base = mix(vec3(.15,.3,1.0), vec3(.5,.25,1.0), aS)*(.25+.5*tw+gy*1.4);
  if(part>.5) base = vec3(.2,.5,.7)*.45;
  vec3 gold = vec3(2.6,1.6,.45);
  vC = base + gold*lit*.7 + vec3(.5,.9,1.6)*wave*uLit*.6;
  vA = uOp*(part<.5? .8:.6);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_PointSize = (2.0+lit*2.2+wave*1.5)*(.7+aS*.6)*30./ -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const BRAIN_F = /* glsl */ `varying vec3 vC; varying float vA;
void main(){ float g = smoothstep(.5,.0,length(gl_PointCoord-.5)); gl_FragColor = vec4(vC*g*vA, g*vA); }`;

const LOOP_V = /* glsl */ `
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute float aPh;
uniform float uTime, uOp, uLit, uGrow;
varying float vA;
void main(){
  float u = fract(aPh + uTime*.16);
  vec3 p0=aP0, p2=aP2; p0.x += uGrow*.55*.8;
  vec3 p = (1.-u)*(1.-u)*p0 + 2.*(1.-u)*u*aP1 + u*u*p2;
  float head = smoothstep(0.,.1,u)*(1.-smoothstep(.85,1.,u));
  vA = head*uOp*uLit;
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_PointSize = (2.+head*2.)*30./ -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const LOOP_F = /* glsl */ `varying float vA;
void main(){ float g = smoothstep(.5,.0,length(gl_PointCoord-.5)); gl_FragColor = vec4(vec3(1.9,1.5,.7)*g*vA, g*vA); }`;

export default function Prefrontal() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const bm = useRef<THREE.ShaderMaterial>(null);
  const lm = useRef<THREE.ShaderMaterial>(null);

  const brainGeo = useMemo(() => {
    const r = rng(5);
    const nC = Math.floor(9000 * world.quality), nB = Math.floor(1600 * world.quality), nS = Math.floor(300 * world.quality);
    const n = nC + nB + nS;
    const aD = new Float32Array(n * 4), aS = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const part = i < nC ? 0 : i < nC + nB ? 1 : 2;
      const th = r() * Math.PI * 2, c = 2 * r() - 1, s = Math.sqrt(1 - c * c);
      aD.set([s * Math.cos(th), c, s * Math.sin(th), part], i * 4);
      aS[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aD', new THREE.BufferAttribute(aD, 4));
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    return g;
  }, []);
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
  useEffect(() => () => { brainGeo.dispose(); loopGeo.dispose(); }, [brainGeo, loopGeo]);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t;
    const tm = ambientTime();
    const beat = near(eventPos('prefrontal-expansion'), 0.7);
    const grow = smoothstep(0.1, 0.75, t);
    const lit = smoothstep(0.05, 0.6, t) * (0.85 + 0.3 * beat);
    const wave = lerp(-2.6, 3.2, (t * 2.2) % 1);
    for (const m of [bm.current, lm.current]) {
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
    <group ref={grp} scale={1.0} rotation={[0.08, 0, 0]}>
      <points geometry={brainGeo} frustumCulled={false}>
        <shaderMaterial ref={bm} transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={BRAIN_V} fragmentShader={BRAIN_F}
          uniforms={{ uGrow: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 }, uOp: { value: 0 }, uWave: { value: 0 } }} />
      </points>
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
  look: [lerp(0, 0.6, t), 0, 0] as [number, number, number],
  fov: 50,
});
