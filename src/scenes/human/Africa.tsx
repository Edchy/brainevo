import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range, smoothstep } from '../../world/util';
import { EarthSphere, llToVec, useEarthMats } from './Earth';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

type LL = [number, number];
// [waypoints, start, end] -- stylised dispersal corridors, in order of rough timing
export const ROUTES: { pts: LL[]; a: number; b: number; col: [number, number, number] }[] = [
  { pts: [[5, 38], [15, 41], [29, 35], [41, 30], [48, 15], [55, 38]], a: 0.0, b: 0.5, col: [1.9, 1.2, 0.5] },
  { pts: [[5, 38], [14, 46], [24, 56], [22, 74], [14, 99], [0, 111], [-12, 125], [-25, 134]], a: 0.08, b: 0.62, col: [2.0, 0.8, 0.45] },
  { pts: [[29, 35], [40, 65], [41, 90], [36, 115], [41, 128], [36, 139]], a: 0.2, b: 0.75, col: [1.6, 1.3, 0.6] },
  { pts: [[58, 100], [66, 170], [60, -150], [50, -125], [35, -105], [10, -80], [-15, -70], [-40, -70]], a: 0.5, b: 1.0, col: [0.7, 1.6, 1.8] },
];

export default function Africa() {
  const scene = useScene();
  const { mat, atmo } = useEarthMats();
  const root = useRef<THREE.Group>(null);
  const { geo, pm, lgeo, lm } = useMemo(() => {
    const b = new PBuf(51);
    const r = b.r;
    ROUTES.forEach((rt, ri) => {
      const curve = new THREE.CatmullRomCurve3(rt.pts.map(([la, lo]) => new THREE.Vector3(...llToVec(la, lo, 1))), false, 'centripetal');
      const n = Math.floor(800 * world.quality);
      for (let i = 0; i < n; i++) {
        const s = i / n;
        const v = curve.getPoint(s).normalize();
        const spread = 0.004 + 0.012 * Math.sin(s * Math.PI);
        v.x += (r() - 0.5) * spread; v.y += (r() - 0.5) * spread; v.z += (r() - 0.5) * spread;
        v.normalize().multiplyScalar(1.012 + r() * 0.012);
        b.add(v.x, v.y, v.z, rt.col, ri, { aR: [s, rt.a, rt.b] });
      }
    });
    // stars
    for (let i = 0; i < 120 * world.quality; i++) {
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(14 + r() * 20);
      b.add(v.x, v.y, v.z, [0.7, 0.8, 1.2], 9, { aR: [0, 0, 0] });
    }
    // fine route lines hugging the globe, drawn out by the migration's progress
    const lb = new LBuf(52);
    ROUTES.forEach((rt, ri) => {
      const curve = new THREE.CatmullRomCurve3(rt.pts.map(([la, lo]) => new THREE.Vector3(...llToVec(la, lo, 1))), false, 'centripetal');
      const N = 220;
      let prev = curve.getPoint(0).normalize().multiplyScalar(1.004);
      for (let i = 1; i <= N; i++) {
        const cur = curve.getPoint(i / N).normalize().multiplyScalar(1.004);
        lb.seg([prev.x, prev.y, prev.z], [cur.x, cur.y, cur.z], (i - 1) / N, i / N, rt.col, ri, { aR: [rt.a, rt.b] });
        prev = cur;
      }
    });
    const lm = lineMat({
      decl: 'attribute vec2 aR; uniform float uProg;', uniforms: { uProg: { value: 0 } },
      body: `
      float pr = clamp((uProg - aR.x)/(aR.y - aR.x), 0., 1.);
      float d = pr - aG;
      a = step(0., d)*step(.0001, pr)*(.22 + .35*exp(-max(d,0.)*5.));`,
    });
    const pm = pointMat({
      decl: 'attribute vec3 aR; uniform float uProg;',
      uniforms: { uProg: { value: 0 } },
      size: 0.6,
      body: `
      if (aSeed.w > 8.) { a = .25*(.4+.6*pow(.5+.5*sin(uTime*(.5+aSeed.y)+aSeed.z*40.),3.)); size=.6; }
      else {
        float pr = clamp((uProg - aR.y)/(aR.z - aR.y), 0., 1.);
        float s = aR.x;
        float d = pr - s;
        float vis = step(0., d) * step(.0001, pr);
        float head = exp(-max(d,0.)*45.);
        float trail = exp(-max(d,0.)*3.);
        a = vis*(.25+.7*trail+1.8*head);
        a *= .75+.25*sin(uTime*3.+aSeed.x*30.);
        size = .5+1.0*head+.2*trail;
        col = col*(.6+head*1.6);
      }
      `,
    });
    return { geo: b.build(), pm, lgeo: lb.build(), lm };
  }, []);
  useEffect(() => () => { geo.dispose(); pm.dispose(); lgeo.dispose(); lm.dispose(); }, [geo, pm, lgeo, lm]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('out-of-africa');
    const prog = range(e - 0.45, e + 0.75, f);
    mat.uniforms.uW.value = scene.weight; atmo.uniforms.uW.value = scene.weight;
    tickU(pm, scene, state.gl.getPixelRatio());
    pm.uniforms.uProg.value = prog;
    tickU(lm, scene); lm.uniforms.uProg.value = prog;
    const g = root.current;
    if (g) {
      const lon = 22 + smoothstep(0, 1, prog) * 105;
      g.rotation.y = (-lon * Math.PI) / 180;
      g.rotation.x = 0.42;
      const k = 0.8 + 0.2 * smoothstep(0, 0.3, scene.weight);
      g.scale.setScalar(1.95 * k);
      g.position.set(1.7, 0.1, 0);
    }
  });
  return (
    <group ref={root}>
      <EarthSphere mat={mat} atmo={atmo} />
      <lineSegments geometry={lgeo} material={lm} frustumCulled={false} />
      <points geometry={geo} material={pm} frustumCulled={false} />
    </group>
  );
}
