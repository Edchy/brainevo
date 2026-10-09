import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, smoothstep } from '../../world/util';
import { EarthSphere, landV, llToVec, useEarthMats } from './Earth';
import { PBuf, pointMat, tickU } from './common';
import { Brain, useBrainCtl } from '../shared/brain';

export const NOW_CAM = (t: number) => {
  const k = smoothstep(0.25, 0.7, t);
  return { pos: [0, 0.3 * (1 - k), 6.4 + k * 21] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 50 };
};

const BRAIN_SCALE = 2.7;

export default function Now() {
  const scene = useScene();
  const { mat: eMat, atmo } = useEarthMats();
  // the finale is the night side: a thin sunlit crescent at the limb, and the lit cities as the one warm splash
  useEffect(() => { (eMat.uniforms.uSun.value as THREE.Vector3).set(0.85, 0.32, -0.42).normalize(); }, [eMat]);
  const earth = useRef<THREE.Group>(null);
  const bcg = useRef<THREE.Group>(null);
  const bc = useBrainCtl({ grow: 1, holo: 1, holoColor: '#6f8fc0', starColor: '#e8f0ff', stars: 0 });
  const youAreHere = useMemo(() => ({ at: [0.62, 0.52, 0.55] as [number, number, number], r: 0.1, sym: false, color: '#ffe9a0', i: 0 }), []);
  bc.regions = [youAreHere];
  const {
    cGeo, cMat, aGeo, aMat, sGeo, sMat,
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
        cb.add(v[0], v[1], v[2], r() < 0.85 ? [2.2, 1.6, .7] : [2.4, 2.1, 1.6], hi / hubs.length);
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
      col = mix(vec3(1.2,1.2,1.25),vec3(2.4,1.7,.7),head);
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
    return {
      cGeo: cb.build(), cMat, aGeo: ab.build(), aMat, sGeo: sb.build(), sMat,
    };
  }, []);
  useEffect(() => () => { [cGeo, aGeo, sGeo].forEach((g) => g.dispose()); [cMat, aMat, sMat].forEach((m) => m.dispose()); }, [cGeo, aGeo, sGeo, cMat, aMat, sMat]);

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
    const draw = range(0.6, 0.92, t);
    bc.alpha = scene.weight * smoothstep(0.55, 0.7, t) * 0.85;
    bc.stars = draw; bc.holo = 1;
    bc.cut = 0;
    youAreHere.i = smoothstep(0.88, 0.98, t) * (1.4 + 0.6 * Math.sin(tm * 1.3));
    bcg.current && (bcg.current.rotation.y = -0.2 + 0.18 * Math.sin(tm * 0.12) + t * 0.2);
  });
  return (
    <group>
      <points geometry={sGeo} material={sMat} frustumCulled={false} />
      <group ref={earth}>
        <EarthSphere mat={eMat} atmo={atmo} />
        <points geometry={cGeo} material={cMat} frustumCulled={false} />
        <points geometry={aGeo} material={aMat} frustumCulled={false} />
      </group>
      <group position={[-7.2, 0.5, -0.5]} scale={BRAIN_SCALE}>
        <group ref={bcg}><Brain ctl={bc} /></group>
      </group>
    </group>
  );
}
