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
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vWN;
void main(){
  vec4 mv = modelViewMatrix*vec4(position,1.);
  vN = normalize(normalMatrix*normal);
  vWN = normalize(mat3(modelMatrix)*normal);
  vV = normalize(-mv.xyz);
  vObj = (modelMatrix*vec4(position,1.)).xyz;
  gl_Position = projectionMatrix*mv;
}`;
// dark body with a warm fur-fringed rim: the rim is broken up by high-frequency "hair" noise and the silhouette
// edge is stippled away so the outline reads as fur, not a clean outline.
const FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uRim; uniform float uOp; uniform float uGlow; uniform float uPow;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vWN;
float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 n = normalize(vN);
  float ndv = abs(dot(n,normalize(vV)));
  float edge = 1.-ndv;
  float f = pow(edge, uPow);
  // fur: strands elongated along y (hanging fur) -> sample noise in stretched object space
  float hair = h3(floor(vObj*vec3(190.,70.,190.)));
  float tuft = .5+.5*sin(vObj.x*31.+sin(vObj.y*23.)*2.)*sin(vObj.z*27.+vObj.y*15.);
  if(edge>.9 && hair>.62+ (1.-edge)*2.) discard;
  float wup = normalize(vWN).y*.5+.5;
  float key = max(dot(normalize(vWN), normalize(vec3(-.35,.7,.6))),0.);
  vec3 c = uBase*(.35+.65*wup) + uBase*key*1.6;
  c += uRim*f*uGlow*(.7+.6*hair)*(.8+.35*tuft)*(.55+.75*wup);
  c += uRim*.12*key*uGlow*smoothstep(.2,.9,tuft);
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

/** tapered limb segment, y in [-1, 0] hanging down from its pivot (radius 1 at the pivot, `t` at the far end) */
const hang = (rTop: number, rBot: number, len: number) => {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 14, 1, false);
  g.translate(0, -len / 2, 0);
  return g;
};
const ell = (x: number, y: number, z: number) => { const g = new THREE.SphereGeometry(1, 18, 12); g.scale(x, y, z); return g; };

const GEO = {
  chest: ell(0.235, 0.27, 0.19),
  belly: ell(0.2, 0.22, 0.17),
  mantle: ell(0.3, 0.1, 0.17),
  neck: hang(0.07, 0.09, 0.14),
  skull: ell(0.17, 0.165, 0.165),
  brow: ell(0.14, 0.035, 0.075),
  jaw: ell(0.07, 0.05, 0.085),
  muzzle: ell(0.078, 0.066, 0.1),
  nose: ell(0.04, 0.03, 0.03),
  ear: ell(0.03, 0.062, 0.056),
  upper: hang(0.075, 0.055, 0.4),
  fore: hang(0.055, 0.04, 0.38),
  joint: new THREE.SphereGeometry(1, 12, 10),
  palm: ell(0.05, 0.06, 0.035),
  finger: (() => { const g = new THREE.CapsuleGeometry(0.014, 0.05, 3, 6); g.translate(0, -0.03, 0); return g; })(),
  thigh: hang(0.1, 0.07, 0.4),
  shin: hang(0.07, 0.045, 0.34),
  foot: ell(0.045, 0.028, 0.09),
  tail1: hang(0.05, 0.036, 0.3),
  tail2: hang(0.036, 0.022, 0.26),
  tail3: hang(0.022, 0.012, 0.2),
  stick: new THREE.CapsuleGeometry(0.018, 1.0, 4, 10),
  eye: new THREE.SphereGeometry(0.028, 10, 8),
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

const Hand = ({ mat }: { mat: THREE.Material }) => (
  <group position={[0, -0.43, 0]}>
    <mesh geometry={GEO.palm} material={mat} position={[0, -0.03, 0]} />
    {[-0.028, 0, 0.028].map((x, i) => (
      <mesh key={i} geometry={GEO.finger} material={mat} position={[x, -0.075, 0.01]} rotation={[-0.5, 0, 0]} scale={[1, 1 + (i === 1 ? 0.2 : 0), 1]} />
    ))}
    <mesh geometry={GEO.finger} material={mat} position={[0.05, -0.03, 0.02]} rotation={[-0.6, 0, -0.9]} scale={[1.1, 0.8, 1.1]} />
  </group>
);

/** Stylised procedural primate, +z is forward. Animated entirely through the mutable `pose` object (same API as before). */
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

  const arm = (side: 1 | -1, ref: React.RefObject<THREE.Group | null>, eref: React.RefObject<THREE.Group | null>, withStick: boolean) => (
    <group ref={ref} position={[0.27 * side, 0.46, 0]}>
      <mesh geometry={GEO.joint} material={mat} scale={0.085} />
      <mesh geometry={GEO.upper} material={mat} />
      <group ref={eref} position={[0, -0.4, 0]}>
        <mesh geometry={GEO.joint} material={mat} scale={0.058} />
        <mesh geometry={GEO.fore} material={mat} />
        <Hand mat={mat} />
        {withStick && <mesh ref={stick} geometry={GEO.stick} material={stickMat} position={[0, -0.5, 0.18]} rotation={[1.1, 0, 0]} />}
      </group>
    </group>
  );
  const leg = (side: 1 | -1, ref: React.RefObject<THREE.Group | null>) => (
    <group ref={ref} position={[0.12 * side, 0.5, 0]}>
      <mesh geometry={GEO.joint} material={mat} scale={0.1} />
      <mesh geometry={GEO.thigh} material={mat} rotation={[-0.15, 0, 0]} />
      <group position={[0, -0.4, -0.06]}>
        <mesh geometry={GEO.joint} material={mat} scale={0.07} />
        <mesh geometry={GEO.shin} material={mat} rotation={[0.3, 0, 0]} />
        <mesh geometry={GEO.foot} material={mat} position={[0, -0.34, 0.07]} />
      </group>
    </group>
  );

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={spine} position={[0, 0.5, 0]}>
          <mesh geometry={GEO.belly} material={mat} position={[0, 0.1, 0]} />
          <mesh geometry={GEO.chest} material={mat} position={[0, 0.38, 0.01]} />
          <mesh geometry={GEO.mantle} material={mat} position={[0, 0.58, -0.02]} />
          <mesh geometry={GEO.neck} material={mat} position={[0, 0.7, 0.02]} />
          {/* head */}
          <group ref={head} position={[0, 0.78, 0.04]}>
            <mesh geometry={GEO.skull} material={mat} position={[0, 0.03, -0.005]} />
            <mesh geometry={GEO.brow} material={mat} position={[0, 0.075, 0.125]} />
            <mesh geometry={GEO.muzzle} material={mat} position={[0, -0.045, 0.15]} />
            <mesh geometry={GEO.nose} material={mat} position={[0, -0.02, 0.24]} />
            <mesh geometry={GEO.jaw} material={mat} position={[0, -0.105, 0.11]} />
            <mesh geometry={GEO.ear} material={mat} position={[0.175, 0.02, -0.02]} />
            <mesh geometry={GEO.ear} material={mat} position={[-0.175, 0.02, -0.02]} />
            <group ref={eyes}>
              <mesh geometry={GEO.eye} material={eyeM} position={[0.062, 0.036, 0.158]} />
              <mesh geometry={GEO.eye} material={eyeM} position={[-0.062, 0.036, 0.158]} />
            </group>
            <mesh ref={mark} geometry={GEO.mark} material={markMat} position={[0.05, 0.14, 0.12]} />
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
