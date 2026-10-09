import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeInOutCubic, eventPos, lerp, near, range, rng, smoothstep } from '../../world/util';
import { NOISE, Primate, ambientTime, neutral, reach } from './common';
import type { CreatureHandle } from './common';
import { silhouetteMaterial } from '../mammal/kit';

const PERCH: [number, number][] = [[-4.4, -0.8], [-1.2, 0.3], [1.9, -0.3], [4.9, 0.55]];
const SCALE = 1.5;

const FOLIAGE_V = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FOLIAGE_F = /* glsl */ `
${NOISE}
varying vec2 vUv;
uniform float uTime,uSeed,uOp,uAspect,uTop,uBot,uScroll;
uniform vec3 uCol,uGlow;
void main(){
  vec2 p = vec2(vUv.x*uAspect + uScroll, vUv.y*uAspect/3.2);
  p.x += sin(uTime*.35+vUv.y*3.+uSeed)*.12;
  float n = fbm(p*vec2(.9,1.)+uSeed);
  float leaf = vnoise(p*vec2(9.,7.)+uSeed*3.);
  float spike = abs(sin(p.x*7.+uSeed))*.12;
  float topM = smoothstep(.5,1.,vUv.y)*uTop;
  float botM = smoothstep(.45,0.,vUv.y)*uBot;
  float d = n*.8 + leaf*.3 + spike*.4 + topM*1.1 + botM*1.1 - .3;
  float a = smoothstep(.5,.56,d);
  if(a<.01) discard;
  float edge = 1.-smoothstep(.56,.74,d);
  vec3 c = mix(uCol, uGlow, edge*.5);
  gl_FragColor = vec4(c, a*uOp);
}`;

const SHAFT_V = FOLIAGE_V;
const SHAFT_F = /* glsl */ `
${NOISE}
varying vec2 vUv; uniform float uTime,uOp,uSeed; uniform vec3 uCol;
void main(){
  float across = 1.-abs(vUv.x-.5)*2.;
  across = pow(max(across,0.),1.6);
  float along = smoothstep(0.,.15,vUv.y)*smoothstep(1.,.2,vUv.y);
  float fl = .65+.35*fbm(vec2(vUv.y*3.+uSeed, uTime*.15+uSeed));
  float a = across*along*fl*uOp;
  gl_FragColor = vec4(uCol*a, a);
}`;

const FLY_V = /* glsl */ `
attribute vec4 aR; uniform float uTime,uOp,uGlowAmt; varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime*.3*aR.x+aR.w*6.28)*.9; p.y += sin(uTime*.4*aR.y+aR.w*9.)*.6; p.z += cos(uTime*.25*aR.z+aR.w*3.)*.8;
  float tw = pow(.5+.5*sin(uTime*(1.+aR.x*2.)+aR.w*40.),3.);
  vA = (.15+tw)*uOp*(1.+uGlowAmt);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_PointSize = (9.+tw*9.)*aR.z*(1.+uGlowAmt*.3)/ -mv.z * 3.;
  gl_Position = projectionMatrix*mv;
}`;
const FLY_F = /* glsl */ `
varying float vA;
void main(){ vec2 c=gl_PointCoord-.5; float d=length(c)*2.; float g=smoothstep(1.,0.,d); g*=g;
  gl_FragColor = vec4(vec3(1.5,1.6,1.3)*g*vA, g*vA); }`;

interface Layer { z: number; h: number; col: string; glow: string; seed: number; top: number; bot: number; scroll: number }
const LAYERS: Layer[] = [
  { z: -16, h: 30, col: '#000201', glow: '#22332d', seed: 1.3, top: 0.55, bot: 0.5, scroll: 0.4 },
  { z: -8, h: 20, col: '#000100', glow: '#17251f', seed: 3.1, top: 0.75, bot: 0.6, scroll: 0.7 },
];

function branchCurve(cx: number, cy: number, len: number, droop: number) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - len, cy + droop * 0.7, 0),
    new THREE.Vector3(cx - len * 0.45, cy + droop * 0.02, 0.03),
    new THREE.Vector3(cx + len * 0.45, cy - droop * 0.02, -0.03),
    new THREE.Vector3(cx + len, cy - droop * 0.8, 0),
  ]);
}

export default function Canopy() {
  const scene = useScene();
  const fig = useRef<THREE.Group>(null);
  const hp = useRef<CreatureHandle>(null);
  const shafts = useRef<THREE.ShaderMaterial[]>([]);
  const layerMats = useRef<THREE.ShaderMaterial[]>([]);
  const flyMat = useRef<THREE.ShaderMaterial>(null);

  const branches = useMemo(
    () => PERCH.map(([x, y], i) => new THREE.TubeGeometry(branchCurve(x, y - 0.07, 2.3, 0.25 * (i % 2 ? 1 : -1)), 32, 0.065 + (i % 2) * 0.015, 8)),
    [],
  );
  const branchMat = useMemo(() => silhouetteMaterial('#a9bcd6', '#000000', 2.4, 1.1), []);
  const flyGeo = useMemo(() => {
    const n = Math.floor(36 * world.quality);
    const r = rng(42);
    const pos = new Float32Array(n * 3);
    const aR = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos.set([(r() - 0.5) * 22, (r() - 0.5) * 7, -5 + r() * 9], i * 3);
      aR.set([0.4 + r(), 0.4 + r(), 0.5 + r() * 0.8, r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(aR, 4));
    return g;
  }, []);
  useEffect(() => () => { branches.forEach((b) => b.dispose()); branchMat.dispose(); flyGeo.dispose(); }, [branches, branchMat, flyGeo]);

  const shaftDefs = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 2 }, (_, i) => ({ x: -2 + i * 7 + r() * 1.5, z: -4 - r() * 5, w: 1.6 + r() * 2.4, seed: r() * 10 }));
  }, []);

  useFrame(() => {
    if (!scene.active) return;
    const tm = ambientTime();
    const w = scene.weight;
    const t = scene.t;
    const beat = near(eventPos('first-primates'), 0.8);
    for (let i = 0; i < LAYERS.length; i++) {
      const m = layerMats.current[i];
      if (!m) continue;
      m.uniforms.uTime.value = tm;
      m.uniforms.uOp.value = w * 0.9;
      m.uniforms.uScroll.value = LAYERS[i].scroll + t * 0.6 * (1 - (LAYERS[i].z + 18) / 24);
    }
    shafts.current.forEach((m, i) => {
      if (!m) return;
      m.uniforms.uTime.value = tm;
      m.uniforms.uOp.value = w * (0.1 + beat * 0.12) * (0.7 + 0.3 * Math.sin(t * 5 + i));
    });
    if (flyMat.current) {
      flyMat.current.uniforms.uTime.value = tm + t * 6;
      flyMat.current.uniforms.uOp.value = w;
      flyMat.current.uniforms.uGlowAmt.value = beat * 0.8;
    }
    branchMat.uniforms.uW.value = w;

    // leap schedule: 3 hops
    const seg = Math.min(2.9999, t * 3);
    const i = Math.floor(seg);
    const f = seg - i;
    const a = PERCH[i], b = PERCH[i + 1];
    const crouch = smoothstep(0.1, 0.38, f) * (1 - smoothstep(0.38, 0.45, f));
    const air = range(0.4, 0.82, f);
    const e = easeInOutCubic(air);
    const x = lerp(a[0], b[0], e);
    const baseY = lerp(a[1], b[1], e);
    const arc = Math.sin(air * Math.PI) * 0.42;
    const g = fig.current;
    const h = hp.current;
    const inAir = Math.sin(air * Math.PI);
    const landing = smoothstep(0.82, 0.97, f) * (1 - smoothstep(0.97, 1.0, f));
    const rising = Math.cos(air * Math.PI) * inAir; // +: going up during the first half
    if (g) {
      g.position.set(x, baseY + arc - 0.01, 0.2);
      g.rotation.z = -0.5 * Math.sin(air * Math.PI * 2) * 0.55 * (b[1] > a[1] ? 1 : 0.7) * (air > 0 && air < 1 ? 1 : 0);
    }
    if (h) {
      const st = h.state, pm = st.pm;
      neutral(pm);
      h.override.walk = 0; h.override.phase = 0;
      st.crouch = 0.55 * crouch + 0.5 * landing;
      pm.hand.length; // (targets are creature-local)
      // airborne: arms thrown forward and up, hind legs trailing, tail streaming; grip closes on landing
      reach(pm.hand, 1, 0.95, 0.62 + 0.1 * rising, 0.14, inAir * 1.0);
      reach(pm.hand, -1, 0.95, 0.62 + 0.1 * rising, -0.14, inAir * 1.0);
      reach(pm.foot, 1, -0.62, 0.3, 0.12, inAir);
      reach(pm.foot, -1, -0.62, 0.3, -0.12, inAir);
      pm.gripL = pm.gripR = 0.15 + 0.8 * smoothstep(0.72, 0.9, f) + 0.5 * crouch;
      pm.footGrip = 0.3 + 0.6 * crouch + 0.5 * smoothstep(0.78, 0.92, f);
      pm.tailPit = -0.3 * inAir; pm.tailCurl = -0.8 * inAir + 0.5 * (1 - inAir);
      pm.brow = 0.3 + 0.4 * crouch;
      st.headPitch = 0.25 * crouch + 0.1 * inAir;
      st.alert = 0.4 + 0.4 * crouch;
      h.look.w = w;
    }
  });

  return (
    <group>
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, 0, l.z]} renderOrder={-10 + i}>
          <planeGeometry args={[l.h * 3.2, l.h]} />
          <shaderMaterial
            ref={(m) => { if (m) layerMats.current[i] = m; }}
            transparent depthWrite={false}
            vertexShader={FOLIAGE_V} fragmentShader={FOLIAGE_F}
            uniforms={{
              uTime: { value: 0 }, uSeed: { value: l.seed }, uOp: { value: 1 }, uAspect: { value: 3.2 * (3 + i * 1.2) },
              uTop: { value: l.top }, uBot: { value: l.bot }, uScroll: { value: 0 },
              uCol: { value: new THREE.Color(l.col) }, uGlow: { value: new THREE.Color(l.glow) },
            }}
          />
        </mesh>
      ))}
      {shaftDefs.map((s, i) => (
        <mesh key={i} position={[s.x, 3, s.z]} rotation={[0, 0, -0.45]} renderOrder={-5}>
          <planeGeometry args={[s.w, 22]} />
          <shaderMaterial
            ref={(m) => { if (m) shafts.current[i] = m; }}
            transparent depthWrite={false} blending={THREE.AdditiveBlending}
            vertexShader={SHAFT_V} fragmentShader={SHAFT_F}
            uniforms={{ uTime: { value: 0 }, uOp: { value: 0 }, uSeed: { value: s.seed }, uCol: { value: new THREE.Color(0.9, 0.95, 1.0) } }}
          />
        </mesh>
      ))}
      {branches.map((g, i) => (
        <mesh key={i} geometry={g} material={branchMat} />
      ))}
      <points geometry={flyGeo} renderOrder={5}>
        <shaderMaterial
          ref={flyMat} transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={FLY_V} fragmentShader={FLY_F}
          uniforms={{ uTime: { value: 0 }, uOp: { value: 0 }, uGlowAmt: { value: 0 } }}
        />
      </points>
      <group ref={fig} scale={SCALE}>
        <Primate ref={hp} preset="prosimian" rim="#ffe2bd" look={{ splashK: 0.5, rimK: 2.0 }} />
      </group>
    </group>
  );
}

export const canopyCamera = (t: number) => ({
  pos: [lerp(-5.0, 2.8, t), 0.4, 7] as [number, number, number],
  look: [lerp(-4.6, 3.0, t), -0.15, 0] as [number, number, number],
  fov: 50,
});
