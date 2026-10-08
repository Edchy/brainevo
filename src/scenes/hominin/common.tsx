import { useEffect, useMemo, useRef } from 'react';
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

/* ---------------------------------------------------------------- Walker */
export interface WalkCtl { phase: number; u: number; alpha: number; hl: number; stride: number; int: number }
export const newWalk = (): WalkCtl => ({ phase: 0, u: 1, alpha: 1, hl: 0, stride: 1, int: 1 });

/** Stylised hominin figure, walks toward +x. u = 0 stooped & bent-kneed, 1 fully upright. hl lights spine+pelvis. */
export function Walker({ ctl, color = '#ffc891', scale = 1 }: { ctl: WalkCtl; color?: string; scale?: number }) {
  const mat = useRim(color, 0.1, 2.0);
  const R = {
    pelvis: useRef<THREE.Group>(null), torso: useRef<THREE.Group>(null), head: useRef<THREE.Group>(null),
    th0: useRef<THREE.Group>(null), th1: useRef<THREE.Group>(null), sh0: useRef<THREE.Group>(null), sh1: useRef<THREE.Group>(null),
    ar0: useRef<THREE.Group>(null), ar1: useRef<THREE.Group>(null), fa0: useRef<THREE.Group>(null), fa1: useRef<THREE.Group>(null),
  };
  const hlMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(3, 1.8, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }), []);
  const geo = useMemo(() => ({
    cap: (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10),
    sph: new THREE.SphereGeometry(1, 20, 14),
    torus: new THREE.TorusGeometry(0.17, 0.018, 8, 32),
  }), []);
  const caps = useMemo(() => ({
    thigh: geo.cap(0.075, 0.38), shin: geo.cap(0.058, 0.4), torso: geo.cap(0.13, 0.4),
    arm: geo.cap(0.05, 0.22), fore: geo.cap(0.042, 0.22),
  }), [geo]);
  useEffect(() => () => {
    Object.values(caps).forEach((g) => g.dispose()); geo.sph.dispose(); geo.torus.dispose(); hlMat.dispose();
  }, [caps, geo, hlMat]);

  useFrame(() => {
    const c = ctl, ph = c.phase, b = 1 - c.u, s = Math.sin;
    const P = R.pelvis.current;
    if (!P) return;
    P.position.y = 0.94 - b * 0.15 - 0.018 * Math.cos(2 * ph) * c.stride;
    R.torso.current!.rotation.z = -b * 0.85 + s(ph) * 0.03;
    R.head.current!.rotation.z = b * 0.6;
    const legs: Array<[THREE.Group | null, THREE.Group | null, number]> = [[R.th0.current, R.sh0.current, 0], [R.th1.current, R.sh1.current, Math.PI]];
    for (const [th, sh, off] of legs) {
      th!.rotation.z = s(ph + off) * 0.55 * c.stride + b * 0.4;
      sh!.rotation.z = -(0.12 + 0.85 * Math.max(0, Math.cos(ph + off)) * c.stride) - b * 0.55;
    }
    const arms: Array<[THREE.Group | null, THREE.Group | null, number]> = [[R.ar0.current, R.fa0.current, Math.PI], [R.ar1.current, R.fa1.current, 0]];
    for (const [ar, fa, off] of arms) {
      ar!.rotation.z = s(ph + off) * 0.5 * c.stride + b * 0.3;
      fa!.rotation.z = 0.25 + b * 0.25 + 0.2 * Math.max(0, s(ph + off + 0.8));
    }
    mat.uniforms.uAlpha.value = c.alpha; mat.uniforms.uInt.value = c.int;
    hlMat.opacity = c.hl * c.alpha;
  });

  const m = mat;
  return (
    <group scale={scale}>
      <group ref={R.pelvis} position={[0, 0.94, 0]}>
        <mesh geometry={geo.sph} material={m} scale={[0.15, 0.11, 0.16]} />
        <mesh geometry={geo.torus} material={hlMat} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.1, 1]} />
        <group ref={R.torso}>
          <mesh geometry={caps.torso} material={m} position={[0, 0.3, 0]} scale={[0.9, 1, 1.15]} />
          {[0.08, 0.2, 0.32, 0.44, 0.56].map((y, i) => (
            <mesh key={i} geometry={geo.sph} material={hlMat} position={[-0.11 + Math.sin(y * 5) * 0.03, y, 0]} scale={0.032} />
          ))}
          <group ref={R.head} position={[0.0, 0.7, 0]}>
            <mesh geometry={geo.sph} material={m} scale={[0.115, 0.105, 0.095]} position={[0.02, 0.05, 0]} />
            <mesh geometry={geo.sph} material={m} scale={[0.07, 0.05, 0.05]} position={[0.1, 0.0, 0]} />
          </group>
          {[0, 1].map((i) => (
            <group key={i} ref={i ? R.ar1 : R.ar0} position={[0, 0.55, i ? -0.19 : 0.19]}>
              <mesh geometry={caps.arm} material={m} position={[0, -0.18, 0]} />
              <group ref={i ? R.fa1 : R.fa0} position={[0, -0.36, 0]}>
                <mesh geometry={caps.fore} material={m} position={[0, -0.18, 0]} />
              </group>
            </group>
          ))}
        </group>
        {[0, 1].map((i) => (
          <group key={i} ref={i ? R.th1 : R.th0} position={[0, -0.02, i ? -0.09 : 0.09]}>
            <mesh geometry={caps.thigh} material={m} position={[0, -0.28, 0]} />
            <group ref={i ? R.sh1 : R.sh0} position={[0, -0.47, 0]}>
              <mesh geometry={caps.shin} material={m} position={[0, -0.28, 0]} />
              <mesh geometry={geo.sph} material={m} position={[0.07, -0.51, 0]} scale={[0.11, 0.035, 0.05]} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ Bust */
export interface BustCtl { int: number; alpha: number }
/** Head-and-shoulders figure facing +x; rotate the parent to face the fire/centre. */
export function Bust({ ctl, color = '#ffc891', scale = 1, headScale = 1 }: { ctl: BustCtl; color?: string; scale?: number; headScale?: number }) {
  const mat = useRim(color, 0.08, 2.0);
  const g = useMemo(() => ({
    body: new THREE.CapsuleGeometry(0.2, 0.35, 4, 12), sh: new THREE.CapsuleGeometry(0.11, 0.4, 4, 10), head: new THREE.SphereGeometry(1, 22, 16),
  }), []);
  useEffect(() => () => { g.body.dispose(); g.sh.dispose(); g.head.dispose(); }, [g]);
  useFrame(() => { mat.uniforms.uAlpha.value = ctl.alpha; mat.uniforms.uInt.value = ctl.int; });
  return (
    <group scale={scale}>
      <mesh geometry={g.body} material={mat} position={[0, 0.3, 0]} scale={[0.75, 1, 1]} />
      <mesh geometry={g.sh} material={mat} position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={g.head} material={mat} position={[0.03, 0.93, 0]} scale={[0.17 * headScale, 0.16 * headScale, 0.14 * headScale]} />
      <mesh geometry={g.head} material={mat} position={[0.17, 0.88, 0]} scale={[0.07, 0.05, 0.06]} />
    </group>
  );
}

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
