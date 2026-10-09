import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU, type V3 } from './common';

// One engraved piece of ochre (after the cross-hatched Blombos stones): a slab edge, then the pattern scratched in line by line.
const HW = 2.3, HH = 1.45;

export default function Ochre() {
  const scene = useScene();
  const root = useRef<THREE.Group>(null);
  const { lGeo, lMat, pGeo, pMat } = useMemo(() => {
    const lb = new LBuf(31);
    const pb = new PBuf(32);
    const r = lb.r;
    const edgeC: V3 = [2.0, 1.75, 1.45], lineC: V3 = [2.4, 2.1, 1.7];
    // slab edge: a softened, slightly irregular rectangle
    const N = 120;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const k = 1 / Math.pow(Math.pow(Math.abs(c), 7) + Math.pow(Math.abs(s), 7), 1 / 7);
      const w = 1 + 0.008 * Math.sin(a * 5 + 1) + 0.005 * Math.sin(a * 11);
      pts.push([c * k * HW * w, s * k * HH * w]);
    }
    for (let i = 0; i < N; i++) {
      const A = pts[i], B = pts[(i + 1) % N];
      const g = (i / N) * 0.05;
      lb.seg([A[0], A[1], 0], [B[0], B[1], 0], g, g, edgeC, 0);
      if (i % 4 === 0) pb.add(A[0], A[1], 0, [2.2, 1.9, 1.5], g, { aK: [1] });
    }
    // engraved bands: three strips of diamond cross-hatching, scratched in left to right
    const bands: [number, number][] = [[0.62, 1.12], [-0.28, 0.52], [-1.18, -0.38]];
    const sp = 0.4;
    const xl = -HW + 0.28, xr = HW - 0.28;
    const jit = () => (r() - 0.5) * 0.02;
    bands.forEach(([y0, y1], bi) => {
      // frame lines of the band
      for (const y of [y0, y1]) {
        const g = 0.2 + (bi * 0.06);
        lb.seg([xl + jit(), y + jit(), 0], [xr + jit(), y + jit(), 0], g, g, lineC, 1);
      }
      const hgt = y1 - y0;
      for (const dir of [1, -1]) {
        for (let x0 = xl - hgt; x0 <= xr + hgt; x0 += sp) {
          // line from (x0, y0) rising to (x0 + dir*hgt, y1), clipped to the slab span
          let ax = x0, ay = y0, bx = x0 + dir * hgt, by = y1;
          const clip = (px: number, py: number, qx: number, qy: number): [number, number, number, number] | null => {
            let t0 = 0, t1 = 1; const dx = qx - px;
            if (Math.abs(dx) < 1e-6) return px >= xl && px <= xr ? [px, py, qx, qy] : null;
            const ta = (xl - px) / dx, tb = (xr - px) / dx;
            t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
            if (t0 >= t1) return null;
            return [px + dx * t0, py + (qy - py) * t0, px + dx * t1, py + (qy - py) * t1];
          };
          const cl = clip(ax, ay, bx, by);
          if (!cl) continue;
          [ax, ay, bx, by] = cl;
          const gx = ((ax + bx) / 2 - xl) / (xr - xl);
          const g = 0.3 + gx * 0.5 + (dir > 0 ? 0 : 0.05) + r() * 0.04;
          lb.seg([ax + jit(), ay + jit(), 0], [bx + jit(), by + jit(), 0], g, g, [lineC[0] * (0.8 + r() * 0.4), lineC[1] * (0.8 + r() * 0.4), lineC[2]], 2);
        }
      }
      // light caught at the diamond vertices on the band's mid-line
      for (let x = xl + sp / 2; x < xr; x += sp) {
        const g = 0.3 + ((x - xl) / (xr - xl)) * 0.5 + 0.05;
        pb.add(x, (y0 + y1) / 2, 0.01, [2.4, 2.1, 1.7], g, { aK: [0] });
      }
    });
    // ochre dust drifting off the stone
    for (let i = 0; i < 80; i++) {
      const a = r() * 6.283, rad = 0.9 + r() * 1.3;
      pb.add(Math.cos(a) * rad * HW * 0.9, Math.sin(a) * rad * HH * 0.9, (r() - 0.5) * 0.8, [1.6, 1.0, 0.6], 0.2 + r() * 0.6, { aK: [2] });
    }
    const lMat = lineMat({
      decl: 'uniform float uRev;', uniforms: { uRev: { value: 0 } },
      body: `
      float on = smoothstep(aG, aG+.05, uRev);
      float fl = .85 + .15*sin(uTime*1.4 + aSeed.x*30.);
      a = on * fl * (aSeed.w < .5 ? 1.0 : aSeed.w < 1.5 ? .9 : .75);`,
    });
    const pMat = pointMat({
      decl: 'attribute float aK; uniform float uRev;', uniforms: { uRev: { value: 0 } }, size: 1.2,
      body: `
      float on = smoothstep(aSeed.w, aSeed.w+.05, uRev);
      float tw = pow(.5+.5*sin(uTime*(.6+aSeed.y)+aSeed.z*50.), 3.);
      if (aK > 1.5) { p.y += mod(uTime*.05 + aSeed.x*3., 1.2) - .3; p.x += sin(uTime*.2+aSeed.z*20.)*.1; a = on*.35*(.4+tw); size = .35; }
      else if (aK > .5) { a = on*.9; size = .45; }
      else { a = on*(.6+.7*tw); size = .55 + .4*tw; }`,
    });
    return { lGeo: lb.build(), lMat, pGeo: pb.build(), pMat };
  }, []);
  useEffect(() => () => { lGeo.dispose(); pGeo.dispose(); lMat.dispose(); pMat.dispose(); }, [lGeo, pGeo, lMat, pMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('ochre-symbolic-thought');
    const rev = range(e - 0.6, e - 0.05, world.stationF);
    tickU(lMat, scene); tickU(pMat, scene, state.gl.getPixelRatio());
    lMat.uniforms.uRev.value = rev; pMat.uniforms.uRev.value = rev;
    if (root.current) {
      root.current.rotation.y = -0.38 + scene.t * 0.5;
      root.current.rotation.x = 0.1;
      root.current.rotation.z = 0.05;
      root.current.position.set(0.9, 0.35, 0);
    }
  });
  return (
    <group ref={root}>
      <lineSegments geometry={lGeo} material={lMat} frustumCulled={false} />
      <points geometry={pGeo} material={pMat} frustumCulled={false} />
    </group>
  );
}
