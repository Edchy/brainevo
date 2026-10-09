import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range, rng, smoothstep } from '../../world/util';
import Critter, { SHAPES } from './Critter';
import { GLSL_NOISE, pointMaterial, pointScale, silhouetteMaterial } from './kit';

// K-Pg: one small mammal stands against the horizon. A single streak crosses the sky, the world flashes white, the horizon
// burns, ash drifts, and then one soft beam of light returns to the animal while a few fireflies wake. That is all.
const bell = (s: number, c: number, w: number) => Math.exp(-((s - c) * (s - c)) / (2 * w * w));
const GROUND_Y = -2.4;

const PLANE_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vWp; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const PH_UNI = `uniform float uW, uTime, uFire, uAsh, uRec, uFlash, uBlast;`;

const SKY_FRAG = /* glsl */ `
${PH_UNI} varying vec2 vUv; ${GLSL_NOISE}
void main(){
  float y = vUv.y;
  vec3 col = vec3(.004,.006,.012);
  vec2 g = floor(vUv*vec2(260.,140.)); float r = h21(g);
  float star = step(.9976,r)*(.5+.5*sin(uTime*2.+r*60.))*smoothstep(.3,.75,y);
  col += vec3(.8,.9,1.2)*star*(1.-uFire)*(1.-uAsh)*.8;
  float cl = fbm(vec2(vUv.x*5.+uTime*.03, y*3.-uTime*.05));
  // the burning horizon: a thin band of heat low in the frame, nothing above it
  col += vec3(1.5,.5,.18)*exp(-y*11.)*(.35+.9*cl)*uFire*.75;
  col += vec3(.2,.22,.26)*exp(-y*7.)*uAsh*.25*cl;
  // quiet pre-dawn glow on the horizon during recovery
  col += vec3(.45,.6,.75)*exp(-y*14.)*uRec*.18;
  vec2 imp = vec2(.55,.4);
  col += vec3(1.6,.9,.45)*exp(-length((vUv-imp)*vec2(1.8,1.))*9.)*uBlast*.8;
  gl_FragColor = vec4(col*uW,1.);
}`;
const RIDGE_FRAG = /* glsl */ `
${PH_UNI} uniform float uBase, uAmp, uSeed; varying vec2 vUv; ${GLSL_NOISE}
void main(){
  float h = uBase + uAmp*fbm(vec2(vUv.x*7.+uSeed, uSeed*.3));
  if (vUv.y > h) discard;
  float edge = smoothstep(.04,0.,h-vUv.y);
  vec3 col = vec3(.002,.003,.005);
  col += vec3(1.5,.5,.14)*edge*uFire*(.4+.7*fbm(vec2(vUv.x*40.,uTime*.8)))*.8;
  col += vec3(.25,.33,.45)*edge*uRec*.25;
  gl_FragColor = vec4(col*uW,1.);
}`;
const GROUND_FRAG = /* glsl */ `
${PH_UNI} varying vec2 vUv; varying vec3 vWp; ${GLSL_NOISE}
void main(){
  float n = fbm(vWp.xz*.45);
  float far = smoothstep(-4.,-34.,vWp.z);
  vec3 col = vec3(.003,.004,.006) + vec3(.004,.005,.008)*n;
  col += vec3(1.4,.45,.14)*uFire*far*(.05+.35*smoothstep(.45,.75,n))*.7;
  col += vec3(.5,.62,.8)*uRec*(.02+.02*n)*(1.-far);
  gl_FragColor = vec4(col*uW,1.);
}`;
const FLASH_FRAG = /* glsl */ `uniform float uFlash; varying vec2 vUv; void main(){ float d = length(vUv-.5); gl_FragColor = vec4(vec3(2.0,1.8,1.5)*uFlash*(1.-.5*d), 1.); }`;
const RING_FRAG = /* glsl */ `
uniform float uR, uA; varying vec2 vUv;
void main(){ float r = length(vUv-.5)*2.; float a = smoothstep(.05,0.,abs(r-uR))*uA; gl_FragColor = vec4(vec3(1.5,1.2,.9)*a,1.); }`;
const BEAM_FRAG = /* glsl */ `uniform float uA; varying vec2 vUv; ${GLSL_NOISE}
void main(){ float across = pow(max(1.-abs(vUv.x-.5)*2.,0.),2.2); float along = smoothstep(0.,.35,vUv.y)*smoothstep(1.,.5,vUv.y);
  float f = .8+.2*fbm(vec2(vUv.y*4., 1.)); gl_FragColor = vec4(vec3(.8,.9,1.)*across*along*f*uA,1.); }`;

const mk = (frag: string, extra: Record<string, THREE.IUniform> = {}, opts: Partial<THREE.ShaderMaterialParameters> = {}) => new THREE.ShaderMaterial({
  vertexShader: PLANE_VERT, fragmentShader: frag, toneMapped: false,
  uniforms: { uW: { value: 1 }, uTime: { value: 0 }, uFire: { value: 0 }, uAsh: { value: 0 }, uRec: { value: 0 }, uFlash: { value: 0 }, uBlast: { value: 0 }, ...extra },
  ...opts,
});

const IMPACT = new THREE.Vector3(5.5, -1.2, -30);
const START = new THREE.Vector3(-26, 17, -30);

export default function KPg() {
  const scene = useScene();
  const root = useRef<THREE.Group>(null);
  const hero = useRef<THREE.Group>(null);
  const blades = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flashMesh = useRef<THREE.Mesh>(null);

  const sky = useMemo(() => mk(SKY_FRAG), []);
  const ground = useMemo(() => mk(GROUND_FRAG), []);
  const ridge = useMemo(() => mk(RIDGE_FRAG, { uBase: { value: 0.28 }, uAmp: { value: 0.3 }, uSeed: { value: 3 } }), []);
  const flashMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = vec4(position.xy*2.,0.,1.); }`,
    fragmentShader: FLASH_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uFlash: { value: 0 } },
  }), []);
  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uR: { value: 0 }, uA: { value: 0 } },
  }), []);
  const beamMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 } },
  }), []);
  const heroMat = useMemo(() => silhouetteMaterial('#cfdcff', '#000000', 2.8, 1.6), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.2), toneMapped: false }), []);
  const bladeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.11, 0.14), toneMapped: false }), []);

  // asteroid streak, a few embers, ash, fireflies
  const streak = useMemo(() => {
    const n = Math.floor(160 * Math.max(0.5, world.quality)); const r = rng(2);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uScale, uW, uAmt, uLen; uniform vec3 uHead, uDir; varying vec3 vCol; varying float vA;
      void main(){
        float u = aSeed.x;
        vec3 p = uHead - uDir*u*uLen + (vec3(aSeed.y,aSeed.z,aSeed.w)-.5)*(.1+u*1.2);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = mix(1.6,.3,u)*uScale/-mv.z*(1.+aSeed.w);
        vCol = mix(vec3(2.2,2.0,1.8), vec3(1.6,.6,.2), pow(u,.6)); vA = uW*uAmt*(1.-u)*(1.-u)*.9;
      }`, { uAmt: { value: 0 }, uLen: { value: 22 }, uHead: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);
  const embers = useMemo(() => {
    const n = Math.floor(240 * world.quality); const r = rng(6);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.05+aSeed.y*.07));
        vec3 p = vec3((aSeed.z-.5)*30., -2.3 + life*(5.+aSeed.w*4.), -2. - aSeed.y*26.);
        p.x += sin(life*8.+aSeed.w*30.)*(.5+aSeed.x)*.6 + life*1.5;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.035+aSeed.w*.07)*(1.-life*.6)*uScale/-mv.z;
        vCol = mix(vec3(1.9,.8,.3), vec3(1.2,.3,.1), life); vA = uW*uAmt*(1.-life)*smoothstep(0.,.05,life)*.8;
      }`, { uAmt: { value: 0 } });
    return { g, m };
  }, []);
  const ash = useMemo(() => {
    const n = Math.floor(170 * world.quality); const r = rng(16);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.015+aSeed.y*.02));
        vec3 p = vec3((aSeed.z-.5)*26. + sin(uTime*.2+aSeed.w*20.)*.8, 6. - life*9., 3. - aSeed.y*22.);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.02+aSeed.w*.04)*uScale/-mv.z;
        vCol = vec3(.7,.68,.66); vA = uW*uAmt*.5;
      }`, { uAmt: { value: 0 } });
    return { g, m };
  }, []);
  const flies = useMemo(() => {
    const n = Math.floor(48 * world.quality); const r = rng(26);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt; varying vec3 vCol; varying float vA;
      void main(){
        float ph = uTime*(.1+aSeed.y*.1) + aSeed.x*6.28;
        vec3 p = vec3(-3.5 + aSeed.z*10. + sin(ph*1.3)*.5, GROUND_Y_ + .4 + aSeed.w*3.2 + sin(ph*.9+aSeed.x*9.)*.35, -1. - aSeed.y*9.);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float tw = pow(.5+.5*sin(uTime*(.8+aSeed.y*1.5)+aSeed.x*40.), 3.);
        gl_PointSize = (.05+aSeed.w*.06)*uScale/-mv.z;
        vCol = vec3(1.4,1.5,1.2); vA = uW*uAmt*(.15+tw)*.8;
      }`.replace(/GROUND_Y_/g, GROUND_Y.toFixed(2)), { uAmt: { value: 0 } });
    return { g, m };
  }, []);
  const bladeData = useMemo(() => {
    const r = rng(44); const n = 22;
    return Array.from({ length: n }, () => ({ x: 0.2 + r() * 5.5, z: -0.2 - r() * 3, h: 0.35 + r() * 0.9, tilt: (r() - 0.5) * 0.4, ph: r() * 6 }));
  }, []);

  useEffect(() => () => {
    [sky, ground, ridge, flashMat, ringMat, beamMat, heroMat, eyeMat, bladeMat, streak.g, streak.m, embers.g, embers.m, ash.g, ash.m, flies.g, flies.m].forEach((d) => d.dispose());
  }, [sky, ground, ridge, flashMat, ringMat, beamMat, heroMat, eyeMat, bladeMat, streak, embers, ash, flies]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => IMPACT.clone().sub(START).normalize(), []);
  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight;
    const s = world.stationF - eventPos('kpg-mammal-radiation');
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);

    const approach = range(-0.7, -0.55, s);
    const flash = bell(s, -0.545, 0.012) * 0.7 + bell(s, -0.55, 0.05) * 0.06;
    const fire = smoothstep(-0.58, -0.48, s) * (1 - smoothstep(-0.15, 0.3, s));
    const ashA = smoothstep(-0.4, -0.1, s) * (1 - smoothstep(0.2, 0.45, s));
    const rec = smoothstep(-0.02, 0.4, s);

    for (const m of [sky, ground, ridge]) {
      const u = m.uniforms;
      u.uW.value = w; u.uTime.value = time; u.uFire.value = fire; u.uAsh.value = ashA; u.uRec.value = rec; u.uBlast.value = bell(s, -0.545, 0.05) * 1.1 + bell(s, -0.4, 0.2) * 0.2;
    }
    flashMat.uniforms.uFlash.value = flash * w;
    const rr = range(-0.55, -0.1, s);
    ringMat.uniforms.uR.value = rr; ringMat.uniforms.uA.value = (1 - rr) * (rr > 0 ? 1 : 0) * w * 0.5;
    ring.current!.visible = rr > 0 && rr < 1;
    flashMesh.current!.visible = flash > 0.002;
    beamMat.uniforms.uA.value = w * rec * 0.2;

    // asteroid: accelerates across the sky and ploughs into the horizon
    const ae = approach * approach;
    (streak.m.uniforms.uHead.value as THREE.Vector3).lerpVectors(START, IMPACT, ae);
    (streak.m.uniforms.uDir.value as THREE.Vector3).copy(dir);
    streak.m.uniforms.uAmt.value = approach > 0 && s < -0.55 ? Math.min(1, approach * 4) * 1.6 : 0;
    streak.m.uniforms.uLen.value = 8 + approach * 22;
    for (const m of [streak.m, embers.m, ash.m, flies.m]) { m.uniforms.uW.value = w; m.uniforms.uScale.value = k; if (m.uniforms.uTime) m.uniforms.uTime.value = time; }
    embers.m.uniforms.uAmt.value = fire * 1.1;
    ash.m.uniforms.uAmt.value = ashA;
    flies.m.uniforms.uAmt.value = smoothstep(0.05, 0.38, s);

    // the world shakes when the shockwave arrives
    const sh = bell(s, -0.54, 0.04) * 0.4 + bell(s, -0.42, 0.1) * 0.08;
    root.current!.position.set(Math.sin(time * 61) * sh * 0.4, Math.cos(time * 53) * sh * 0.3, 0);

    // the hero: rim colour warms with the fire, then cools to clean white under the returning light
    heroMat.uniforms.uW.value = w;
    heroMat.uniforms.uK.value = 1.0 + 1.2 * fire + 0.9 * rec + 1.5 * bell(s, -0.545, 0.04);
    const rim = heroMat.uniforms.uRim.value as THREE.Color;
    rim.setRGB(0.55 + 0.45 * fire - 0.05 * rec, 0.62 + 0.18 * fire + 0.3 * rec, 0.85 - 0.45 * fire + 0.15 * rec);
    eyeMat.color.setRGB(2.4 * w, 2.4 * w, 2.2 * w);
    const hg = hero.current!;
    // looks up at the streak, then settles and sniffs the air
    hg.position.set(1.5, GROUND_Y + 0.72 * 1.35 * 1.9, -1.4);
    hg.rotation.set(0, -0.25 + 0.1 * Math.sin(time * 0.3) * rec, 0.1 * (1 - smoothstep(-0.8, -0.5, s)) + 0.0);

    bladeMat.color.setRGB(0.1 * w, 0.115 * w, 0.14 * w).multiplyScalar(0.4 + rec * 1.2);
    const bm = blades.current!;
    for (let i = 0; i < bladeData.length; i++) {
      const d = bladeData[i];
      const gr = range(-0.05 + i * 0.006, 0.28 + i * 0.006, s);
      dummy.position.set(d.x, GROUND_Y + d.h * gr * 0.5, d.z);
      dummy.rotation.set(0, 0, d.tilt + Math.sin(time * 0.7 + d.ph) * 0.05);
      dummy.scale.set(0.035, Math.max(0.0001, d.h * gr), 0.035);
      dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix);
    }
    bm.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh position={[0, 4, -50]} scale={[190, 100, 1]} material={sky}><planeGeometry args={[1, 1]} /></mesh>
      <group ref={root}>
        <mesh position={[0, 12, -40]} scale={[150, 34, 1]} material={ridge}><planeGeometry args={[1, 1]} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -18]} material={ground}><planeGeometry args={[110, 70]} /></mesh>
        <mesh ref={ring} position={[IMPACT.x, IMPACT.y + 1.5, -29]} scale={[44, 22, 1]} material={ringMat}><planeGeometry args={[1, 1]} /></mesh>
        <mesh position={[1.4, GROUND_Y + 6, -3]} rotation={[0, 0, -0.18]} scale={[5.5, 15, 1]} material={beamMat}><planeGeometry args={[1, 1]} /></mesh>
        <points geometry={streak.g} material={streak.m} frustumCulled={false} />
        <points geometry={embers.g} material={embers.m} frustumCulled={false} />
        <points geometry={ash.g} material={ash.m} frustumCulled={false} />
        <points geometry={flies.g} material={flies.m} frustumCulled={false} />
        <instancedMesh ref={blades} args={[undefined, undefined, bladeData.length]} material={bladeMat} frustumCulled={false}>
          <coneGeometry args={[1, 1, 4]} />
        </instancedMesh>
        <group ref={hero} scale={1.9}><Critter mat={heroMat} shape={SHAPES.mammal} walk={0} alert={0.6} eyeMat={eyeMat} /></group>
      </group>
      <mesh ref={flashMesh} material={flashMat} renderOrder={999} frustumCulled={false}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}
