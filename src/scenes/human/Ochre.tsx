import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, PBuf, pointMat, tickU } from './common';

// hand stencil as a union of capsules (unit-ish coordinates, y up)
const CAPS: [number, number, number, number, number][] = [
  [0, -0.15, 0, -0.2, 0.5], // palm (disc)
  [0, -0.4, 0, -1.4, 0.3], // wrist
  [-0.45, -0.1, -0.95, 0.4, 0.13], // thumb
  [-0.3, 0.3, -0.42, 1.1, 0.12], // index
  [-0.08, 0.38, -0.1, 1.25, 0.125], // middle
  [0.14, 0.33, 0.2, 1.1, 0.12], // ring
  [0.34, 0.2, 0.52, 0.8, 0.105], // pinky
];
function sdHand(x: number, y: number) {
  let d = 1e9;
  for (const [ax, ay, bx, by, r] of CAPS) {
    const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay + 1e-9)));
    d = Math.min(d, Math.hypot(pax - bax * h, pay - bay * h) - r);
  }
  return d;
}

const WALL_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uGlow; varying vec2 vUv;
void main(){
  vec2 p=vUv*vec2(8.,5.);
  float h=fbm(vec3(p*1.6,1.))*.7+fbm(vec3(p*6.,4.))*.3;
  float e=.02; float hx=fbm(vec3((p+vec2(e,0.))*1.6,1.))*.7+fbm(vec3((p+vec2(e,0.))*6.,4.))*.3;
  float hy=fbm(vec3((p+vec2(0.,e))*1.6,1.))*.7+fbm(vec3((p+vec2(0.,e))*6.,4.))*.3;
  vec3 n=normalize(vec3((h-hx)/e*.35,(h-hy)/e*.35,1.));
  vec2 lp=vec2(.5,.52); float fl=.9+.1*sin(uTime*7.+sin(uTime*3.1)*2.);
  vec3 L=normalize(vec3((lp-vUv)*vec2(8.,5.)*.35,.8));
  float dif=max(dot(n,L),0.);
  float r=length((vUv-lp)*vec2(1.,.8));
  float lit=exp(-r*r*5.)*fl*uGlow;
  vec3 c=vec3(.5,.26,.15)*(.02+dif*lit*.5)+vec3(.008,.006,.012);
  vec2 q=abs(vUv-.5)*2.; float m=(1.-smoothstep(.55,1.,q.x))*(1.-smoothstep(.55,1.,q.y));
  gl_FragColor=vec4(c,uW*m);
}`;

export default function Ochre() {
  const scene = useScene();
  const { geo, mat, wallMat } = useMemo(() => {
    const b = new PBuf(31);
    const N = Math.floor(16000 * world.quality);
    const r = b.r;
    let n = 0;
    while (n < N) {
      const x = (r() * 2 - 1) * 1.9, y = r() * 3.3 - 1.4;
      const d = sdHand(x, y);
      if (d < 0.015 + r() * 0.01) continue;
      const sx = Math.abs(x) / 1.9, sy = Math.abs(y - 0.25) / 1.65;
      const fall = (1 - Math.min(1, Math.max(0, (sx - 0.5) / 0.5))) * (1 - Math.min(1, Math.max(0, (sy - 0.5) / 0.5)));
      if (r() > (Math.exp(-d * 3.2) * 0.9 + 0.02) * fall) continue;
      b.add(x, y, 0.02, [1, 1, 1], r());
      n++;
    }
    const mat = pointMat({
      decl: 'uniform float uSpray;',
      uniforms: { uSpray: { value: 0 } },
      size: 0.75,
      body: `
      float d = aSeed.w; // delay
      vec3 tgt = p;
      // powder mound at the foot of the wall, ground in circles
      float ang = aSeed.x*6.283 + uTime*(.6+aSeed.y) + aSeed.z*10.;
      float rr = sqrt(aSeed.y)*.9;
      vec3 mound = vec3(-2.6 + cos(ang)*rr, -1.9 + (1.-aSeed.y)*.35 + sin(ang*2.)*.03, 1.0 + sin(ang)*rr*.5);
      mound.y += .08*pow(.5+.5*sin(uTime*2.+aSeed.x*9.),4.)*uMillW;
      float s = clamp((uSpray - d*.75)/.25, 0., 1.);
      float e = s*s*(3.-2.*s);
      // arc travel from the mouth/hand towards the wall, with turbulence
      vec3 mid = mix(mound, tgt, e);
      mid.z += sin(e*3.14159)*1.6*(aSeed.z-.2);
      mid.y += sin(e*3.14159)*.9;
      mid.x += (aSeed.y-.5)*sin(e*3.14159)*1.2;
      p = mid;
      p.z += (1.-e)*0. + (aSeed.z-.5)*.02;
      float settled = smoothstep(.85,1.,e);
      col = mix(vec3(1.5,.4,.14), vec3(1.4,.2,.07), settled)*(.8+aSeed.x*.5);
      col = mix(col, vec3(1.8,.5,.2), uFlash*(1.-settled)*.6);
      a = 1.5*(.45 + .2*sin(uTime*3.+aSeed.z*30.)*(1.-settled)) * (.7 + .3*settled) * mix(.5,1.,s);
      size = mix(.7,.45,settled) + (1.-settled)*.3*s;
      `,
    });
    mat.vertexShader = mat.vertexShader.replace('uniform float uSpray;', 'uniform float uSpray; uniform float uFlash; uniform float uMillW;');
    mat.uniforms.uFlash = { value: 0 };
    mat.uniforms.uMillW = { value: 1 };
    const wallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: WALL_FS,
    });
    return { geo: b.build(), mat, wallMat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); wallMat.dispose(); }, [geo, mat, wallMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('ochre-symbolic-thought');
    const f = world.stationF;
    tickU(mat, scene, state.gl.getPixelRatio());
    mat.uniforms.uSpray.value = range(e - 0.35, e + 0.45, f);
    mat.uniforms.uFlash.value = near(e, 0.4) * 0.5;
    wallMat.uniforms.uW.value = scene.weight;
    wallMat.uniforms.uTime.value = world.reduced ? 0 : world.time;
    wallMat.uniforms.uGlow.value = 0.6 + 0.6 * range(e - 0.6, e + 0.3, f);
  });
  return (
    <group>
      <mesh position={[0, 0.3, -0.05]} material={wallMat}>
        <planeGeometry args={[9, 6]} />
      </mesh>
      <points geometry={geo} material={mat} frustumCulled={false} position={[0.3, 0.5, 0]} scale={1.15} />
    </group>
  );
}
