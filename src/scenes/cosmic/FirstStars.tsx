import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { rng } from '../../world/util';
import { Glow, gauss, mkMat, makeGeo, pxScale, setGlow, useDispose } from './fx';

const gasVert = /* glsl */ `
attribute vec3 aA, aB, aOff; attribute vec4 aMisc;
uniform float uF, uPx, uW, uTime;
varying vec3 vCol; varying float vA;
void main(){
  float col=smoothstep(.2,1.5,uF);
  float e=aMisc.x<.5?0.:1.;
  float s=mix(aMisc.x,e,.5*col);
  vec3 p=mix(aA,aB,s); p.y-=sin(3.14159*s)*.8*(1.-col*.7);
  p+=aOff*(1.-.72*col)*(1.+.12*sin(uTime*.4+aMisc.w*20.));
  float lit=smoothstep(aMisc.y,aMisc.y+.35,uF);
  vCol=mix(vec3(.16,.12,.55),vec3(1.1,.4,.75),lit)*(1.+lit*1.2*aMisc.w);
  vA=uW*(.1+.3*col)*(.5+.9*lit);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp(aMisc.z*uPx/max(-mv.z,.1),1.,60.);
  gl_Position=projectionMatrix*mv;
}`;
const softFrag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float a=1.-d; a*=a; gl_FragColor=vec4(vCol*a*vA,1.); }`;

const starVert = /* glsl */ `
attribute vec3 aPos; attribute vec4 aMisc;
uniform float uF, uPx, uW, uTime;
varying vec3 vCol; varying float vA; varying float vSp;
void main(){
  float col=smoothstep(.2,1.5,uF);
  float dt=uF-aMisc.x;
  float on=smoothstep(0.,.02,dt);
  float flash=dt>0.?exp(-dt*20.)*6.:0.;
  float tw=.85+.15*sin(uTime*3.+aMisc.w*90.);
  vec3 p=aPos*(1.15-.35*col);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  float sz=aMisc.y*on*(1.+flash*.5);
  gl_PointSize=clamp(sz*uPx/max(-mv.z,.1),0.,90.);
  gl_Position=projectionMatrix*mv;
  vec3 base=mix(vec3(.55,.75,1.7),vec3(1.7,1.55,1.3),aMisc.w*.35);
  vCol=base*(.9+aMisc.z*1.6+flash*2.)*tw;
  vA=uW*on; vSp=flash;
}`;
const starFrag = /* glsl */ `
varying vec3 vCol; varying float vA; varying float vSp;
void main(){ vec2 q=gl_PointCoord-.5; float d=length(q)*2.; if(d>1.) discard;
  float core=exp(-d*d*9.); float halo=.25*(1.-d)*(1.-d);
  float spike=(exp(-abs(q.x)*60.)*exp(-abs(q.y)*5.)+exp(-abs(q.y)*60.)*exp(-abs(q.x)*5.))*(.3+vSp*.3);
  gl_FragColor=vec4(vCol*(core+halo+spike)*vA,1.); }`;

const snVert = /* glsl */ `
attribute vec4 aC; attribute vec4 aD; attribute vec4 aCol;
uniform float uF, uPx, uW;
varying vec3 vCol; varying float vA;
void main(){
  float age=max(uF-aC.w,0.)*2.2;
  float on=step(0.,uF-aC.w);
  vec3 p=aC.xyz+aD.xyz*aD.w*3.6*(1.-exp(-3.2*age))+aD.xyz*aD.w*.25*age;
  vCol=aCol.rgb*(1.+4.*exp(-age*5.));
  vA=on*uW*(.35+.65*exp(-age*1.1));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp(aCol.w*uPx/max(-mv.z,.1),1.,24.);
  gl_Position=projectionMatrix*mv;
}`;

const ELEMENTS: Array<[number, number, number]> = [
  [1.5, 0.45, 0.9], // hydrogen/helium shock pinks
  [1.7, 1.3, 0.3], // carbon gold
  [0.2, 1.3, 1.1], // oxygen teal
  [1.8, 0.45, 0.15], // iron/nickel orange-red
  [0.7, 0.45, 1.7], // silicon violet
  [0.5, 1.5, 0.5], // nitrogen-ish green
];

export default function FirstStars() {
  const scene = useScene();
  const q = world.quality;
  const glows = useRef<Array<THREE.Mesh | null>>([]);

  const data = useMemo(() => {
    const r = rng(77);
    const NN = 14;
    const nodes: THREE.Vector3[] = [];
    const tn: number[] = [];
    for (let i = 0; i < NN; i++) {
      nodes.push(new THREE.Vector3((r() - 0.5) * 24, (r() - 0.5) * 12, -20 + r() * 22));
      tn.push(0.66 + r() * 0.5);
    }
    // supernova nodes
    const snNodes: number[] = [];
    const order = [...Array(NN).keys()].sort((a, b) => tn[a] - tn[b]);
    for (let k = 0; k < 8; k++) snNodes.push(order[k]);
    const ts = new Map<number, number>();
    snNodes.forEach((n, k) => ts.set(n, tn[n] + 0.22 + (k % 4) * 0.08 + r() * 0.1));
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < NN; i++) {
      const d = nodes.map((n, j) => [n.distanceTo(nodes[i]), j] as const).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 2; k++) edges.push([i, d[k][1]]);
    }
    // gas
    const G = Math.floor(13000 * q);
    const A = new Float32Array(G * 3), B = new Float32Array(G * 3), O = new Float32Array(G * 3), M = new Float32Array(G * 4);
    for (let i = 0; i < G; i++) {
      const [ia, ib] = edges[Math.floor(r() * edges.length)];
      const a = nodes[ia], b = nodes[ib];
      A.set([a.x, a.y, a.z], i * 3); B.set([b.x, b.y, b.z], i * 3);
      const wid = 0.2 + r() * 0.5;
      O.set([gauss(r) * wid, gauss(r) * wid, gauss(r) * wid], i * 3);
      const s = r();
      M.set([s, s < 0.5 ? tn[ia] : tn[ib], 0.12 + r() * 0.22, r()], i * 4);
    }
    // stars
    const S = Math.floor(520 * q);
    const P = new Float32Array(S * 3), SM = new Float32Array(S * 4);
    for (let i = 0; i < S; i++) {
      const n = Math.floor(r() * NN);
      const spread = 0.35 + r() * 1.1;
      P.set([nodes[n].x + gauss(r) * spread, nodes[n].y + gauss(r) * spread, nodes[n].z + gauss(r) * spread], i * 3);
      const mass = Math.pow(r(), 2);
      SM.set([tn[n] + r() * 0.14, 0.05 + mass * 0.16, mass, r()], i * 4);
    }
    // supernova particles
    const PER = Math.floor(600 * q);
    const NS = snNodes.length;
    const C = new Float32Array(NS * PER * 4), D = new Float32Array(NS * PER * 4), CL = new Float32Array(NS * PER * 4);
    snNodes.forEach((n, k) => {
      for (let j = 0; j < PER; j++) {
        const i = k * PER + j;
        const th = r() * Math.PI * 2, z = r() * 2 - 1, s = Math.sqrt(1 - z * z);
        C.set([nodes[n].x, nodes[n].y, nodes[n].z, ts.get(n)!], i * 4);
        D.set([s * Math.cos(th), s * Math.sin(th), z, 0.25 + Math.pow(r(), 0.6) * 0.75], i * 4);
        const e = ELEMENTS[Math.floor(r() * ELEMENTS.length)];
        CL.set([e[0], e[1], e[2], 0.08 + r() * 0.1], i * 4);
      }
    });
    return { nodes, tn, ts, G, S, NS, PER, A, B, O, M, P, SM, C, D, CL };
  }, [q]);

  const { gasGeo, starGeo, snGeo } = useMemo(() => ({
    gasGeo: makeGeo(data.G, { aA: [data.A, 3], aB: [data.B, 3], aOff: [data.O, 3], aMisc: [data.M, 4] }),
    starGeo: makeGeo(data.S, { aPos: [data.P, 3], aMisc: [data.SM, 4] }),
    snGeo: makeGeo(data.NS * data.PER, { aC: [data.C, 4], aD: [data.D, 4], aCol: [data.CL, 4] }),
  }), [data]);
  useDispose(gasGeo, starGeo, snGeo);
  const U = useMemo(() => ({ uF: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 }, uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    U.uF.value = f; U.uPx.value = pxScale(state); U.uW.value = scene.weight; U.uTime.value = world.reduced ? 0 : world.time;
    data.nodes.forEach((n, i) => {
      const g = glows.current[i];
      const d1 = f - data.tn[i];
      let I = 0;
      let sc = 1.6;
      if (d1 > 0) { I += 2.0 * Math.exp(-d1 * 12) + 0.35 * Math.min(1, d1 * 6); }
      const ts = data.ts.get(i);
      let spike = 0.25;
      let cr = 0.8, cg = 0.9, cb = 1.3;
      if (ts !== undefined && f > ts) {
        const d2 = f - ts;
        I += 9 * Math.exp(-d2 * 9); sc += 5 * (1 - Math.exp(-d2 * 6)) * Math.exp(-d2 * 1.5);
        cr = 1.4; cg = 0.8; cb = 0.7; spike = 0.9;
      }
      if (g) { g.position.copy(n); setGlow(g, sc, I * scene.weight, cr, cg, cb, spike); }
    });
  });

  const mats = useMemo(() => ({ gas: mkMat(gasVert, softFrag, U), sn: mkMat(snVert, softFrag, U), star: mkMat(starVert, starFrag, U) }), [U]);
  useDispose(mats.gas, mats.sn, mats.star);
  return (
    <group>
      <points geometry={gasGeo} material={mats.gas} frustumCulled={false} />
      <points geometry={snGeo} material={mats.sn} frustumCulled={false} />
      <points geometry={starGeo} material={mats.star} frustumCulled={false} />
      {data.nodes.map((_, i) => <Glow key={i} meshRef={{ get current() { return glows.current[i] ?? null; }, set current(v) { glows.current[i] = v; } }} />)}
    </group>
  );
}
