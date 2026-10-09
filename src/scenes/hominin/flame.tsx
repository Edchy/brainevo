import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { world } from '../../world/store';
import { rng } from '../../world/util';

/** shared controls: F = fire strength 0..1 (0 = cold), flick = flicker multiplier, alpha = scene weight */
export interface FlameCtl { F: number; flick: number; alpha: number; time: number }
export const newFlameCtl = (): FlameCtl => ({ F: 1, flick: 1, alpha: 1, time: 0 });

const NOISE2 = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn2(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
`;

/** Layered flame tongues: crossed planes, each a domain-warped noise flame with a physically-ordered colour ramp. */
export function Flame({ ctl, height = 1.5, width = 0.75, tongues = 7, seed = 3 }: { ctl: FlameCtl; height?: number; width?: number; tongues?: number; seed?: number }) {
  const R = useMemo(() => {
    const r = rng(seed);
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1); geo.translate(0, 0.5, 0);
    const mk = (s: number, hot: number) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uT: { value: 0 }, uF: { value: 1 }, uSeed: { value: s }, uHot: { value: hot } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `${NOISE2}
        uniform float uT, uF, uSeed, uHot; varying vec2 vUv;
        void main(){
          float y = vUv.y, X = vUv.x*2. - 1.;
          float t = uT*1.25 + uSeed*17.;
          float sway = (fbm2(vec2(t*.55 + uSeed*9., y*1.4)) - .5) * 1.0 * y*y;
          float x = X - sway;
          vec2 q = vec2(x*1.7 + uSeed*5., y*1.9 - t*1.55);
          float warp = fbm2(q*2.1 + vec2(0., -t*.5));
          float n = fbm2(q*vec2(1.5, 1.05) + vec2(warp*.9, 0.));
          float W = mix(.7, .03, pow(y, .8));
          float edge = abs(x)/W;
          float body = 1. - smoothstep(.45, 1.05, edge + (n - .5)*.85*(.2 + y));
          float top = 1. - smoothstep(.35, 1., y + (n - .5)*.6 + .06);
          float I = body*top;
          float heat = I*(1.25 - y*.95)*(1. - edge*.55)*uHot;
          vec3 c = mix(vec3(.5,.05,.01), vec3(1.,.34,.03), smoothstep(.0,.3,heat));
          c = mix(c, vec3(1.,.72,.18), smoothstep(.28,.62,heat));
          c = mix(c, vec3(1.,.93,.7), smoothstep(.62,.95,heat));
          // blue-ish root where gas meets the coals
          c += vec3(.02,.05,.2) * (1. - smoothstep(0., .12, y)) * I;
          float a = I*smoothstep(0., .04, y);
          gl_FragColor = vec4(c*a*1.45*uF, 1.);
        }`,
    });
    const items = Array.from({ length: tongues }, (_, i) => {
      const core = i === 0;
      const a = (i / tongues) * Math.PI + r() * 0.3;
      const rad = core ? 0 : 0.06 + r() * 0.16;
      return {
        mat: mk(r(), core ? 1.25 : 0.95 + r() * 0.2), yaw: a, x: Math.cos(a * 2.3) * rad, z: Math.sin(a * 2.3) * rad,
        h: height * (core ? 1 : 0.5 + r() * 0.42), w: width * (core ? 1 : 0.55 + r() * 0.35),
      };
    });
    return { geo, items };
  }, [height, width, tongues, seed]);
  useEffect(() => () => { R.geo.dispose(); R.items.forEach((i) => i.mat.dispose()); }, [R]);
  useFrame(() => {
    const tm = world.reduced ? 0 : world.time;
    for (const it of R.items) { it.mat.uniforms.uT.value = tm; it.mat.uniforms.uF.value = ctl.F * ctl.flick * ctl.alpha; }
  });
  return (
    <group>
      {R.items.map((it, i) => (
        <mesh key={i} geometry={R.geo} material={it.mat} position={[it.x, 0.02, it.z]} rotation={[0, it.yaw, 0]} scale={[it.w, it.h * (0.001 + ctl.F), 1]} frustumCulled={false} renderOrder={3} />
      ))}
    </group>
  );
}

/** Rising embers and sparks with curly drift; colour cools from yellow to dull red as they age. */
export function Embers({ ctl, count = 140, radius = 0.35, rise = 3.2, seed = 8 }: { ctl: FlameCtl; count?: number; radius?: number; rise?: number; seed?: number }) {
  const R = useMemo(() => {
    const r = rng(seed), n = Math.max(20, Math.floor(count * world.quality));
    const sd = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) sd[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(sd, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uT: { value: 0 }, uF: { value: 1 }, uRad: { value: radius }, uRise: { value: rise } },
      vertexShader: `attribute vec4 aS; uniform float uT, uF, uRad, uRise; varying float vK; varying float vA;
        void main(){
          float sp = .05 + aS.y*.09;
          float k = fract(aS.x + uT*sp);
          float a = aS.z*6.2831;
          float r0 = uRad*aS.w;
          vec3 p = vec3(cos(a)*r0, .1, sin(a)*r0);
          p.y += k*uRise*(.55 + aS.y*.7);
          float w = k*k;
          p.x += (sin(uT*.9 + aS.x*40.) + sin(uT*2.1 + aS.w*30.)*.4) * .35*w + cos(a)*k*.5;
          p.z += (cos(uT*.8 + aS.y*40.) + cos(uT*1.9 + aS.z*30.)*.4) * .35*w + sin(a)*k*.5;
          vK = k;
          float tw = .55 + .45*sin(uT*(5. + aS.w*9.) + aS.x*60.);
          vA = (1. - k)*smoothstep(0., .04, k)*tw*uF*step(aS.y, uF*1.05);
          vec4 mv = modelViewMatrix*vec4(p,1.);
          gl_PointSize = (14. + aS.w*18.)*(1. - k*.6)/(-mv.z)*80./60.;
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `varying float vK; varying float vA; void main(){
          float d = length(gl_PointCoord - .5)*2.; float a = max(0., 1. - d); a = a*a;
          vec3 c = mix(vec3(3.2,2.0,.7), vec3(1.4,.28,.05), smoothstep(0.,.8,vK));
          gl_FragColor = vec4(c*a*vA, 1.); }`,
    });
    return { g, mat };
  }, [count, radius, rise, seed]);
  useEffect(() => () => { R.g.dispose(); R.mat.dispose(); }, [R]);
  useFrame(() => { R.mat.uniforms.uT.value = world.reduced ? 0 : world.time; R.mat.uniforms.uF.value = ctl.F * ctl.alpha; });
  return <points geometry={R.g} material={R.mat} frustumCulled={false} renderOrder={4} />;
}

/** Glowing charcoal logs / coals (emissive cracks) in a loose cone. */
export function Coals({ ctl, logs = 5, seed = 4 }: { ctl: FlameCtl; logs?: number; seed?: number }) {
  const R = useMemo(() => {
    const r = rng(seed);
    const geo = new THREE.CylinderGeometry(0.07, 0.085, 1, 10, 6); geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uF: { value: 1 } },
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec2 vUv; void main(){ vP = position; vUv = uv; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `${NOISE2}
        uniform float uT, uF; varying vec3 vP; varying vec3 vN; varying vec2 vUv;
        void main(){
          vec2 p = vec2(vUv.x*6.28*1.5, vUv.y*5.);
          float c1 = fbm2(p*1.7 + 3.);
          float crack = 1. - smoothstep(.0, .05, abs(c1 - .5));
          float c2 = 1. - smoothstep(.0, .035, abs(fbm2(p*3.3 + 9.) - .5));
          float glow = max(crack, c2*.7) * (.55 + .45*sin(uT*3. + c1*30.));
          float grad = smoothstep(.9, .0, vUv.y);                 // hotter at the base of the log
          vec3 ash = vec3(.03,.025,.025) + vec3(.07,.06,.055)*fbm2(p*5.);
          vec3 hot = vec3(1.,.26,.03)*(glow*(.35 + grad*1.0)) * 1.5;
          gl_FragColor = vec4(ash*(.4 + uF*.8) + hot*uF, 1.); }`,
    });
    const logs_ = Array.from({ length: logs }, (_, i) => {
      const a = (i / logs) * Math.PI * 2 + r() * 0.5, lean = 1.0 + r() * 0.35;
      return { a, lean, len: 0.7 + r() * 0.3, x: Math.cos(a) * 0.3, z: Math.sin(a) * 0.3 };
    });
    return { geo, mat, logs: logs_ };
  }, [logs, seed]);
  useEffect(() => () => { R.geo.dispose(); R.mat.dispose(); }, [R]);
  useFrame(() => { R.mat.uniforms.uT.value = world.reduced ? 0 : world.time; R.mat.uniforms.uF.value = ctl.F * ctl.flick * ctl.alpha; });
  return (
    <group>
      {R.logs.map((l, i) => (
        <mesh key={i} geometry={R.geo} material={R.mat} position={[l.x * 0.45, 0.05, l.z * 0.45]} rotation={[-l.lean * Math.sin(l.a) * 0.9, 0, l.lean * Math.cos(l.a) * 0.9]} scale={[1, l.len, 1]} />
      ))}
    </group>
  );
}
