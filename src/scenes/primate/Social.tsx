import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
import { ambientTime } from './common';

const NODE_V = /* glsl */ `
attribute float aThr; attribute vec3 aCol; attribute float aR;
uniform float uGrow, uOp, uTime, uBeat;
varying vec3 vC; varying float vA;
void main(){
  float on = smoothstep(aThr, aThr+.06, uGrow);
  float size = (.5 + uGrow*.9)*aR;       // neocortex ratio rises with group size
  float pulse = .75+.25*sin(uTime*1.4+aThr*40.);
  vC = aCol*(1.2+uBeat*.8)*pulse;
  vA = on*uOp;
  vec4 mv = modelViewMatrix*vec4(position,1.);
  gl_PointSize = size*on*480./ -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const NODE_F = /* glsl */ `varying vec3 vC; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; float core=smoothstep(.35,.0,d); float halo=pow(smoothstep(1.,.0,d),2.5);
  float ring = smoothstep(.62,.55,d)*smoothstep(.45,.52,d)*.5;
  vec3 c = vC*(halo*.7+ring) + vec3(1.8,1.7,1.4)*core;
  gl_FragColor = vec4(c*vA, (halo+core)*vA); }`;

const EDGE_V = /* glsl */ `
attribute float aThr; attribute float aU; attribute float aH; attribute vec3 aCol;
uniform float uGrow, uOp, uTime, uBeat;
varying float vA; varying vec3 vC;
void main(){
  float on = smoothstep(aThr, aThr+.05, uGrow);
  float pos = fract(uTime*.22+aH);       // grooming pulse travelling along the edge
  float pulse = exp(-pow((aU-pos)*7.,2.));
  vA = on*uOp*(.16+pulse*1.1+uBeat*.2);
  vC = aCol;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const EDGE_F = /* glsl */ `varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC*vA*1.6, vA); }`;

const PALETTE = ['#ffb347', '#47d6c4', '#ff6fa8', '#8f9bff'];

export default function Social() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const nm = useRef<THREE.ShaderMaterial>(null);
  const em = useRef<THREE.ShaderMaterial>(null);

  const { nodeGeo, edgeGeo } = useMemo(() => {
    const r = rng(21);
    const N = Math.floor(64 * Math.max(0.6, world.quality));
    const cl = 4;
    const centers = Array.from({ length: cl }, () => new THREE.Vector3((r() - 0.5) * 7, (r() - 0.5) * 3.5, (r() - 0.5) * 5));
    const pts: THREE.Vector3[] = [], cid: number[] = [];
    for (let i = 0; i < N; i++) {
      const c = i % cl;
      pts.push(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(3.2).add(centers[c]));
      cid.push(c);
    }
    // join order: nodes appear in order of distance from the founder cluster
    const thr = pts.map((_, i) => 0.05 + (i / N) * 0.8);
    const pos = new Float32Array(N * 3), th = new Float32Array(N), col = new Float32Array(N * 3), rad = new Float32Array(N);
    const c = new THREE.Color();
    pts.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      th[i] = thr[i];
      c.set(PALETTE[cid[i]]);
      col.set([c.r, c.g, c.b], i * 3);
      rad[i] = 0.7 + r() * 0.6 + (i < 4 ? 0.5 : 0);
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setAttribute('aThr', new THREE.BufferAttribute(th, 1));
    ng.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    ng.setAttribute('aR', new THREE.BufferAttribute(rad, 1));

    const ep: number[] = [], et: number[] = [], eu: number[] = [], eh: number[] = [], ec: number[] = [];
    for (let i = 0; i < N; i++) {
      const ds = pts.map((q, j) => ({ j, d: q.distanceTo(pts[i]) })).filter((o) => o.j > i || true).sort((a, b) => a.d - b.d).slice(1, 7);
      ds.forEach((o, rank) => {
        if (o.j < i) return;
        const base = Math.max(thr[i], thr[o.j]);
        const t0 = base + 0.02 + rank * 0.045 + o.d * 0.01;
        const same = cid[i] === cid[o.j];
        const a = pts[i], b = pts[o.j];
        const h = r();
        const cc = new THREE.Color(same ? PALETTE[cid[i]] : '#ffffff');
        ep.push(a.x, a.y, a.z, b.x, b.y, b.z);
        et.push(t0, t0); eu.push(0, 1); eh.push(h, h);
        ec.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
      });
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ep), 3));
    eg.setAttribute('aThr', new THREE.BufferAttribute(new Float32Array(et), 1));
    eg.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(eu), 1));
    eg.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(eh), 1));
    eg.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(ec), 3));
    return { nodeGeo: ng, edgeGeo: eg };
  }, []);
  useEffect(() => () => { nodeGeo.dispose(); edgeGeo.dispose(); }, [nodeGeo, edgeGeo]);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t;
    const beat = near(eventPos('social-brain'), 0.6);
    const grow = smoothstep(0.08, 0.92, t);
    const tm = ambientTime() + t * 4;
    for (const m of [nm.current, em.current]) {
      if (!m) continue;
      m.uniforms.uGrow.value = grow; m.uniforms.uOp.value = scene.weight; m.uniforms.uTime.value = tm; m.uniforms.uBeat.value = beat;
    }
    if (grp.current) grp.current.rotation.y = lerp(-0.6, 0.7, t);
  });

  return (
    <group ref={grp} scale={1.6}>
      <lineSegments geometry={edgeGeo} frustumCulled={false}>
        <shaderMaterial ref={em} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={EDGE_V} fragmentShader={EDGE_F}
          uniforms={{ uGrow: { value: 0 }, uOp: { value: 0 }, uTime: { value: 0 }, uBeat: { value: 0 } }} />
      </lineSegments>
      <points geometry={nodeGeo} frustumCulled={false}>
        <shaderMaterial ref={nm} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={NODE_V} fragmentShader={NODE_F}
          uniforms={{ uGrow: { value: 0 }, uOp: { value: 0 }, uTime: { value: 0 }, uBeat: { value: 0 } }} />
      </points>
    </group>
  );
}

export const socialCamera = (t: number) => ({
  pos: [Math.sin(t * 1.2) * 2, lerp(2.5, 1, t), lerp(13, 9.5, t)] as [number, number, number],
  look: [0, 0, 0] as [number, number, number],
  fov: 50,
});
