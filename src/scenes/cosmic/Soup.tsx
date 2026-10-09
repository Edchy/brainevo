import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeInOutCubic, easeOutCubic, range, rng, smoothstep } from '../../world/util';
import { NOISE, makeGeo, mkMat, pxScale, useDispose } from './fx';
import { Discs, Segs } from './light';
import { boltEnv, buildBolt, makeBoltMaterial } from './bolt';
import type { BoltSpec } from './bolt';

export const SURF_Y = 6;

/** three considered strikes (station units). Placement is deliberate: a distant one right, a thin one left, then the hero. */
const BOLTS: Array<BoltSpec & { t: number }> = [
  { t: 2.975, seed: 11, topX: 12.5, botX: 10.5, z: -34, top: 44, bot: SURF_Y, forks: 2, amp: 1 },
  { t: 3.125, seed: 7, topX: -7.5, botX: -9.5, z: -30, top: 42, bot: SURF_Y, forks: 3, amp: 1 },
  { t: 3.255, seed: 23, topX: 4.6, botX: 3.4, z: -27, top: 34, bot: SURF_Y, forks: 5, amp: 1 },
];
export const STRIKES = BOLTS.map((b) => b.t);
/** global illumination pulse of the whole scene (0..1) */
export function flashAt(f: number) {
  let m = 0;
  for (const b of BOLTS) { const e = boltEnv(f - b.t); m = Math.max(m, 0.8 * e.c + 0.3 * e.g); }
  return Math.min(1, m);
}

/* ---------- ocean surface ---------- */
const oceanVert = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const oceanFrag = /* glsl */ `
${NOISE}
uniform float uFlash, uTime, uAmp; uniform vec3 uBg; uniform vec3 uHit; varying vec3 vW;
void main(){
  vec3 V=normalize(cameraPosition-vW);
  float dist=length(vW-cameraPosition);
  // analytic swell gradient, flattened with distance so the far sea is a calm sheet
  float far=1.-smoothstep(25.,90.,dist);
  vec2 p=vW.xz;
  float ph1=p.x*.5+uTime*1.1, ph2=p.y*.7-uTime*.9, ph3=(p.x+p.y)*1.3+uTime*1.7;
  vec2 g=vec2(cos(ph1)*.25+cos(ph3)*.2, cos(ph2)*.245+cos(ph3)*.2)*uAmp*.5;
  g+=vec2(vnoise(vec3(p*1.7,uTime*.3))-.5, vnoise(vec3(p*1.7+9.,-uTime*.3))-.5)*.18*uAmp;
  vec3 n=normalize(vec3(-g.x*far,1.,-g.y*far));
  vec3 col;
  if(gl_FrontFacing){
    float fr=pow(1.-max(dot(n,V),0.),4.);
    vec3 sky=vec3(.025,.04,.08)+vec3(.5,.6,1.)*uFlash*.16;
    col=vec3(.0008,.004,.01)+sky*fr*(.6+.4*uFlash);
    float hd=length(vW.xz-uHit.xy);
    col+=vec3(.55,.68,1.)*uHit.z*(exp(-hd*.1)*.2+exp(-hd*.6)*.35)*(.2+fr);
    col=mix(col,uBg+vec3(.02,.03,.06)*uFlash*2.,smoothstep(60.,200.,dist));
  } else {
    float c=fbm(vec3(vW.x*.2,uTime*.15,vW.z*.2));
    float caustic=smoothstep(.4,.95,c);
    col=vec3(.01,.055,.085)*(.6+caustic*.6)+vec3(.1,.25,.4)*uFlash*.3;
    col=mix(col,uBg,smoothstep(3.,28.,dist));
  }
  gl_FragColor=vec4(col,1.);
}`;

/* ---------- storm sky ---------- */
const skyFrag = /* glsl */ `
${NOISE}
uniform float uFlash, uTime, uAmt; uniform vec3 uHit; varying vec3 vW;
void main(){
  vec2 q=vW.xz*.012;
  float c=fbm(vec3(q*2.,uTime*.02))*.7+fbm(vec3(q*6.,uTime*.04))*.3;
  float d=smoothstep(.35,.85,c);
  float dist=length(vW.xz-cameraPosition.xz);
  float hd=length(vW.xz-uHit.xy);
  vec3 col=vec3(.012,.018,.034)*d+vec3(.4,.5,.9)*d*(d*uFlash*.5+uHit.z*exp(-hd*.045)*.9);
  gl_FragColor=vec4(col*uAmt*smoothstep(260.,60.,dist),1.);
}`;

/* ---------- rain ---------- */
const rainVert = /* glsl */ `
attribute vec4 aR; attribute float aEnd;
uniform float uTime, uAmt;
varying float vA;
void main(){
  float y=mod(aR.y-uTime*(26.+aR.w*8.),18.);
  vec3 p=vec3(aR.x+y*.08,${SURF_Y.toFixed(1)}+y,aR.z)+vec3(.08,1.,0.)*aEnd*.7;
  vA=uAmt*step(aR.w,uAmt)*(.1+.28*aEnd)*smoothstep(0.,1.,y);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const lineFrag = /* glsl */ `varying float vA; void main(){ gl_FragColor=vec4(vec3(.6,.75,1.)*vA,1.); }`;

/* ---------- molecules (real bond geometry, angstrom-ish units) ---------- */
type El = 'H' | 'C' | 'N' | 'O';
interface MolDef { atoms: Array<[El, number, number, number]>; bonds: Array<[number, number, number]>; slot: [number, number]; t0: number; rx: number; ry: number; sc: number }
const sd = (deg: number) => Math.sin((deg * Math.PI) / 180), cd = (deg: number) => Math.cos((deg * Math.PI) / 180);
const T4 = 1.09 / Math.sqrt(3);
const NH_R = 0.943, NH_H = 0.364;
const MOLS: MolDef[] = [
  // water, 0.96 A, 104.5 deg
  { atoms: [['O', 0, 0, 0], ['H', 0.96 * sd(52.25), 0.96 * cd(52.25), 0], ['H', -0.96 * sd(52.25), 0.96 * cd(52.25), 0]], bonds: [[0, 1, 1], [0, 2, 1]], slot: [-3.7, 1.5], t0: 3.385, rx: 0.2, ry: 0.0, sc: 1.25 },
  // methane, tetrahedral
  { atoms: [['C', 0, 0, 0], ['H', T4, T4, T4], ['H', -T4, -T4, T4], ['H', -T4, T4, -T4], ['H', T4, -T4, -T4]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], slot: [3.5, 1.75], t0: 3.42, rx: 0.5, ry: 0.5, sc: 1.25 },
  // ammonia, trigonal pyramid (viewed slightly from above)
  { atoms: [['N', 0, 0, 0], ['H', NH_R, -NH_H, 0], ['H', NH_R * cd(120), -NH_H, NH_R * sd(120)], ['H', NH_R * cd(240), -NH_H, NH_R * sd(240)]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], slot: [-2.9, -0.7], t0: 3.455, rx: 0.5, ry: 0.35, sc: 1.25 },
  // hydrogen cyanide, linear, triple bond
  { atoms: [['H', -1.06, 0, 0], ['C', 0, 0, 0], ['N', 1.156, 0, 0]], bonds: [[0, 1, 1], [1, 2, 3]], slot: [3.3, -0.55], t0: 3.49, rx: 0, ry: 0.0, sc: 1.25 },
  // formaldehyde, planar, C=O double bond, 116.5 deg
  { atoms: [['C', 0, 0, 0], ['O', 1.21, 0, 0], ['H', 1.1 * cd(121.75), 1.1 * sd(121.75), 0], ['H', 1.1 * cd(121.75), -1.1 * sd(121.75), 0]], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]], slot: [0.1, 2.55], t0: 3.52, rx: 0.35, ry: -0.3, sc: 1.25 },
];
const EL: Record<El, { r: number; c: [number, number, number] }> = {
  H: { r: 0.04, c: [1.05, 1.08, 1.12] },
  C: { r: 0.07, c: [0.92, 0.97, 1.05] },
  N: { r: 0.066, c: [0.82, 0.92, 1.15] },
  O: { r: 0.063, c: [1.12, 0.99, 0.93] },
};

/* ---------- the hero strand: a double helix with fine rungs ---------- */
const NP = 38, SUB = 3, DX = 0.26, X0 = -(NP - 1) * DX * 0.5;
const yc = (x: number) => 1.15 + 0.5 * Math.sin(x * 0.42 + 0.6);
const HR = 0.36;

export default function Soup() {
  const scene = useScene();
  const q = world.quality;
  const oceanU = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 1 }, uFlash: { value: 0 }, uCalm: { value: 0 }, uBg: { value: new THREE.Color('#02060e') }, uHit: { value: new THREE.Vector3() } }), []);
  const skyU = useMemo(() => ({ uFlash: { value: 0 }, uTime: { value: 0 }, uAmt: { value: 1 }, uHit: { value: new THREE.Vector3() } }), []);
  const rainU = useMemo(() => ({ uTime: { value: 0 }, uAmt: { value: 0 } }), []);
  const snowU = useMemo(() => ({ uPx: { value: 800 }, uTime: { value: 0 }, uA: { value: 0 } }), []);
  const mats = useMemo(() => ({
    ocean: mkMat(oceanVert, oceanFrag, oceanU, { transparent: false, depthWrite: true, blending: THREE.NormalBlending, side: THREE.DoubleSide }),
    sky: mkMat(`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`, skyFrag, skyU),
    rain: mkMat(rainVert, lineFrag, rainU),
    snow: mkMat(`attribute vec3 aP; attribute vec4 aM; uniform float uPx,uTime,uA; varying float vA;
              void main(){ vec3 p=aP+vec3(sin(uTime*.2+aM.x*30.),-mod(uTime*.12*(.5+aM.y)+aM.z*20.,16.)+8.,cos(uTime*.17+aM.y*30.))*vec3(.6,1.,.6); p.y=mod(p.y+8.,16.)-8.;
              vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=clamp((.02+.035*aM.w)*uPx/max(-mv.z,.1),1.,4.); vA=uA*(.1+.3*aM.w); gl_Position=projectionMatrix*mv; }`, `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; gl_FragColor=vec4(vec3(.75,.9,1.)*(1.-d)*vA,1.); }`, snowU),
  }), [oceanU, skyU, rainU, snowU]);

  const bolts = useMemo(() => BOLTS.map((b) => {
    const { geo, total } = buildBolt(b);
    const main = makeBoltMaterial(false, SURF_Y), mir = makeBoltMaterial(true, SURF_Y);
    return { geo, total, main, mir, mMain: new THREE.Mesh(geo, main), mMir: new THREE.Mesh(geo, mir) };
  }), []);
  bolts.forEach((b) => { b.mMain.frustumCulled = false; b.mMir.frustumCulled = false; b.mMain.renderOrder = 30; b.mMir.renderOrder = 29; });

  const light = useMemo(() => ({ bonds: new Segs(220, [0.82, 0.9, 1.0]), spine: new Segs(420, [0.9, 0.95, 1.0]), discs: new Discs(220), res: new THREE.Vector2() }), []);

  const D = useMemo(() => {
    const r = rng(2024);
    const NR = Math.floor(650 * q);
    const R = new Float32Array(NR * 2 * 4), E = new Float32Array(NR * 2);
    for (let i = 0; i < NR; i++) {
      const v = [(r() - 0.5) * 40, r() * 18, -r() * 30 + 4, r()];
      R.set(v, i * 8); R.set(v, i * 8 + 4); E[i * 2 + 1] = 1;
    }
    const rainGeo = makeGeo(NR * 2, { aR: [R, 4], aEnd: [E, 1] });
    const NS = Math.floor(260 * q);
    const SP = new Float32Array(NS * 3), SM = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) { SP.set([(r() - 0.5) * 30, (r() - 0.5) * 16, (r() - 0.5) * 24], i * 3); SM.set([r(), r(), r(), r()], i * 4); }
    const snowGeo = makeGeo(NS, { aP: [SP, 3], aM: [SM, 4] });
    // per-atom arrival vectors for molecules and strand nodes
    const arr = (n: number) => Array.from({ length: n }, () => { const th = r() * 6.283; return [Math.cos(th), Math.sin(th) * 0.8, (r() - 0.5) * 1.2, r()]; });
    return { rainGeo, snowGeo, molArr: MOLS.map((m) => arr(m.atoms.length)), nodeArr: [arr(NP), arr(NP)] };
  }, [q]);

  const skyGeo = useMemo(() => { const g = new THREE.PlaneGeometry(500, 500); g.rotateX(Math.PI / 2); return g; }, []);
  const oceanGeo = useMemo(() => { const g = new THREE.PlaneGeometry(500, 500, 2, 2); g.rotateX(-Math.PI / 2); return g; }, []);
  useDispose(mats.ocean, mats.sky, mats.rain, mats.snow, D.rainGeo, D.snowGeo, skyGeo, oceanGeo, light.bonds, light.spine, light.discs,
    ...bolts.flatMap((b) => [b.geo, b.main, b.mir]));

  const S = useMemo(() => ({
    a: new THREE.Vector3(), b: new THREE.Vector3(), p: [] as THREE.Vector3[], e: new THREE.Euler(), m: new THREE.Matrix4(),
    deepC: new THREE.Color('#03050b'), ox: new THREE.Vector3(), hit: new THREE.Vector3(),
  }), []);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const w = scene.weight;
    const time = world.reduced ? 0 : world.time;
    const fl = flashAt(f);
    const rain = smoothstep(2.9, 3.0, f) * (1 - smoothstep(3.22, 3.36, f));
    const under = smoothstep(3.33, 3.5, f);
    const px = pxScale(state);
    state.gl.getDrawingBufferSize(light.res);
    const K = light.res.y / 900;

    // --- strikes: pick the strongest active one to light the sea and the cloud deck around its footing
    let hitS = 0, hi = -1;
    BOLTS.forEach((b, i) => { const e = boltEnv(f - b.t); const s = 0.8 * e.c + 0.3 * e.g; if (s > hitS) { hitS = s; hi = i; } });
    if (hi >= 0) S.hit.set(BOLTS[hi].botX, BOLTS[hi].z, Math.min(1, hitS)); else S.hit.set(0, 0, 0);

    oceanU.uTime.value = time; oceanU.uFlash.value = fl; oceanU.uAmp.value = 1.15 - 0.8 * smoothstep(3.2, 3.6, f);
    (oceanU.uHit.value as THREE.Vector3).copy(S.hit);
    (oceanU.uBg.value as THREE.Color).set(under > 0.5 ? '#031a27' : '#02060e').lerp(S.deepC, smoothstep(3.5, 3.75, f));
    skyU.uTime.value = time; skyU.uFlash.value = fl; skyU.uAmt.value = w; (skyU.uHit.value as THREE.Vector3).copy(S.hit);
    rainU.uTime.value = time; rainU.uAmt.value = rain * w;
    snowU.uPx.value = px; snowU.uTime.value = time; snowU.uA.value = w * under * (1 - smoothstep(3.7, 3.85, f));

    bolts.forEach((b, i) => {
      const env = boltEnv(f - BOLTS[i].t);
      const vis = env.g > 0.004 && under < 0.8 && w > 0.01;
      b.mMain.visible = vis; b.mMir.visible = vis && under < 0.3;
      if (!vis) return;
      for (const m of [b.main, b.mir]) {
        const u = m.uniforms;
        (u.uRes.value as THREE.Vector2).copy(light.res);
        u.uK.value = K; u.uWpx.value = 125 * K; u.uTime.value = time;
        u.uHead.value = env.lead * (b.total + 4);
        u.uCore.value = env.c * 1.7 * w; u.uGlow.value = env.g * 0.6 * w; u.uAura.value = env.g * 0.11 * w;
      }
    });

    // --- molecules and the strand (only underwater)
    const { bonds, spine, discs } = light;
    bonds.begin(light.res); spine.begin(light.res); discs.begin();
    if (under > 0.02 && w > 0.01) {
      const fadeMol = 1 - smoothstep(3.58, 3.72, f);
      const spin = f * 2.2 + time * 0.12;
      MOLS.forEach((m, mi) => {
        const arr = D.molArr[mi];
        const vis = smoothstep(m.t0 - 0.01, m.t0 + 0.03, f) * fadeMol * w * under;
        if (vis < 0.003) return;
        const ry = m.ry + 0.3 * Math.sin(f * 7 + mi * 2 + time * 0.2), rx = m.rx + 0.12 * Math.cos(f * 5 + mi + time * 0.17);
        S.e.set(rx, ry, 0); S.m.makeRotationFromEuler(S.e);
        // drift away to the sides as the strand takes over
        const away = smoothstep(3.6, 3.76, f) * 0.6 * Math.sign(m.slot[0] || 1);
        const cx = m.slot[0] + away + 0.08 * Math.sin(time * 0.3 + mi * 2), cy = m.slot[1] + 0.08 * Math.cos(time * 0.25 + mi) + Math.sin(f * 9 + mi) * 0.03;
        const dur = 0.075;
        const tk = m.atoms.map((_, k) => m.t0 + (k === 0 ? 0 : 0.016 + 0.014 * k));
        m.atoms.forEach((at, k) => {
          const a = range(tk[k], tk[k] + dur, f);
          const ea = easeOutCubic(a), inv = 1 - ea;
          const o = arr[k];
          const P = (S.p[k] ??= new THREE.Vector3());
          P.set(at[1] * m.sc, at[2] * m.sc, at[3] * m.sc).applyMatrix4(S.m);
          P.x += cx + o[0] * (1 - ea) * (2.4 + 0.5 * k) + Math.sin(ea * Math.PI) * o[1] * 0.35;
          P.y += cy + o[1] * inv * (2.0 + 0.4 * k);
          P.z += o[2] * inv * 0.5;
          const E = EL[at[0]];
          const age = (f - (tk[k] + dur)) / 0.05;
          const pulse = age >= 0 && age < 1 && a >= 1 ? age : -1;
          const breathe = 1 + 0.06 * Math.sin(time * 1.5 + k + mi);
          discs.add(P.x, P.y, P.z, E.r * breathe * (0.75 + 0.25 * ea), vis * (0.3 + 0.7 * ea), pulse, E.c[0], E.c[1], E.c[2]);
        });
        m.bonds.forEach(([i, j, ord]) => {
          const tb = Math.max(tk[i], tk[j]) + dur - 0.014;
          const g = easeOutCubic(range(tb, tb + 0.022, f));
          if (g <= 0) return;
          const A = S.a.copy(S.p[i]), B = S.b.copy(S.p[j]);
          const dir = S.ox.copy(B).sub(A); const len = dir.length(); dir.divideScalar(len || 1);
          const ra = EL[m.atoms[i][0]].r * 1.35 + 0.02, rb = EL[m.atoms[j][0]].r * 1.35 + 0.02;
          const x1 = ra, x2 = len - rb;
          if (x2 <= x1) return;
          const xe = x1 + (x2 - x1) * g;
          // perpendicular (in the picture plane) for multiple bonds
          const px2 = -dir.y, py2 = dir.x, pl = Math.hypot(px2, py2) || 1;
          const off = ord === 1 ? [0] : ord === 2 ? [-0.042, 0.042] : [-0.07, 0, 0.07];
          const bright = vis * (0.55 + 0.35 * (1 - g) + 0.15 * Math.exp(-Math.abs(g - 1) * 10));
          for (const d of off) {
            const ox = (px2 / pl) * d, oy = (py2 / pl) * d;
            bonds.add(A.x + dir.x * x1 + ox, A.y + dir.y * x1 + oy, A.z + dir.z * x1, A.x + dir.x * xe + ox, A.y + dir.y * xe + oy, A.z + dir.z * xe, bright, 0.78 * K, 0.35);
          }
        });
      });

      // the strand
      const g = range(3.52, 3.72, f);
      const fadeS = (1 - smoothstep(3.7, 3.8, f)) * w * under;
      if (g > 0 && fadeS > 0.003) {
        const head = X0 + (NP - 1) * DX * easeInOutCubic(g) + 0.15;
        const ph = (qq: number) => qq * 0.6 + spin;
        const cam = state.camera.position;
        void cam;
        for (let s = 0; s < 2; s++) {
          let lx = 0, ly = 0, lz = 0, lv = 0, ld = 0;
          for (let n = 0; n <= (NP - 1) * SUB; n++) {
            const qq = n / SUB, x = X0 + qq * DX, p = ph(qq) + s * Math.PI;
            const y = yc(x) + HR * Math.cos(p), z = HR * Math.sin(p) * 1.4;
            const v = 1 - smoothstep(head - 0.7, head, x);
            const depth = 0.5 + 0.5 * Math.sin(p);                // 1 = towards the viewer
            if (n > 0) {
              const iv = Math.min(v, lv);
              spine.add(lx, ly, lz, x, y, z, fadeS * iv * (0.32 + 0.68 * (depth + ld) * 0.5), (0.7 + 0.45 * (depth + ld) * 0.5) * K, 0.4);
            }
            lx = x; ly = y; lz = z; lv = v; ld = depth;
          }
        }
        for (let i = 0; i < NP; i++) {
          const ti = (i / NP) * 0.86;
          const a = easeOutCubic(range(ti, ti + 0.14, g));
          if (a <= 0) continue;
          const x = X0 + i * DX, p = ph(i);
          const pos = [0, 0].map((_, s) => {
            const pp = p + s * Math.PI, o = D.nodeArr[s][i];
            return [
              x + o[0] * (1 - a) * 1.6,
              yc(x) + HR * Math.cos(pp) + o[1] * (1 - a) * 1.4 + (s ? -0.5 : 0.5) * (1 - a) * (1 - a),
              HR * Math.sin(pp) * 1.4 + o[2] * (1 - a),
              0.5 + 0.5 * Math.sin(pp),
            ];
          });
          const age = (g - ti - 0.14) / 0.1;
          const pulse = age >= 0 && age < 1 ? age : -1;
          pos.forEach((P, s) => {
            const nodeR = 0.042 + (s === 0 ? 0.005 : 0);
            discs.add(P[0], P[1], P[2], nodeR * (0.8 + 0.2 * a), fadeS * (0.35 + 0.65 * a) * (0.55 + 0.45 * P[3]), pulse, 1.0, 1.04, 1.1);
          });
          // base-pair rung: two halves with a hair of space between them
          if (a > 0.98) {
            const A = pos[0], B = pos[1];
            const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
            const L = Math.hypot(dx, dy, dz);
            const sx = Math.hypot(dx, dy);   // on-screen length
            if (sx > 0.1) {
              const u = [dx / L, dy / L, dz / L];
              const r0 = 0.09 / L, m0 = 0.5 - 0.035 / L;
              const kk = fadeS * 0.5 * (0.5 + 0.5 * Math.min(1, sx / (2 * HR)));
              spine.add(A[0] + u[0] * r0 * L, A[1] + u[1] * r0 * L, A[2] + u[2] * r0 * L, A[0] + dx * m0, A[1] + dy * m0, A[2] + dz * m0, kk, 0.6 * K, 0.25);
              spine.add(A[0] + dx * (1 - m0), A[1] + dy * (1 - m0), A[2] + dz * (1 - m0), B[0] - u[0] * r0 * L, B[1] - u[1] * r0 * L, B[2] - u[2] * r0 * L, kk, 0.6 * K, 0.25);
            }
          }
        }
        // the growing tip
        const hx = Math.min(head, X0 + (NP - 1) * DX);
        discs.add(hx, yc(hx), 0, 0.1, fadeS * (0.55 + 0.25 * Math.sin(time * 4)) * (1 - 0.7 * smoothstep(0.92, 1, g)), -1, 0.9, 0.97, 1.1);
      }
    }
    bonds.end(); spine.end(); discs.end();
  });

  return (
    <group>
      <group visible>
        <mesh geometry={oceanGeo} position={[0, SURF_Y, 0]} frustumCulled={false}>
          <primitive object={mats.ocean} attach="material" />
        </mesh>
        <mesh geometry={skyGeo} position={[0, 38, 0]} frustumCulled={false}>
          <primitive object={mats.sky} attach="material" />
        </mesh>
        <lineSegments geometry={D.rainGeo} frustumCulled={false}>
          <primitive object={mats.rain} attach="material" />
        </lineSegments>
        {bolts.map((b, i) => (
          <group key={i}>
            <primitive object={b.mMir} />
            <primitive object={b.mMain} />
          </group>
        ))}
      </group>
      <points geometry={D.snowGeo} frustumCulled={false}>
        <primitive object={mats.snow} attach="material" />
      </points>
      <primitive object={light.bonds.mesh} />
      <primitive object={light.spine.mesh} />
      <primitive object={light.discs.mesh} />
    </group>
  );
}
