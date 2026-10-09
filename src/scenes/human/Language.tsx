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
      for (let i = 0; i < 1700 * q; i++) {
        let x, y, z;
        do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
        const s = Math.hypot(x, y, z) || 1;
        const surf = r() < 0.92;
        const m = surf ? 1 / s : 1;
        b.add(x * m, y * m, z * m, [1, 1, 1], k);
      }
    }
    // waves: kind 2 (x = s along the wave, y = strand index)
    for (let st = 0; st < 3; st++) {
      for (let i = 0; i < 900 * q; i++) b.add(i / (900 * q) + r() * 0.0005, st, 0, [1, 1, 1], 2);
    }
    // helix: kind 4 (x = s, y = strand 0/1)
    for (let st = 0; st < 2; st++) for (let i = 0; i < 800 * q; i++) b.add(i / (800 * q), st, 0, [1, 1, 1], 4);
    for (let k = 0; k < 15; k++) for (let i = 0; i < 16; i++) b.add((k + 0.5) / 15, i / 15, 0, [1, 1, 1], 5);
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
        a = .26*mix(.03,1.,smoothstep(.92,1.,rf))*(.6+tw*1.1)*(1.+talk*1.2)*(1.-.7*uHelix);
        size = .3+.3*tw;
        col = vec3(1.4,1.4,1.5);
      } else if (kind < 2.5) {
        float s = position.x; float st = position.y;
        float dirn = mod(st,2.)*2.-1.; st = st*2.+1.;
        float ph = uT*26.*dirn + uTime*.8*dirn;
        float fr = 6.+st*2.3;
        float env = pow(sin(3.14159*s), .7);
        float y = sin(s*fr*3.14159 - ph + st)*(.28+.1*st/6.)*env + sin(s*fr*1.7 + ph*.6)*.1*env;
        p = vec3(mix(-2.3,2.3,s), .55 + y*(.8+.2*sin(uT*10.+st)), (st-3.)*.22);
        float pk = fract(s*dirn*.5 + uT*3.2 + uTime*.1 + st*.17);
        float pack = exp(-pow((pk-.5)*7.,2.));
        col = vec3(1.6,1.6,1.7);
        a = (.18 + .9*pack) * env * (1.-uHelix) + 0.; size = .3 + pack*.6;
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
      } else if (kind < 4.5) {
        float s = position.x; float st = position.y;
        float ang = s*6.283*2.4 + st*3.14159 + uT*8. + uTime*.3;
        float env = smoothstep(0.,.08,s)*smoothstep(1.,.92,s);
        p = vec3(mix(-2.5,2.5,s), .55 + sin(ang)*.5*env, cos(ang)*.5*env);
        col = vec3(1.6,1.6,1.7)*(.8+.5*(cos(ang)*.5+.5));
        a = uHelix*(.7+.5*pow(.5+.5*sin(uTime*1.5-s*9.),3.))*env;
        size = .45;
      } else {
        float s = position.x; float t2 = position.y;
        float ang = s*6.283*2.4 + uT*8. + uTime*.3;
        float env = smoothstep(0.,.08,s)*smoothstep(1.,.92,s);
        vec3 p0 = vec3(0., sin(ang)*.5*env, cos(ang)*.5*env);
        vec3 p1 = vec3(0., sin(ang+3.14159)*.5*env, cos(ang+3.14159)*.5*env);
        p = vec3(mix(-2.5,2.5,s), .55, 0.) + mix(p0,p1,t2);
        col = vec3(1.4,1.4,1.5);
        a = uHelix*.5*env; size = .3;
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
