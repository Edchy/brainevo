import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range, rng } from '../../world/util';
import { PBuf, pointMat, tickU } from './common';

const BODY = /* glsl */ `
  float rf = aSeed.w;
  vec3 dir = normalize(position + 1e-5);
  float wr = (fbm(dir*3.2+1.)-.5)*0.2 + (vnoise(dir*10.)-.5)*0.06;
  vec3 A = vec3(2.5,1.1,1.0);
  vec3 B = vec3(1.85,1.5,1.42);
  float k = 1. + wr*rf*rf;
  vec3 pa = position*A*k;
  vec3 pb = position*B*k;
  pb.y += 0.12;
  pb.y *= 1.0 + 0.14*smoothstep(0.,1.,-dir.y)*step(dir.x,0.);
  pb.x *= 1.0 + 0.05*smoothstep(0.,1.,-dir.x);
  float m = smoothstep(0.,1.,uM);
  float tw = pow(.5+.5*sin(uTime*(1.+aSeed.y*2.)+aSeed.z*40.), 6.);
  vec3 amber = vec3(1.7,.85,.32); vec3 cool = vec3(.55,1.05,1.7);
  if (uMode < .5) {
    p = mix(pa, pb, m);
    float par = smoothstep(.3,-.7,dir.x)*smoothstep(-.1,.6,dir.y);
    float cer = smoothstep(-.1,-.7,dir.y)*smoothstep(.4,-.4,dir.x);
    float hl = max(par,cer)*sin(m*3.14159)*.8 + max(par,cer)*m*.25;
    col = vec3(1.0,1.0,1.02)*1.1 + vec3(.15,.2,.3)*hl;
    a = .2*mix(.05,1.,rf*rf*rf) * (.7 + tw*1.3) * (1. + uPulse*.5 + hl*.4);
    size = .3 + .3*rf + tw*.4 + hl*.25;
  } else if (uMode < 1.5) {
    // ghost of the old shape
    p = pa;
    col = amber*.5; a = .12*smoothstep(.05,.5,uM)*(1.-m*.35); size = .4;
  } else {
    // skull shell
    float sk = 1.22 + .02*sin(dir.x*6.);
    vec3 sa = dir*vec3(2.65,1.3,1.2)*sk; sa.y += .0; sa.x += .0;
    vec3 sb = dir*vec3(2.1,1.82,1.7)*sk; sb.y += .12;
    p = mix(sa, sb, m);
    // flat brow on the archaic skull: push the front lower and forward
    col = vec3(.55,.7,1.0)*.55; a = .12; size = .35;
  }
`;

export default function Morph() {
  const scene = useScene();
  const root = useRef<THREE.Group>(null);
  const { geo, mats } = useMemo(() => {
    const r = rng(11);
    const N = Math.floor(15000 * world.quality);
    const b = new PBuf(21);
    const dirv = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      dirv.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      while (dirv.lengthSq() > 1 || dirv.lengthSq() < 0.01) dirv.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      dirv.normalize();
      const surf = r() < 0.93;
      const rf = surf ? 1 : Math.cbrt(r()) * 0.92;
      b.add(dirv.x * rf, dirv.y * rf, dirv.z * rf, [1, 1, 1], rf);
    }
    const mk = (mode: number) => pointMat({ decl: 'uniform float uM,uPulse,uMode;', body: BODY, uniforms: { uM: { value: 0 }, uPulse: { value: 0 }, uMode: { value: mode } }, size: 0.9 });
    return { geo: b.build(), mats: [mk(0)] };
  }, []);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e0 = eventPos('jebel-irhoud-sapiens'), e1 = eventPos('globular-brain');
    const um = range(e0 + 0.15, e1 + 0.35, f);
    const pulse = Math.max(near(e0, 0.5), near(e1, 0.5));
    for (const m of mats) {
      tickU(m, scene, state.gl.getPixelRatio());
      m.uniforms.uM.value = um; m.uniforms.uPulse.value = pulse;
    }
    const g = root.current;
    if (g) {
      g.rotation.y = -0.75 + scene.t * 1.5;
      g.rotation.x = 0.08;
      g.position.y = Math.sin(scene.t * 3) * 0.05;
    }
  });
  return (
    <group ref={root}>
      <points geometry={geo} material={mats[0]} frustumCulled={false} />
    </group>
  );
}
