import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';

const SR = 2.3;

/** free cells swim together into a Volvox-like colony; some specialise */
export default function Multicell() {
  const scene = useScene();
  const N = Math.floor(520 * world.quality);
  const { geo, hair } = useMemo(() => {
    const r = rng(1234);
    const pos = new Float32Array(N * 3), dir = new Float32Array(N * 3), sc = new Float32Array(N * 4);
    const hp = new Float32Array(N * 2 * 3), hd = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      const dv: [number, number, number] = [Math.cos(th) * rad, y, Math.sin(th) * rad];
      dir.set(dv, i * 3);
      const a = r() * 6.28, b = Math.acos(2 * r() - 1), rr = 4 + r() * 8;
      const spec = r() < 0.07 ? 1 : 0;
      sc.set([Math.sin(b) * Math.cos(a) * rr, Math.cos(b) * rr * 0.6, Math.sin(b) * Math.sin(a) * rr - 2, spec + r() * 0.5], i * 4);
      for (let k = 0; k < 2; k++) { hd.set([dv[0], dv[1], dv[2], k], (i * 2 + k) * 4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aSc', new THREE.BufferAttribute(sc, 4));
    const h = new THREE.BufferGeometry();
    h.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    h.setAttribute('aDir', new THREE.BufferAttribute(hd, 4));
    const hs = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) hs.set(sc.subarray(i * 4, i * 4 + 4), (i * 2 + k) * 4);
    h.setAttribute('aSc', new THREE.BufferAttribute(hs, 4));
    return { geo: g, hair: h };
  }, [N]);

  const COMMON = /* glsl */ `
    uniform float uTime,uA,uSpin,uSpec; uniform float uPx,uW;
    vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
    vec3 cellPos(vec3 dir,vec4 sc){
      float e=smoothstep(.1,.9,clamp(uA*1.35-sc.w*.35,0.,1.));
      float spec=step(.99,sc.w)*smoothstep(0.,1.,uSpec); // germ cells sink inside
      vec3 sph=rotY(dir*${SR.toFixed(2)}*(1.-spec*.35),uSpin);
      vec3 scat=sc.xyz+vec3(sin(uTime*.4+sc.w*30.),cos(uTime*.33+sc.w*20.),sin(uTime*.27+sc.w*9.))*.5;
      return mix(scat,sph,e);
    }`;
  const cellMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uSpin: { value: 0 }, uSpec: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 } },
    vertexShader: /* glsl */ `${COMMON} attribute vec3 aDir; attribute vec4 aSc; varying vec3 vC; varying float vA;
      void main(){ vec3 p=cellPos(aDir,aSc); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        float spec=step(.99,aSc.w)*smoothstep(0.,1.,uSpec);
        float sz=.16+spec*.22; gl_PointSize=max(1.,sz*uPx/-mv.z);
        vec3 soma=vec3(.2,1.,.45), germ=vec3(1.7,1.1,.25);
        vC=mix(soma,germ,spec)*(.7+.5*sin(uTime*2.+aSc.w*20.)*.3);
        vA=uW*(.8+.4*spec); }`,
    fragmentShader: POINT_FRAG,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const hairMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uSpin: { value: 0 }, uSpec: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 } },
    vertexShader: /* glsl */ `${COMMON} attribute vec4 aDir; attribute vec4 aSc; varying vec3 vC; varying float vA;
      void main(){ vec3 p=cellPos(aDir.xyz,aSc);
        vec3 out_=normalize(rotY(aDir.xyz,uSpin));
        vec3 tip=out_*.55+vec3(sin(uTime*7.+aSc.w*40.),cos(uTime*6.+aSc.w*17.),sin(uTime*5.+aSc.w*9.))*.12;
        float isTip=aDir.w; vec3 q=p+tip*isTip*smoothstep(.5,.95,uA)*(1.-step(.99,aSc.w)*uSpec);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);
        vC=vec3(.4,1.,.8); vA=uW*.5*mix(.2,1.,1.-isTip); }`,
    fragmentShader: /* glsl */ `varying vec3 vC; varying float vA; void main(){ gl_FragColor=vec4(vC*vA,1.); }`,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const col = useRef<AquaHandle>(null);
  useDispose(geo, hair, cellMat, hairMat);

  // loose choanoflagellate-like singles drifting in the background (visible early)
  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const A = smoothstep(0.1, 0.62, t);
    const pulse = near(eventPos('multicellularity'), 0.6);
    const shell = smoothstep(0.5, 0.85, t);
    for (const m of [cellMat, hairMat]) {
      const u = m.uniforms;
      u.uTime.value = time; u.uA.value = A; u.uSpin.value = world.stationF * 0.5 + time * 0.25; u.uSpec.value = smoothstep(0.62, 0.9, t); u.uPx.value = px;
      u.uW.value = w * (1 + pulse * 0.6) * (m === cellMat ? 1 - 0.7 * shell : 1 - 0.8 * shell);
    }
    const c = col.current;
    if (c) {
      c.look.w = w * shell; c.state.grow = smoothstep(0.66, 0.95, t); c.look.glowK = 0.9 + pulse * 0.8;
      c.state.time = time;
    }
  });

  return (
    <group position={[0, 0.4, 0]}>
      <Backdrop color="#2fbf8a" caustics={0.4} shafts={0.35} haze={0.1} />
      <Plankton count={700} box={[20, 12, 9]} color="#a8ffd6" size={0.05} dir={[0.0, 0.05, 0]} />
      <SpinGroup>
        <AquaCreature ref={col} kind="colony" params={{ radius: SR * 1.01, cells: 8 }} />
      </SpinGroup>
      <lineSegments geometry={hair} material={hairMat} frustumCulled={false} />
      <points geometry={geo} material={cellMat} frustumCulled={false} />
    </group>
  );
}
void NOISE;

function SpinGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.rotation.y = world.stationF * 0.5 + timeNow() * 0.25; });
  return <group ref={g}>{children}</group>;
}
