import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

const TG: [number, number][] = [[2.5, 0.1], [1.5, 1.0], [3.7, 0.9], [3.6, -0.8], [1.5, -0.8], [2.5, 0.1], [3.7, 0.9], [1.5, -0.8]];
function path(s: number, out: [number, number]) {
  const n = TG.length - 1;
  const c = Math.min(n - 1e-4, Math.max(0, s));
  const i = Math.floor(c), f = c - i;
  const hold = Math.min(1, f / 0.7);
  const e = hold * hold * (3 - 2 * hold);
  const a = TG[i], b = TG[i + 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const bend = Math.sin(e * Math.PI) * 0.25 * (i % 2 ? 1 : -1);
  out[0] = a[0] + dx * e - (dy / L) * bend; out[1] = a[1] + dy * e + (dx / L) * bend;
}

const NT = 140;
export default function Bci() {
  const scene = useScene();
  const { geo, mat, lgeo, lmat, tgeo, tmat, trail, tpos } = useMemo(() => {
    const b = new PBuf(151);
    const r = b.r;
    const q = world.quality;
    // 0: cortex sheet
    for (let i = 0; i < 700 * q; i++) b.add(-5.2 + r() * 4.6, -1.25, (r() - 0.5) * 3.2, [1, 1, 1], 0, { aX: [r(), 0] });
    // 1: needle tips (10x10)
    for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 6; iz++) b.add(-4.6 + ix * 0.5, -1.0, -1.25 + iz * 0.5, [1, 1, 1], 1, { aX: [0, 0] });
    // 3: data stream
    for (let i = 0; i < 700 * q; i++) b.add(0, 0, 0, [1, 1, 1], 3, { aX: [0, 0] });
    // 5: targets
    for (let t = 0; t < 5; t++) for (let i = 0; i < 70; i++) b.add(TG[t][0] + Math.cos((i / 70) * 6.283) * 0.2, TG[t][1] + Math.sin((i / 70) * 6.283) * 0.2, 0, [1, 1, 1], 5, { aX: [t, 0] });
    const mat = pointMat({
      decl: 'attribute vec2 aX; uniform float uAct,uHit;', uniforms: { uAct: { value: 0 }, uHit: { value: 0 } }, size: 0.9,
      body: `
      float k = aSeed.w;
      float tw = pow(.5+.5*sin(uTime*(2.+aSeed.y*4.)+aSeed.z*60.+uT*30.*aSeed.x),10.);
      if (k < .5) {
        p.y += sin(p.x*1.3)*.08 + sin(p.z*1.7+1.)*.07;
        col = mix(vec3(1.7,.55,.6), vec3(.8,.7,1.6), aSeed.x);
        a = .05 + tw*(.4+uAct*.8)*.7; size=.3+tw*.5;
      } else if (k < 1.5) {
        float fire = pow(.5+.5*sin(uTime*(3.+aSeed.x*5.)+aSeed.y*40.+uT*20.),12.)*(.4+uAct);
        col = vec3(2.0,1.6,.6); a = .5+fire*1.2; size = .5+fire*1.0;
      } else if (k < 3.5) {
        float u = fract(aSeed.x + uTime*(.18+.1*uAct) + uT*3.);
        vec3 P0=vec3(-3.,1.2,0.), P1=vec3(-.9,3.1,0.), P2=vec3(.5,.4,0.);
        vec3 pp = (1.-u)*(1.-u)*P0 + 2.*(1.-u)*u*P1 + u*u*P2;
        pp += vec3(0., (aSeed.y-.5)*.08, (aSeed.z-.5)*.1);
        p = pp;
        col = mix(vec3(2.0,1.6,.6), vec3(.5,1.3,2.2), u);
        a = (.2+.7*uAct)*sin(3.14159*u); size = .4+.4*uAct;
      } else {
        float hit = 0.;
        float idx = aX.x;
        a = .4 + .6*smoothstep(.0,1.,uHit); col = vec3(.5,1.4,2.2); size = .45;
        a += tw*.2;
      }`,
    });
    // needles + plate + screen frame
    const lb = new LBuf(152);
    const c: [number, number, number] = [1.7, 1.3, .55];
    for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 6; iz++) lb.seg([-4.6 + ix * 0.5, 1.1, -1.25 + iz * 0.5], [-4.6 + ix * 0.5, -1.0, -1.25 + iz * 0.5], 0, 1, c);
    const pl: [number, number, number][] = [[-4.85, 1.1, -1.5], [-1.95, 1.1, -1.5], [-1.95, 1.1, 1.5], [-4.85, 1.1, 1.5]];
    for (let i = 0; i < 4; i++) lb.seg(pl[i], pl[(i + 1) % 4], 0, 1, [2.2, 1.6, .7]);
    const fr: [number, number, number][] = [[0.6, -1.5, 0], [4.6, -1.5, 0], [4.6, 1.7, 0], [0.6, 1.7, 0]];
    for (let i = 0; i < 4; i++) lb.seg(fr[i], fr[(i + 1) % 4], 0.7, 0.7, [.5, 1.0, 1.8]);
    const lmat = lineMat({ body: 'a = mix(.06,.5,aG*aG) * (.8+.2*sin(uTime+aSeed.x*20.));' });
    // cursor trail (CPU-updated)
    const tpos = new Float32Array(NT * 3);
    const tb = new PBuf(153);
    for (let j = 0; j < NT; j++) tb.add(0, 0, 0, [1, 1, 1], j / NT);
    const tgeo = tb.build();
    tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage));
    const tmat = pointMat({
      size: 1,
      body: `
      float j = aSeed.w;
      col = mix(vec3(2.5,2.2,1.8), vec3(.3,1.0,2.2), min(1.,j*3.));
      a = (1.-j)*(1.-j)*1.0 + step(j,.001)*2.; size = (1.-j)*.9+.2 + step(j,.001)*2.2;`,
    });
    return { geo: b.build(), mat, lgeo: lb.build(), lmat, tgeo, tmat, trail: tgeo, tpos };
  }, []);
  useEffect(() => () => { geo.dispose(); lgeo.dispose(); tgeo.dispose(); mat.dispose(); lmat.dispose(); tmat.dispose(); }, [geo, lgeo, tgeo, mat, lmat, tmat]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('brain-computer-interfaces');
    const pr = state.gl.getPixelRatio();
    const act = 0.35 + 0.65 * near(e, 0.8);
    tickU(mat, scene, pr); mat.uniforms.uAct.value = act; mat.uniforms.uHit.value = near(e, 0.6);
    tickU(lmat, scene);
    tickU(tmat, scene, pr);
    const s0 = scene.t * (TG.length - 1) * 0.98 + (world.reduced ? 0 : Math.sin(world.time * 0.2) * 0.02);
    const o: [number, number] = [0, 0];
    for (let j = 0; j < NT; j++) {
      path(Math.max(0, s0 - j * 0.012), o);
      tpos[j * 3] = o[0]; tpos[j * 3 + 1] = o[1]; tpos[j * 3 + 2] = 0.02;
    }
    trail.getAttribute('position').needsUpdate = true;
  });
  return (
    <group>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <points geometry={tgeo} material={tmat} frustumCulled={false} />
    </group>
  );
}
