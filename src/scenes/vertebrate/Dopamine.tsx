import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range, rng, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM, latheX, makeBodyMat, makeTubeMat } from './shared';

const BOX: [number, number, number] = [20, 11, 8];
const VTA = new THREE.Vector3(-1.9, -0.9, 0);
const STR = new THREE.Vector3(1.6, 0.5, 0);

function burstMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPb: { value: 0 }, uOp: { value: 1 }, uAmp: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aEnd; attribute vec4 aR; uniform float uPb,uAmp; varying float vA;
      void main(){ float e=clamp((uPb-aR.x*.3)/.65,0.,1.); float k=1.-e;
        vec3 mid=mix(position,aEnd,.5)+vec3(0.,(aR.y-.5)*2.4+.6,(aR.z-.5)*1.5);
        vec3 p=k*k*position+2.*k*e*mid+e*e*aEnd; p+=vec3(sin(aR.w*40.+e*9.),cos(aR.w*33.+e*8.),0.)*.12*sin(3.14159*e);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=(0.08+aR.w*.1)*(0.6+0.8*sin(3.14159*e))*480./max(.3,-mv.z);
        vA=sin(3.14159*e)*uAmp; if(e<=0.||e>=1.) vA=0.; }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.72,.2)*a*a*vA*uOp*2.2,1.); }`,
  });
}

function cloudMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFlood: { value: 0 }, uOp: { value: 1 }, uTime: { value: 0 }, uStr: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uFlood,uTime,uStr; varying float vF; varying float vR;
      void main(){ vec3 p=position+vec3(sin(uTime*.5+aR.x*30.),cos(uTime*.4+aR.y*30.),0.)*.03;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=(0.11+aR.w*.08)*(1.+uFlood*.8+uStr*.4)*480./max(.3,-mv.z); vF=smoothstep(0.,1.,uFlood*1.3-aR.z*.5); vR=aR.w; }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vF; varying float vR;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d);
        vec3 c=mix(vec3(.3,.6,1.)*1.1,vec3(1.,.7,.18)*1.8,vF); gl_FragColor=vec4(c*a*a*uOp*(.5+vR*.6),1.); }`,
  });
}

/** a fish finds food; dopamine floods a reward circuit in golden bursts; pathways thicken with each trial */
export default function Dopamine() {
  const scene = useScene();
  const fishG = useRef<THREE.Group>(null);
  const pellet = useRef<THREE.Mesh>(null);
  const vtaM = useRef<THREE.Mesh>(null);
  const S = useMemo(() => {
    const r = rng(18);
    const fishGeo = latheX((x) => 0.5 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / 1.6, x > 0 ? 2.2 : 1.7)), 0.6), -1.6, 1.6, 50, 24, 0.8);
    const fishM = makeBodyMat('#7fe3ff', { rim: 1.5, base: 0.06, stripe: 0 });
    const pelletG = new THREE.SphereGeometry(0.14, 20, 14);
    const pelletM = makeBodyMat('#ffd27a', { rim: 3, base: 1.2 });
    const vtaG = new THREE.SphereGeometry(0.28, 28, 20);
    const vtaMat = makeBodyMat('#ffc04a', { rim: 3, base: 0.9 });
    const stG = (() => {
      const n = Math.floor(900 * world.quality);
      const pos = new Float32Array(n * 3), rr = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        let x, y, z;
        do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
        pos[i * 3] = STR.x + x * 1.7; pos[i * 3 + 1] = STR.y + y * 1.0; pos[i * 3 + 2] = z * 0.9;
        rr[i * 4] = r(); rr[i * 4 + 1] = r(); rr[i * 4 + 2] = (x + 1) / 2; rr[i * 4 + 3] = r();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aR', new THREE.BufferAttribute(rr, 4));
      return g;
    })();
    const bn = Math.floor(450 * world.quality);
    const bg = new THREE.BufferGeometry();
    const b0 = new Float32Array(bn * 3), b1 = new Float32Array(bn * 3), br = new Float32Array(bn * 4);
    for (let i = 0; i < bn; i++) {
      b0[i * 3] = VTA.x; b0[i * 3 + 1] = VTA.y; b0[i * 3 + 2] = 0;
      b1[i * 3] = STR.x + (r() * 2 - 1) * 1.6; b1[i * 3 + 1] = STR.y + (r() * 2 - 1) * 0.9; b1[i * 3 + 2] = (r() * 2 - 1) * 0.8;
      for (let k = 0; k < 4; k++) br[i * 4 + k] = r();
    }
    bg.setAttribute('position', new THREE.BufferAttribute(b0, 3));
    bg.setAttribute('aEnd', new THREE.BufferAttribute(b1, 3));
    bg.setAttribute('aR', new THREE.BufferAttribute(br, 4));
    const axM = makeTubeMat('#ffb43c', { base: 0.25, count: 1 });
    axM.uniforms.uR0.value = 0.03;
    const axons: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const end = new THREE.Vector3(STR.x + (r() * 2 - 1) * 1.4, STR.y + (r() * 2 - 1) * 0.8, (r() * 2 - 1) * 0.6);
      const mid = VTA.clone().lerp(end, 0.5).add(new THREE.Vector3((r() - 0.5) * 0.8, (r() - 0.2) * 1.4, (r() - 0.5) * 0.8));
      axons.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([VTA.clone(), mid, end]), 60, 0.03, 8, false));
    }
    return { fishGeo, fishM, pelletG, pelletM, vtaG, vtaMat, stG, bg, bM: burstMat(), cM: cloudMat(), axM, axons };
  }, []);
  useEffect(() => () => {
    S.fishGeo.dispose(); S.fishM.dispose(); S.pelletG.dispose(); S.pelletM.dispose(); S.vtaG.dispose(); S.vtaMat.dispose();
    S.stG.dispose(); S.bg.dispose(); S.bM.dispose(); S.cM.dispose(); S.axM.dispose(); S.axons.forEach((a) => a.dispose());
  }, [S]);

  const pos = eventPos('dopamine-reinforcement-signal');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight;
    const trial = scene.t * 3.4;
    const ph = trial - Math.floor(trial);
    const strength = smoothstep(0, 3.2, trial);
    const eat = smoothstep(0.32, 0.38, ph);
    const pb = range(0.36, 1.0, ph) * 1.05;
    const flood = Math.sin(Math.PI * range(0.36, 0.9, ph));
    const tm = TM();
    // fish
    const fx = -5.2 + 2.6 * smoothstep(0, 0.34, ph);
    const fishFade = smoothstep(0, 0.06, ph) * (1 - smoothstep(0.82, 0.98, ph)) * w;
    S.fishM.uniforms.uOpacity.value = fishFade;
    S.fishM.uniforms.uPhase.value = trial * 40 + tm * 3; S.fishM.uniforms.uAmp.value = 0.12;
    if (fishG.current) { fishG.current.position.set(fx + 0.4 * eat, 2.4 + Math.sin(trial * 4) * 0.08, 0); }
    S.pelletM.uniforms.uOpacity.value = w * (1 - eat) * smoothstep(0, 0.05, ph);
    if (pellet.current) pellet.current.scale.setScalar(1 + Math.sin(tm * 3) * 0.1 + (1 - eat) * 0.2);
    // circuit
    S.bM.uniforms.uPb.value = pb; S.bM.uniforms.uOp.value = w; S.bM.uniforms.uAmp.value = 0.6 + strength * 0.5 + near(pos, 0.8) * 0.4;
    S.cM.uniforms.uFlood.value = flood; S.cM.uniforms.uOp.value = w; S.cM.uniforms.uTime.value = tm; S.cM.uniforms.uStr.value = strength;
    S.axM.uniforms.uOpacity.value = w;
    S.axM.uniforms.uSig.value = pb * 1.1;
    S.axM.uniforms.uPulseAmt.value = (pb > 0 && pb < 1.05 ? 1 : 0);
    S.axM.uniforms.uRad.value = 1 + strength * 1.8;
    S.axM.uniforms.uBase.value = 0.15 + strength * 0.9 + flood * 0.5;
    S.vtaMat.uniforms.uOpacity.value = w;
    S.vtaMat.uniforms.uBoost.value = 0.7 + eat * (1 - range(0.4, 0.8, ph)) * 3 + near(pos, 0.8);
    if (vtaM.current) vtaM.current.scale.setScalar(1 + eat * (1 - range(0.4, 0.7, ph)) * 0.8);
  });
  return (
    <group>
      <Backdrop top="#241448" bottom="#02030a" ray={0.3} />
      <Plankton count={700} box={BOX} color="#8fb4ff" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={fishG} scale={0.9}><mesh geometry={S.fishGeo} material={S.fishM} frustumCulled={false} /></group>
      <mesh ref={pellet} geometry={S.pelletG} material={S.pelletM} position={[-2.5, 2.4, 0]} />
      <mesh ref={vtaM} geometry={S.vtaG} material={S.vtaMat} position={VTA} />
      <points geometry={S.stG} material={S.cM} frustumCulled={false} />
      <points geometry={S.bg} material={S.bM} frustumCulled={false} />
      {S.axons.map((g, i) => <mesh key={i} geometry={g} material={S.axM} frustumCulled={false} />)}
    </group>
  );
}
