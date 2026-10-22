import { forwardRef, useCallback } from 'react';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle, CreatureProps } from '../shared/creatures/Creature';
import type { PrimatePose } from '../shared/creatures/rig';
import * as THREE from 'three';
import { world } from '../../world/store';

export type { CreatureHandle };

export const NOISE = /* glsl */ `
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
`;

/** ambient shimmer time, frozen when reduced motion is on */
export const ambientTime = () => (world.reduced ? 0 : world.time);

/** soft round additive sprite for Points */
export const SPRITE_FRAG = /* glsl */ `
float spr(){ vec2 c = gl_PointCoord-.5; float d = length(c)*2.; return smoothstep(1.,0.,d); }
`;

/** warm-rimmed primate palette used by every primate scene (rim colour is the per-creature accent) */
export const PRIMATE_LOOK = { rimK: 1.9, rimPow: 2.4, keyK: 1.1, amb: 0.2, sss: 0.35, fur: 1, groundAO: 0.4, keyDir: [0.25, 0.85, 0.45] as [number, number, number] } as const;

interface PrimateProps extends Omit<CreatureProps, 'rig'> {
  /** scene weight 0..1 (crossfade) is written into look.w by the caller via handle.look.w */
  rim?: string;
}

/**
 * A raymarched primate (toolkit quadruped rig, primate solver). Feet at local y = 0, facing +x. Drive it through
 * `handle.state` (pm = PrimatePose: sit, hand/foot targets, grip, tail, brow; plus headYaw/headPitch/mouth/alert).
 * In dev, `window.__pm = { sit: 1, ... }` overrides pose fields for tuning.
 */
export const Primate = forwardRef<CreatureHandle, PrimateProps>(function Primate({ rim, palette, onBeforeDraw, look, ...rest }, ref) {
  const cb = useCallback((h: CreatureHandle) => {
    if (import.meta.env.DEV) {
      const d = (window as unknown as { __pm?: Partial<PrimatePose> }).__pm;
      if (d) Object.assign(h.state.pm, d);
    }
    onBeforeDraw?.(h);
  }, [onBeforeDraw]);
  return <Creature ref={ref} rig="quadruped" preset="primate" {...rest} palette={rim ? { rim, ...palette } : palette} look={{ ...PRIMATE_LOOK, ...look }} onBeforeDraw={cb} />;
});

/** reset the pose controls to a neutral all-fours stance (call at the top of a scene's frame, then override) */
export function neutral(pm: PrimatePose) {
  pm.sit = 0; pm.tilt = 0; pm.ox = 0; pm.oy = 0; pm.oz = 0;
  for (let i = 0; i < 8; i++) { pm.hand[i] = 0; pm.foot[i] = 0; }
  pm.gripL = 0; pm.gripR = 0; pm.footGrip = 0; pm.tailPit = 0; pm.tailCurl = 0; pm.brow = 0; pm.roll = 0;
}
/** pull a wrist (front) or ankle (back) toward a creature-local target. side: +1 left (+z), -1 right */
export function reach(arr: number[], side: 1 | -1, x: number, y: number, z: number, w: number) {
  const o = side > 0 ? 0 : 4;
  arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; arr[o + 3] = w;
}

/** ripe fruit: a saturated red sphere with a soft top-left key, a rim and a hard glint. Weight via uW, ripeness glow via uGlow. */
export function fruitMaterial(hex = '#ff1a08') {
  return new THREE.ShaderMaterial({
    toneMapped: false, transparent: true,
    uniforms: { uCol: { value: new THREE.Color(hex) }, uW: { value: 1 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uW, uGlow; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV);
        vec3 L = normalize(vec3(-.45,.7,.55));
        float d = clamp(dot(n,L)*.5+.5,0.,1.);
        float fr = pow(1.-max(dot(n,v),0.), 2.6);
        float sp = pow(max(dot(reflect(-L,n),v),0.), 60.);
        vec3 c = uCol*(.28+1.1*d*d) + vec3(1.,.35,.2)*fr*.55 + vec3(1.)*sp*1.4 + uCol*uGlow;
        gl_FragColor = vec4(c*uW, uW);
      }`,
  });
}
