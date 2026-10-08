import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, pointMaterial, pointScale, rimMaterial } from './kit';

const SKY_FRAG = /* glsl */ `
uniform float uW, uTime; varying vec2 vUv; ${GLSL_NOISE}
void main(){
  vec2 p = vUv;
  vec3 c = mix(vec3(.01,.02,.05), vec3(.03,.07,.15), smoothstep(0.,1.,p.y));
  vec2 m = (p - vec2(.74,.72)) * vec2(2.,1.);
  float d = length(m);
  float moon = smoothstep(.062,.058,d);
  float halo = exp(-d*5.5)*.55 + exp(-d*18.)*.6;
  float cl = fbm(p*vec2(4.,7.)+vec2(uTime*.01,0.));
  c += vec3(.35,.5,.75)*halo*(.6+.5*cl);
  c += vec3(1.6,1.7,2.0)*moon*(.8+.3*cl);
  c *= 1.-.4*smoothstep(.5,.0,p.y)*0.;
  gl_FragColor = vec4(c*uW,1.);
}`;
const GROUND_FRAG = /* glsl */ `
uniform float uW, uTime; varying vec3 vWp; ${GLSL_NOISE}
void main(){
  float n = fbm(vWp.xz*.7);
  float depth = length(vWp.xz-vec2(0.,5.));
  vec3 c = vec3(.012,.03,.045) + vec3(.02,.05,.06)*n;
  // moonlit sheen toward the moon side
  c += vec3(.05,.09,.14)*smoothstep(-6.,18.,vWp.x)*smoothstep(0.,1.,n)*.9;
  c = mix(c, vec3(.03,.07,.14), smoothstep(10.,45.,depth));
  gl_FragColor = vec4(c*uW,1.);
}`;
const RING_FRAG = /* glsl */ `
uniform float uW, uPh, uA; varying vec2 vUv;
void main(){ float r = length(vUv-.5)*2.; float rad = uPh; float a = smoothstep(.07,0.,abs(r-rad)) * (1.-uPh) * uA;
  gl_FragColor = vec4(vec3(.4,.9,1.)*a*uW*1.6, 1.); }`;
const SHAFT_FRAG = /* glsl */ `uniform float uW; varying vec2 vUv;
void main(){ float a = smoothstep(0.,.25,vUv.y)*smoothstep(1.,.3,vUv.y)*smoothstep(0.,.35,vUv.x)*smoothstep(1.,.65,vUv.x); gl_FragColor = vec4(vec3(.3,.5,.8)*a*.14*uW,1.); }`;
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
  const head = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const dinoLegs = useRef<(THREE.Object3D | null)[]>([]);
  const dino = useRef<THREE.Group>(null);
  const theropod = useRef<THREE.Group>(null);
  const eye = useRef<THREE.Mesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const beetle = useRef<THREE.Mesh>(null);

  const sky = useMemo(() => shaderMat(SKY_FRAG), []);
  const ground = useMemo(() => shaderMat(GROUND_FRAG), []);
  const shaftMat = useMemo(() => shaderMat(SHAFT_FRAG, {}, true), []);
  const ringMats = useMemo(() => [0, 1, 2].map(() => shaderMat(RING_FRAG, { uPh: { value: 0 }, uA: { value: 0 } }, true)), []);
  const treeMat = useMemo(() => rimMaterial('#02050c', '#2a4a78', '#0a1832', 6, 38, 2.2, 0.8), []);
  const furMat = useMemo(() => rimMaterial('#150f0c', '#9fb3d9', '#0a1832', 20, 60, 2.0, 1.0), []);
  const dinoMat = useMemo(() => rimMaterial('#010208', '#6f93c8', '#0a1832', 30, 140, 3.0, 1.2), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.2), toneMapped: false }), []);
  const beetleMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.4, 0.6), toneMapped: false }), []);

  const trunkData = useMemo(() => {
    const r = rng(21); const n = 46;
    return Array.from({ length: n }, (_, i) => ({ x: (r() - 0.5) * 38, z: -5 - r() * 34 - i * 0.05, h: 14 + r() * 10, w: 0.12 + r() * 0.3, lean: (r() - 0.5) * 0.06 }));
  }, []);

  // scent: particles stream from beetle to the shrew's nose
  const scent = useMemo(() => {
    const n = Math.floor(1500 * world.quality); const r = rng(3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uStr; uniform vec3 uSrc, uDst; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.06+aSeed.y*.05));
        vec3 d = uDst-uSrc; vec3 p = mix(uSrc, uDst, life);
        float sp = life*(1.-life)*4.;
        p.y += sin(life*7.+aSeed.z*6.28+uTime*.7)*.5*sp + sp*.25 + (aSeed.y-.5)*.2*sp;
        p.z += cos(life*5.+aSeed.w*6.28+uTime*.5)*.45*sp + (aSeed.w-.5)*.3*sp;
        p.x += (aSeed.z-.5)*.25*sp;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.03+aSeed.w*.06)*(1.+sp*.8)*uScale/-mv.z;
        vCol = mix(vec3(.5,1.,.35), vec3(.2,.9,.9), life);
        vA = uW*uStr*smoothstep(0.,.08,life)*smoothstep(1.,.85,life)*.2;
      }`, { uStr: { value: 0 }, uSrc: { value: new THREE.Vector3(2.2, -0.7, -0.2) }, uDst: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);
  const fog = useMemo(() => {
    const n = Math.floor(160 * world.quality); const r = rng(4);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW; varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = vec3((aSeed.x-.5)*40.+sin(uTime*.04+aSeed.w*6.)*2., -.8+aSeed.y*1.2, 3.-aSeed.z*30.);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (3.+aSeed.w*5.)*uScale/-mv.z; vCol = vec3(.2,.32,.5); vA = uW*.11;
      }`, {});
    return { g, m };
  }, []);
  const neck = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -6, 0), new THREE.Vector3(0.2, -1, 0), new THREE.Vector3(-0.6, 2, 0), new THREE.Vector3(-1.2, 3.2, 0)]), 16, 0.7, 8), []);

  useEffect(() => () => {
    [sky, ground, shaftMat, treeMat, furMat, dinoMat, eyeMat, beetleMat, neck, scent.g, scent.m, fog.g, fog.m, ...ringMats].forEach((d) => d.dispose());
  }, [sky, ground, shaftMat, treeMat, furMat, dinoMat, eyeMat, beetleMat, neck, scent, fog, ringMats]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const nose = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat = near(eventPos('nocturnal-bottleneck'), 0.8);
    for (const m of [sky, ground, shaftMat, treeMat, furMat, dinoMat, scent.m, fog.m, ...ringMats]) {
      if (m.uniforms.uW) m.uniforms.uW.value = w;
      if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    }
    scent.m.uniforms.uScale.value = fog.m.uniforms.uScale.value = k;
    eyeMat.color.setRGB(2.6 * w, 1.3 * w, 0.2 * w);
    beetleMat.color.setRGB(0.9 * w, 2.4 * w, 0.6 * w);

    // shrew forages toward the beetle, nose bobbing
    const sx = -2.6 + t * 3.8;
    const bob = Math.sin(sx * 9) * 0.5 + 0.5;
    const s = shrew.current!;
    s.position.set(sx, -0.78 + Math.abs(Math.sin(sx * 9)) * 0.03, 0);
    head.current!.rotation.z = -0.15 + Math.sin(time * 6 + sx * 4) * 0.14 * (0.4 + beat);
    for (let i = 0; i < 4; i++) { const l = legs.current[i]; if (l) l.rotation.z = Math.sin(sx * 9 + (i % 2) * Math.PI) * 0.7; }
    nose.set(sx + 0.62, -0.62 + Math.sin(time * 6 + sx * 4) * 0.03, 0);
    (scent.m.uniforms.uDst.value as THREE.Vector3).copy(nose);
    scent.m.uniforms.uStr.value = 0.45 + 0.55 * smoothstep(0.05, 0.5, t);
    beetle.current!.position.set(2.2, -0.88 + Math.sin(time * 2) * 0.01, -0.2);
    beetle.current!.scale.setScalar(0.5 + 0.3 * Math.sin(time * 3) * 0 + bob * 0);

    // whisker-touch ripples radiate from the nose in sweeps
    rings.current.forEach((m, i) => {
      if (!m) return;
      const ph = (time * 0.45 + i / 3 + t * 2) % 1;
      m.position.set(nose.x + 0.1, -0.98, 0.05);
      m.scale.setScalar(0.5 + ph * 1.4);
      ringMats[i].uniforms.uPh.value = ph * 0.95;
      ringMats[i].uniforms.uA.value = 0.5 + beat * 1.5;
    });

    // looming dinosaurs: sauropod legs pass behind and a theropod head rises later
    const dg = dino.current!;
    dg.position.set(8 - t * 22, 0, -9);
    for (let i = 0; i < 4; i++) { const l = dinoLegs.current[i]; if (l) { const ph = t * 14 + i * 1.6; l.position.y = Math.max(0, Math.sin(ph)) * 0.9; l.rotation.z = Math.sin(ph) * 0.1; } }
    const tg = theropod.current!;
    const rise = smoothstep(0.35, 0.75, t) * (1 - smoothstep(0.92, 1, t));
    tg.position.set(-9 + t * 3, -4 + rise * 6.5, -14);
    eye.current!.visible = rise > 0.05;
    (eyeMat.color as THREE.Color).multiplyScalar(0.3 + rise * 0.7);

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
      {[-6, -1, 5, 10].map((x, i) => (
        <mesh key={i} position={[x + 8, 9, -20 - i * 3]} rotation={[0, 0, -0.35]} scale={[3 + i, 26, 1]} material={shaftMat}><planeGeometry args={[1, 1]} /></mesh>
      ))}
      <group ref={dino}>
        {[-5, -2.4, 2.4, 5].map((x, i) => (
          <group key={i} position={[x, 0, i % 2 ? 1 : 0]} ref={(o) => { dinoLegs.current[i] = o; }}>
            <mesh position={[0, 3, 0]} material={dinoMat}><cylinderGeometry args={[1.1, 1.4, 8, 10]} /></mesh>
          </group>
        ))}
        <mesh position={[0, 9, 0]} scale={[8, 3.5, 3]} material={dinoMat}><sphereGeometry args={[1, 16, 12]} /></mesh>
      </group>
      <group ref={theropod}>
        <mesh geometry={neck} material={dinoMat} />
        <mesh position={[-1.8, 3.4, 0]} scale={[1.6, 0.7, 0.6]} rotation={[0, 0, 0.1]} material={dinoMat}><sphereGeometry args={[1, 16, 12]} /></mesh>
        <mesh ref={eye} position={[-1.5, 3.65, 0.5]} material={eyeMat}><sphereGeometry args={[0.1, 8, 8]} /></mesh>
      </group>

      <mesh ref={beetle} material={beetleMat}><sphereGeometry args={[0.07, 10, 10]} /></mesh>
      <points geometry={scent.g} material={scent.m} frustumCulled={false} />
      <points geometry={fog.g} material={fog.m} frustumCulled={false} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(o) => { rings.current[i] = o; }} rotation={[-Math.PI / 2, 0, 0]} material={ringMats[i]}><planeGeometry args={[2, 2]} /></mesh>
      ))}

      <group ref={shrew} scale={0.8}>
        <mesh scale={[0.55, 0.3, 0.3]} material={furMat}><sphereGeometry args={[1, 20, 14]} /></mesh>
        <group ref={head} position={[0.5, 0.06, 0]}>
          <mesh scale={[0.3, 0.2, 0.2]} material={furMat}><sphereGeometry args={[1, 16, 12]} /></mesh>
          <mesh position={[0.4, -0.02, 0]} rotation={[0, 0, -Math.PI / 2]} material={furMat}><coneGeometry args={[0.1, 0.38, 10]} /></mesh>
          <mesh position={[0.57, -0.04, 0]} material={beetleMat}><sphereGeometry args={[0.035, 8, 8]} /></mesh>
          <mesh position={[0.06, 0.2, 0.1]} material={furMat}><sphereGeometry args={[0.08, 8, 8]} /></mesh>
          {[-1, 1].flatMap((sd) => [0.22, 0.12, 0].map((a, j) => (
            <mesh key={`${sd}${j}`} position={[0.5, -0.03 + j * 0.03, sd * 0.2]} rotation={[sd * (0.5 + j * 0.25), 0, -0.2 + j * 0.2]} material={furMat}>
              <cylinderGeometry args={[0.004, 0.004, 0.6 - a, 3]} />
            </mesh>
          )))}
        </group>
        <mesh position={[-0.9, -0.05, 0]} rotation={[0, 0, Math.PI / 2 + 0.2]} material={furMat}><cylinderGeometry args={[0.02, 0.06, 0.7, 6]} /></mesh>
        {[[0.3, 1], [0.3, -1], [-0.3, 1], [-0.3, -1]].map(([x, sd], i) => (
          <group key={i} position={[x, -0.15, sd * 0.2]} ref={(o) => { legs.current[i] = o; }}>
            <mesh position={[0, -0.1, 0]} material={furMat}><capsuleGeometry args={[0.04, 0.16, 3, 6]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
