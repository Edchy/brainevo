import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, smoothstep } from '../../world/util';
import { EarthSphere, landV, llToVec, useEarthMats } from './Earth';
import { LBuf, PBuf, brainCurve, inPoly, lineMat, pointMat, tickU } from './common';

export const NOW_CAM = (t: number) => {
  const k = smoothstep(0.3, 0.8, t);
  return { pos: [0, 0.3 * (1 - k), 6.4 + k * 21] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 50 };
};

const BRAIN_SCALE = 4.4;

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
    while (hubs.length < 70) {
      const lat = -40 + r() * 100, lon = r() * 360 - 180;
      if (landV(lat, lon) > 0.58) hubs.push([lat, lon]);
    }
    hubs.forEach(([la, lo], hi) => {
      const n = Math.floor((60 + r() * 150) * q);
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
    for (let k = 0; k < 110; k++) {
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
        ab.add(v.x, v.y, v.z, [.6, 1.4, 2.4], k / 110, { aA: [s, ph] });
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
    for (let i = 0; i < 1800 * q; i++) {
      const v = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(60 + r() * 140);
      sb.add(v.x, v.y, v.z, r() < 0.2 ? [2.0, 1.5, 1.0] : [1.3, 1.6, 2.4], 0);
    }
    const sMat = pointMat({
      size: 2.4,
      body: `
      float cos_ = smoothstep(.1,.5,uT);
      a = cos_*.7*(.4+.6*pow(.5+.5*sin(uTime*(.4+aSeed.y)+aSeed.z*60.),3.)); size=.3+aSeed.x*.8;`,
    });
    // --- brain constellation ---
    const poly = brainCurve(140);
    const kb = new PBuf(174);
    const lb = new LBuf(175);
    const kc: [number, number, number] = [2.3, 2.0, 1.5];
    const stars: { x: number; y: number; z: number; o: number }[] = [];
    poly.forEach(([x, y], i) => {
      const o = (i / poly.length) * 0.55;
      stars.push({ x, y, z: (r() - .5) * .25, o });
    });
    const outlineN = stars.length;
    let guard = 0;
    while (stars.length < outlineN + 650 && guard++ < 4000) {
      const x = (r() - .5) * 4.2, y = r() * 4 - 2.1;
      if (!inPoly(poly, x, y)) continue;
      stars.push({ x, y, z: (r() - .5) * 1.2, o: 0.3 + r() * 0.55 });
    }
    // sulci strands
    for (let s = 0; s < 9; s++) {
      let x = (r() - .5) * 2.8, y = r() * 2 - .6, ang = r() * 6.28;
      if (!inPoly(poly, x, y)) continue;
      const base = 0.35 + r() * 0.4;
      for (let k = 0; k < 28; k++) {
        ang += (r() - .5) * 1.1; x += Math.cos(ang) * .11; y += Math.sin(ang) * .11;
        if (!inPoly(poly, x, y)) break;
        stars.push({ x, y, z: (r() - .5) * .5, o: base + k * 0.006 });
      }
    }
    stars.forEach((s, i) => {
      const bright = i < outlineN ? 1.2 : 0.6 + r() * .6;
      kb.add(s.x, s.y, s.z, [kc[0] * bright, kc[1] * bright, kc[2] * bright], s.o, { aC: [i < outlineN ? 1 : 0] });
    });
    for (let i = 0; i < outlineN; i++) {
      const a = stars[i], b = stars[(i + 1) % outlineN];
      lb.seg([a.x, a.y, a.z], [b.x, b.y, b.z], a.o, a.o, [.7, 1.0, 1.8], 1);
    }
    for (let i = outlineN; i < stars.length; i++) {
      const a = stars[i];
      const near2 = stars.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * .5)] as const).filter(([j, d]) => j !== i && d < .62).sort((p, q2) => p[1] - q2[1]).slice(0, 3);
      for (const [j] of near2) { const b = stars[j]; lb.seg([a.x, a.y, a.z], [b.x, b.y, b.z], Math.max(a.o, b.o), Math.max(a.o, b.o), [.6, .9, 1.7], 0); }
    }
    const kMat = pointMat({
      decl: 'attribute float aC; uniform float uBrain;', uniforms: { uBrain: { value: 0 } }, size: 3.4,
      body: `
      float on = smoothstep(aSeed.w, aSeed.w+.06, uBrain);
      float tw = pow(.5+.5*sin(uTime*(.6+aSeed.y*1.5)+aSeed.z*60.),3.);
      float wave = exp(-pow((fract(uTime*.1+p.x*.05+uT)-.5)*6.,2.))*0.;
      a = on*(.55+.6*tw); size = (.3+.45*aC+.6*tw)*on + (1.-on)*.0;`,
    });
    const lMat = lineMat({
      decl: 'uniform float uBrain;', uniforms: { uBrain: { value: 0 } },
      body: `
      float on = smoothstep(aG, aG+.06, uBrain);
      float pp = fract(uTime*.07 + aSeed.x);
      float fire = exp(-pow((fract(uTime*.12 + aG*1.7 + aSeed.y*.3)-.5)*5.,2.));
      a = on*(.3+.9*fire);`,
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
    eMat.uniforms.uW.value = scene.weight; atmo.uniforms.uW.value = scene.weight;
    const k = smoothstep(0.3, 0.8, t);
    if (earth.current) {
      earth.current.scale.setScalar(2.0 - 1.62 * k);
      earth.current.rotation.y = -0.45 + t * 1.4 + tm * 0.03;
      earth.current.rotation.x = 0.35;
      earth.current.position.y = 0.4 * (1 - k);
    }
    const on = range(0.02, 0.3, t);
    for (const m of [cMat, aMat]) { tickU(m, scene, pr); m.uniforms.uOn.value = on; }
    tickU(sMat, scene, pr);
    const brain = range(0.5, 0.88, t);
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
      <group position={[0, 0.3 * BRAIN_SCALE, -0.5]} scale={BRAIN_SCALE}>
        <points geometry={kGeo} material={kMat} frustumCulled={false} />
        <lineSegments geometry={lGeo} material={lMat} frustumCulled={false} />
      </group>
    </group>
  );
}
