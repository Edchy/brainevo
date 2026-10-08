import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { PBuf, pointMat, tickU } from './common';

export default function Language() {
  const scene = useScene();
  const { geo, mat } = useMemo(() => {
    const b = new PBuf(41);
    const r = b.r;
    const q = world.quality;
    // minds: kind 0 (left) and 1 (right)
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 3000 * q; i++) {
        let x, y, z;
        do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
        const s = Math.hypot(x, y, z) || 1;
        const surf = r() < 0.55;
        const m = surf ? 1 / s : 1;
        b.add(x * m, y * m, z * m, [1, 1, 1], k);
      }
    }
    // waves: kind 2 (x = s along the wave, y = strand index)
    for (let st = 0; st < 7; st++) {
      for (let i = 0; i < 520 * q; i++) b.add(i / (520 * q) + r() * 0.002, st, 0, [1, 1, 1], 2);
    }
    // ghost shared scene: kind 3 (positions in local 2D)
    const g = (x: number, y: number, c: [number, number, number]) => b.add(x, y, (r() - 0.5) * 0.15, c, 3);
    const violet: [number, number, number] = [1.1, 0.8, 1.9], warm: [number, number, number] = [1.9, 1.3, 0.7], green: [number, number, number] = [0.6, 1.7, 1.0];
    for (let i = 0; i < 260; i++) { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.3; g(0.6 + Math.cos(a) * rr, 0.75 + Math.sin(a) * rr, warm); }
    for (let i = 0; i < 420; i++) { const x = r() * 2.2 - 1.1; g(x, -0.35 + 0.2 * Math.sin(x * 2.2 + 0.5) + (r() - 0.5) * 0.03, violet); }
    for (let i = 0; i < 120; i++) g(-0.55 + (r() - 0.5) * 0.04, -0.25 + r() * 0.75, warm);
    for (let i = 0; i < 360; i++) { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.42; g(-0.55 + Math.cos(a) * rr * 1.2, 0.6 + Math.sin(a) * rr * 0.9, green); }
    for (let i = 0; i < 300; i++) { const a = r() * 6.283, rr = Math.sqrt(r()); g(0.35 + Math.cos(a) * rr * 0.3, -0.12 + Math.sin(a) * rr * 0.13, violet); }
    for (const lx of [0.1, 0.22, 0.48, 0.6]) for (let i = 0; i < 20; i++) g(lx + (r() - 0.5) * 0.02, -0.25 + r() * 0.15, violet);
    for (let i = 0; i < 700; i++) { const a = r() * 6.283; g(Math.cos(a) * 1.35, 0.25 + Math.sin(a) * 1.15, [0.7, 0.8, 1.4]); }
    // helix: kind 4 (x = s, y = strand 0/1)
    for (let st = 0; st < 2; st++) for (let i = 0; i < 360 * q; i++) b.add(i / (360 * q), st, 0, [1, 1, 1], 4);
    const mat = pointMat({
      decl: 'uniform float uGhost,uHelix,uSpeak;',
      uniforms: { uGhost: { value: 0 }, uHelix: { value: 0 }, uSpeak: { value: 0 } },
      size: 0.8,
      body: `
      float kind = aSeed.w;
      float tw = pow(.5+.5*sin(uTime*(1.+aSeed.y*3.)+aSeed.z*50.), 5.);
      if (kind < 1.5) {
        float side = kind < .5 ? -1. : 1.;
        float rf = length(position);
        vec3 dir = normalize(position+1e-5);
        float wr = (fbm(dir*3.+side*5.)-.5)*.3;
        p = vec3(side*3.15, .55, 0.) + position*vec3(1.05,.85,.8)*(1.+wr*rf*rf);
        // the listener answers a beat after the speaker
        float talk = side < 0. ? .5+.5*sin(uT*30.) : .5+.5*sin(uT*30.-1.6);
        talk = smoothstep(.4,1.,talk);
        col = mix(vec3(1.7,.9,.4), vec3(.7,1.1,1.8), kind) ;
        a = .2*mix(.2,.9,step(.99,rf)+.0)*(.5+tw*1.2)*(1.+talk*.9);
        size = .4+.35*tw;
      } else if (kind < 2.5) {
        float s = position.x; float st = position.y;
        float dirn = mod(st,2.)*2.-1.;
        float ph = uT*26.*dirn + uTime*.8*dirn;
        float fr = 6.+st*2.3;
        float env = pow(sin(3.14159*s), .7);
        float y = sin(s*fr*3.14159 - ph + st)*(.28+.1*st/6.)*env + sin(s*fr*1.7 + ph*.6)*.1*env;
        p = vec3(mix(-2.0,2.0,s), .55 + y*(.8+.2*sin(uT*10.+st)), (st-3.)*.22);
        float pk = fract(s*dirn*.5 + uT*3.2 + uTime*.1 + st*.17);
        float pack = exp(-pow((pk-.5)*7.,2.));
        col = mix(vec3(1.9,1.0,.4), vec3(.6,1.2,2.0), s);
        a = .1 + .8*pack; a *= env + .1; size = .35 + pack*.7;
      } else if (kind < 3.5) {
        vec3 q = position;
        float gg = uGhost;
        float rise = smoothstep(aSeed.x*.7, aSeed.x*.7+.3, gg);
        p = vec3(q.x, q.y+.35, q.z-.1)*1.15 + vec3(0.,.15,0.) ;
        p += (1.-rise)*vec3((aSeed.y-.5)*2.,(aSeed.z-.5)*2.,0.);
        p.y += .03*sin(uTime*1.3+aSeed.x*20.)*rise;
        col = aCol*(.8+.4*tw);
        a = .35*rise*(.6+tw);
        size = .5+.3*tw;
      } else {
        float s = position.x; float st = position.y;
        float ang = s*6.283*3. + st*3.14159 + uT*8.;
        p = vec3(mix(-1.8,1.8,s), 2.15 + sin(ang)*.22, cos(ang)*.22);
        float rung = step(.93, fract(s*18.));
        col = mix(vec3(.5,1.4,1.0), vec3(1.8,1.2,.5), step(.5,fract(s*18.+st*.5)));
        a = uHelix*(.35+.9*pow(.5+.5*sin(uTime*2.-s*9.),3.));
        size = .5;
        if (uHelix<.01) a = 0.;
      }
      `,
    });
    return { geo: b.build(), mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e65 = eventPos('language-shares-simulations'), e66 = eventPos('language-foxp2');
    tickU(mat, scene, state.gl.getPixelRatio());
    mat.uniforms.uGhost.value = range(e65 - 0.5, e65 + 0.4, f);
    mat.uniforms.uHelix.value = near(e66, 0.8);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
