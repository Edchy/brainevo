import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import Critter, { SHAPES } from './Critter';
import { GLSL_NOISE, pointMaterial, pointScale, rimMaterial, silhouetteMaterial } from './kit';

// Night. One small shrew-like mammal rim-lit by a single moon, a thread of scent to a beetle's spark, a few dark trunks
// and, near the end, one amber eye rising out of the dark. Everything else is black.
const SKY_FRAG = /* glsl */ `
uniform float uW, uTime; varying vec2 vUv; ${GLSL_NOISE}
void main(){
  vec2 m = (vUv - vec2(.76,.7)) * vec2(2.,1.);
  float d = length(m);
  float moon = smoothstep(.046,.042,d);
  float halo = exp(-d*7.)*.34 + exp(-d*24.)*.5;
  float cl = fbm(vUv*vec2(4.,7.)+vec2(uTime*.01,0.));
  vec3 c = vec3(.004,.007,.014) + vec3(.55,.68,.95)*halo*(.7+.4*cl) + vec3(1.7,1.8,2.1)*moon;
  gl_FragColor = vec4(c*uW,1.);
}`;
const GROUND_FRAG = /* glsl */ `
uniform float uW; varying vec3 vWp; ${GLSL_NOISE}
void main(){
  float n = fbm(vWp.xz*.7);
  float sheen = smoothstep(-4.,12.,vWp.x) * smoothstep(-14.,-2.,vWp.z) * (1.-smoothstep(-2.,3.,vWp.z));
  vec3 c = vec3(.003,.006,.01) + vec3(.03,.05,.08)*sheen*(.35+n);
  gl_FragColor = vec4(c*uW,1.);
}`;
const RING_FRAG = /* glsl */ `
uniform float uW, uPh, uA; varying vec2 vUv;
void main(){ float r = length(vUv-.5)*2.; float a = smoothstep(.045,0.,abs(r-uPh)) * (1.-uPh) * uA;
  gl_FragColor = vec4(vec3(.8,.9,1.)*a*uW*1.1, 1.); }`;
const SHAFT_FRAG = /* glsl */ `uniform float uW; varying vec2 vUv;
void main(){ float a = smoothstep(0.,.3,vUv.y)*smoothstep(1.,.25,vUv.y)*smoothstep(0.,.5,vUv.x)*smoothstep(1.,.5,vUv.x); gl_FragColor = vec4(vec3(.5,.62,.9)*a*.075*uW,1.); }`;
const PLANE_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vWp; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

const shaderMat = (frag: string, extra: Record<string, THREE.IUniform> = {}, additive = false) => new THREE.ShaderMaterial({
  vertexShader: PLANE_VERT, fragmentShader: frag, toneMapped: false, transparent: additive, depthWrite: !additive,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
  uniforms: { uW: { value: 1 }, uTime: { value: 0 }, ...extra },
});

export default function NightForest() {
  const scene = useScene();
  const trunks = useRef<THREE.InstancedMesh>(null);
  const shrew = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const theropod = useRef<THREE.Group>(null);
  const eye = useRef<THREE.Mesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const beetle = useRef<THREE.Mesh>(null);

  const sky = useMemo(() => shaderMat(SKY_FRAG), []);
  const ground = useMemo(() => shaderMat(GROUND_FRAG), []);
  const shaftMat = useMemo(() => shaderMat(SHAFT_FRAG, {}, true), []);
  const ringMats = useMemo(() => [0, 1].map(() => shaderMat(RING_FRAG, { uPh: { value: 0 }, uA: { value: 0 } }, true)), []);
  const treeMat = useMemo(() => rimMaterial('#000102', '#16213a', '#000000', 8, 34, 2.4, 0.9), []);
  const furMat = useMemo(() => silhouetteMaterial('#d4e0ff', '#010102', 3.0, 1.7), []);
  const dinoMat = useMemo(() => silhouetteMaterial('#6f84b0', '#000000', 3.2, 0.9), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.4), toneMapped: false }), []);
  const beetleMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.0), toneMapped: false }), []);

  const trunkData = useMemo(() => {
    const r = rng(21); const n = 18;
    return Array.from({ length: n }, (_, i) => ({ x: (r() - 0.5) * 36, z: -7 - r() * 28 - i * 0.05, h: 14 + r() * 10, w: 0.15 + r() * 0.3, lean: (r() - 0.5) * 0.05 }));
  }, []);

  // scent: a fine thread of particles from the beetle to the shrew's nose
  const scent = useMemo(() => {
    const n = Math.floor(340 * world.quality); const r = rng(3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uStr; uniform vec3 uSrc, uDst; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.06+aSeed.y*.05));
        vec3 p = mix(uSrc, uDst, life);
        float sp = life*(1.-life)*4.;
        p.y += sin(life*7.+aSeed.z*6.28+uTime*.7)*.2*sp + sp*.22;
        p.z += cos(life*5.+aSeed.w*6.28+uTime*.5)*.22*sp;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.014+aSeed.w*.022)*(1.+sp*.5)*uScale/-mv.z;
        vCol = vec3(.85,.95,1.);
        vA = uW*uStr*smoothstep(0.,.08,life)*smoothstep(1.,.85,life)*.7;
      }`, { uStr: { value: 0 }, uSrc: { value: new THREE.Vector3(4.2, -0.85, -0.2) }, uDst: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);
  const neck = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -6, 0), new THREE.Vector3(0.2, -1, 0), new THREE.Vector3(-0.6, 2, 0), new THREE.Vector3(-1.2, 3.2, 0)]), 16, 0.7, 8), []);

  useEffect(() => () => {
    [sky, ground, shaftMat, treeMat, furMat, dinoMat, eyeMat, beetleMat, neck, scent.g, scent.m, ...ringMats].forEach((d) => d.dispose());
  }, [sky, ground, shaftMat, treeMat, furMat, dinoMat, eyeMat, beetleMat, neck, scent, ringMats]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const nose = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const beat = near(eventPos('nocturnal-bottleneck'), 0.8);
    for (const m of [sky, ground, shaftMat, treeMat, furMat, dinoMat, scent.m, ...ringMats]) {
      if (m.uniforms.uW) m.uniforms.uW.value = w;
      if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    }
    scent.m.uniforms.uScale.value = pointScale(state);
    eyeMat.color.setRGB(2.6 * w, 1.5 * w, 0.4 * w);
    beetleMat.color.setRGB(2.2 * w, 2.4 * w, 2.0 * w);

    // the shrew forages toward the beetle, nose bobbing
    const sx = -3.4 + t * 3.4;
    const s = shrew.current!;
    s.position.set(sx, -0.14 + Math.abs(Math.sin(sx * 7)) * 0.025, 0);
    s.rotation.z = Math.sin(time * 5 + sx * 3) * 0.02 * (0.4 + beat) - 0.03;
    for (let i = 0; i < 4; i++) { const l = legs.current[i]; if (l) l.rotation.z = Math.sin(sx * 7 + (i % 2) * Math.PI) * 0.5; }
    nose.set(sx + 2.34, -0.1, 0);
    (scent.m.uniforms.uDst.value as THREE.Vector3).copy(nose);
    scent.m.uniforms.uStr.value = 0.45 + 0.55 * smoothstep(0.05, 0.5, t);
    beetle.current!.position.set(4.3, -0.8 + Math.sin(time * 2) * 0.01, -0.2);
    beetle.current!.scale.setScalar(0.7 + 0.15 * Math.sin(time * 3));

    // whisker-touch ripples
    rings.current.forEach((m, i) => {
      if (!m) return;
      const ph = (time * 0.4 + i / 2 + t * 2) % 1;
      m.position.set(nose.x + 0.15, -0.97, 0.05);
      m.scale.setScalar(0.5 + ph * 1.4);
      ringMats[i].uniforms.uPh.value = ph * 0.95;
      ringMats[i].uniforms.uA.value = 0.4 + beat * 1.2;
    });

    // the predator: one amber eye rises out of the dark, late
    const rise = smoothstep(0.4, 0.8, t) * (1 - smoothstep(0.93, 1, t));
    theropod.current!.position.set(-9 + t * 3, -4 + rise * 6.5, -14);
    eye.current!.visible = rise > 0.05;
    eyeMat.color.multiplyScalar(0.2 + rise * 0.8);

    const tr = trunks.current;
    if (tr) {
      for (let i = 0; i < trunkData.length; i++) {
        const d = trunkData[i];
        dummy.position.set(d.x, -1 + d.h * 0.5, d.z);
        dummy.rotation.set(0, 0, d.lean);
        dummy.scale.set(d.w, d.h, d.w);
        dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
      }
      tr.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh position={[0, 8, -62]} scale={[150, 70, 1]} material={sky}><planeGeometry args={[1, 1]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, -16]} material={ground}><planeGeometry args={[90, 70]} /></mesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, trunkData.length]} material={treeMat} frustumCulled={false}>
        <cylinderGeometry args={[0.6, 1, 1, 7]} />
      </instancedMesh>
      <mesh position={[11, 7, -22]} rotation={[0, 0, -0.5]} scale={[4.5, 26, 1]} material={shaftMat}><planeGeometry args={[1, 1]} /></mesh>
      <group ref={theropod}>
        <mesh geometry={neck} material={dinoMat} />
        <mesh position={[-1.8, 3.4, 0]} scale={[1.6, 0.7, 0.6]} rotation={[0, 0, 0.1]} material={dinoMat}><sphereGeometry args={[1, 24, 16]} /></mesh>
        <mesh ref={eye} position={[-1.5, 3.65, 0.5]} material={eyeMat}><sphereGeometry args={[0.1, 10, 10]} /></mesh>
      </group>
      <mesh ref={beetle} material={beetleMat}><sphereGeometry args={[0.06, 10, 10]} /></mesh>
      <points geometry={scent.g} material={scent.m} frustumCulled={false} />
      {[0, 1].map((i) => (
        <mesh key={i} ref={(o) => { rings.current[i] = o; }} rotation={[-Math.PI / 2, 0, 0]} material={ringMats[i]}><planeGeometry args={[2, 2]} /></mesh>
      ))}
      <group ref={shrew} scale={1.4}><Critter mat={furMat} shape={SHAPES.shrew} legRefs={legs} eyeMat={beetleMat} /></group>
    </group>
  );
}
