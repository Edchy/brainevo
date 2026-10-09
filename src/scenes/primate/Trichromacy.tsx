import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { ambientTime } from './common';

const VERT = /* glsl */ `
attribute vec3 aCol; attribute float aKind; attribute float aSeed;
uniform float uTime;
varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying float vKind; varying float vNdc; varying float vDepth;
void main(){
  vec3 p = position;
  if(aKind<.5){ p.x += sin(uTime*1.2+aSeed*6.28)*.08*(1.-uv.y); }
  vec4 world = instanceMatrix*vec4(p,1.);
  if(aKind<.5){ world.x += sin(uTime*.8+aSeed*20.)*.05; world.y += cos(uTime*.7+aSeed*13.)*.03; }
  vec4 mv = modelViewMatrix*world;
  vN = normalize(mat3(modelViewMatrix)*mat3(instanceMatrix)*normal);
  vCol = aCol; vUv = uv; vKind = aKind; vDepth = -mv.z;
  vec4 clip = projectionMatrix*mv;
  vNdc = clip.x/clip.w;
  gl_Position = clip;
}`;
const FRAG = /* glsl */ `
uniform float uWipe, uPulse, uOp;
varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying float vKind; varying float vNdc; varying float vDepth;
void main(){
  vec3 c = vCol;
  float lit;
  if(vKind<.5){ // leaf: ellipse w/ midrib
    vec2 q = (vUv-.5)*vec2(2.,2.);
    float yy=q.y*.5+.5; float hw = 1.05*sin(3.14159*pow(yy,.8))*(1.-.35*yy); if(abs(q.x) > hw) discard;
    float edgeG = smoothstep(.55,.98,abs(q.x)/max(hw,.001))*smoothstep(0.,.1,yy)*smoothstep(1.,.9,yy);
    float rib = smoothstep(.08,.0,abs(q.x));
    c *= .85+.35*vUv.y; c += rib*.025 + vec3(.2,.26,.22)*edgeG*.32;
    lit = .75+.25*abs(vN.z);
    c *= lit;
  } else { // fruit
    float l = clamp(dot(normalize(vN), normalize(vec3(-.4,.7,.6)))*.5+.5,0.,1.);
    c *= .35+.9*l;
    float rim = pow(1.-abs(vN.z),3.);
    c += vCol*rim*.6;
  }
  // true trichromat colour vs red-green dichromat simulation
  vec3 d = vec3(dot(c,vec3(.625,.375,0.)), dot(c,vec3(.7,.3,0.)), dot(c,vec3(0.,.3,.7)));
  float lum = dot(d,vec3(.3,.5,.2));
  d = mix(vec3(lum), d, .65) * vec3(.82,.95,1.05); // muted and cool
  // to a red-green dichromat the ripe fruit is just another dark leaf-coloured thing in the foliage
  if(vKind>.5){ float l2 = clamp(dot(normalize(vN), normalize(vec3(-.4,.7,.6)))*.5+.5,0.,1.); d = vec3(.05,.07,.055)*(.6+.9*l2); }
  float sx = vNdc*.5+.5; float k = smoothstep(uWipe-.03, uWipe+.03, sx);
  vec3 full = c;
  if(vKind>.5) full *= 1.0 + uPulse*1.0 + 1.6; // fruit pops (bloom)
  vec3 outc = mix(full, d, k);
  float seam = exp(-pow((sx-uWipe)*18.,2.));
  outc += seam*vec3(.9,1.1,1.6)*.3;
  // depth haze into dark teal
  float fog = smoothstep(4.,16.,vDepth);
  outc = mix(outc, vec3(.02,.05,.06), fog*.65);
  gl_FragColor = vec4(outc*uOp, 1.);
}`;

export default function Trichromacy() {
  const scene = useScene();
  const leaves = useRef<THREE.InstancedMesh>(null);
  const fruits = useRef<THREE.InstancedMesh>(null);
  const mats = useRef<THREE.ShaderMaterial[]>([]);

  const data = useMemo(() => {
    const r = rng(99);
    const nL = Math.floor(64 * Math.max(0.5, world.quality));
    const nF = 5;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const lm: THREE.Matrix4[] = [];
    const lc = new Float32Array(nL * 3), ls = new Float32Array(nL);
    const col = new THREE.Color();
    for (let i = 0; i < nL; i++) {
      p.set((r() - 0.5) * 17, (r() - 0.5) * 8, -r() * 9 - 0.5);
      e.set((r() - 0.5) * 1.2, (r() - 0.5) * 1.2, r() * Math.PI * 2);
      q.setFromEuler(e);
      const sc = 0.8 + r() * 0.9;
      s.set(sc * 1.0, sc * 1.0, sc);
      m.compose(p, q, s);
      lm.push(m.clone());
      const g = r();
      // greens; a few young reddish leaves (also invisible to dichromats)
      if (r() < 0.07) col.setRGB(0.2 + g * 0.08, 0.14 + g * 0.05, 0.03);
      else col.setHSL(0.27 + g * 0.08, 0.4, 0.045 + g * 0.05);
      lc.set([col.r, col.g, col.b], i * 3);
      ls[i] = r();
    }
    const fm: THREE.Matrix4[] = [];
    const fc = new Float32Array(nF * 3), fs = new Float32Array(nF);
    for (let i = 0; i < nF; i++) {
      if (i === 0) p.set(1.0, 0.1, -0.4); else p.set((r() - 0.5) * 9, (r() - 0.5) * 3.4, -1.2 - r() * 4);
      q.identity();
      const sc = i === 0 ? 0.42 : 0.14 + r() * 0.06;
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      fm.push(m.clone());
      col.setRGB(0.95, 0.1 + r() * 0.1, 0.04);
      fc.set([col.r, col.g, col.b], i * 3);
      fs[i] = r();
    }
    return { nL, nF, lm, lc, ls, fm, fc, fs };
  }, []);

  const leafGeo = useMemo(() => new THREE.PlaneGeometry(0.5, 0.5, 4, 4), []);
  const fruitGeo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  useEffect(() => () => { leafGeo.dispose(); fruitGeo.dispose(); }, [leafGeo, fruitGeo]);

  useEffect(() => {
    const l = leaves.current, f = fruits.current;
    if (l) {
      data.lm.forEach((m, i) => l.setMatrixAt(i, m));
      l.instanceMatrix.needsUpdate = true;
      leafGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(data.lc, 3));
      leafGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(data.ls, 1));
      leafGeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(data.nL).fill(0), 1));
    }
    if (f) {
      data.fm.forEach((m, i) => f.setMatrixAt(i, m));
      f.instanceMatrix.needsUpdate = true;
      fruitGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(data.fc, 3));
      fruitGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(data.fs, 1));
      fruitGeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(data.nF).fill(1), 1));
    }
  }, [data, leafGeo, fruitGeo]);

  useFrame(() => {
    if (!scene.active) return;
    const beat = near(eventPos('trichromatic-vision'), 0.6);
    const wipe = -0.1 + smoothstep(0.2, 0.8, scene.t) * 1.2;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = ambientTime();
      m.uniforms.uWipe.value = wipe;
      m.uniforms.uPulse.value = beat;
      m.uniforms.uOp.value = scene.weight;
    }
  });

  const uniforms = () => ({ uTime: { value: 0 }, uWipe: { value: 1 }, uPulse: { value: 0 }, uOp: { value: 0 } });
  return (
    <group>
      <instancedMesh ref={leaves} args={[leafGeo, undefined, data.nL]} frustumCulled={false}>
        <shaderMaterial ref={(m) => { if (m) mats.current[0] = m; }} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms()} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={fruits} args={[fruitGeo, undefined, data.nF]} frustumCulled={false}>
        <shaderMaterial ref={(m) => { if (m) mats.current[1] = m; }} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms()} />
      </instancedMesh>
    </group>
  );
}

export const trichromacyCamera = (t: number) => ({
  pos: [Math.sin(t * 1.6 - 0.8) * 1.2, 0.2, 7] as [number, number, number],
  look: [0, 0, 0] as [number, number, number],
  fov: 52,
});
