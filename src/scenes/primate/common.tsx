import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';

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
const FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uRim; uniform float uOp; uniform float uGlow; uniform float uPow;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN);
  float f = pow(1.-abs(dot(n,normalize(vV))), uPow);
  float top = n.y*.5+.5;
  vec3 c = uBase*(.35+.65*top) + uRim*f*uGlow;
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

const capsule = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
const GEO = {
  torso: capsule(0.2, 0.45),
  head: new THREE.SphereGeometry(0.19, 20, 14),
  muzzle: new THREE.SphereGeometry(0.1, 12, 10),
  ear: new THREE.SphereGeometry(0.06, 10, 8),
  upper: capsule(0.062, 0.28),
  fore: capsule(0.055, 0.26),
  hand: new THREE.SphereGeometry(0.075, 10, 8),
  thigh: capsule(0.08, 0.26),
  shin: capsule(0.065, 0.26),
  tail: capsule(0.04, 0.55),
  stick: capsule(0.018, 1.0),
  eye: new THREE.SphereGeometry(0.03, 8, 6),
  mark: new THREE.SphereGeometry(0.045, 10, 8),
};

const eyeMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true });
const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15), toneMapped: false, transparent: true });
const stickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.5), toneMapped: false, transparent: true });

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

/** Stylised procedural primate silhouette, +z is forward. Animated entirely through the mutable `pose` object. */
export function Figure({
  pose, base = '#080b0e', rim = '#ffd7a0', rimPow = 2.2, rimGlow = 2.4, eyeColor = '#fff0c0', scale = 1, tail = true,
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

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={spine} position={[0, 0.5, 0]}>
          <mesh geometry={GEO.torso} material={mat} position={[0, 0.2, 0]} />
          {/* head */}
          <group ref={head} position={[0, 0.78, 0.04]}>
            <mesh geometry={GEO.head} material={mat} />
            <mesh geometry={GEO.muzzle} material={mat} position={[0, -0.05, 0.15]} scale={[1, 0.8, 1]} />
            <mesh geometry={GEO.ear} material={mat} position={[0.19, 0.02, -0.02]} />
            <mesh geometry={GEO.ear} material={mat} position={[-0.19, 0.02, -0.02]} />
            <group ref={eyes}>
              <mesh geometry={GEO.eye} material={eyeM} position={[0.075, 0.04, 0.165]} />
              <mesh geometry={GEO.eye} material={eyeM} position={[-0.075, 0.04, 0.165]} />
            </group>
            <mesh ref={mark} geometry={GEO.mark} material={markMat} position={[0.05, 0.14, 0.12]} />
          </group>
          {/* arms */}
          <group ref={aL} position={[0.26, 0.42, 0]}>
            <mesh geometry={GEO.upper} material={mat} position={[0, -0.2, 0]} />
            <group ref={eL} position={[0, -0.4, 0]}>
              <mesh geometry={GEO.fore} material={mat} position={[0, -0.19, 0]} />
              <mesh geometry={GEO.hand} material={mat} position={[0, -0.4, 0]} />
            </group>
          </group>
          <group ref={aR} position={[-0.26, 0.42, 0]}>
            <mesh geometry={GEO.upper} material={mat} position={[0, -0.2, 0]} />
            <group ref={eR} position={[0, -0.4, 0]}>
              <mesh geometry={GEO.fore} material={mat} position={[0, -0.19, 0]} />
              <mesh geometry={GEO.hand} material={mat} position={[0, -0.4, 0]} />
              <mesh ref={stick} geometry={GEO.stick} material={stickMat} position={[0, -0.5, 0.18]} rotation={[1.1, 0, 0]} />
            </group>
          </group>
        </group>
        {/* legs */}
        <group ref={lL} position={[0.12, 0.5, 0]}>
          <mesh geometry={GEO.thigh} material={mat} position={[0, -0.2, 0]} />
          <mesh geometry={GEO.shin} material={mat} position={[0, -0.5, 0.02]} />
        </group>
        <group ref={lR} position={[-0.12, 0.5, 0]}>
          <mesh geometry={GEO.thigh} material={mat} position={[0, -0.2, 0]} />
          <mesh geometry={GEO.shin} material={mat} position={[0, -0.5, 0.02]} />
        </group>
        {tail && (
          <group ref={tl} position={[0, 0.55, -0.15]}>
            <mesh geometry={GEO.tail} material={mat} position={[0, -0.4, 0]} />
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
