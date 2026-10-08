import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeInOutCubic, eventPos, lerp, near, range, rng, smoothstep } from '../../world/util';
import { Figure, NOISE, ambientTime, makePose } from './common';

const PERCH: [number, number][] = [[-4.4, -0.8], [-1.2, 0.3], [1.9, -0.3], [4.9, 0.55]];
const SCALE = 0.62;

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
  vec3 c = mix(uCol, uGlow, edge*.75 + leaf*.1);
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
  gl_PointSize = (14.+tw*14.)*aR.z*(1.+uGlowAmt*.3)/ -mv.z * 6.;
  gl_Position = projectionMatrix*mv;
}`;
const FLY_F = /* glsl */ `
varying float vA;
void main(){ vec2 c=gl_PointCoord-.5; float d=length(c)*2.; float g=smoothstep(1.,0.,d); g*=g;
  gl_FragColor = vec4(vec3(1.6,1.9,.7)*g*vA, g*vA); }`;

interface Layer { z: number; h: number; col: string; glow: string; seed: number; top: number; bot: number; scroll: number }
const LAYERS: Layer[] = [
  { z: -16, h: 30, col: '#16483c', glow: '#5fb497', seed: 1.3, top: 0.55, bot: 0.4, scroll: 0.4 },
  { z: -11, h: 24, col: '#0e382c', glow: '#46a07a', seed: 7.7, top: 0.6, bot: 0.45, scroll: 0.1 },
  { z: -7, h: 18, col: '#0a2a21', glow: '#3a8a60', seed: 3.1, top: 0.7, bot: 0.5, scroll: 0.7 },
  { z: -3.2, h: 12, col: '#06180f', glow: '#2b6c43', seed: 11.9, top: 0.75, bot: 0.55, scroll: 0.3 },
  { z: 2.6, h: 6, col: '#010503', glow: '#123e22', seed: 5.5, top: 0.9, bot: 0.8, scroll: 0.9 },
];

function branchCurve(cx: number, cy: number, len: number, droop: number) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - len, cy + droop * 0.6, 0),
    new THREE.Vector3(cx - len * 0.3, cy + droop * 0.1, 0.05),
    new THREE.Vector3(cx + len * 0.4, cy - droop * 0.1, -0.05),
    new THREE.Vector3(cx + len, cy - droop * 0.7, 0),
  ]);
}

export default function Canopy() {
  const scene = useScene();
  const pose = useMemo(makePose, []);
  const fig = useRef<THREE.Group>(null);
  const shafts = useRef<THREE.ShaderMaterial[]>([]);
  const layerMats = useRef<THREE.ShaderMaterial[]>([]);
  const flyMat = useRef<THREE.ShaderMaterial>(null);

  const branches = useMemo(
    () => PERCH.map(([x, y], i) => new THREE.TubeGeometry(branchCurve(x, y - 0.06, 1.7, 0.25 * (i % 2 ? 1 : -1)), 28, 0.07 + (i % 2) * 0.02, 7)),
    [],
  );
  const branchMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#030604', transparent: true }), []);
  const flyGeo = useMemo(() => {
    const n = Math.floor(260 * world.quality);
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
    return Array.from({ length: 6 }, (_, i) => ({ x: -9 + i * 3.6 + r() * 1.5, z: -4 - r() * 5, w: 1.6 + r() * 2.4, seed: r() * 10 }));
  }, []);

  useFrame(() => {
    if (!scene.active) return;
    const tm = ambientTime();
    const w = scene.weight;
    const t = scene.t;
    const beat = near(eventPos('first-primates'), 0.8);
    for (let i = 0; i < layerMats.current.length; i++) {
      const m = layerMats.current[i];
      if (!m) continue;
      m.uniforms.uTime.value = tm;
      m.uniforms.uOp.value = w;
      m.uniforms.uScroll.value = LAYERS[i].scroll + t * 0.6 * (1 - (LAYERS[i].z + 18) / 24);
    }
    shafts.current.forEach((m, i) => {
      if (!m) return;
      m.uniforms.uTime.value = tm;
      m.uniforms.uOp.value = w * (0.16 + beat * 0.2) * (0.6 + 0.4 * Math.sin(t * 5 + i));
    });
    if (flyMat.current) {
      flyMat.current.uniforms.uTime.value = tm + t * 6;
      flyMat.current.uniforms.uOp.value = w;
      flyMat.current.uniforms.uGlowAmt.value = beat * 0.8;
    }
    branchMat.opacity = w;

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
    const arc = Math.sin(air * Math.PI) * 1.15;
    const g = fig.current;
    if (g) {
      g.position.set(x, baseY + arc + 0.05, 0.2);
      g.rotation.z = (b[1] - a[1] > 0 ? 1 : -1) * Math.sin(air * Math.PI) * 0.15 - 0.35 * Math.sin(air * Math.PI);
      g.rotation.y = Math.PI / 2 - 0.2; // profile, facing +x
    }
    const inAir = Math.sin(air * Math.PI);
    pose.lean = 0.35 * crouch - 0.45 * inAir;
    pose.y = -0.1 * crouch;
    pose.aL = [-0.6 - 1.5 * inAir + crouch * 0.2, 0.2, -0.3 - 0.5 * inAir];
    pose.aR = [-0.6 - 1.5 * inAir + crouch * 0.2, -0.2, -0.3 - 0.5 * inAir];
    pose.lL = 0.5 * crouch + 0.9 * inAir;
    pose.lR = 0.5 * crouch + 0.7 * inAir;
    pose.tail = Math.sin(tm * 2 + t * 8) * 0.15 + inAir * 0.9;
    pose.headYaw = 0;
    pose.headPitch = -0.1 * inAir;
    pose.alpha = 1;
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
            uniforms={{ uTime: { value: 0 }, uOp: { value: 0 }, uSeed: { value: s.seed }, uCol: { value: new THREE.Color(1.0, 0.85, 0.45) } }}
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
        <Figure pose={pose} base="#07090a" rim="#ffc77a" rimGlow={2.8} eyeColor="#ffe9a8" />
      </group>
    </group>
  );
}

export const canopyCamera = (t: number) => ({
  pos: [lerp(-3.4, 4.2, t), 0.3, 7] as [number, number, number],
  look: [lerp(-3.0, 4.4, t), 0.1, 0] as [number, number, number],
  fov: 50,
});
