import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, rng, smoothstep } from '../../world/util';
import { EarthSphere, landV, llToVec, useEarthMats } from './Earth';
import { LBuf, PBuf, brainCurve, inPoly, lineMat, pointMat, tickU } from './common';

export const NOW_CAM = (t: number) => {
  const k = smoothstep(0.25, 0.7, t);
  return { pos: [0, 0.3 * (1 - k), 6.4 + k * 21] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 50 };
};

const BRAIN_SCALE = 3.4;
const b2rng = rng;

export default function Now() {
  const scene = useScene();
  const { mat: eMat, atmo } = useEarthMats();
  const earth = useRef<THREE.Group>(null);
  const {
    cGeo, cMat, aGeo, aMat, sGeo, sMat, kGeo, kMat, lGeo, lMat,
  } = useMemo(() => {
    const q = world.quality;
    // --- cities ---
    const cb = new PBuf(171);
    const r = cb.r;
    const hubs: [number, number][] = [];
    while (hubs.length < 42) {
      const lat = -40 + r() * 100, lon = r() * 360 - 180;
      if (landV(lat, lon) > 0.58) hubs.push([lat, lon]);
    }
    hubs.forEach(([la, lo], hi) => {
      const n = Math.floor((50 + r() * 90) * q);
      for (let i = 0; i < n; i++) {
        const sg = 1.6 + r() * 2.2;
        const a = r() * 6.283, d = Math.abs(r() + r() - 1) * sg;
        const lat = la + Math.sin(a) * d, lon = lo + Math.cos(a) * d / Math.max(0.3, Math.cos((la * Math.PI) / 180));
        if (landV(lat, lon) < 0.52) continue;
        const v = llToVec(lat, lon, 1.004);
        cb.add(v[0], v[1], v[2], r() < 0.85 ? [2.2, 1.7, .9] : [1.2, 1.7, 2.4], hi / hubs.length);
      }
    });
    const cMat = pointMat({
      decl: 'uniform float uOn;', uniforms: { uOn: { value: 0 } }, size: 0.5,
      body: `
      float on = smoothstep(aSeed.w*.8, aSeed.w*.8+.2, uOn);
      float tw = pow(.5+.5*sin(uTime*(.5+aSeed.y*2.)+aSeed.z*50.),4.);
      a = on*(.35+.5*tw); size = .5+.5*tw;`,
    });
    // --- arcs ---
    const ab = new PBuf(172);
    for (let k = 0; k < 34; k++) {
      const A = hubs[Math.floor(r() * hubs.length)], B = hubs[Math.floor(r() * hubs.length)];
      if (A === B) continue;
      const va = new THREE.Vector3(...llToVec(A[0], A[1])), vb = new THREE.Vector3(...llToVec(B[0], B[1]));
      const ang = va.angleTo(vb);
      if (ang < 0.25) continue;
      const ph = r();
      const n = Math.floor((30 + ang * 40) * q);
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const v = new THREE.Vector3().copy(va).multiplyScalar(Math.sin((1 - s) * ang)).addScaledVector(vb, Math.sin(s * ang)).divideScalar(Math.sin(ang));
        v.normalize().multiplyScalar(1.004 + Math.sin(s * Math.PI) * 0.1 * Math.min(1, ang));
        ab.add(v.x, v.y, v.z, [.6, 1.4, 2.4], k / 34, { aA: [s, ph] });
      }
    }
    const aMat = pointMat({
      decl: 'attribute vec2 aA; uniform float uOn;', uniforms: { uOn: { value: 0 } }, size: 0.35,
      body: `
      float on = smoothstep(aSeed.w*.9+.1, aSeed.w*.9+.3, uOn);
      float pp = fract(aA.y + uTime*.12 + uT*1.2);
      float head = exp(-pow((pp-aA.x)*12.,2.));
      col = mix(vec3(.5,1.1,2.),vec3(2.2,2.0,1.6),head);
      a = on*(.07+1.1*head); size=.4+head*.9;`,
    });
    // --- far stars ---
    const sb = new PBuf(173);
    for (let i = 0; i < 260 * q; i++) {
      const v = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(60 + r() * 140);
      sb.add(v.x, v.y, v.z, r() < 0.2 ? [2.0, 1.5, 1.0] : [1.3, 1.6, 2.4], 0);
    }
    const sMat = pointMat({
      size: 2.4,
      body: `
      float cos_ = smoothstep(.1,.5,uT);
      a = cos_*.45*(.3+.7*pow(.5+.5*sin(uTime*(.4+aSeed.y)+aSeed.z*60.),3.)); size=.25+aSeed.x*.6;`,
    });
    // --- brain constellation: a luminous outline, a few drawn folds, one marker star ---
    const poly = brainCurve(150);
    const kb = new PBuf(174);
    const lb = new LBuf(175);
    const kc: [number, number, number] = [2.3, 2.1, 1.8];
    // outline draws around the contour (o = draw-in time)
    poly.forEach(([x, y], i) => {
      const o = (i / poly.length) * 0.5;
      const major = i % 6 === 0;
      const br = major ? 2.0 : 0.7;
      kb.add(x, y, 0, [kc[0] * br, kc[1] * br, kc[2] * br], o, { aC: [major ? 1 : 0] });
      const j = (i + 1) % poly.length;
      lb.seg([x, y, 0], [poly[j][0], poly[j][1], 0], o, o, [1.0, 1.15, 1.6], 1);
    });
    // folds (hand-placed gyral strands, smoothed and lightly perturbed so they read as organic, not drawn)
    const FOLDS: [number, number][][] = [
      [[0.3, 1.48], [0.2, 0.9], [0.0, 0.45], [-0.15, 0.1]],
      [[1.1, -0.5], [0.5, -0.38], [-0.2, -0.12], [-0.8, 0.12]],
      [[1.72, 0.85], [1.2, 0.95], [0.75, 0.98], [0.45, 1.02]],
      [[1.62, 0.12], [1.15, 0.28], [0.8, 0.34], [0.55, 0.3]],
      [[0.85, -0.55], [0.2, -0.62], [-0.55, -0.4], [-1.25, 0.05]],
      [[-0.1, 0.95], [-0.6, 0.85], [-1.05, 0.62], [-1.5, 0.45]],
      [[-1.0, 1.38], [-1.15, 0.9], [-1.25, 0.45]],
      [[-1.65, -0.55], [-1.25, -0.72], [-0.85, -0.74]],
    ];
    const rr = b2rng(176);
    FOLDS.forEach((pts, fi) => {
      const cv = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
      const n = 46;
      const base = 0.45 + fi * 0.055;
      let prev: [number, number, number] | null = null;
      const ph = rr() * 6.28;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const v = cv.getPoint(u);
        const w = Math.sin(u * 9 + ph) * 0.035 * Math.sin(u * Math.PI);
        const cur: [number, number, number] = [v.x + w * 0.6, v.y + w, 0];
        const o = base + u * 0.1;
        if (prev) lb.seg(prev, cur, o, o, [0.8, 1.0, 1.6], 0);
        if (i % 9 === 0) kb.add(cur[0], cur[1], 0, [kc[0] * 0.9, kc[1] * 0.9, kc[2] * 0.9], o, { aC: [0] });
        prev = cur;
      }
    });
    // a faint dust of stars inside the silhouette
    for (let n = 0, g = 0; n < 340 && g < 6000; g++) {
      const x = (rr() - 0.5) * 4.2, y = rr() * 4 - 2.1;
      if (!inPoly(poly, x, y)) continue;
      n++;
      kb.add(x, y, (rr() - 0.5) * 0.3, [kc[0] * 0.5, kc[1] * 0.5, kc[2] * 0.5], 0.2 + rr() * 0.65, { aC: [0] });
    }
    // "you are here": one bright star on the lateral surface
    kb.add(0.62, 0.52, 0, [3.2, 3.0, 2.6], 0.9, { aC: [2] });
    const kMat = pointMat({
      decl: 'attribute float aC; uniform float uBrain;', uniforms: { uBrain: { value: 0 } }, size: 3.4,
      body: `
      float on = smoothstep(aSeed.w, aSeed.w+.06, uBrain);
      float tw = .5+.5*sin(uTime*(.5+aSeed.y*.8)+aSeed.z*60.);
      float mk = step(1.5, aC);
      a = on*(.8+.25*tw+mk*.5*(.5+.5*sin(uTime*1.3)));
      size = on*((.25+.5*aC*(1.-mk)+.1*tw) + mk*1.7);`,
    });
    const lMat = lineMat({
      decl: 'uniform float uBrain;', uniforms: { uBrain: { value: 0 } },
      body: `
      float on = smoothstep(aG, aG+.05, uBrain);
      float fire = exp(-pow((fract(uTime*.06 + aSeed.x*.7)-.5)*6.,2.));
      a = on*(.55+.5*fire*step(.5,aSeed.w+0.));
      a = on*(.5+.55*fire);`,
    });
    return {
      cGeo: cb.build(), cMat, aGeo: ab.build(), aMat, sGeo: sb.build(), sMat,
      kGeo: kb.build(), kMat, lGeo: lb.build(), lMat,
    };
  }, []);
  useEffect(() => () => { [cGeo, aGeo, sGeo, kGeo, lGeo].forEach((g) => g.dispose()); [cMat, aMat, sMat, kMat, lMat].forEach((m) => m.dispose()); }, [cGeo, aGeo, sGeo, kGeo, lGeo, cMat, aMat, sMat, kMat, lMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t;
    const pr = state.gl.getPixelRatio();
    const tm = world.reduced ? 0 : world.time;
    // earth
    const ef = scene.weight * (1 - smoothstep(0.46, 0.72, t));
    eMat.uniforms.uW.value = ef; atmo.uniforms.uW.value = ef;
    const k = smoothstep(0.25, 0.7, t);
    if (earth.current) {
      earth.current.scale.setScalar(2.0 - 1.62 * k);
      earth.current.rotation.y = -0.45 + t * 1.4 + tm * 0.03;
      earth.current.rotation.x = 0.35;
      earth.current.position.set(-1.8 - 3.3 * k, 0.4 * (1 - k) + 1.6 * k, 0);
    }
    const on = range(0.02, 0.3, t);
    for (const m of [cMat, aMat]) { tickU(m, scene, pr); m.uniforms.uOn.value = on; m.uniforms.uW.value = ef; }
    tickU(sMat, scene, pr);
    const brain = range(0.6, 0.92, t);
    tickU(kMat, scene, pr); kMat.uniforms.uBrain.value = brain;
    tickU(lMat, scene); lMat.uniforms.uBrain.value = brain;
  });
  return (
    <group>
      <points geometry={sGeo} material={sMat} frustumCulled={false} />
      <group ref={earth}>
        <EarthSphere mat={eMat} atmo={atmo} />
        <points geometry={cGeo} material={cMat} frustumCulled={false} />
        <points geometry={aGeo} material={aMat} frustumCulled={false} />
      </group>
      <group position={[-7.2, 0.8, -0.5]} scale={BRAIN_SCALE}>
        <points geometry={kGeo} material={kMat} frustumCulled={false} />
        <lineSegments geometry={lGeo} material={lMat} frustumCulled={false} />
      </group>
    </group>
  );
}
