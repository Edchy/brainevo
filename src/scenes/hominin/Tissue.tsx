import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp, rng, smoothstep } from '../../world/util';
import { Brain, newBrain, Shell } from './common';

export default function Tissue() {
  const scene = useScene();
  const q = world.quality;
  const brain = useMemo(newBrain, []);
  const shell = useMemo(() => ({ alpha: 0.3 }), []);
  const gutG = useMemo(() => ({ g: null as THREE.Group | null }), []);
  const brG = useMemo(() => ({ g: null as THREE.Group | null }), []);
  const R = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 44; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.62) * 0.75 + Math.sin(i * 0.17) * 0.2, 1.15 - i * 0.052 + Math.sin(i * 1.7) * 0.07, Math.cos(i * 0.62) * 0.55));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 360, 0.1, 12);
    const gutMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 }, uGlow: { value: 1 } },
      vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vU;
        void main(){ vU=uv.x; float wv=sin(uv.x*90.-uTime*4.); vec3 p=position+normal*wv*.012; vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha,uTime,uGlow; varying vec3 vN; varying vec3 vV; varying float vU;
        void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.7); float pulse=.5+.5*sin(vU*60.-uTime*4.);
          vec3 c=vec3(1.,.5,.18)*(.1+f*1.2+pulse*.35)*uGlow; gl_FragColor=vec4(c*uAlpha,1.); }`,
    });
    const n = Math.floor(160 * q), r = rng(8);
    const sd = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sd[i * 4] = r(); sd[i * 4 + 1] = r(); sd[i * 4 + 2] = r(); sd[i * 4 + 3] = r(); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(sd, 4));
    const pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 }, uShare: { value: 0.3 }, uBs: { value: 1 }, uGs: { value: 1 } },
      vertexShader: `attribute vec4 aS; uniform float uTime,uShare,uBs,uGs; varying vec3 vC; varying float vA;
        void main(){
          bool toB = aS.x < uShare;
          float a = aS.y*6.2831 + uTime*(.3+aS.z*.5)*(toB?1.:-1.);
          float rr = (toB ? 1.3*uBs : 1.1*uGs) * (.75 + aS.w*.55);
          float el = (aS.z-.5)*2.;
          vec3 c = toB ? vec3(1.2,.1,0.) : vec3(-3.0,0.,0.);
          vec3 p = c + vec3(cos(a)*rr*.9, el*rr*.8, sin(a)*rr);
          vC = toB ? vec3(1.,1.,1.2) : vec3(1.3,1.,.8);
          vA = .5 + .5*aS.w;
          vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 20./-mv.z*(.6+aS.w); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha; varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vC*a*a*vA*.8*uAlpha,1.); }`,
    });
    const ring = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, .9), transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { geo, gutMat, pg, pm, ring };
  }, [q]);
  useEffect(() => () => { R.geo.dispose(); R.gutMat.dispose(); R.pg.dispose(); R.pm.dispose(); R.ring.dispose(); }, [R]);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    const k = smoothstep(0.1, 0.9, t);
    const bs = lerp(0.8, 1.35, k), gs = lerp(1.0, 0.45, k);
    brain.s = bs; brain.alpha = w; brain.glow = 0.3 + k * 0.7; brain.motor = 0.2 + k * 0.4; brain.par = 0.2 + k * 0.4;
    shell.alpha = w * 0.25;
    if (gutG.g) { gutG.g.scale.setScalar(gs); gutG.g.rotation.y = tm * 0.25 + t * 2; }
    if (brG.g) brG.g.rotation.y = -0.5 + Math.sin(t * 3) * 0.15;
    R.gutMat.uniforms.uAlpha.value = w; R.gutMat.uniforms.uTime.value = tm + t * 8; R.gutMat.uniforms.uGlow.value = (0.3 + (1 - k) * 0.5) * 0.6;
    const u = R.pm.uniforms; u.uAlpha.value = w; u.uTime.value = tm + t * 6; u.uShare.value = lerp(0.2, 0.8, k); u.uBs.value = bs; u.uGs.value = gs;
    R.ring.opacity = 0;
  });

  return (
    <group>
      <group position={[-3.0, 0, 0]}><group ref={(g) => { gutG.g = g; }}><mesh geometry={R.geo} material={R.gutMat} frustumCulled={false} /></group></group>
      <group position={[1.2, 0.1, 0]}><group ref={(g) => { brG.g = g; }}><Brain ctl={brain} /><Shell ctl={shell} scale={[1.45, 1.1, 1.0]} /></group></group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={R.ring} position={[0, 0, -1]}><torusGeometry args={[4.9, 0.012, 6, 120]} /></mesh>
      <points geometry={R.pg} material={R.pm} frustumCulled={false} />
    </group>
  );
}

export const tissueCamera = (t: number) => ({ pos: [Math.sin(t * 2) * 0.4, 0.3, 7.0] as [number, number, number], look: [-0.3, 0.1, 0] as [number, number, number], fov: 52 });
