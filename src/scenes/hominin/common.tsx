import { useEffect, useMemo, useRef } from 'react';
import type { RigState } from '../shared/creatures/rig';
import { easeOutCubic } from '../../world/util';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Additive fresnel-rim material: dark core, glowing silhouette. Used for all bodies. */
export function makeRim(color: THREE.ColorRepresentation, base = 0.14, pow = 2.2) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: 1 },
      uInt: { value: 1 },
      uBase: { value: base },
      uPow: { value: pow },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha, uInt, uBase, uPow;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), uPow);
        gl_FragColor = vec4(uColor * (uBase + f * 1.3) * uInt * uAlpha, 1.);
      }`,
  });
}

export function useRim(color: THREE.ColorRepresentation, base?: number, pow?: number) {
  const m = useMemo(() => makeRim(color, base, pow), [color, base, pow]);
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

export function useDispose(...objs: Array<{ dispose(): void }>) {
  useEffect(() => () => objs.forEach((o) => o.dispose()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    objs);
}

export const GLSL_NOISE = /* glsl */ `
float hash31(vec3 p){ p=fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

/* ----------------------------------------------------------------- Brain */
export interface BrainCtl { s: number; alpha: number; motor: number; par: number; broca: number; glow: number; hue: number }
export const newBrain = (): BrainCtl => ({ s: 1, alpha: 1, motor: 0, par: 0, broca: 0, glow: 0, hue: 0 });

/** Translucent folded brain, faces +x. Regions can be lit independently. Unit size = ~1 radius. */
export function Brain({ ctl, color = '#9ad7ff', hot = '#ffb05a' }: { ctl: BrainCtl; color?: string; hot?: string }) {
  const grp = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 110, 80), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uHot: { value: new THREE.Color(hot).multiplyScalar(3.4) },
      uAlpha: { value: 1 }, uMotor: { value: 0 }, uPar: { value: 0 }, uBroca: { value: 0 }, uGlow: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      ${GLSL_NOISE}
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vR;
      void main(){
        vec3 p = position;
        vec3 q = p * 3.3 + 7.;
        float w = n3(q) * .62 + n3(q * 2.2) * .3 + n3(q*4.5)*.12;
        float ridge = 1. - abs(w * 1.7 - 0.85);
        vR = ridge;
        float fiss = (1. - smoothstep(0., .1, abs(p.z))) * smoothstep(-.1, .5, p.y);
        float lobes = 1. - .1 * smoothstep(.55, 1., abs(p.z)) ;
        vec3 np = p * (1. + ridge * .065 - fiss * .1) * lobes;
        np *= vec3(1.18, .86, .84);
        vP = p;
        vec4 mv = modelViewMatrix * vec4(np, 1.);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 uColor, uHot; uniform float uAlpha, uMotor, uPar, uBroca, uGlow, uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vR;
      void main(){
        vec3 q = vP * 6. + 3.;
        float w = n3(q) * .6 + n3(q * 2.1) * .3 + n3(q * 4.3) * .1;
        float line = 1. - smoothstep(0., .07, abs(w - .5));
        float w2 = n3(vP * 13. + 9.);
        float line2 = (1. - smoothstep(0., .06, abs(w2 - .5))) * .5;
        float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.8);
        vec3 pp = vec3(vP.x, vP.y, abs(vP.z));
        float motor = exp(-pow((vP.x - .12) / .2, 2.)) * smoothstep(.1, .6, vP.y);
        float par = exp(-pow(length(vec2(vP.x + .42, vP.y - .62)) / .5, 2.));
        float broca = exp(-pow(length(pp - vec3(.72, .1, .5)) / .3, 2.));
        float reg = motor * uMotor + par * uPar + broca * uBroca;
        float folds = max(line, line2) * .9 + smoothstep(.5, 1., vR) * .15;
        vec3 c = uColor * (.05 + f * 1.0 + folds * (.45 + uGlow * .5) + uGlow * .1);
        c += uHot * reg * (.4 + folds * .9) * (.85 + .15 * sin(uTime * 3.));
        gl_FragColor = vec4(c * uAlpha, 1.);
      }`,
  }), [color, hot]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((st) => {
    const c = ctl, u = mat.uniforms;
    if (grp.current) grp.current.scale.setScalar(c.s);
    u.uAlpha.value = c.alpha; u.uMotor.value = c.motor; u.uPar.value = c.par; u.uBroca.value = c.broca; u.uGlow.value = c.glow;
    u.uTime.value = st.clock.elapsedTime;
  });
  return <group ref={grp}><mesh geometry={geo} material={mat} /></group>;
}

/** Faint ellipsoid shell (skull / head outline). Faces +x. */
export function Shell({ ctl, color = '#cfe8ff', scale = [1.3, 1.05, 1] as [number, number, number], base = 0.02 }: { ctl: { alpha: number }; color?: string; scale?: [number, number, number]; base?: number }) {
  const mat = useRim(color, base, 3.0);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 40, 28), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => { mat.uniforms.uAlpha.value = ctl.alpha; });
  return <mesh geometry={geo} material={mat} scale={scale} />;
}

/* ------------------------------------------------------------ Glow discs */
/** Soft radial glow on a plane (floor light, halos). Set via material uniforms. */
export function makeGlowMat(color: THREE.ColorRepresentation, power = 2) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uPow: { value: power } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha,uPow; varying vec2 vUv;
      void main(){ float d=length(vUv-.5)*2.; float a=pow(max(0.,1.-d),uPow); gl_FragColor=vec4(uColor*a*uAlpha,1.); }`,
  });
}

export const GLSL_FOG = /* glsl */ `
vec3 applyFog(vec3 c, vec3 fogC, float depth, float a, float b){ return mix(c, fogC, smoothstep(a, b, depth)); }
`;

/* --------------------------------------------------------------- Knapping */
/** swing curve for one strike cycle f in 0..1: lift (0..0.6), fast fall (0.6..0.72), rebound. raise 0..1, hit = impact decay. */
export function strikeCurve(f: number, active = 1) {
  let raise: number;
  if (f < 0.6) raise = easeOutCubic(f / 0.6); else if (f < 0.72) { const u = (f - 0.6) / 0.12; raise = 1 - u * u; } else raise = Math.max(0, 0.12 * Math.exp(-(f - 0.72) * 9) * Math.sin((f - 0.72) * 24 + 0.5));
  const hit = f >= 0.72 ? Math.exp(-(f - 0.72) * 14) * active : 0;
  return { raise, hit };
}
/**
 * Crouched knapper: the holding hand (side -strike) cups a core at creature-local (0.30, 0.27), the striking hand (side `strike`, +1 = z+)
 * swings a hammerstone down onto it. Writes only RigState fields.
 */
export function setKnap(s: RigState, raise: number, hit: number, tm: number, strike: 1 | -1, reach = 0.7, crouch = 0.85) {
  const j = Math.sin(tm * 1.3) * 0.004;
  s.crouch = crouch; s.armsFree = 0;
  const hold = strike > 0 ? 'L' : 'R', sw = strike > 0 ? 'R' : 'L';
  const set = (side: string, x: number, y: number, z: number, prop: number, grip: number, roll: number) => {
    (s as unknown as Record<string, number>)['h' + side + 'w'] = 1; (s as unknown as Record<string, number>)['h' + side + 'x'] = x; (s as unknown as Record<string, number>)['h' + side + 'y'] = y;
    (s as unknown as Record<string, number>)['h' + side + 'z'] = z; (s as unknown as Record<string, number>)['prop' + side] = prop; (s as unknown as Record<string, number>)['grip' + side] = grip; (s as unknown as Record<string, number>)['roll' + side] = roll;
  };
  set(hold, 0.3, 0.27 + j - hit * 0.006, -strike * 0.06, 7, 0.75, 0);
  set(sw, 0.278 - 0.03 * raise * reach + 0.06 * raise, 0.39 + 0.42 * raise, strike * (0.075 + 0.02 * raise), 6, 0.85, strike * 0.2 * raise);
}
