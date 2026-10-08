import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, TM, useBrain, latheX, makeBodyMat } from './shared';

const BOX: [number, number, number] = [20, 11, 8];

function hemiMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOp: { value: 1 }, uExp: { value: 0 }, uTime: { value: 0 }, uBoost: { value: 1 } },
    vertexShader: /* glsl */ `${NOISE}
      uniform float uExp,uTime; varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
      void main(){ vec3 p=position; float n=snoise(p*2.2+vec3(0.,0.,uTime*.05)); float n2=snoise(p*5.);
        float h=n*.5+n2*.2; vH=h; p*=1.+h*(.07+.08*uExp);
        vP=p; vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*normalize(p)); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uOp,uExp,uBoost; varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
        vec3 a=vec3(1.,.55,.18), b=vec3(1.,.25,.55); vec3 c=mix(a,b,smoothstep(-.3,.5,vH)*.6+uExp*.25);
        c=c*(.02+f*.38+smoothstep(.2,.6,vH)*.15)*uBoost; gl_FragColor=vec4(c*uOp,1.); }`,
  });
}

function neuronMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 1 }, uExp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uExp,uTime; varying float vA;
      void main(){ vec3 p=position*(.6+.5*uExp); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        float tw=.5+.5*sin(uTime*3.+aR.x*60.); vA=step(aR.z,.25+.75*uExp)*(.35+.65*tw);
        gl_PointSize=(.05+aR.w*.05)*(.8+tw*.6)*480./max(.3,-mv.z); }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d);
        gl_FragColor=vec4(vec3(1.,.85,.5)*a*a*vA*uOp*1.0,1.); }`,
  });
}

function odorMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 1 }, uFlow: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uFlow,uTime; varying float vA;
      void main(){ float k=fract(aR.x+uFlow); float x=mix(8.,3.3,k); float nar=(x-3.0)/5.;
        vec3 p=vec3(x,-0.55+(aR.y-.5)*2.4*nar+sin(k*9.+aR.w*20.)*.12,(aR.z-.5)*2.4*nar+cos(k*8.+aR.w*17.)*.12);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.07+aR.w*.06)*480./max(.3,-mv.z);
        vA=smoothstep(0.,.1,k)*(1.-smoothstep(.85,1.,k)); }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d);
        gl_FragColor=vec4(vec3(.5,1.,.7)*a*a*vA*uOp*1.4,1.); }`,
  });
}

/** fish forebrain: the pallium expands, fills with neurons and receives streams of smell */
export default function Pallium() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const hl = useRef<THREE.Mesh>(null);
  const hr = useRef<THREE.Mesh>(null);
  const { geo, mat } = useBrain(220, 44);
  const S = useMemo(() => {
    const r = rng(22);
    const hg = new THREE.IcosahedronGeometry(0.6, 6);
    const n = Math.floor(600 * world.quality);
    const mk = (side: number) => {
      const pos = new Float32Array(n * 3), rr = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        let x, y, z;
        do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
        pos[i * 3] = x * 0.55; pos[i * 3 + 1] = y * 0.5; pos[i * 3 + 2] = z * 0.5;
        for (let k = 0; k < 4; k++) rr[i * 4 + k] = r();
      }
      void side;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 4));
      return g;
    };
    const on = Math.floor(500 * world.quality);
    const og = new THREE.BufferGeometry();
    const orr = new Float32Array(on * 4);
    for (let i = 0; i < orr.length; i++) orr[i] = r();
    og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(on * 3), 3)); og.setAttribute('aR', new THREE.BufferAttribute(orr, 4));
    const head = latheX((x) => 1.05 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 0.2) / 3.3, 2))) * (x > 1.5 ? 0.9 : 1), -3.1, 3.5, 80, 44, 0.95);
    return { hg, nl: mk(1), nr: mk(-1), og, hm: hemiMat(), nm: neuronMat(), om: odorMat(), head, headM: makeBodyMat('#58b8ff', { rim: 0.8, base: 0.015 }) };
  }, []);
  useEffect(() => () => { S.hg.dispose(); S.nl.dispose(); S.nr.dispose(); S.og.dispose(); S.hm.dispose(); S.nm.dispose(); S.om.dispose(); S.head.dispose(); S.headM.dispose(); }, [S]);
  const p22 = eventPos('pallium-fish-forebrain');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, tm = TM(), n = near(p22, 0.8);
    const ex = smoothstep(0.1, 0.85, scene.t);
    const u = mat.uniforms;
    u.uSw.value = 1; u.uFold.value = 0.85; u.uHemi.value = 0.2; u.uWr.value = 0.3; u.uFore.value = 0.15; u.uTime.value = tm; u.uSig.value = scene.t * 5;
    u.uOpacity.value = w * 0.8; u.uRim.value = 1.0; u.uBase.value = 0.05; u.uBoost.value = 1;
    S.hm.uniforms.uOp.value = w; S.hm.uniforms.uExp.value = ex; S.hm.uniforms.uTime.value = tm; S.hm.uniforms.uBoost.value = 1 + n * 0.8;
    S.nm.uniforms.uOp.value = w; S.nm.uniforms.uExp.value = ex; S.nm.uniforms.uTime.value = tm;
    S.om.uniforms.uOp.value = w; S.om.uniforms.uFlow.value = scene.t * 5 + tm * 0.05; S.om.uniforms.uTime.value = tm;
    S.headM.uniforms.uOpacity.value = w * 0.8;
    const sc = 0.75 + ex * 0.85;
    if (hl.current && hr.current) { hl.current.scale.setScalar(sc); hr.current.scale.setScalar(sc); }
    if (grp.current) grp.current.rotation.y = -0.55 + scene.t * 0.7;
  });
  return (
    <group>
      <Backdrop top="#3a1a2a" bottom="#02030a" ray={0.25} />
      <Plankton count={500} box={BOX} color="#ffb3a0" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={grp} position={[0, 0.1, 0]} scale={1.2}>
        <mesh geometry={S.head} material={S.headM} position={[0, -0.3, 0]} scale={[1.4, 1.35, 1.35]} frustumCulled={false} />
        <group scale={1.4} position={[0, 0.3, 0]}>
          <mesh geometry={geo} material={mat} frustumCulled={false} />
          <group position={[2.15, -0.45, 0]}>
            <mesh ref={hl} geometry={S.hg} material={S.hm} position={[0, 0, 0.55]} />
            <mesh ref={hr} geometry={S.hg} material={S.hm} position={[0, 0, -0.55]} />
            <points geometry={S.nl} material={S.nm} position={[0, 0, 0.55]} frustumCulled={false} />
            <points geometry={S.nr} material={S.nm} position={[0, 0, -0.55]} frustumCulled={false} />
          </group>
          <points geometry={S.og} material={S.om} frustumCulled={false} position={[0, 0, 0]} />
        </group>
      </group>
    </group>
  );
}
