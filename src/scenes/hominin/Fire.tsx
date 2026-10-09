import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp, rng, smoothstep } from '../../world/util';
import { Bust, makeGlowMat, makeRim, type BustCtl } from './common';

const NB = 6, RAD = 3.1;
const tNow = () => (world.reduced ? 0 : world.time);

export default function Fire() {
  const scene = useScene();
  const q = world.quality;
  const busts = useMemo<BustCtl[]>(() => Array.from({ length: NB }, () => ({ int: 1, alpha: 1 })), []);
  const bg = useRef<Array<THREE.Group | null>>([]);
  const meat = useRef<THREE.Mesh>(null), light = useRef<THREE.Mesh>(null);
  const R = useMemo(() => {
    const r = rng(14);
    const mkPts = (n: number) => {
      const sd = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) sd[i] = r();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 4));
      return g;
    };
    const flameG = mkPts(Math.floor(900 * q)), emberG = mkPts(Math.floor(110 * q));
    const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
    const flameM = new THREE.ShaderMaterial({
      ...common, uniforms: { uT: { value: 0 }, uF: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `attribute vec4 aS; uniform float uT,uF,uAlpha; varying vec3 vC; varying float vA;
        void main(){ float k=fract(aS.x+uT*(.55+aS.y*.5)); float a=aS.z*6.2831; float rr=(1.-k*.85)*.7*aS.w*uF;
          float sway=sin(uT*3.+aS.x*20.)*.06*k;
          vec3 p=vec3(cos(a)*rr+sway,.15+k*3.0*uF*(.7+aS.y*.6),sin(a)*rr);
          vC=mix(vec3(3.2,3.0,2.6),mix(vec3(2.4,1.6,.9),vec3(.9,.45,.25),smoothstep(.35,1.,k)),smoothstep(0.,.4,k));
          vA=(1.-k)*smoothstep(0.,.08,k)*uF*uAlpha;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(1.-k*.7)*(360./-mv.z)*(.5+aS.y*.5)*uF; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vC*a*a*vA*.24,1.); }',
    });
    const emberM = new THREE.ShaderMaterial({
      ...common, uniforms: { uT: { value: 0 }, uF: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `attribute vec4 aS; uniform float uT,uF,uAlpha; varying float vA;
        void main(){ float k=fract(aS.x+uT*(.07+aS.y*.07)); float a=aS.z*6.2831;
          vec3 p=vec3(cos(a)*(.2+k*aS.w*1.4)+sin(uT+aS.x*30.)*.25*k,.3+k*(3.+aS.y*2.),sin(a)*(.2+k*aS.w*1.4)+cos(uT*.8+aS.y*30.)*.25*k);
          vA=(1.-k)*smoothstep(0.,.04,k)*(.5+.5*sin(uT*9.+aS.w*40.))*uF*uAlpha;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(70./-mv.z)*(.5+aS.y); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(3.,2.0,1.1)*a*a*vA,1.); }',
    });
    const floor = makeGlowMat('#ffc890', 1.5), halo = makeGlowMat('#ffd0a0', 2.2);
    const logM = makeRim('#ffa060', 0.08, 1.8), spit = makeRim('#c9a070', 0.2, 1.5);
    const logG = new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6);
    const meatM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, .2, .2), toneMapped: false });
    return { flameG, emberG, flameM, emberM, floor, halo, logM, spit, logG, meatM };
  }, [q]);
  useEffect(() => () => { R.flameG.dispose(); R.emberG.dispose(); R.flameM.dispose(); R.emberM.dispose(); R.floor.dispose(); R.halo.dispose(); R.logM.dispose(); R.spit.dispose(); R.logG.dispose(); R.meatM.dispose(); }, [R]);
  const cooked = useMemo(() => new THREE.Color(), []);
  const c0 = useMemo(() => new THREE.Color(1.3, 0.18, 0.15), []);
  const c1 = useMemo(() => new THREE.Color(0.35, 0.16, 0.07), []);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = tNow();
    const F = smoothstep(0.08, 0.3, t);
    const flick = 0.85 + 0.15 * Math.sin(tm * 11) * Math.sin(tm * 7.3);
    R.flameM.uniforms.uT.value = tm; R.flameM.uniforms.uF.value = F * flick; R.flameM.uniforms.uAlpha.value = w;
    R.emberM.uniforms.uT.value = tm; R.emberM.uniforms.uF.value = F; R.emberM.uniforms.uAlpha.value = w;
    R.floor.uniforms.uAlpha.value = w * F * flick * 0.4; R.halo.uniforms.uAlpha.value = w * F * 0.45;
    if (light.current) light.current.scale.setScalar(lerp(3, 10, smoothstep(0.1, 0.9, t)));
    for (let i = 0; i < NB; i++) {
      const appear = smoothstep(0.12 + i * 0.07, 0.24 + i * 0.07, t);
      const g = bg.current[i]; if (g) g.scale.setScalar(Math.max(0.0001, appear));
      busts[i].alpha = w * appear * (Math.sin((i / NB) * Math.PI * 2 + 0.2) > 0.55 ? 0 : 1); busts[i].int = (0.05 + 0.75 * F * flick) * (0.85 + 0.15 * Math.sin(tm * 3 + i));
    }
    if (meat.current) {
      const cook = smoothstep(0.35, 0.8, t);
      cooked.copy(c0).lerp(c1, cook); R.meatM.color.copy(cooked).multiplyScalar(0.6 + (1 - cook) * 0.5 + F * 0.3);
      meat.current.visible = false;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={R.floor} ref={light}><planeGeometry args={[1, 1]} /></mesh>
      <mesh position={[0, 0.7, 0.2]} material={R.halo}><planeGeometry args={[5.5, 5.5]} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={R.logG} material={R.logM} position={[Math.cos(i * 1.57 + 0.4) * 0.28, 0.14, Math.sin(i * 1.57 + 0.4) * 0.28]} rotation={[Math.PI / 2 - 0.2, 0, i * 1.57 + 0.4 + Math.PI / 2]} />
      ))}
      <points geometry={R.flameG} material={R.flameM} frustumCulled={false} />
      <points geometry={R.emberG} material={R.emberM} frustumCulled={false} />
      {busts.map((b, i) => {
        const a = (i / NB) * Math.PI * 2 + 0.2, sc = 0.8 + ((i * 37) % 10) / 45;
        return (
          <group key={i} ref={(g) => { bg.current[i] = g; }} position={[Math.cos(a) * RAD * (0.9 + (i % 3) * 0.1), 0, Math.sin(a) * RAD * (0.9 + (i % 3) * 0.1)]} rotation={[0, Math.PI - a, 0]}>
            <Bust ctl={b} scale={sc} color="#ffd2a8" headScale={i < 3 ? 0.92 : 1.05} />
          </group>
        );
      })}
    </group>
  );
}

export const fireCamera = (t: number) => ({ pos: [Math.sin(t * 2.2 - 1.1) * 1.4 - 0.4, 1.3, 4.6 - t * 0.4] as [number, number, number], look: [0.3, 1.15, 0] as [number, number, number], fov: 50 });
