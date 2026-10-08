import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import { pointMaterial, pointScale, rimMaterial } from './kit';

const WAVE_VERT = /* glsl */ `varying vec3 vWp; void main(){ vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const WAVE_FRAG = /* glsl */ `
uniform float uW, uPh, uAmp, uX; varying vec3 vWp;
void main(){
  vec2 src = vec2(-11.5, 0.2);
  float r = length(vWp.xy - src);
  float w = sin(r*5.2 - uPh);
  float line = smoothstep(.82,1.,w);
  // the wavefront is compressed and gets brighter as it reaches the eardrum, then stops there
  float reach = smoothstep(uX+.4, uX-.6, vWp.x);
  float fade = smoothstep(-9.5,-6.,vWp.x) * reach;
  float spread = smoothstep(4.5,0.,abs(vWp.y-.2));
  gl_FragColor = vec4(vec3(.35,.8,1.3)*line*fade*spread*uAmp*uW, 1.);
}`;
const DRUM_FRAG = /* glsl */ `
uniform float uW, uAmp, uTime; varying vec2 vUv;
void main(){ vec2 p = vUv-.5; float r = length(p)*2.; if (r>1.) discard;
  float ring = .5+.5*sin(r*26. - uTime*16.*uAmp);
  vec3 c = vec3(.55,.35,.22)*(.6+.4*ring*uAmp) + vec3(1.,.7,.4)*smoothstep(.55,1.,ring)*.5*uAmp + vec3(.25,.15,.1)*smoothstep(.7,1.,r);
  gl_FragColor = vec4(c*uW*(.7+.6*uAmp),1.); }`;

export default function MiddleEar() {
  const scene = useScene();
  const waveMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uW: { value: 1 }, uPh: { value: 0 }, uAmp: { value: 1 }, uX: { value: -2.6 } },
  }), []);
  const drumMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: DRUM_FRAG, side: THREE.DoubleSide, toneMapped: false, transparent: true,
    uniforms: { uW: { value: 1 }, uAmp: { value: 0 }, uTime: { value: 0 } },
  }), []);
  const boneMat = useMemo(() => rimMaterial('#8a7a62', '#ffe7c0', '#000', 99, 100, 2.0, 1.8), []);
  const jawMat = useMemo(() => rimMaterial('#2c2a30', '#8aa0c8', '#000', 99, 100, 2.0, 1.2), []);

  const spiral = useMemo(() => {
    const rr = rng(5);
    const n = Math.floor(1100 * world.quality);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = i / n;
      seed[i * 4] = s; seed[i * 4 + 1] = rr(); seed[i * 4 + 2] = rr(); seed[i * 4 + 3] = rr();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmp, uPh; varying vec3 vCol; varying float vA;
      void main(){
        float s = aSeed.x;
        float ang = s*6.2832*2.7;
        float rad = mix(1.25, .18, s);
        vec3 p = vec3(3.2 + cos(ang)*rad, -.2 + sin(ang)*rad*.9, (aSeed.y-.5)*.25 + s*.3);
        p.xy += (vec2(aSeed.z,aSeed.w)-.5)*.17*(1.-s*.4);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float travel = fract(uPh*.045);
        float lit = exp(-pow((s-travel)*7.,2.)) * uAmp;
        // tonotopy: base of cochlea (s=0) = high pitch (blue), apex = low pitch (red)
        vec3 hue = mix(vec3(.4,.7,1.4), vec3(1.4,.45,.3), s);
        vCol = hue*(1.+lit*2.);
        vA = uW*(.18+lit*1.1);
        gl_PointSize = (.06+lit*.05)*uScale/-mv.z;
      }`, { uAmp: { value: 0 }, uPh: { value: 0 } });
    return { g, m };
  }, []);
  const nerve = useMemo(() => {
    const rr = rng(6);
    const n = Math.floor(260 * world.quality);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = rr(); seed[i * 4 + 2] = rr(); seed[i * 4 + 3] = rr(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uAmp, uPh; varying vec3 vCol; varying float vA;
      void main(){
        float s = aSeed.x;
        vec3 a = vec3(3.6,.9,0.), b = vec3(5.2,2.4,0.), c = vec3(6.6,2.3,-.5);
        vec3 p = mix(mix(a,b,s), mix(b,c,s), s) + (vec3(aSeed.y,aSeed.z,aSeed.w)-.5)*.08;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float lit = exp(-pow((fract(s - uPh*.16)-.0)*6.,2.)) + exp(-pow((fract(s - uPh*.16)-1.)*6.,2.));
        vCol = vec3(1.,.9,.5)*(1.+lit*2.); vA = uW*uAmp*(.12+lit*.9);
        gl_PointSize = (.05+lit*.05)*uScale/-mv.z;
      }`, { uAmp: { value: 0 }, uPh: { value: 0 } });
    return { g, m };
  }, []);

  const mal = useRef<THREE.Group>(null);
  const inc = useRef<THREE.Group>(null);
  const sta = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const drum = useRef<THREE.Mesh>(null);

  useEffect(() => () => { [waveMat, drumMat, boneMat, jawMat, spiral.g, spiral.m, nerve.g, nerve.m].forEach((d) => d.dispose()); }, [waveMat, drumMat, boneMat, jawMat, spiral, nerve]);

  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat = near(eventPos('mammalian-middle-ear'), 0.9);
    const mig = smoothstep(0.08, 0.5, t);        // jaw bones migrate into the ear
    const amp = smoothstep(0.42, 0.7, t);         // then sound drives the chain
    const ph = time * 6 + t * 40;
    const vib = Math.sin(time * 22) * amp * (0.6 + 0.6 * beat);

    for (const m of [waveMat, drumMat, boneMat, jawMat, spiral.m, nerve.m]) if (m.uniforms.uW) m.uniforms.uW.value = w;
    waveMat.uniforms.uPh.value = ph;
    waveMat.uniforms.uAmp.value = 0.15 + 0.85 * amp;
    drumMat.uniforms.uAmp.value = amp; drumMat.uniforms.uTime.value = time;
    spiral.m.uniforms.uScale.value = nerve.m.uniforms.uScale.value = k;
    spiral.m.uniforms.uAmp.value = amp; nerve.m.uniforms.uAmp.value = amp;
    spiral.m.uniforms.uPh.value = nerve.m.uniforms.uPh.value = ph * 0.35;
    jawMat.uniforms.uW.value = w * (1 - smoothstep(0.35, 0.6, t) * 0.85);

    // bones: malleus and incus slide from the jaw hinge up into the skull
    const lift = (1 - mig);
    mal.current!.position.set(-2.0 + lift * -0.9, 0.2 - lift * 2.8, 0);
    mal.current!.rotation.z = -0.55 + lift * 1.1 + vib * 0.05;
    inc.current!.position.set(-0.75 + lift * -0.5, 0.55 - lift * 2.8, 0);
    inc.current!.rotation.z = lift * 0.6 + vib * 0.06;
    sta.current!.position.set(0.85 + vib * 0.1, -0.15, 0);
    sta.current!.rotation.z = vib * 0.08;
    mal.current!.scale.setScalar(1.5); inc.current!.scale.setScalar(1.5); sta.current!.scale.setScalar(1.5);
    jaw.current!.position.set(-0.2 - mig * 0.4, -2.3 - mig * 1.5, 0);
    drum.current!.position.set(-2.55 + vib * 0.07, 0.15, 0);
    drum.current!.scale.set(1, 1.5 + vib * 0.03, 1);
  });

  return (
    <group position={[0, 0.4, 0]}>
      <mesh position={[-2, 0.2, -0.2]} material={waveMat}><planeGeometry args={[18, 9]} /></mesh>
      <mesh ref={drum} rotation={[0, Math.PI / 2 - 0.5, 0]} material={drumMat}><circleGeometry args={[0.85, 40]} /></mesh>
      <group ref={mal}>
        <mesh position={[0.5, 0.15, 0]} rotation={[0, 0, Math.PI / 2 - 0.35]} material={boneMat}><capsuleGeometry args={[0.07, 1.0, 6, 10]} /></mesh>
        <mesh position={[0.98, 0.3, 0]} material={boneMat}><sphereGeometry args={[0.2, 14, 12]} /></mesh>
        <mesh position={[0.05, 0.02, 0]} material={boneMat}><sphereGeometry args={[0.1, 10, 10]} /></mesh>
      </group>
      <group ref={inc}>
        <mesh position={[0.05, -0.2, 0]} rotation={[0, 0, 0.4]} material={boneMat}><capsuleGeometry args={[0.1, 0.6, 6, 10]} /></mesh>
        <mesh position={[0.35, -0.65, 0]} rotation={[0, 0, Math.PI / 2 - 0.3]} material={boneMat}><capsuleGeometry args={[0.06, 0.6, 6, 10]} /></mesh>
        <mesh position={[-0.1, 0.12, 0]} material={boneMat}><sphereGeometry args={[0.2, 14, 12]} /></mesh>
      </group>
      <group ref={sta}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={boneMat}><torusGeometry args={[0.28, 0.05, 8, 20]} /></mesh>
        <mesh position={[0.5, 0, 0]} scale={[0.4, 1, 1]} material={boneMat}><sphereGeometry args={[0.22, 14, 12]} /></mesh>
        <mesh position={[-0.35, 0.2, 0]} rotation={[0, 0, 0.5]} material={boneMat}><capsuleGeometry args={[0.04, 0.5, 4, 8]} /></mesh>
      </group>
      <group ref={jaw}>
        <mesh position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2 + 0.05]} material={jawMat}><capsuleGeometry args={[0.28, 4.4, 6, 14]} /></mesh>
        {[-3.6, -3.0, -2.4, -1.8, -1.2].map((x, i) => (
          <mesh key={i} position={[x, 0.42, 0]} material={jawMat}><coneGeometry args={[0.1, 0.35, 8]} /></mesh>
        ))}
      </group>
      <points geometry={spiral.g} material={spiral.m} frustumCulled={false} />
      <points geometry={nerve.g} material={nerve.m} frustumCulled={false} />
    </group>
  );
}
