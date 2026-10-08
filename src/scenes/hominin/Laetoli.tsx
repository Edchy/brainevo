import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, newWalk, Walker } from './common';

const N = 20, STEP = 0.62;
const wx = (t: number) => lerp(-2.5, 11.5, smoothstep(0.08, 0.92, t));
const tNow = () => (world.reduced ? 0 : world.time);

export default function Laetoli() {
  const scene = useScene();
  const q = world.quality;
  const w1 = useMemo(newWalk, []), w2 = useMemo(newWalk, []);
  const g1 = useRef<THREE.Group>(null), g2 = useRef<THREE.Group>(null);
  const prints = useRef<THREE.InstancedMesh>(null), rings = useRef<THREE.InstancedMesh>(null);
  const dum = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  const R = useMemo(() => {
    const r = rng(5);
    const ground = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying vec3 vW; varying float vD;
        void main(){
          float n = n3(vec3(vW.x*2.,0.,vW.z*2.))*.5 + n3(vec3(vW.x*9.,1.,vW.z*9.))*.35 + n3(vec3(vW.x*40.,2.,vW.z*40.))*.25;
          vec3 c = mix(vec3(.05,.045,.05), vec3(.2,.17,.16), n);
          c += vec3(.5,.18,.05) * .05 * smoothstep(60., 20., vD) * smoothstep(-30., -60., vW.z) ;
          c = mix(c, vec3(.07,.05,.06), smoothstep(8., 45., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying vec3 vD;
        void main(){
          float h = max(vD.y,0.);
          vec3 c = mix(vec3(.28,.14,.1), vec3(.03,.025,.045), pow(h,.4));
          float cl = n3(vec3(vD.x*5., vD.y*14., vD.z*5.))*.6 + n3(vec3(vD.x*12., vD.y*30., vD.z*12.))*.4;
          c *= .55 + cl * .7;
          vec3 vd = normalize(vec3(.35,.12,-1.));
          c += vec3(1.,.4,.12) * pow(max(dot(vD,vd),0.), 40.) * .5;
          gl_FragColor = vec4(c * (1.-step(vD.y,0.)) * uAlpha * .8, 1.); }`,
    });
    const volGeo = new THREE.ConeGeometry(26, 14, 28, 1, true); volGeo.translate(0, 7, 0);
    const volMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'varying float vY; varying vec3 vN; void main(){ vY=position.y; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uAlpha; varying float vY; varying vec3 vN;
        void main(){ vec3 c = vec3(.025,.02,.03) + vec3(1.,.35,.08) * pow(smoothstep(8.,14.,vY),2.) * .9; gl_FragColor = vec4(c, uAlpha); }`,
    });
    const nA = Math.floor(2200 * q), ap = new Float32Array(nA * 3);
    for (let i = 0; i < nA; i++) { ap[i * 3] = -8 + r() * 28; ap[i * 3 + 1] = r() * 9; ap[i * 3 + 2] = -14 + r() * 20; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3));
    const ashMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `uniform float uTime; varying float vA; void main(){
        vec3 p = position; p.y = mod(p.y - uTime * .35, 9.); p.x += sin(uTime*.4 + p.y*.8 + position.z)*.5;
        vA = smoothstep(0., 1., p.y) * (1. - smoothstep(7., 9., p.y));
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 70./-mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(.8,.72,.7)*a*a*vA*.35*uAlpha,1.); }`,
    });
    // embers rising from the crater
    const nE = Math.floor(260 * q), ep = new Float32Array(nE * 4);
    for (let i = 0; i < nE; i++) { ep[i * 4] = (r() - .5) * 8; ep[i * 4 + 1] = r(); ep[i * 4 + 2] = (r() - .5) * 8; ep[i * 4 + 3] = r(); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nE * 3), 3));
    eg.setAttribute('aS', new THREE.BufferAttribute(ep, 4));
    const emberMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `attribute vec4 aS; uniform float uTime; varying float vA; void main(){
        float k = fract(aS.y + uTime * (.03 + aS.w * .03));
        vec3 p = vec3(aS.x * (.4 + k * 2.), k * 38., aS.z * (.4 + k * 2.) ) + vec3(0., 12., 0.);
        vA = (1. - k) * smoothstep(0., .05, k);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 120./-mv.z * (.5 + aS.w); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.,.7,.2)*a*a*vA*uAlpha,1.); }`,
    });
    const glow = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float uAlpha; varying vec2 vUv; void main(){ float d=length(vUv-.5)*2.; float a=pow(max(0.,1.-d),2.5); gl_FragColor=vec4(vec3(1.,.4,.1)*a*1.4*uAlpha,1.); }',
    });
    const footGeo = new THREE.CircleGeometry(1, 24); footGeo.rotateX(-Math.PI / 2);
    const ringGeo = new THREE.RingGeometry(0.8, 1, 32); ringGeo.rotateX(-Math.PI / 2);
    const footMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const ringMat = footMat.clone();
    return { ground, sky, volGeo, volMat, ag, ashMat, eg, emberMat, glow, footGeo, ringGeo, footMat, ringMat };
  }, [q]);
  useEffect(() => () => Object.values(R).forEach((o) => (o as { dispose?: () => void }).dispose?.()), [R]);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tt = tNow();
    const x = wx(t);
    for (const m of [R.ground, R.sky, R.volMat, R.ashMat, R.emberMat, R.glow]) m.uniforms.uAlpha.value = w;
    R.ashMat.uniforms.uTime.value = tt; R.emberMat.uniforms.uTime.value = tt;
    const lucy = near(eventPos('australopithecus-lucy'), 0.6);
    for (const [wk, g, off, s] of [[w1, g1.current, 0, 1], [w2, g2.current, 1.7, 0.85]] as const) {
      const px = x - off;
      if (g) g.position.x = px;
      wk.phase = px * Math.PI / STEP; wk.u = 1; wk.alpha = w * (px > -3.2 ? 1 : 0); wk.stride = 0.9; wk.hl = lucy * 0.8 * s; wk.int = 1 + lucy * 0.5;
    }
    const P = prints.current, Rg = rings.current;
    if (!P || !Rg) return;
    for (let i = 0; i < N; i++) {
      const px = i * STEP, side = i % 2 ? -1 : 1;
      const k = smoothstep(px - 0.15, px + 0.55, x - 0.1); // pressed progress
      const pulse = Math.max(0, 1 - Math.abs(k - 0.35) * 3.2) * (k > 0.001 ? 1 : 0);
      dum.position.set(px + 0.1, 0.012, side * 0.11); dum.rotation.set(0, side * 0.12, 0);
      dum.scale.set(0.17 * k, 1, 0.065 * k); dum.updateMatrix(); P.setMatrixAt(i, dum.matrix);
      const settle = 0.55 + pulse * 1.8;
      col.setRGB(1.0 * settle, 0.55 * settle, 0.2 * settle).multiplyScalar(k > 0.01 ? w : 0); P.setColorAt(i, col);
      const rs = 0.12 + (1 - Math.abs(k - 0.2)) * 0 + smoothstep(0.1, 0.8, k) * 0.7;
      dum.position.set(px + 0.1, 0.014, side * 0.11); dum.rotation.set(0, 0, 0); dum.scale.set(rs * 1.5, 1, rs * 0.7); dum.updateMatrix(); Rg.setMatrixAt(i, dum.matrix);
      col.setRGB(1.4, 0.7, 0.3).multiplyScalar(pulse * (1 - smoothstep(0.35, 0.85, k)) * w * 0.9); Rg.setColorAt(i, col);
    }
    P.instanceMatrix.needsUpdate = true; Rg.instanceMatrix.needsUpdate = true;
    if (P.instanceColor) P.instanceColor.needsUpdate = true; if (Rg.instanceColor) Rg.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <mesh material={R.sky} renderOrder={-10}><sphereGeometry args={[300, 32, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.ground} position={[5, 0, -50]}><planeGeometry args={[300, 200]} /></mesh>
      <mesh geometry={R.volGeo} material={R.volMat} position={[24, -0.5, -75]} />
      <mesh material={R.glow} position={[24, 13.5, -74]}><planeGeometry args={[34, 20]} /></mesh>
      <points geometry={R.eg} material={R.emberMat} position={[24, 0, -75]} frustumCulled={false} />
      <points geometry={R.ag} material={R.ashMat} frustumCulled={false} />
      <instancedMesh ref={prints} args={[R.footGeo, R.footMat, N]} frustumCulled={false} />
      <instancedMesh ref={rings} args={[R.ringGeo, R.ringMat, N]} frustumCulled={false} />
      <group ref={g1}><Walker ctl={w1} color="#ffb98a" scale={1.1} /></group>
      <group ref={g2} position={[0, 0, -0.55]}><Walker ctl={w2} color="#ff9f6e" scale={0.92} /></group>
    </group>
  );
}

export const laetoliCamera = (t: number) => {
  const x = wx(t);
  return { pos: [x - 1.8, 0.75, 3.3] as [number, number, number], look: [x + 1.6, 0.35, 0] as [number, number, number], fov: 54 };
};
