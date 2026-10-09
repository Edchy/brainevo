import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { profileBody } from '../mammal/kit';

export const NOISE = /* glsl */ `
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
`;

/** ambient shimmer time, frozen when reduced motion is on */
export const ambientTime = () => (world.reduced ? 0 : world.time);

export type Arm = [number, number, number]; // shoulder x, shoulder z, elbow x

export interface Pose {
  aL: Arm;
  aR: Arm;
  lL: number;
  lR: number;
  lean: number;
  headYaw: number;
  headPitch: number;
  y: number;
  tail: number;
  stick: number;
  eye: number;
  glow: number;
  mark: number;
  alpha: number;
}

export function makePose(): Pose {
  return {
    aL: [0.1, 0.15, -0.2], aR: [0.1, -0.15, -0.2], lL: 0, lR: 0, lean: 0, headYaw: 0, headPitch: 0, y: 0,
    tail: 0, stick: 0, eye: 1, glow: 0, mark: 0, alpha: 1,
  };
}

const VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix*vec4(position,1.);
  vN = normalize(normalMatrix*normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix*mv;
}`;
// near-black body with a thin, one-sided rim of light (back-light from upper left in view space). No hair stipple, no
// uniform outline: the silhouette is carved by light the way a title-sequence still would be.
const FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uRim; uniform float uOp; uniform float uGlow; uniform float uPow;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN);
  float f = pow(1.-abs(dot(n,normalize(vV))), uPow);
  float side = dot(normalize(n.xy+1e-4), normalize(vec2(-.62,.78)));
  float lit = mix(.16, 1., smoothstep(-.3,.7,side));
  vec3 c = uBase*(.4+.6*(n.y*.5+.5)) + uRim*f*uGlow*lit;
  gl_FragColor = vec4(c, uOp);
}`;

export function useRimMaterial(base: string, rim: string, pow = 2.2, additive = false) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uBase: { value: new THREE.Color(base) },
          uRim: { value: new THREE.Color(rim) },
          uOp: { value: 1 },
          uGlow: { value: 1 },
          uPow: { value: pow },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    [base, rim, pow, additive],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

const ell = (x: number, y: number, z: number) => { const g = new THREE.SphereGeometry(1, 24, 16); g.scale(x, y, z); return g; };
/** tapered limb segment hanging down (-y) from its pivot: keys are [distance, radius, 0] */
const limb = (keys: [number, number, number][], flat = 1) => { const g = profileBody(keys, flat, 28, 16); g.rotateZ(-Math.PI / 2); return g; };

const GEO = {
  // torso: pelvis -> belly -> chest -> mantle -> neck as ONE surface (spine-local, y up from the waist)
  torso: (() => {
    const g = profileBody([
      [-0.13, 0.0, 0], [-0.1, 0.13, 0], [0.0, 0.19, 0], [0.16, 0.19, 0], [0.34, 0.205, 0], [0.48, 0.235, 0.01], [0.58, 0.215, 0.0], [0.65, 0.1, 0], [0.72, 0.075, 0], [0.76, 0.0, 0],
    ], 1.3, 60, 22);
    g.rotateZ(Math.PI / 2);
    return g;
  })(),
  // head: skull running smoothly into the muzzle (x forward -> +z)
  head: (() => {
    const g = profileBody([
      [-0.17, 0.0, 0.03], [-0.14, 0.11, 0.03], [-0.05, 0.165, 0.04], [0.06, 0.16, 0.04], [0.14, 0.125, 0.0], [0.21, 0.088, -0.03], [0.29, 0.076, -0.045], [0.34, 0.05, -0.045], [0.365, 0.0, -0.045],
    ], 1.0, 48, 20);
    g.rotateY(-Math.PI / 2);
    return g;
  })(),
  brow: ell(0.14, 0.03, 0.07),
  ear: ell(0.03, 0.062, 0.05),
  upper: limb([[0, 0.065, 0], [0.1, 0.082, 0], [0.28, 0.062, 0], [0.4, 0.05, 0]]),
  fore: limb([[0, 0.05, 0], [0.1, 0.056, 0], [0.28, 0.042, 0], [0.38, 0.034, 0]]),
  joint: new THREE.SphereGeometry(1, 14, 12),
  palm: ell(0.048, 0.062, 0.03),
  finger: (() => { const g = new THREE.CapsuleGeometry(0.013, 0.05, 3, 6); g.translate(0, -0.03, 0); return g; })(),
  thigh: limb([[0, 0.092, 0], [0.12, 0.1, 0], [0.3, 0.07, 0], [0.4, 0.058, 0]]),
  shin: limb([[0, 0.058, 0], [0.1, 0.064, 0], [0.26, 0.042, 0], [0.34, 0.034, 0]]),
  foot: ell(0.042, 0.026, 0.09),
  tail1: limb([[0, 0.05, 0], [0.3, 0.034, 0]]),
  tail2: limb([[0, 0.034, 0], [0.26, 0.02, 0]]),
  tail3: limb([[0, 0.02, 0], [0.2, 0.004, 0]]),
  stick: new THREE.CapsuleGeometry(0.016, 1.0, 4, 10),
  eye: new THREE.SphereGeometry(0.026, 10, 8),
  mark: new THREE.SphereGeometry(0.045, 10, 8),
};

const eyeMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true });
const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15), toneMapped: false, transparent: true });
const stickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.7, 1.5), toneMapped: false, transparent: true });

interface FigureProps {
  pose: Pose;
  base?: string;
  rim?: string;
  rimPow?: number;
  rimGlow?: number;
  eyeColor?: string;
  scale?: number;
  tail?: boolean;
  additive?: boolean;
}

const Hand = ({ mat }: { mat: THREE.Material }) => (
  <group position={[0, -0.43, 0]}>
    <mesh geometry={GEO.palm} material={mat} position={[0, -0.03, 0]} />
    {[-0.026, 0, 0.026].map((x, i) => (
      <mesh key={i} geometry={GEO.finger} material={mat} position={[x, -0.075, 0.01]} rotation={[-0.5, 0, 0]} scale={[1, 1 + (i === 1 ? 0.2 : 0), 1]} />
    ))}
    <mesh geometry={GEO.finger} material={mat} position={[0.048, -0.03, 0.02]} rotation={[-0.6, 0, -0.9]} scale={[1.1, 0.8, 1.1]} />
  </group>
);

/** Stylised procedural primate, +z is forward. Animated entirely through the mutable `pose` object (same API as before). */
export function Figure({
  pose, base = '#030405', rim = '#ffe2bd', rimPow = 2.6, rimGlow = 1.9, eyeColor = '#fff0c0', scale = 1, tail = true,
  additive = false,
}: FigureProps) {
  const scene = useScene();
  const mat = useRimMaterial(base, rim, rimPow, additive);
  const eyeM = useMemo(() => { const m = eyeMat.clone(); m.color.set(eyeColor).multiplyScalar(3); return m; }, [eyeColor]);
  const root = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const aL = useRef<THREE.Group>(null);
  const aR = useRef<THREE.Group>(null);
  const eL = useRef<THREE.Group>(null);
  const eR = useRef<THREE.Group>(null);
  const lL = useRef<THREE.Group>(null);
  const lR = useRef<THREE.Group>(null);
  const tl = useRef<THREE.Group>(null);
  const stick = useRef<THREE.Mesh>(null);
  const mark = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  useEffect(() => () => eyeM.dispose(), [eyeM]);

  useFrame(() => {
    if (!scene.active) return;
    const a = scene.weight * pose.alpha;
    mat.uniforms.uOp.value = a;
    mat.uniforms.uGlow.value = rimGlow * (1 + pose.glow * 1.5);
    eyeM.opacity = a;
    eyeM.color.set(eyeColor).multiplyScalar(1 + 3 * pose.eye);
    markMat.opacity = a;
    if (root.current) root.current.position.y = pose.y;
    if (spine.current) spine.current.rotation.x = pose.lean;
    if (head.current) { head.current.rotation.y = pose.headYaw; head.current.rotation.x = pose.headPitch; }
    if (aL.current) { aL.current.rotation.x = pose.aL[0]; aL.current.rotation.z = pose.aL[1]; }
    if (eL.current) eL.current.rotation.x = pose.aL[2];
    if (aR.current) { aR.current.rotation.x = pose.aR[0]; aR.current.rotation.z = pose.aR[1]; }
    if (eR.current) eR.current.rotation.x = pose.aR[2];
    if (lL.current) lL.current.rotation.x = pose.lL;
    if (lR.current) lR.current.rotation.x = pose.lR;
    if (tl.current) tl.current.rotation.x = 0.55 + pose.tail;
    if (stick.current) { stick.current.scale.setScalar(Math.max(0.0001, pose.stick)); }
    if (mark.current) mark.current.scale.setScalar(Math.max(0.0001, pose.mark));
    if (eyes.current) eyes.current.visible = pose.eye > 0.01;
  });

  const arm = (side: 1 | -1, ref: React.RefObject<THREE.Group | null>, eref: React.RefObject<THREE.Group | null>, withStick: boolean) => (
    <group ref={ref} position={[0.27 * side, 0.52, 0]}>
      <mesh geometry={GEO.joint} material={mat} scale={0.075} />
      <mesh geometry={GEO.upper} material={mat} />
      <group ref={eref} position={[0, -0.4, 0]}>
        <mesh geometry={GEO.joint} material={mat} scale={0.052} />
        <mesh geometry={GEO.fore} material={mat} />
        <Hand mat={mat} />
        {withStick && <mesh ref={stick} geometry={GEO.stick} material={stickMat} position={[0, -0.5, 0.18]} rotation={[1.1, 0, 0]} />}
      </group>
    </group>
  );
  const leg = (side: 1 | -1, ref: React.RefObject<THREE.Group | null>) => (
    <group ref={ref} position={[0.12 * side, 0.5, 0]}>
      <mesh geometry={GEO.joint} material={mat} scale={0.095} />
      <mesh geometry={GEO.thigh} material={mat} rotation={[-0.15, 0, 0]} />
      <group position={[0, -0.4, -0.06]}>
        <mesh geometry={GEO.joint} material={mat} scale={0.06} />
        <mesh geometry={GEO.shin} material={mat} rotation={[0.3, 0, 0]} />
        <mesh geometry={GEO.foot} material={mat} position={[0, -0.34, 0.07]} />
      </group>
    </group>
  );

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={spine} position={[0, 0.5, 0]}>
          <mesh geometry={GEO.torso} material={mat} />
          {/* head */}
          <group ref={head} position={[0, 0.8, 0.03]}>
            <mesh geometry={GEO.head} material={mat} position={[0, 0.0, 0]} />
            <mesh geometry={GEO.brow} material={mat} position={[0, 0.09, 0.115]} />
            <mesh geometry={GEO.ear} material={mat} position={[0.165, 0.05, -0.03]} />
            <mesh geometry={GEO.ear} material={mat} position={[-0.165, 0.05, -0.03]} />
            <group ref={eyes}>
              <mesh geometry={GEO.eye} material={eyeM} position={[0.075, 0.065, 0.118]} />
              <mesh geometry={GEO.eye} material={eyeM} position={[-0.075, 0.065, 0.118]} />
            </group>
            <mesh ref={mark} geometry={GEO.mark} material={markMat} position={[0.05, 0.15, 0.1]} />
          </group>
          {arm(1, aL, eL, false)}
          {arm(-1, aR, eR, true)}
        </group>
        {leg(1, lL)}
        {leg(-1, lR)}
        {tail && (
          <group ref={tl} position={[0, 0.55, -0.15]}>
            <mesh geometry={GEO.tail1} material={mat} />
            <group position={[0, -0.3, 0]} rotation={[-0.45, 0, 0]}>
              <mesh geometry={GEO.tail2} material={mat} />
              <group position={[0, -0.26, 0]} rotation={[-0.6, 0, 0]}>
                <mesh geometry={GEO.tail3} material={mat} />
              </group>
            </group>
          </group>
        )}
      </group>
    </group>
  );
}

/** soft round additive sprite for Points */
export const SPRITE_FRAG = /* glsl */ `
float spr(){ vec2 c = gl_PointCoord-.5; float d = length(c)*2.; return smoothstep(1.,0.,d); }
`;
