import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, pointMaterial, pointScale } from './kit';

const CX = 44, CY = 28, PER = 5; // columns x rows x neurons per cell per layer

const VERT = /* glsl */ `
attribute vec4 aSeed;   // x: u, y: v (sheet coords 0..1), z: layer 0..5, w: random
attribute vec2 aCell;
uniform float uTime, uScale, uW, uGrow, uFold, uBend, uWave, uBeat;
varying vec3 vCol; varying float vA;
${GLSL_NOISE}
const vec3 LAYER[6] = vec3[6](vec3(.75,.8,1.), vec3(.3,.55,1.), vec3(.25,.85,.95), vec3(.35,1.,.55), vec3(1.,.7,.25), vec3(.9,.35,.85));
vec3 sheet(vec2 uv, float layer, float fold){
  vec2 q = (uv-.5)*vec2(11.,7.2);
  // wrinkles: gyri/sulci grow with fold, domain-warped so they meander
  float g = fbm(uv*5.+vec2(1.3,.7)) + .5*fbm(uv*11.+3.);
  float wr = (g-.55)*2.2*fold;
  float depth = layer*.2;
  // bend the flat sheet into a dome
  float R = 5.2;
  vec2 a = q/R*uBend;
  vec3 fl = vec3(q, -depth + wr*1.1);
  float rr = R - depth*.9 + wr*1.7;
  vec3 dome = vec3(sin(a.x)*cos(a.y)*rr, sin(a.y)*rr, (cos(a.x)*cos(a.y)-1.)*rr);
  return mix(fl, dome, smoothstep(0.,1.,uBend));
}
void main(){
  vec2 uv = aSeed.xy; float layer = aSeed.z;
  // the sheet starts as a small patch, then expands outward while wrinkling
  vec2 uvg = (uv-.5)*uGrow+.5;
  vec3 p = sheet(uvg, layer, uFold);
  // neuron jitter in its layer
  p += (vec3(h11(aSeed.w*91.), h11(aSeed.w*37.), h11(aSeed.w*53.))-.5)*.05;
  vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
  // columns light up in travelling waves; whole column fires together across layers
  float ch = h21(aCell);
  float wave = sin(aCell.x*.35 + aCell.y*.5 - uWave*5.) * .5 + .5;
  float pulse = pow(smoothstep(.78,1.,wave), 2.) * step(.55, ch+uBeat*.4);
  vec3 col = LAYER[int(layer+.5)];
  float base = .11 + .07*h11(aSeed.w*7.);
  vec3 hue = .5+.5*cos(6.2832*(ch*.6+vec3(0.,.33,.67)));
  vCol = mix(col, vec3(.35,.6,1.), .35)*(1.-pulse) + hue*pulse*2.2;
  vA = uW*(base + pulse*.45) * (.4+.6*smoothstep(0.,.15,uGrow-.0));
  gl_PointSize = (layer > 3.5 ? .08 : .06)*(1.+pulse*.6)*uScale/-mv.z;
}`;

export default function Neocortex() {
  const scene = useScene();
  const { geo, mat } = useMemo(() => {
    const per = Math.max(2, Math.floor(PER * world.quality));
    const n = CX * CY * 6 * per; const r = rng(77);
    const seed = new Float32Array(n * 4), cell = new Float32Array(n * 2);
    let k = 0;
    for (let cy = 0; cy < CY; cy++) for (let cx = 0; cx < CX; cx++) for (let l = 0; l < 6; l++) for (let j = 0; j < per; j++) {
      seed[k * 4] = (cx + 0.2 + r() * 0.6) / CX; seed[k * 4 + 1] = (cy + 0.2 + r() * 0.6) / CY; seed[k * 4 + 2] = l; seed[k * 4 + 3] = r();
      cell[k * 2] = cx; cell[k * 2 + 1] = cy; k++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aCell', new THREE.BufferAttribute(cell, 2));
    const m = pointMaterial(VERT, { uGrow: { value: 0.3 }, uFold: { value: 0 }, uBend: { value: 0 }, uWave: { value: 0 }, uBeat: { value: 0 } });
    return { geo: g, mat: m };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const u = mat.uniforms;
    u.uW.value = w; u.uScale.value = pointScale(state);
    u.uTime.value = world.reduced ? 0 : world.time;
    u.uGrow.value = 0.28 + 0.72 * smoothstep(0.05, 0.8, t);
    u.uFold.value = smoothstep(0.2, 0.95, t);
    u.uBend.value = smoothstep(0.35, 1.0, t) * 0.7;
    u.uWave.value = (world.reduced ? 0 : world.time) * 0.25 + t * 1.5;
    u.uBeat.value = near(eventPos('neocortex'), 0.8);
  });

  return <points geometry={geo} material={mat} frustumCulled={false} rotation={[0, 0, 0]} />;
}
