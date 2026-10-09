import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, rng, smoothstep } from '../../world/util';
import { NOISE, makeGeo, mkMat, pxScale, useDispose } from './fx';

export const SURF_Y = 6;
/** lightning schedule in station units */
export const STRIKES = [2.96, 3.05, 3.15, 3.24, 3.34, 3.48, 3.64];
export function flashAt(f: number) {
  let m = 0;
  for (let i = 0; i < STRIKES.length; i++) {
    const d = f - STRIKES[i];
    m = Math.max(m, Math.exp(-(d * d) / 0.00012) + 0.55 * Math.exp(-((d - 0.022) * (d - 0.022)) / 0.00008));
  }
  return m;
}

/* ---------- ocean surface ---------- */
const oceanVert = /* glsl */ `
uniform float uTime, uAmp; varying vec3 vW; varying vec3 vN;
void main(){
  vec3 p=position;
  float ph1=p.x*.5+uTime*1.1, ph2=p.z*.7-uTime*.9, ph3=(p.x+p.z)*1.3+uTime*1.7;
  float h=(sin(ph1)*.5+sin(ph2)*.35+sin(ph3)*.15)*uAmp;
  vec4 w=modelMatrix*vec4(p.x,h,p.z,1.);
  w.y+=0.;
  vW=w.xyz;
  float dx=(cos(ph1)*.25+cos(ph3)*.2)*uAmp, dz=(cos(ph2)*.245+cos(ph3)*.2)*uAmp;
  vN=normalize(vec3(-dx,1.,-dz));
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const oceanFrag = /* glsl */ `
${NOISE}
uniform float uFlash, uTime, uCalm; uniform vec3 uBg; varying vec3 vW; varying vec3 vN;
void main(){
  vec3 V=normalize(cameraPosition-vW);
  vec3 n=normalize(vN+vec3(vnoise(vW*1.3+uTime*.3)-.5,0.,vnoise(vW*1.3-uTime*.3)-.5)*.25);
  float dist=length(vW-cameraPosition);
  vec3 col;
  if(gl_FrontFacing){
    float fr=pow(1.-max(dot(n,V),0.),3.);
    vec3 sky=vec3(.04,.07,.14)+vec3(.55,.65,1.)*uFlash;
    col=vec3(.002,.01,.022)+sky*fr*(.6+.4*uFlash)+vec3(.5,.6,1.)*pow(max(dot(reflect(-V,n),normalize(vec3(.1,.5,-1.))),0.),30.)*uFlash*3.;
    col=mix(col,uBg+vec3(.02,.03,.06)*uFlash*6.,smoothstep(40.,160.,dist));
  } else {
    float c=fbm(vec3(vW.x*.35,uTime*.25,vW.z*.35));
    float caustic=pow(smoothstep(.45,.9,c),2.);
    col=vec3(.02,.16,.24)*(.5+caustic*1.5)+vec3(.15,.35,.6)*uFlash*.8;
    col=mix(col,uBg,smoothstep(10.,70.,dist));
  }
  gl_FragColor=vec4(col,1.);
}`;

/* ---------- storm sky ---------- */
const skyFrag = /* glsl */ `
${NOISE}
uniform float uFlash, uTime, uAmt; varying vec3 vW;
void main(){
  vec2 q=vW.xz*.012;
  float c=fbm(vec3(q*2.,uTime*.02))*.7+fbm(vec3(q*6.,uTime*.04))*.3;
  float d=smoothstep(.35,.85,c);
  float dist=length(vW.xz-cameraPosition.xz);
  vec3 col=vec3(.015,.022,.04)*d+vec3(.4,.5,.9)*d*d*uFlash*1.0;
  gl_FragColor=vec4(col*uAmt*smoothstep(260.,60.,dist),1.);
}`;

/* ---------- rain ---------- */
const rainVert = /* glsl */ `
attribute vec4 aR; attribute float aEnd;
uniform float uTime, uAmt;
varying float vA;
void main(){
  float y=mod(aR.y-uTime*(26.+aR.w*8.),18.);
  vec3 p=vec3(aR.x+y*.08,${SURF_Y.toFixed(1)}+y,aR.z)+vec3(.08,1.,0.)*aEnd*.9;
  vA=uAmt*step(aR.w,uAmt)*(.18+.5*aEnd)*smoothstep(0.,1.,y);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const lineFrag = /* glsl */ `varying float vA; void main(){ gl_FragColor=vec4(vec3(.5,.7,1.1)*vA,1.); }`;

/* ---------- light shafts ---------- */
const shaftFrag = /* glsl */ `
uniform float uFlash, uTime, uI; varying vec2 vUv;
void main(){
  float x=1.-abs(vUv.x*2.-1.); float y=vUv.y;
  float a=x*x*y*y*(.5+.5*sin(vUv.x*14.+uTime*.6+vUv.y*3.));
  gl_FragColor=vec4(vec3(.1,.45,.6)*a*(uI+uFlash*1.5),1.);
}`;

/* ---------- molecules ---------- */
type Atom = { e: 'H' | 'C' | 'N' | 'O' | 'P'; p: [number, number, number] };
type Mol = { atoms: Atom[]; bonds: Array<[number, number]> };
const MOLS: Mol[] = [
  { atoms: [{ e: 'O', p: [0, 0, 0] }, { e: 'H', p: [0.78, 0.55, 0] }, { e: 'H', p: [-0.78, 0.55, 0] }], bonds: [[0, 1], [0, 2]] },
  { atoms: [{ e: 'C', p: [0, 0, 0] }, { e: 'H', p: [0.8, 0.8, 0.8] }, { e: 'H', p: [-0.8, -0.8, 0.8] }, { e: 'H', p: [-0.8, 0.8, -0.8] }, { e: 'H', p: [0.8, -0.8, -0.8] }], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  { atoms: [{ e: 'N', p: [0, 0, 0] }, { e: 'H', p: [0.8, 0.55, 0.2] }, { e: 'H', p: [-0.6, 0.55, 0.6] }, { e: 'H', p: [-0.3, 0.55, -0.8] }], bonds: [[0, 1], [0, 2], [0, 3]] },
  { atoms: [{ e: 'H', p: [-1.5, 0, 0] }, { e: 'C', p: [0, 0, 0] }, { e: 'N', p: [1.2, 0, 0] }], bonds: [[0, 1], [1, 2]] },
  { atoms: [{ e: 'C', p: [0, 0, 0] }, { e: 'O', p: [1.2, 0.3, 0] }, { e: 'H', p: [-0.7, 0.9, 0] }, { e: 'H', p: [-0.7, -0.9, 0] }], bonds: [[0, 1], [0, 2], [0, 3]] },
  { atoms: [{ e: 'N', p: [-1.3, -0.3, 0] }, { e: 'C', p: [0, 0, 0] }, { e: 'C', p: [1.3, -0.3, 0] }, { e: 'O', p: [1.4, 1.0, 0.2] }, { e: 'O', p: [2.4, -1.0, 0] }, { e: 'H', p: [-1.9, 0.4, 0.4] }], bonds: [[0, 1], [1, 2], [2, 3], [2, 4], [0, 5]] },
  { atoms: [{ e: 'P', p: [0, 0, 0] }, { e: 'O', p: [1.1, 0.7, 0] }, { e: 'O', p: [-1.1, 0.7, 0.2] }, { e: 'O', p: [0, -0.7, 1.1] }, { e: 'O', p: [0, -0.7, -1.1] }], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
];
const ECOL: Record<string, [THREE.Color, number]> = {
  H: [new THREE.Color(1.1, 1.15, 1.2), 0.24],
  C: [new THREE.Color(0.55, 0.62, 0.7), 0.38],
  N: [new THREE.Color(0.25, 0.5, 1.6), 0.36],
  O: [new THREE.Color(1.6, 0.22, 0.2), 0.36],
  P: [new THREE.Color(1.6, 0.8, 0.1), 0.46],
};
const MS = 0.6;
const N_MOL = 14;
const N_BEAD = 30;

interface Placed { home: THREE.Vector3; mol: Mol; ta: number; rot: THREE.Quaternion; scat: THREE.Vector3[]; ph: number; first: number }

export default function Soup() {
  const scene = useScene();
  const q = world.quality;
  const oceanU = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 1 }, uFlash: { value: 0 }, uCalm: { value: 0 }, uBg: { value: new THREE.Color('#02060e') } }), []);
  const skyU = useMemo(() => ({ uFlash: { value: 0 }, uTime: { value: 0 }, uAmt: { value: 1 } }), []);
  const rainU = useMemo(() => ({ uTime: { value: 0 }, uAmt: { value: 0 } }), []);
  const shaftU = useMemo(() => ({ uFlash: { value: 0 }, uTime: { value: 0 }, uI: { value: 0.15 } }), []);
  const snowU = useMemo(() => ({ uPx: { value: 800 }, uTime: { value: 0 }, uA: { value: 0 } }), []);
  const sparkU = useMemo(() => ({ uF: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 } }), []);
  const mats = useMemo(() => ({
    ocean: mkMat(oceanVert, oceanFrag, oceanU, { transparent: false, depthWrite: true, blending: THREE.NormalBlending, side: THREE.DoubleSide }),
    sky: mkMat(`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`, skyFrag, skyU),
    rain: mkMat(rainVert, lineFrag, rainU),
    shaft: mkMat(`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, shaftFrag, shaftU, { side: THREE.DoubleSide }),
    snow: mkMat(`attribute vec3 aP; attribute vec4 aM; uniform float uPx,uTime,uA; varying float vA;
              void main(){ vec3 p=aP+vec3(sin(uTime*.2+aM.x*30.),-mod(uTime*.12*(.5+aM.y)+aM.z*20.,16.)+8.,cos(uTime*.17+aM.y*30.))*vec3(.6,1.,.6); p.y=mod(p.y+8.,16.)-8.;
              vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=clamp((.03+.05*aM.w)*uPx/max(-mv.z,.1),1.,6.); vA=uA*(.12+.4*aM.w); gl_Position=projectionMatrix*mv; }`, `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; gl_FragColor=vec4(vec3(.5,.9,1.)*(1.-d)*vA,1.); }`, snowU),
    spark: mkMat(`attribute vec4 aS; uniform float uF,uPx,uW; varying float vA;
              void main(){ float dt=uF-aS.w; float fl=dt>0.?exp(-dt*16.):0.; vA=uW*fl*(dt>0.?1.:0.);
              vec4 mv=modelViewMatrix*vec4(aS.xyz,1.); gl_PointSize=clamp(.9*(.2+fl)*uPx/max(-mv.z,.1),0.,120.); gl_Position=projectionMatrix*mv; }`, `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float g=exp(-d*d*6.); gl_FragColor=vec4(vec3(1.4,1.8,3.)*g*vA*2.,1.); }`, sparkU),
  }), [oceanU, skyU, rainU, shaftU, snowU, sparkU]);
  useDispose(mats.ocean, mats.sky, mats.rain, mats.shaft, mats.snow, mats.spark);
  const atoms = useRef<THREE.InstancedMesh>(null);
  const bonds = useRef<THREE.InstancedMesh>(null);
  const bolts = useRef<Array<THREE.InstancedMesh | null>>([]);
  const underGroup = useRef<THREE.Group>(null);
  const aboveGroup = useRef<THREE.Group>(null);
  const hemi = useRef<THREE.AmbientLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);

  const D = useMemo(() => {
    const r = rng(2024);
    const placed: Placed[] = [];
    for (let i = 0; i < N_MOL; i++) {
      const mol = MOLS[Math.floor(Math.pow(r(), 1.2) * MOLS.length)];
      const scat: THREE.Vector3[] = mol.atoms.map(() => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(3));
      placed.push({
        home: new THREE.Vector3((r() - 0.5) * 11, (r() - 0.5) * 5, (r() - 0.5) * 6 - 3),
        mol, ta: 3.42 + r() * 0.5,
        rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), scat,
        ph: r() * 6.28, first: 0,
      });
    }
    let nA = 0, nB = 0;
    placed.forEach((p) => { nA += p.mol.atoms.length; nB += p.mol.bonds.length; });
    nA += N_BEAD; nB += N_BEAD - 1;
    // bolts: jagged polylines
    const boltSegs: Array<Array<[THREE.Vector3, THREE.Vector3]>> = [];
    for (let b = 0; b < STRIKES.length; b++) {
      const segs: Array<[THREE.Vector3, THREE.Vector3]> = [];
      let x = (r() - 0.5) * 36, z = -14 - r() * 20;
      let prev = new THREE.Vector3(x, 30, z);
      const n = 22;
      for (let i = 1; i <= n; i++) {
        x += (r() - 0.5) * 2.4; z += (r() - 0.5) * 0.8;
        const cur = new THREE.Vector3(x, 30 - (24 * i) / n, z);
        segs.push([prev, cur]);
        if (r() < 0.2 && i > 4) { // branch
          let bp = cur.clone();
          for (let k = 0; k < 5; k++) { const nx = bp.clone().add(new THREE.Vector3((r() - 0.3) * 2.5, -1 - r(), (r() - 0.5) * 0.5)); segs.push([bp, nx]); bp = nx; }
        }
        prev = cur;
      }
      boltSegs.push(segs);
    }
    // rain
    const NR = Math.floor(1300 * q);
    const R = new Float32Array(NR * 2 * 4), E = new Float32Array(NR * 2);
    for (let i = 0; i < NR; i++) {
      const v = [(r() - 0.5) * 40, r() * 18, -r() * 30 + 4, r()];
      R.set(v, i * 8); R.set(v, i * 8 + 4); E[i * 2 + 1] = 1;
    }
    const rainGeo = makeGeo(NR * 2, { aR: [R, 4], aEnd: [E, 1] });
    // marine snow
    const NS = Math.floor(700 * q);
    const SP = new Float32Array(NS * 3), SM = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) { SP.set([(r() - 0.5) * 30, (r() - 0.5) * 16, (r() - 0.5) * 24], i * 3); SM.set([r(), r(), r(), r()], i * 4); }
    const snowGeo = makeGeo(NS, { aP: [SP, 3], aM: [SM, 4] });
    const spark = new Float32Array(N_MOL * 4), sp = new Float32Array(N_MOL * 4);
    placed.forEach((p, i) => { spark.set([p.home.x, p.home.y, p.home.z, p.ta], i * 4); sp.set([r(), 0, 0, 0], i * 4); });
    const sparkGeo = makeGeo(N_MOL, { aS: [spark, 4] });
    return { placed, nA, nB, boltSegs, rainGeo, snowGeo, sparkGeo };
  }, [q]);
  useDispose(D.rainGeo, D.snowGeo, D.sparkGeo);

  const shaftGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const skyGeo = useMemo(() => { const g = new THREE.PlaneGeometry(500, 500); g.rotateX(Math.PI / 2); return g; }, []);
  const oceanGeo = useMemo(() => { const g = new THREE.PlaneGeometry(400, 400, 150, 150); g.rotateX(-Math.PI / 2); return g; }, []);
  const sphereG = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  const cylG = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1), []);
  const boxG = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useDispose(shaftGeo, skyGeo, oceanGeo, sphereG, cylG, boxG);

  const T = useMemo(() => ({
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), pa: [] as THREE.Vector3[],
  }), []);
  const colored = useRef(false);
  const boltInit = useRef(false);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const w = scene.weight;
    const time = world.reduced ? 0 : world.time;
    const fl = flashAt(f);
    const rain = smoothstep(2.88, 3.0, f) * (1 - smoothstep(3.3, 3.65, f));
    const under = smoothstep(3.37, 3.6, f);
    const px = pxScale(state);

    if (aboveGroup.current) aboveGroup.current.visible = under < 0.999;
    oceanU.uTime.value = time; oceanU.uFlash.value = fl; oceanU.uAmp.value = 1.3 - 1.0 * smoothstep(3.2, 4.0, f);
    (oceanU.uBg.value as THREE.Color).set(under > 0.5 ? '#04202f' : '#02060e');
    skyU.uTime.value = time; skyU.uFlash.value = fl; skyU.uAmt.value = w;
    rainU.uTime.value = time; rainU.uAmt.value = rain * w;
    shaftU.uTime.value = time; shaftU.uFlash.value = fl; shaftU.uI.value = 0.08 * w * under;
    snowU.uPx.value = px; snowU.uTime.value = time; snowU.uA.value = w * (0.2 + 0.8 * under) * (1 - 0.5 * smoothstep(3.85, 4.15, f));
    sparkU.uF.value = f; sparkU.uPx.value = px; sparkU.uW.value = w * under;

    // lightning bolts
    if (!boltInit.current) {
      boltInit.current = true;
      D.boltSegs.forEach((segs, bi) => {
        const im = bolts.current[bi];
        if (!im) return;
        segs.forEach(([a, b], i) => {
          T.p.copy(a).add(b).multiplyScalar(0.5);
          T.a.copy(b).sub(a); const len = T.a.length();
          T.q.setFromUnitVectors(T.up, T.a.normalize());
          T.s.set(0.08, len, 0.08);
          T.m.compose(T.p, T.q, T.s); im.setMatrixAt(i, T.m);
        });
        im.instanceMatrix.needsUpdate = true;
      });
    }
    STRIKES.forEach((st, bi) => {
      const im = bolts.current[bi];
      if (!im) return;
      const d = f - st;
      const v = Math.exp(-(d * d) / 0.00012) + 0.55 * Math.exp(-((d - 0.022) * (d - 0.022)) / 0.00008);
      im.visible = v > 0.03 && under < 0.9;
      (im.material as THREE.MeshBasicMaterial).color.setRGB(1.2 * v * 3, 1.5 * v * 3, 3 * v * 3);
    });

    // molecules (CPU instancing, ~700 matrices)
    const am = atoms.current, bm = bonds.current;
    if (under > 0.01 && am && bm) {
      if (!colored.current) {
        colored.current = true;
        let ci = 0;
        D.placed.forEach((p) => p.mol.atoms.forEach((a) => am.setColorAt(ci++, ECOL[a.e][0])));
        for (let i = 0; i < N_BEAD; i++) am.setColorAt(ci++, T.c.setHSL(0.5 + 0.12 * (i % 4), 0.8, 0.55).multiplyScalar(1.4));
        am.instanceColor!.needsUpdate = true;
        let bi2 = 0;
        for (let i = 0; i < D.nB; i++) bm.setColorAt(bi2++, T.c.setRGB(0.5, 0.58, 0.7));
        bm.instanceColor!.needsUpdate = true;
      }
      let ai = 0, bi = 0;
      const drift = time * 0.3;
      D.placed.forEach((p) => {
        const A = smoothstep(p.ta - 0.14, p.ta, f);
        const bondOn = smoothstep(p.ta - 0.04, p.ta + 0.02, f);
        const sc = 1 + 0.6 * Math.exp(-Math.max(f - p.ta, 0) * 20) * (f > p.ta ? 1 : 0);
        const cx = p.home.x + Math.sin(drift + p.ph) * 0.5 + Math.sin(f * 6 + p.ph) * 0.15;
        const cy = p.home.y + Math.cos(drift * 0.8 + p.ph) * 0.4 + Math.cos(f * 4 + p.ph) * 0.15;
        const cz = p.home.z + Math.sin(drift * 0.6 + p.ph * 2) * 0.4;
        p.mol.atoms.forEach((a, k) => {
          T.p.set(a.p[0], a.p[1], a.p[2]).multiplyScalar(MS).applyQuaternion(p.rot);
          T.p.multiplyScalar(sc).add(T.a.set(cx, cy, cz));
          T.p.addScaledVector(p.scat[k], 1 - A);
          const r = ECOL[a.e][1] * MS;
          T.s.setScalar(r * (0.5 + 0.5 * A + 0.25 * (1 - A)) * w);
          T.m.compose(T.p, T.q.identity(), T.s);
          am.setMatrixAt(ai, T.m);
          (T.pa[k] ??= new THREE.Vector3()).copy(T.p);
          ai++;
        });
        p.mol.bonds.forEach(([i, j]) => {
          T.a.copy(T.pa[i]); T.b.copy(T.pa[j]);
          T.p.copy(T.a).add(T.b).multiplyScalar(0.5);
          T.b.sub(T.a); const len = T.b.length();
          T.q.setFromUnitVectors(T.up, T.b.normalize());
          T.s.set(0.04 * w, len * bondOn * w, 0.04 * w);
          T.m.compose(T.p, T.q, T.s); bm.setMatrixAt(bi++, T.m);
        });
      });
      // growing polymer chain at the centre
      const grow = range(3.72, 4.05, f);
      const hr = 0.6;
      for (let i = 0; i < N_BEAD; i++) {
        const on = smoothstep(i / N_BEAD * 0.85, i / N_BEAD * 0.85 + 0.15, grow);
        const ang = i * 0.62 + f * 1.2;
        T.p.set(Math.cos(ang) * hr, (i - N_BEAD / 2) * 0.14, Math.sin(ang) * hr);
        T.pa[100 + i] ??= new THREE.Vector3();
        T.pa[100 + i].copy(T.p);
        T.s.setScalar(0.14 * on * w);
        T.m.compose(T.p, T.q.identity(), T.s); am.setMatrixAt(ai++, T.m);
      }
      for (let i = 0; i < N_BEAD - 1; i++) {
        const on = smoothstep((i + 1) / N_BEAD * 0.85, (i + 1) / N_BEAD * 0.85 + 0.1, grow);
        T.a.copy(T.pa[100 + i]); T.b.copy(T.pa[101 + i]);
        T.p.copy(T.a).add(T.b).multiplyScalar(0.5);
        T.b.sub(T.a); const len = T.b.length();
        T.q.setFromUnitVectors(T.up, T.b.normalize());
        T.s.set(0.04 * w * on, len * on * w, 0.04 * w * on);
        T.m.compose(T.p, T.q, T.s); bm.setMatrixAt(bi++, T.m);
      }
      am.count = ai; bm.count = bi;
      am.instanceMatrix.needsUpdate = true; bm.instanceMatrix.needsUpdate = true;
      if (underGroup.current) underGroup.current.visible = true;
    } else if (underGroup.current) underGroup.current.visible = under > 0.01;
    if (hemi.current) hemi.current.intensity = 0.55 + fl * 1.0;
    if (dir.current) dir.current.intensity = 2.2 + fl * 3;
  });

  const shafts = useMemo(() => [[-6, 0.3], [5, -0.3]], []);
  return (
    <group>
      <group ref={aboveGroup}>
        <mesh geometry={oceanGeo} position={[0, SURF_Y, 0]} frustumCulled={false}>
          <primitive object={mats.ocean} attach="material" />
        </mesh>
        <mesh geometry={skyGeo} position={[0, 38, 0]} frustumCulled={false}>
          <primitive object={mats.sky} attach="material" />
        </mesh>
        <lineSegments geometry={D.rainGeo} frustumCulled={false}>
          <primitive object={mats.rain} attach="material" />
        </lineSegments>
        {STRIKES.map((_, i) => (
          <instancedMesh key={i} ref={(m) => { bolts.current[i] = m; }} args={[boxG, undefined, D.boltSegs[i].length]} frustumCulled={false} visible={false}>
            <meshBasicMaterial toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </instancedMesh>
        ))}
      </group>
      <group ref={underGroup} visible={false}>
        <ambientLight ref={hemi} color="#4aa0c0" intensity={0.9} />
        <directionalLight ref={dir} position={[2, 8, 4]} color="#a8d8ff" intensity={2.2} />
        {shafts.map(([x, sk], i) => (
          <mesh key={i} geometry={shaftGeo} position={[x + sk * 6, SURF_Y / 2, -6 - i]} scale={[3.5, SURF_Y + 6, 1]} rotation={[0, 0, sk * 0.4]} frustumCulled={false}>
            <primitive object={mats.shaft} attach="material" />
          </mesh>
        ))}
        <points geometry={D.snowGeo} frustumCulled={false}>
<primitive object={mats.snow} attach="material" />
        </points>
        <points geometry={D.sparkGeo} frustumCulled={false}>
<primitive object={mats.spark} attach="material" />
        </points>
        <instancedMesh ref={atoms} args={[sphereG, undefined, D.nA]} frustumCulled={false}>
          <meshStandardMaterial roughness={0.3} metalness={0.1} />
        </instancedMesh>
        <instancedMesh ref={bonds} args={[cylG, undefined, D.nB]} frustumCulled={false}>
          <meshStandardMaterial roughness={0.4} />
        </instancedMesh>
      </group>
    </group>
  );
}
