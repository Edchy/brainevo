import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { smoothstep } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU, type V3 } from '../human/common';
import { Brain, useBrainCtl } from '../shared/brain';

// Minds and machines, still only sketched: a brain on the left, a lattice of artificial nodes on the right, and threads
// reaching across between them, with signals running both ways. The oil pass turns it all to chalk underdrawing.

const BRAIN_AT: V3 = [-1.9, 1.05, 0];
const NET_AT: V3 = [3.0, 0.75, 0];

export default function Minds() {
  const scene = useScene();
  const bg = useRef<THREE.Group>(null);
  const ng = useRef<THREE.Group>(null);
  const bc = useBrainCtl({ grow: 1, holo: 1, holoColor: '#c9c2b0', starColor: '#f0e6d0', stars: 0.6 });
  const R = useMemo(() => {
    // lattice: nodes on a few nested shells, linked to their nearest neighbours
    const nb = new PBuf(401);
    const r = nb.r;
    const nodes: V3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (const [rad, n] of [[1.55, 70], [0.95, 26], [0.4, 6]] as const) {
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
        const p: V3 = [Math.cos(th) * rr * rad, y * rad, Math.sin(th) * rr * rad];
        nodes.push(p);
        nb.add(p[0], p[1], p[2], [1.6, 1.5, 1.3], rad);
      }
    }
    const eb = new LBuf(402);
    nodes.forEach((a, i) => {
      const d = nodes.map((b, j) => ({ j, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) })).filter((x) => x.j > i).sort((x, y) => x.d - y.d).slice(0, 3);
      for (const { j } of d) eb.seg(a, nodes[j], 0, 1, [1.2, 1.15, 1.0], 0);
    });
    const eMat = lineMat({ body: `a = .22 + .1*sin(uTime*.7 + aSeed.x*20.);` });
    const nMat = pointMat({ size: 1.1, body: `float tw = .5+.5*sin(uTime*(.8+aSeed.y*2.)+aSeed.z*40.); a = .55 + .45*tw; size = .35 + .25*tw;` });
    // threads across: gentle arcs from the brain's surface to the lattice, a pulse running each way
    const tb = new LBuf(403);
    const N = 40;
    for (let k = 0; k < 11; k++) {
      const yy = (k / 10 - 0.5) * 1.8 + (r() - 0.5) * 0.2, zz = (r() - 0.5) * 1.2;
      const a: V3 = [BRAIN_AT[0] + 0.85, BRAIN_AT[1] + yy * 0.5, zz * 0.5];
      const b: V3 = [NET_AT[0] - 1.45, NET_AT[1] + yy * 0.8, zz * 0.7];
      const lift = (r() - 0.5) * 1.4;
      const phase = r();
      let prev = a;
      for (let i = 1; i <= N; i++) {
        const u = i / N;
        const cur: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * lift, a[2] + (b[2] - a[2]) * u];
        tb.seg(prev, cur, (i - 1) / N, u, [1.3, 1.2, 1.0], k % 2, { aPh: [phase] });
        prev = cur;
      }
    }
    const tMat = lineMat({
      decl: 'attribute float aPh; uniform float uReach;', uniforms: { uReach: { value: 0 } },
      body: `
      float dir = aSeed.w > .5 ? 1. - aG : aG;            // alternate threads carry signals the other way
      float reach = step(abs(aG - .5)*2., uReach);          // threads grow from both ends to meet in the middle
      float ph = fract(uTime*.22 + aPh);
      float pulse = exp(-pow((dir - ph)*18., 2.));
      a = reach*(.16 + 1.1*pulse);
      col = col*(1. + pulse*.8);`,
    });
    // beads of light along the threads, so they have body enough to be drawn
    const bb = new PBuf(404);
    const tp = tb.pos, tg = tb.g, ts = tb.seed, tph = tb.ex.aPh;
    for (let i = 0; i < tp.length / 3; i += 4) bb.add(tp[i * 3], tp[i * 3 + 1], tp[i * 3 + 2], [1.4, 1.3, 1.1], ts[i * 4 + 3], { aG: [tg[i]], aK: [tph[i]] });
    const bMat = pointMat({
      decl: 'attribute float aG; attribute float aK; uniform float uReach;', uniforms: { uReach: { value: 0 } }, size: 0.7,
      body: `
      float dir = aSeed.w > .5 ? 1. - aG : aG;
      float reach = step(abs(aG - .5)*2., uReach);
      float pulse = exp(-pow((dir - fract(uTime*.22 + aK))*18., 2.));
      a = reach*(.35 + 1.4*pulse); size = .45 + 1.2*pulse;`,
    });
    return { nGeo: nb.build(), nMat, eGeo: eb.build(), eMat, tGeo: tb.build(), tMat, bGeo: bb.build(), bMat };
  }, []);
  useEffect(() => () => { [R.nGeo, R.eGeo, R.tGeo, R.bGeo].forEach((g) => g.dispose()); [R.nMat, R.eMat, R.tMat, R.bMat].forEach((m) => m.dispose()); }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const t = scene.t, tm = world.reduced ? 0 : world.time;
    const pr = st.gl.getPixelRatio();
    for (const m of [R.nMat, R.eMat, R.tMat, R.bMat]) tickU(m, scene, pr);
    R.tMat.uniforms.uReach.value = R.bMat.uniforms.uReach.value = smoothstep(0.15, 0.6, t);
    bc.alpha = scene.weight * 0.6;
    if (bg.current) bg.current.rotation.y = 0.5 + 0.15 * Math.sin(tm * 0.15);
    if (ng.current) { ng.current.rotation.y = tm * 0.06; ng.current.rotation.x = 0.2 * Math.sin(tm * 0.1); }
  });

  return (
    <group>
      <group position={BRAIN_AT} scale={1.05}><group ref={bg}><Brain ctl={bc} /></group></group>
      <group position={NET_AT} ref={ng}>
        <lineSegments geometry={R.eGeo} material={R.eMat} frustumCulled={false} />
        <points geometry={R.nGeo} material={R.nMat} frustumCulled={false} />
      </group>
      <lineSegments geometry={R.tGeo} material={R.tMat} frustumCulled={false} />
      <points geometry={R.bGeo} material={R.bMat} frustumCulled={false} />
    </group>
  );
}
