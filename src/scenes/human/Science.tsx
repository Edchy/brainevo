import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range, smoothstep } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

// [semi-major, eccentricity, hue]
const BODIES: [number, number, [number, number, number]][] = [
  [0, 0, [2.5, 1.7, .6]], // Sun (seen from Earth in the geocentric view)
  [0.8, 0.2, [1.4, 1.2, 1.0]],
  [1.2, 0.02, [2.0, 1.5, .7]],
  [1.8, 0.05, [.5, 1.2, 2.2]],
  [2.7, 0.09, [2.2, .7, .4]],
  [4.0, 0.05, [2.0, 1.5, 1.0]],
  [5.2, 0.06, [1.8, 1.6, .9]],
];

const FNS = /* glsl */ `
vec2 helio(float a, float e, float tau){
  float P = pow(a/1.8, 1.5);
  float M = 6.28318*tau/P;
  float th = M + 2.*e*sin(M) + 1.25*e*e*sin(2.*M);
  float r = a*(1.-e*e)/(1.+e*cos(th));
  return r*vec2(cos(th), sin(th));
}`;

export default function Science() {
  const scene = useScene();
  const { pgeo, pmat, lgeo, lmat, sgeo, smat } = useMemo(() => {
    const pb = new PBuf(121);
    const N = Math.floor(520 * world.quality);
    BODIES.forEach((bd, bi) => {
      for (let i = 0; i < N; i++) pb.add(i / N, bi, 0, bd[2], bi, { aB: [bd[0], bd[1], 0] });
    });
    // comet tail
    for (let i = 0; i < 160; i++) pb.add(i / 160, 9, 0, [.8, 1.4, 2.0], 9, { aB: [6.5, .88, 0] });
    // Jupiter moons (Galileo)
    for (let m = 0; m < 4; m++) pb.add(0, 10 + m, 0, [2.0, 1.8, 1.4], 10 + m, { aB: [0, 0, 0] });
    const pmat = pointMat({
      decl: 'attribute vec3 aB; uniform float uGeo,uNow,uComet,uMoons;' + FNS,
      uniforms: { uGeo: { value: 1 }, uNow: { value: 0 }, uComet: { value: 0 }, uMoons: { value: 0 } },
      size: 1,
      body: `
      float k = aSeed.w;
      if (k < 8.) {
        float s = position.x;
        float len = k < .5 ? 3.0 : 2.6;
        float tau = uNow - s*len;
        vec2 H = k < .5 ? vec2(0.) : helio(aB.x, aB.y, tau);
        vec2 E = helio(1.8, .05, tau);
        vec2 q = H - uGeo*E;
        // Earth keeps its own orbit once the Sun is the centre
        float isEarth = step(2.5,k)*step(k,3.5);
        a = (1.-isEarth*uGeo) * (.04 + .5*pow(1.-s,3.) + 2.*exp(-s*60.));
        if (k < .5) a *= 1.;
        p = vec3(q.x, 0., q.y);
        size = .45 + 1.5*exp(-s*70.) * (k<.5 ? 2.2 : 1.) + .2*(1.-s);
        col = col*(.55+.8*exp(-s*40.));
        if (k < .5) a *= (1.-.8*(1.-uGeo));
      } else if (k < 9.5) {
        float s = position.x;
        float tau = uNow*.35 + .5;
        float P = pow(6.5/1.8,1.5)*3.;
        float M = 6.28318*tau/P*2.;
        float th = M + 2.*aB.y*sin(M);
        float r = aB.x*(1.-aB.y*aB.y)/(1.+aB.y*cos(th));
        vec2 hd = r*vec2(cos(th),sin(th));
        vec2 away = normalize(hd+1e-4);
        vec2 q = hd + away*s*(1.5+1.5/ (r*.3+.4)) + (vec2(aSeed.x,aSeed.y)-.5)*.05*s*3.;
        p = vec3(q.x, 0., q.y);
        a = uComet*(1.-s)*(1.-s)*(.15+.5/(r*.3+.5));
        size = .4+1.8*exp(-s*30.);
      } else {
        float j = k-10.;
        float tau = uNow;
        vec2 J = helio(4.0, .05, tau) - uGeo*helio(1.8,.05,tau);
        float an = tau*(9.+j*4.5) + j*1.7;
        float rad = .22 + j*.1;
        p = vec3(J.x + cos(an)*rad*1.6, 0., J.y + sin(an)*rad*.3);
        a = uMoons*.9; size = .7;
      }
      `,
    });
    // telescope
    const lb = new LBuf(122);
    const c: [number, number, number] = [1.7, 1.2, .5];
    const ring = (z: number, rad: number) => { for (let i = 0; i < 16; i++) { const a0 = (i / 16) * 6.283, a1 = ((i + 1) / 16) * 6.283; lb.seg([Math.cos(a0) * rad, Math.sin(a0) * rad, z], [Math.cos(a1) * rad, Math.sin(a1) * rad, z], 0, 1, c); } };
    ring(0, 0.16); ring(1.3, 0.2); ring(2.0, 0.22);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; lb.seg([Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0], [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 2.0], 0, 1, c); }
    lb.seg([0.1, -0.2, 0.9], [0.5, -1.4, 1.2], 0, 1, c); lb.seg([-0.1, -0.2, 0.9], [-0.4, -1.4, 1.4], 0, 1, c); lb.seg([0, -0.2, 0.9], [0.0, -1.4, 0.2], 0, 1, c);
    const lmat = lineMat({ body: 'a=.8;' });
    // starfield
    const sb = new PBuf(123);
    for (let i = 0; i < 160 * world.quality; i++) {
      const v = [sb.r() - .5, sb.r() - .5, sb.r() - .5]; const l = Math.hypot(v[0], v[1], v[2]) || 1; const R = 14 + sb.r() * 20;
      sb.add(v[0] / l * R, v[1] / l * R * .6, v[2] / l * R - 8, [.8, .9, 1.4], 0);
    }
    const smat = pointMat({ size: .7, body: 'a=.35*(.3+.7*pow(.5+.5*sin(uTime*(.5+aSeed.y)+aSeed.z*60.),3.)); size=.4+aSeed.x*.6;' });
    return { pgeo: pb.build(), pmat, lgeo: lb.build(), lmat, sgeo: sb.build(), smat };
  }, []);
  useEffect(() => () => { pgeo.dispose(); lgeo.dispose(); sgeo.dispose(); pmat.dispose(); lmat.dispose(); smat.dispose(); }, [pgeo, lgeo, sgeo, pmat, lmat, smat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('scientific-revolution');
    const pr = state.gl.getPixelRatio();
    for (const m of [pmat, smat]) tickU(m, scene, pr);
    tickU(lmat, scene);
    const u = pmat.uniforms;
    u.uGeo.value = 1 - smoothstep(e - 0.55, e + 0.15, f);
    u.uNow.value = 3 + scene.t * 14 + (world.reduced ? 0 : world.time * 0.12);
    u.uComet.value = range(e - 0.1, e + 0.3, f);
    u.uMoons.value = range(e - 0.9, e - 0.5, f) * (1 - range(e - 0.2, e + 0.1, f));
  });
  return (
    <group>
      <points geometry={sgeo} material={smat} frustumCulled={false} />
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
    </group>
  );
}
