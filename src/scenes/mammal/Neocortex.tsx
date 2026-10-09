import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, smoothstep } from '../../world/util';
import { GLSL_NOISE } from './kit';

// The neocortex as ONE sheet: six hair-fine strata of contour lines that start as a small flat patch, widen and wrinkle
// into folds while curling into a shallow dome. A single soft ripple of activity travels across it; the rest stays dim.
const VERT = /* glsl */ `
uniform float uGrow, uFold, uBend, uLayer;
varying vec2 vUv; varying float vH; varying float vDepth;
${GLSL_NOISE}
vec3 sheet(vec2 uv, float layer, float fold){
  vec2 q = (uv-.5)*vec2(11.,7.2);
  float g = fbm(uv*4.+vec2(1.3,.7)) + .5*fbm(uv*9.+3.);
  float wr = (g-.55)*2.0*fold;
  float depth = layer*.16;
  float R = 6.2;
  vec2 a = q/R*uBend;
  vec3 fl = vec3(q, -depth + wr*.9);
  float rr = R - depth*.9 + wr*1.5;
  vec3 dome = vec3(sin(a.x)*cos(a.y)*rr, sin(a.y)*rr, (cos(a.x)*cos(a.y)-1.)*rr);
  vH = wr;
  return mix(fl, dome, smoothstep(0.,1.,uBend));
}
void main(){
  vUv = uv;
  vec2 uvg = (uv-.5)*uGrow+.5;
  vec3 p = sheet(uvg, uLayer, uFold);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  vDepth = -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const FRAG = /* glsl */ `
uniform float uW, uWave, uBeat, uLayer, uGrow;
varying vec2 vUv; varying float vH; varying float vDepth;
void main(){
  vec2 g = vUv*vec2(72.,47.);
  vec2 d = abs(fract(g-.5)-.5)/fwidth(g);
  float line = 1.-min(min(d.x,d.y),1.);
  vec2 e = min(vUv, 1.-vUv);
  float edge = smoothstep(0.,.16,min(e.x,e.y));
  vec2 q = (vUv-vec2(.46,.52))*vec2(1.5,1.);
  float rr = length(q);
  float front = fract(uWave*.5);
  float ring = exp(-pow((rr-front*.95)*7.5,2.)) * (1.-front*.55);
  float input4 = step(3.5,uLayer)*step(uLayer,4.5);
  float base = (.03 + .05*input4) * (.75 + .5*smoothstep(-.4,.5,vH));
  float lit = ring * (.5 + .7*input4 + .25*uBeat);
  float top = step(4.5,uLayer);
  float a = (line * top * (.21 + lit*.45) + (1.-top) * (.014 + .014*input4 + lit*.05)) * edge * (.8 + .4*smoothstep(-.4,.5,vH));
  vec3 col = vec3(.84,.9,1.) * (1. + lit*.6);
  float haze = smoothstep(14.,26.,vDepth);
  gl_FragColor = vec4(col*a*uW*(1.-haze*.6), 1.);
}`;

const LAYERS = 6;

export default function Neocortex() {
  const scene = useScene();
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, 220, 140), []);
  const mats = useMemo(() => Array.from({ length: LAYERS }, (_, l) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uW: { value: 1 }, uWave: { value: 0 }, uBeat: { value: 0 }, uLayer: { value: l }, uGrow: { value: 0.3 }, uFold: { value: 0 }, uBend: { value: 0 } },
  })), []);
  const grp = useRef<THREE.Group>(null);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);

  useFrame(() => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const grow = 0.34 + 0.66 * smoothstep(0.05, 0.8, t);
    const fold = smoothstep(0.2, 0.95, t);
    const bend = smoothstep(0.3, 1.0, t) * 0.55;
    const wave = time * 0.2 + t * 1.2;
    const beat = near(eventPos('neocortex'), 0.8);
    for (const m of mats) {
      const u = m.uniforms;
      u.uW.value = w; u.uGrow.value = grow; u.uFold.value = fold; u.uBend.value = bend; u.uWave.value = wave; u.uBeat.value = beat;
    }
    if (grp.current) { grp.current.rotation.x = -0.5 + 0.12 * t; grp.current.rotation.z = 0.06; }
  });

  return (
    <group ref={grp} position={[1.2, -0.2, 0]}>
      {mats.map((m, i) => <mesh key={i} geometry={geo} material={m} frustumCulled={false} />)}
    </group>
  );
}
