import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, pointMaterial, pointScale } from './kit';

const bell = (s: number, c: number, w: number) => Math.exp(-((s - c) * (s - c)) / (2 * w * w));
const easeOutBack = (x: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const GROUND_Y = -2.4;

const PLANE_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vWp; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const PH_UNI = `uniform float uW, uTime, uFire, uAsh, uRec, uFlash, uBlast;`;

const SKY_FRAG = /* glsl */ `
${PH_UNI} varying vec2 vUv; ${GLSL_NOISE}
void main(){
  float y = vUv.y;
  vec3 night = mix(vec3(.03,.04,.09), vec3(.006,.01,.024), smoothstep(0.,.8,y));
  vec2 g = floor(vUv*vec2(260.,140.)); float r = h21(g);
  float star = step(.9968,r)*(.5+.5*sin(uTime*2.+r*60.))*smoothstep(.3,.75,y);
  night += vec3(.8,.9,1.2)*star*(1.-uFire)*(1.-uAsh);
  float cl = fbm(vec2(vUv.x*5.+uTime*.03, y*3.-uTime*.05));
  vec3 fire = vec3(1.5,.32,.05)*exp(-y*5.)*(.5+1.1*cl) + vec3(.3,.04,.015)*smoothstep(0.,.8,y)*(.4+cl);
  vec3 ash = vec3(.075,.055,.05)*(1.-y*.55)*(.6+.8*cl) + vec3(.25,.07,.02)*exp(-y*9.)*cl;
  vec3 col = mix(night, ash, uAsh);
  col = mix(col, fire, uFire);
  col += vec3(.015,.2,.22)*exp(-y*4.5)*uRec*(.7+.6*cl) + vec3(.1,.05,.2)*smoothstep(.2,.9,y)*uRec*.12*cl;
  vec2 imp = vec2(.55,.4);
  col += vec3(1.5,.6,.2)*exp(-length((vUv-imp)*vec2(1.8,1.))*7.)*uBlast;
  gl_FragColor = vec4(col*uW,1.);
}`;
const RIDGE_FRAG = /* glsl */ `
${PH_UNI} uniform float uBase, uAmp, uSeed, uDist; varying vec2 vUv; ${GLSL_NOISE}
void main(){
  float h = uBase + uAmp*fbm(vec2(vUv.x*7.+uSeed, uSeed*.3));
  if (vUv.y > h) discard;
  float edge = smoothstep(.05,0.,h-vUv.y);
  vec3 dark = mix(vec3(.004,.007,.016), vec3(.02,.035,.06), uDist);
  vec3 burnt = mix(vec3(.012,.008,.008), vec3(.04,.03,.03), uDist);
  vec3 col = mix(dark, burnt, uAsh);
  col += vec3(1.7,.5,.1)*edge*uFire*(.5+.8*fbm(vec2(vUv.x*40.,uTime*.8)));
  col += vec3(.02,.16,.1)*uRec*(.3+.7*(1.-vUv.y/h))*uDist + vec3(.05,.35,.3)*edge*uRec*.3;
  gl_FragColor = vec4(col*uW,1.);
}`;
const GROUND_FRAG = /* glsl */ `
${PH_UNI} varying vec2 vUv; varying vec3 vWp; ${GLSL_NOISE}
void main(){
  float n = fbm(vWp.xz*.45);
  float far = smoothstep(-4.,-34.,vWp.z);
  vec3 dark = vec3(.006,.012,.02) + vec3(.01,.02,.03)*n;
  vec3 burnt = vec3(.02,.014,.012)+vec3(.02,.012,.01)*n;
  vec3 col = mix(dark, burnt, uAsh);
  col += vec3(1.4,.36,.06)*uFire*far*(.2+.9*smoothstep(.45,.75,n));
  float moss = smoothstep(.42,.62,fbm(vWp.xz*.8+7.));
  col += vec3(.02,.2,.12)*moss*uRec*(.4+n);
  col = mix(col, vec3(.01,.03,.04)*uRec + col*.5, far*.4);
  gl_FragColor = vec4(col*uW,1.);
}`;
const FLASH_FRAG = /* glsl */ `uniform float uFlash; varying vec2 vUv; void main(){ float d = length(vUv-.5); gl_FragColor = vec4(vec3(2.2,1.7,1.1)*uFlash*(1.-.5*d), 1.); }`;
const RING_FRAG = /* glsl */ `
uniform float uR, uA; varying vec2 vUv;
void main(){ float r = length(vUv-.5)*2.; float a = smoothstep(.09,0.,abs(r-uR))*uA; gl_FragColor = vec4(vec3(1.8,1.1,.6)*a,1.); }`;

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
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const tails = useRef<THREE.InstancedMesh>(null);
  const ferns = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flashMesh = useRef<THREE.Mesh>(null);

  const sky = useMemo(() => mk(SKY_FRAG), []);
  const ground = useMemo(() => mk(GROUND_FRAG), []);
  const ridges = useMemo(() => [
    mk(RIDGE_FRAG, { uBase: { value: 0.3 }, uAmp: { value: 0.3 }, uSeed: { value: 3 }, uDist: { value: 1 } }),
    mk(RIDGE_FRAG, { uBase: { value: 0.26 }, uAmp: { value: 0.32 }, uSeed: { value: 11 }, uDist: { value: 0.5 } }),
  ], []);
  const flashMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = vec4(position.xy*2.,0.,1.); }`,
    fragmentShader: FLASH_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uFlash: { value: 0 } },
  }), []);
  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uR: { value: 0 }, uA: { value: 0 } },
  }), []);
  const bodyMat = useMemo(() => new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uW: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){ vec4 lp = vec4(position,1.); vec3 nn = normal; vC = vec3(1.);
        #ifdef USE_INSTANCING
          lp = instanceMatrix*lp; nn = mat3(instanceMatrix)*nn;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 mv = modelViewMatrix*lp; vN = normalize(normalMatrix*nn); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `uniform float uW; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){ float fr = pow(1.-abs(dot(normalize(vN),normalize(vV))), 2.); float up = .5+.5*normalize(vN).y;
        vec3 c = vC*(.12 + .25*up + 1.5*fr); gl_FragColor = vec4(c*uW,1.); }`,
  }), []);
  const fernMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  // asteroid streak, embers, ash, spores
  const streak = useMemo(() => {
    const n = Math.floor(220 * Math.max(0.5, world.quality)); const r = rng(2);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uScale, uW, uAmt, uLen; uniform vec3 uHead, uDir; varying vec3 vCol; varying float vA;
      void main(){
        float u = aSeed.x;
        vec3 p = uHead - uDir*u*uLen + (vec3(aSeed.y,aSeed.z,aSeed.w)-.5)*(.2+u*2.4);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = mix(1.9,.35,u)*uScale/-mv.z*(1.+aSeed.w);
        vCol = mix(vec3(2.,1.7,1.2), vec3(1.5,.35,.08), pow(u,.6)); vA = uW*uAmt*(1.-u)*(1.-u)*.9;
      }`, { uAmt: { value: 0 }, uLen: { value: 22 }, uHead: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);
  const embers = useMemo(() => {
    const n = Math.floor(2200 * world.quality); const r = rng(6);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt, uAsh; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.05+aSeed.y*.07));
        vec3 p = vec3((aSeed.z-.5)*44., -2.3 + life*(7.+aSeed.w*5.), -2. - aSeed.y*30.);
        p.x += sin(life*8.+aSeed.w*30.)*(.5+aSeed.x)*.8 + life*2.;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.06+aSeed.w*.12)*(1.-life*.6)*uScale/-mv.z;
        vCol = mix(vec3(1.9,.6,.1), vec3(1.2,.15,.05), life); vA = uW*uAmt*(1.-life)*smoothstep(0.,.05,life)*.9;
      }`, { uAmt: { value: 0 }, uAsh: { value: 0 } });
    return { g, m };
  }, []);
  const ash = useMemo(() => {
    const n = Math.floor(1300 * world.quality); const r = rng(16);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.015+aSeed.y*.02));
        vec3 p = vec3((aSeed.z-.5)*30. + sin(uTime*.2+aSeed.w*20.)*.8, 6. - life*9., 3. - aSeed.y*26.);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.025+aSeed.w*.05)*uScale/-mv.z;
        vCol = vec3(.55,.5,.48); vA = uW*uAmt*.55;
      }`, { uAmt: { value: 0 } });
    return { g, m };
  }, []);
  const spores = useMemo(() => {
    const n = Math.floor(700 * world.quality); const r = rng(26);
    const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmt; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.03+aSeed.y*.03));
        vec3 p = vec3((aSeed.z-.5)*34., -2.2 + life*5.*aSeed.w + sin(uTime*.5+aSeed.x*30.)*.1, -1. - aSeed.y*22.);
        p.x += sin(life*6.+aSeed.w*20.)*.6;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.035+aSeed.y*.05)*uScale/-mv.z;
        vCol = mix(vec3(.4,1.5,.8), vec3(1.5,1.2,.4), aSeed.w); vA = uW*uAmt*smoothstep(0.,.1,life)*smoothstep(1.,.6,life)*.8;
      }`, { uAmt: { value: 0 } });
    return { g, m };
  }, []);

  const critters = useMemo(() => {
    const n = Math.floor(120 * Math.max(0.45, world.quality)); const r = rng(34);
    const pal = [[0.2, 1.4, 1.5], [1.6, 0.4, 1.1], [1.7, 1.1, 0.3], [0.5, 1.6, 0.4], [0.7, 0.5, 1.8], [1.7, 0.5, 0.35], [0.4, 0.9, 1.8]];
    return Array.from({ length: n }, () => {
      const z = -1.5 - Math.pow(r(), 0.8) * 20;
      const x = (r() - 0.5) * (14 + (-z) * 0.9);
      const size = 0.12 + Math.pow(r(), 2.2) * 0.42;
      const c = pal[Math.floor(r() * pal.length)];
      const dist = Math.hypot(x * 0.7, z + 8);
      return { x, z, size, lenR: 1 + r() * 1.3, col: new THREE.Color(c[0], c[1], c[2]), delay: 0.12 + dist / 26 * 0.65 + r() * 0.08, hop: 2 + r() * 4, ph: r() * 6.28, fly: r() < 0.13, tail: 0.5 + r() * 1.6 };
    });
  }, []);
  const fernData = useMemo(() => {
    const r = rng(44); const n = Math.floor(240 * world.quality);
    return Array.from({ length: n }, () => ({
      x: (r() - 0.5) * 50, z: -1 - r() * 30, h: 0.5 + r() * 1.6, delay: 0.1 + r() * 0.9,
      col: new THREE.Color(0.1 + r() * 0.25, 0.7 + r() * 0.7, 0.4 + r() * 0.5).multiplyScalar(0.55),
    }));
  }, []);

  useEffect(() => {
    const b = bodies.current, h = heads.current, t = tails.current, f = ferns.current;
    if (!b || !h || !t || !f) return;
    critters.forEach((c, i) => { b.setColorAt(i, c.col); h.setColorAt(i, c.col); t.setColorAt(i, c.col); });
    fernData.forEach((c, i) => f.setColorAt(i, c.col));
    [b, h, t, f].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }, [critters, fernData]);

  useEffect(() => () => {
    [sky, ground, flashMat, ringMat, bodyMat, fernMat, streak.g, streak.m, embers.g, embers.m, ash.g, ash.m, spores.g, spores.m, ...ridges].forEach((d) => d.dispose());
  }, [sky, ground, flashMat, ringMat, bodyMat, fernMat, streak, embers, ash, spores, ridges]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => IMPACT.clone().sub(START).normalize(), []);
  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight;
    const s = world.stationF - eventPos('kpg-mammal-radiation');
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);

    const approach = range(-1.3, -0.56, s);
    const flash = bell(s, -0.53, 0.025) * 1.0 + bell(s, -0.5, 0.12) * 0.12;
    const fire = smoothstep(-0.58, -0.45, s) * (1 - smoothstep(-0.2, 0.2, s));
    const ashA = smoothstep(-0.4, -0.1, s) * (1 - smoothstep(0.35, 0.95, s));
    const rec = smoothstep(0.05, 0.9, s);
    const bloomT = range(0.12, 1.1, s);

    for (const m of [sky, ground, ...ridges]) {
      const u = m.uniforms;
      u.uW.value = w; u.uTime.value = time; u.uFire.value = fire; u.uAsh.value = ashA; u.uRec.value = rec; u.uBlast.value = bell(s, -0.52, 0.07) * 1.4 + bell(s, -0.4, 0.2) * 0.3;
    }
    flashMat.uniforms.uFlash.value = flash * w;
    const rr = range(-0.55, -0.1, s);
    ringMat.uniforms.uR.value = rr; ringMat.uniforms.uA.value = (1 - rr) * (rr > 0 ? 1 : 0) * w * 1.4;
    ring.current!.visible = rr > 0 && rr < 1;
    flashMesh.current!.visible = flash > 0.002;

    // asteroid: accelerates across the sky and ploughs into the horizon
    const ae = approach * approach;
    const head = streak.m.uniforms.uHead.value as THREE.Vector3;
    head.lerpVectors(START, IMPACT, ae);
    (streak.m.uniforms.uDir.value as THREE.Vector3).copy(dir);
    streak.m.uniforms.uAmt.value = approach > 0 && s < -0.5 ? Math.min(1, approach * 4) * 1.6 : 0;
    streak.m.uniforms.uLen.value = 8 + approach * 22;
    for (const m of [streak.m, embers.m, ash.m, spores.m]) { m.uniforms.uW.value = w; m.uniforms.uScale.value = k; if (m.uniforms.uTime) m.uniforms.uTime.value = time; }
    embers.m.uniforms.uAmt.value = fire * 1.2 + smoothstep(-0.2, 0.0, s) * (1 - smoothstep(0.0, 0.6, s)) * 0.15;
    ash.m.uniforms.uAmt.value = ashA;
    spores.m.uniforms.uAmt.value = smoothstep(0.3, 0.9, s) * 1.1;

    // the world shakes when the shockwave arrives
    const sh = bell(s, -0.5, 0.05) * 0.5 + bell(s, -0.38, 0.1) * 0.12;
    root.current!.position.set(Math.sin(time * 61) * sh * 0.4, Math.cos(time * 53) * sh * 0.3, 0);

    // mammals radiate outward as a bloom of luminous little forms
    const b = bodies.current!, h = heads.current!, t = tails.current!;
    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      const pop = bloomT > c.delay ? easeOutBack(range(c.delay, c.delay + 0.14, bloomT)) : 0;
      const sz = c.size * Math.max(0.0001, pop);
      const stride = Math.sin(time * 0.25 + c.ph);
      const dr = stride > 0 ? 1 : -1;
      const x = c.x + Math.sin(time * 0.3 + c.ph) * 0.8;
      const hop = Math.abs(Math.sin(time * c.hop + c.ph)) * 0.18 * c.size * (Math.abs(stride) > 0.1 ? 1 : 0);
      const y = GROUND_Y + sz * 0.5 + hop + (c.fly ? 1.4 + c.size * 2 + Math.sin(time * 1.2 + c.ph) * 0.4 : 0);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y, c.z); dummy.scale.set(sz * c.lenR, sz * 0.62, sz * 0.62); dummy.updateMatrix(); b.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + dr * sz * c.lenR * 0.85, y + sz * 0.12, c.z); dummy.scale.setScalar(sz * 0.42); dummy.updateMatrix(); h.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - dr * sz * c.lenR * 0.95, y + sz * 0.05, c.z); dummy.rotation.set(0, 0, dr > 0 ? Math.PI / 2 : -Math.PI / 2);
      dummy.scale.set(sz * 0.14, sz * c.tail, sz * 0.14); dummy.updateMatrix(); t.setMatrixAt(i, dummy.matrix);
    }
    b.instanceMatrix.needsUpdate = h.instanceMatrix.needsUpdate = t.instanceMatrix.needsUpdate = true;
    bodyMat.uniforms.uW.value = w;

    const f = ferns.current!;
    for (let i = 0; i < fernData.length; i++) {
      const d = fernData[i];
      const gr = easeOutBack(range(d.delay * 0.9 + 0.1, d.delay * 0.9 + 0.35, bloomT)) * (bloomT > d.delay * 0.9 + 0.1 ? 1 : 0);
      const hh = d.h * Math.max(0.0001, gr);
      dummy.rotation.set(0, 0, Math.sin(time * 0.7 + d.x) * 0.05);
      dummy.position.set(d.x, GROUND_Y + hh * 0.5, d.z); dummy.scale.set(0.16 * Math.max(0.2, gr), hh, 0.16 * Math.max(0.2, gr)); dummy.updateMatrix();
      f.setMatrixAt(i, dummy.matrix);
    }
    f.instanceMatrix.needsUpdate = true;
    fernMat.color.setScalar(w);
  });

  return (
    <group>
      <mesh position={[0, 4, -50]} scale={[190, 100, 1]} material={sky}><planeGeometry args={[1, 1]} /></mesh>
      <group ref={root}>
        <mesh position={[0, 16, -42]} scale={[150, 38, 1]} material={ridges[0]}><planeGeometry args={[1, 1]} /></mesh>
        <mesh position={[0, 11, -30]} scale={[110, 28, 1]} material={ridges[1]}><planeGeometry args={[1, 1]} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -18]} material={ground}><planeGeometry args={[110, 70]} /></mesh>
        <mesh ref={ring} position={[IMPACT.x, IMPACT.y + 1.5, -29]} scale={[44, 22, 1]} material={ringMat}><planeGeometry args={[1, 1]} /></mesh>
        <points geometry={streak.g} material={streak.m} frustumCulled={false} />
        <points geometry={embers.g} material={embers.m} frustumCulled={false} />
        <points geometry={ash.g} material={ash.m} frustumCulled={false} />
        <points geometry={spores.g} material={spores.m} frustumCulled={false} />
        <instancedMesh ref={ferns} args={[undefined, undefined, fernData.length]} material={fernMat} frustumCulled={false}>
          <coneGeometry args={[1, 1, 5]} />
        </instancedMesh>
        <instancedMesh ref={bodies} args={[undefined, undefined, critters.length]} material={bodyMat} frustumCulled={false}><sphereGeometry args={[1, 14, 10]} /></instancedMesh>
        <instancedMesh ref={heads} args={[undefined, undefined, critters.length]} material={bodyMat} frustumCulled={false}><sphereGeometry args={[1, 12, 10]} /></instancedMesh>
        <instancedMesh ref={tails} args={[undefined, undefined, critters.length]} material={bodyMat} frustumCulled={false}><coneGeometry args={[1, 1, 6]} /></instancedMesh>
      </group>
      <mesh ref={flashMesh} material={flashMat} renderOrder={999} frustumCulled={false}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}
