import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import { pointMaterial, pointScale, profileBody, silhouetteMaterial } from './kit';

// Three tiny bones, rim-lit like jewellery, a few thin wavefronts arriving from the left, a hairline of jaw they came from,
// and a single bright thread climbing the cochlea. No colour coding, no teeth, no drum skin.
const WAVE_VERT = /* glsl */ `varying vec3 vWp; void main(){ vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const WAVE_FRAG = /* glsl */ `
uniform float uW, uPh, uAmp; varying vec3 vWp;
void main(){
  vec2 src = vec2(-12.5, 0.2);
  float r = length(vWp.xy - src);
  float w = sin(r*3.4 - uPh);
  float line = pow(smoothstep(.55,1.,w), 3.);
  float fade = smoothstep(-10.5,-6.5,vWp.x) * smoothstep(-2.0,-3.6,vWp.x);
  float spread = smoothstep(3.4,0.,abs(vWp.y-.2));
  gl_FragColor = vec4(vec3(.8,.9,1.)*line*fade*spread*uAmp*uW, 1.);
}`;
const DRUM_FRAG = /* glsl */ `
uniform float uW, uAmp; varying vec2 vUv;
void main(){ float r = length(vUv-.5)*2.; float ring = smoothstep(.03,0.,abs(r-.96)); float fill = (1.-smoothstep(0.,1.,r))*.04;
  float a = (ring*(.14+.8*uAmp) + fill*(.4+uAmp)); gl_FragColor = vec4(vec3(.85,.92,1.)*a*uW,1.); }`;

function bone(keys: [number, number, number][], flat = 1) { return profileBody(keys, flat, 60, 16); }

export default function MiddleEar() {
  const scene = useScene();
  const waveMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uW: { value: 1 }, uPh: { value: 0 }, uAmp: { value: 1 } },
  }), []);
  const drumMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: DRUM_FRAG, side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 1 }, uAmp: { value: 0 } },
  }), []);
  const boneMat = useMemo(() => new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uW: { value: 1 }, uK: { value: 2 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
    // ivory bone: soft key from the upper left, a cool rim, a polished sheen and fine pitted relief
    fragmentShader: /* glsl */ `uniform float uW, uK; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float h3(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float h = vn(vP*55.)*.5 + vn(vP*140.)*.5;
        vec3 n = normalize(vN);
        n = normalize(n + vec3(dFdx(h), dFdy(h), 0.)*0.55);
        vec3 v = normalize(vV);
        vec3 L = normalize(vec3(-.55,.7,.55));
        float nl = dot(n,L);
        float diff = clamp((nl+.35)/1.35, 0., 1.);
        vec3 ivory = vec3(.93,.86,.74)*(.9+.2*h);
        float fr = pow(1.-max(dot(n,v),0.), 2.4);
        float spec = pow(max(dot(reflect(-L,n),v),0.), 36.);
        vec3 c = ivory*(.035+.95*diff*diff) + vec3(.55,.68,1.)*fr*(.35+.18*uK) + vec3(1.,.95,.88)*spec*.55;
        gl_FragColor = vec4(c*uW, 1.);
      }`,
  }), []);
  const jawMat = useMemo(() => silhouetteMaterial('#8da2c8', '#000000', 3.0, 0.7), []);

  const geo = useMemo(() => ({
    // malleus: slim handle that widens to a rounded head
    malleus: bone([[-0.05, 0.012, 0], [0.15, 0.03, 0], [0.7, 0.045, 0], [1.0, 0.06, 0], [1.14, 0.17, 0], [1.28, 0.16, 0], [1.38, 0.008, 0]]),
    // incus: a compact body with a long and a short process
    incusBody: bone([[-0.12, 0.01, 0], [0, 0.17, 0], [0.2, 0.19, 0], [0.34, 0.1, 0], [0.42, 0.008, 0]]),
    incusLong: bone([[0, 0.07, 0], [0.4, 0.04, 0], [0.82, 0.026, 0], [0.9, 0.05, 0], [0.95, 0.006, 0]]),
    incusShort: bone([[0, 0.065, 0], [0.3, 0.04, 0], [0.5, 0.008, 0]]),
    stapesBase: bone([[-0.28, 0.006, 0], [-0.2, 0.06, 0], [0.2, 0.06, 0], [0.28, 0.006, 0]], 0.5),
    stapesArc: new THREE.TorusGeometry(0.25, 0.026, 12, 40, Math.PI),
    jaw: bone([[-3.4, 0.01, 0], [-2.8, 0.12, 0.05], [-1.2, 0.16, 0], [0, 0.12, 0], [0.5, 0.02, 0]]),
  }), []);

  const spiral = useMemo(() => {
    const rr = rng(5);
    const n = Math.floor(620 * world.quality);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = rr(); seed[i * 4 + 2] = rr(); seed[i * 4 + 3] = rr(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmp, uPh; varying vec3 vCol; varying float vA;
      void main(){
        float s = aSeed.x;
        float ang = s*6.2832*2.5;
        float rad = mix(1.3, .2, s);
        vec3 p = vec3(3.4 + cos(ang)*rad, -.1 + sin(ang)*rad*.9, (aSeed.y-.5)*.1);
        p.xy += (vec2(aSeed.z,aSeed.w)-.5)*.035;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float travel = fract(uPh*.04);
        float lit = exp(-pow((s-travel)*8.,2.)) * uAmp;
        vCol = mix(vec3(.55,.62,.8), vec3(.4,.75,2.4), clamp(lit*1.4,0.,1.))*(1.+lit*1.4);
        vA = uW*(.2+lit*1.1);
        gl_PointSize = (.032+lit*.04)*uScale/-mv.z;
      }`, { uAmp: { value: 0 }, uPh: { value: 0 } });
    return { g, m };
  }, []);
  const nerve = useMemo(() => {
    const rr = rng(6);
    const n = Math.floor(150 * world.quality);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = rr(); seed[i * 4 + 2] = rr(); seed[i * 4 + 3] = rr(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmp, uPh; varying vec3 vCol; varying float vA;
      void main(){
        float s = aSeed.x;
        vec3 a = vec3(3.8,.9,0.), b = vec3(5.4,2.3,0.), c = vec3(7.0,2.2,-.4);
        vec3 p = mix(mix(a,b,s), mix(b,c,s), s) + (vec3(aSeed.y,aSeed.z,aSeed.w)-.5)*.03;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float lit = exp(-pow((fract(s - uPh*.16))*7.,2.)) + exp(-pow((fract(s - uPh*.16)-1.)*7.,2.));
        vCol = mix(vec3(.6,.65,.8), vec3(.4,.8,2.6), clamp(lit,0.,1.))*(1.+lit*1.5); vA = uW*uAmp*(.1+lit*.9);
        gl_PointSize = (.03+lit*.04)*uScale/-mv.z;
      }`, { uAmp: { value: 0 }, uPh: { value: 0 } });
    return { g, m };
  }, []);

  const mal = useRef<THREE.Group>(null);
  const inc = useRef<THREE.Group>(null);
  const sta = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const drum = useRef<THREE.Mesh>(null);

  useEffect(() => () => { [waveMat, drumMat, boneMat, jawMat, spiral.g, spiral.m, nerve.g, nerve.m, ...Object.values(geo)].forEach((d) => d.dispose()); }, [waveMat, drumMat, boneMat, jawMat, spiral, nerve, geo]);

  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat = near(eventPos('mammalian-middle-ear'), 0.9);
    const mig = smoothstep(0.08, 0.5, t);        // jaw bones migrate into the ear
    const amp = smoothstep(0.42, 0.7, t);         // then sound drives the chain
    const ph = time * 4 + t * 30;
    const vib = Math.sin(time * 22) * amp * (0.6 + 0.6 * beat);

    for (const m of [waveMat, drumMat, boneMat, jawMat, spiral.m, nerve.m]) if (m.uniforms.uW) m.uniforms.uW.value = w;
    waveMat.uniforms.uPh.value = ph;
    waveMat.uniforms.uAmp.value = 0.1 + 0.75 * amp;
    drumMat.uniforms.uAmp.value = amp * (1 + vib * 0.4);
    spiral.m.uniforms.uScale.value = nerve.m.uniforms.uScale.value = k;
    spiral.m.uniforms.uAmp.value = amp; nerve.m.uniforms.uAmp.value = amp;
    spiral.m.uniforms.uPh.value = nerve.m.uniforms.uPh.value = ph * 0.3;
    jawMat.uniforms.uW.value = w * (1 - smoothstep(0.35, 0.65, t) * 0.8);
    boneMat.uniforms.uK.value = 1.7 + amp * 0.9 + beat * 0.5;

    // bones: malleus and incus slide from the jaw hinge up into the skull
    const lift = 1 - mig;
    mal.current!.position.set(-1.75 + lift * -0.9, 0.35 - lift * 2.3, 0);
    mal.current!.rotation.z = -0.5 + lift * 0.9 + vib * 0.04;
    inc.current!.position.set(-0.25 + lift * -0.5, 0.35 - lift * 2.3, 0);
    inc.current!.rotation.z = lift * 0.6 + vib * 0.05;
    sta.current!.position.set(1.05 + vib * 0.08, -0.05, 0);
    sta.current!.rotation.z = vib * 0.06;
    jaw.current!.position.set(-0.9 - mig * 0.4, -2.0 - mig * 1.2, 0);
    drum.current!.position.set(-2.8 + vib * 0.05, 0.2, 0);
    drum.current!.scale.set(1, 1.1 + vib * 0.02, 1);
  });

  return (
    <group position={[0.4, 0.2, 0]} scale={1.65}>
      <mesh position={[-2, 0.2, -0.2]} material={waveMat}><planeGeometry args={[18, 9]} /></mesh>
      <mesh ref={drum} rotation={[0, Math.PI / 2 - 0.5, 0]} material={drumMat}><circleGeometry args={[0.95, 48]} /></mesh>
      <group ref={mal}><mesh geometry={geo.malleus} material={boneMat} rotation={[0, 0, -0.1]} /></group>
      <group ref={inc}>
        <mesh geometry={geo.incusBody} material={boneMat} />
        <mesh geometry={geo.incusLong} material={boneMat} position={[0.12, -0.05, 0]} rotation={[0, 0, -1.25]} />
        <mesh geometry={geo.incusShort} material={boneMat} position={[0.2, 0.08, 0]} rotation={[0, 0, 0.5]} />
      </group>
      <group ref={sta}>
        <mesh geometry={geo.stapesArc} material={boneMat} rotation={[0, 0, 0]} position={[-0.0, 0.02, 0]} />
        <mesh geometry={geo.stapesBase} material={boneMat} rotation={[0, 0, Math.PI / 2]} position={[0.05, -0.0, 0]} scale={[1, 1, 1]} />
      </group>
      <group ref={jaw}><mesh geometry={geo.jaw} material={jawMat} /></group>
      <points geometry={spiral.g} material={spiral.m} frustumCulled={false} />
      <points geometry={nerve.g} material={nerve.m} frustumCulled={false} />
    </group>
  );
}
