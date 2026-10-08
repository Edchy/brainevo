import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const PLACE = /* glsl */ `
uniform float uTime,uM,uW,uPx,uSig,uCord,uRad,uHead,uFlash;
vec3 place(float u,float v){
  float L=mix(2.3,5.3,uM), Wd=mix(2.3,1.05,uM);
  float ex=mix(.5,.62,uM);
  float prof=pow(max(0.,1.-u*u),ex)*(1.-.28*uM*smoothstep(-.1,1.,u));
  float wig=uM*.38*sin(u*3.4-uTime*2.4)*(.35+.65*(1.-u)*.5);
  float y=v*Wd*prof+wig*smoothstep(1.,-1.,u)*1.1+uM*.15*sin(uTime*1.1)*u;
  return vec3(u*L,y,0.);
}
float sigBump(float u,float c,float w){ return exp(-pow((u-c)/w,2.)); }
`;

export default function Worm() {
  const scene = useScene();
  const geo = useMemo(() => {
    const r = rng(77);
    // body
    const body = new THREE.PlaneGeometry(2, 2, 90, 16);
    // radial net
    const rad: number[] = [];
    const SP = 14, RG = 5;
    const mapUV = (rr: number, th: number): [number, number] => {
      const u = rr * Math.cos(th); const v = Math.max(-1, Math.min(1, rr * Math.sin(th) / Math.sqrt(Math.max(0.02, 1 - u * u))));
      return [u, v];
    };
    for (let s = 0; s < SP; s++) {
      const th = (s / SP) * Math.PI * 2;
      for (let k = 0; k < RG; k++) { rad.push(...mapUV(0.1 + 0.9 * k / RG, th), 0, ...mapUV(0.1 + 0.9 * (k + 1) / RG, th), 0); }
    }
    for (let k = 1; k <= RG; k++) for (let s = 0; s < SP * 2; s++) {
      const rr = 0.1 + 0.9 * k / RG; rad.push(...mapUV(rr, (s / (SP * 2)) * 6.2832), 0, ...mapUV(rr, ((s + 1) / (SP * 2)) * 6.2832), 0);
    }
    const radG = new THREE.BufferGeometry(); radG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rad), 3));
    const radN: number[] = [];
    for (let k = 0; k <= RG; k++) for (let s = 0; s < SP; s++) radN.push(...mapUV(0.1 + 0.9 * k / RG, (s / SP) * 6.2832), 0);
    const radNG = new THREE.BufferGeometry(); radNG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(radN), 3));
    // cords + rungs
    const cord: number[] = [], kinds: number[] = [];
    const CV = 0.42;
    const NSEG = 60;
    for (const sgn of [-1, 1]) for (let i = 0; i < NSEG; i++) {
      const u0 = -0.92 + 1.8 * i / NSEG, u1 = -0.92 + 1.8 * (i + 1) / NSEG;
      const c = (u: number) => CV * sgn * (1 - 0.55 * smoothstep(0.55, 0.95, u));
      cord.push(u0, c(u0), 0, u1, c(u1), 0); kinds.push(0, 0);
    }
    const NR = 16; const ganglia: number[] = [];
    for (let i = 0; i < NR; i++) {
      const u = -0.85 + 1.5 * i / (NR - 1) ;
      const c = CV * (1 - 0.55 * smoothstep(0.55, 0.95, u));
      cord.push(u, -c, 0, u, c, 0); kinds.push(1, 1);
      ganglia.push(u, -c, 0, u, c, 0);
    }
    // head ganglion: dense neuron cloud + radiating nerves
    const head: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = r() * 6.28, rr = Math.sqrt(r());
      head.push(0.82 + Math.cos(a) * rr * 0.16, Math.sin(a) * rr * 0.34, 0);
    }
    for (let i = 0; i < 26; i++) { // sensory nerves fanning forward to the head tip
      const v = (i / 25 - 0.5) * 1.3; cord.push(0.8, v * 0.3, 0, 0.97, v * 0.9, 0); kinds.push(2, 2);
    }
    const cordG = new THREE.BufferGeometry();
    cordG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cord), 3));
    cordG.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(kinds), 1));
    const gangG = new THREE.BufferGeometry(); gangG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ganglia), 3));
    const headG = new THREE.BufferGeometry(); headG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(head), 3));
    const eyeG = new THREE.BufferGeometry(); eyeG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.93, -0.5, 0, 0.93, 0.5, 0]), 3));
    return { body, radG, radNG, cordG, gangG, headG, eyeG };
  }, []);

  const U = useMemo(() => ({
    uTime: { value: 0 }, uM: { value: 0 }, uW: { value: 0 }, uPx: { value: 500 }, uSig: { value: 0 },
    uCord: { value: 0 }, uRad: { value: 1 }, uHead: { value: 0 }, uFlash: { value: 0 },
  }), []);
  const mats = useMemo(() => {
    const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U };
    const body = new THREE.ShaderMaterial({
      ...base, side: THREE.DoubleSide,
      vertexShader: `${PLACE} varying vec2 vUV; varying float vEdge; void main(){ vUV=position.xy; vec3 p=place(position.x,position.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `${PLACE} ${NOISE} varying vec2 vUV;
        void main(){ float u=vUV.x,v=vUV.y; float prof=1.; float r=length(vec2(u,v));
          float edge=smoothstep(.55,1.,abs(v)); float tip=smoothstep(.8,1.,abs(u));
          float n=fbm(vec3(u*2.5,v*2.5,uTime*.1));
          float gut=smoothstep(.3,0.,abs(v))*smoothstep(.95,.3,abs(u));
          vec3 c=vec3(.15,.55,.7)*(.09+.22*n)+vec3(.3,.9,1.)*edge*.55+vec3(.9,.55,.35)*gut*.16*(.5+n)+vec3(1.,.8,.5)*tip*.12;
          gl_FragColor=vec4(c*uW,1.); }`,
    });
    const line = (frag: string, vert: string) => new THREE.ShaderMaterial({ ...base, vertexShader: `${PLACE} ${vert}`, fragmentShader: frag });
    const rad = line('varying float vS; uniform float uW; void main(){ gl_FragColor=vec4((vec3(.3,.6,1.)*.55+vec3(1.4,1.,2.)*vS)*uW,1.); }',
      `varying float vS; void main(){ vec3 p=place(position.x,position.y); float d=length(position.xy); vS=exp(-pow((d-fract(uSig*.8)*1.3),2.)*40.)*uRad*step(.001,uRad); vS*=1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`);
    rad.fragmentShader = 'varying float vS; uniform float uW,uRad; void main(){ gl_FragColor=vec4((vec3(.3,.6,1.)*.5+vec3(1.4,1.,2.)*vS)*uW*uRad,1.); }';
    const cord = line('varying float vS; varying float vK; uniform float uW,uCord,uHead; void main(){ float a=mix(1.,uHead,step(1.5,vK)); gl_FragColor=vec4((vec3(.3,.8,1.)*(vK<.5?1.7:.9)+vec3(1.5,1.,2.)*vS)*uW*uCord*a,1.); }',
      `attribute float aK; varying float vS; varying float vK; void main(){ vec3 p=place(position.x,position.y); vK=aK;
        float c=-1.2+uSig*3.2; vS=sigBump(position.x,c,.12)*(aK<1.5?1.:0.)+ (aK>1.5?1.:0.)*sigBump(c,1.6,.9)*uHead*2.; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`);
    const pts = (col: string, size: number, dyn: string) => new THREE.ShaderMaterial({
      ...base, vertexShader: `${PLACE} varying vec3 vC; varying float vA; void main(){ vec3 p=place(position.x,position.y); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; ${dyn}
        gl_PointSize=max(1.,(${size.toFixed(3)}*sz)*uPx/-mv.z); vC=${col}; }`, fragmentShader: POINT_FRAG,
    });
    const radN = pts('vec3(.5,.8,1.5)', 0.08, 'float sz=1.; vA=uW*uRad;');
    const gang = pts('vec3(.8,1.4,2.)', 0.16, 'float sz=1.+1.2*sigBump(position.x,-1.2+uSig*3.2,.15); vA=uW*uCord*(.6+.7*(sz-1.));');
    const head = pts('mix(vec3(.6,1.,1.8),vec3(2.,1.5,2.4),uFlash)', 0.1, 'float sz=1.+uFlash*.8+.4*sin(uTime*4.+position.x*60.); vA=uW*uHead*(.5+.5*uFlash);');
    const eye = pts('vec3(2.2,2.,1.4)', 0.2, 'float sz=1.; vA=uW*smoothstep(.55,1.,uHead)*(.7+.3*uFlash);');
    return { body, rad, cord, radN, gang, head, eye };
  }, [U]);

  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uS: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uW,uS,uTime; varying vec2 vP; ${NOISE}
      void main(){ vec2 q=vP+vec2(uS,0.); float n=fbm(vec3(q*.7,0.)); float g=pow(vnoise(vec3(q*3.,uTime*.05)),3.);
        float rip=pow(1.-abs(vnoise(vec3(q*1.1,uTime*.2))*2.-1.),7.);
        float fade=exp(-length(vP)*.06);
        gl_FragColor=vec4((vec3(.05,.13,.12)*n+vec3(.2,.35,.25)*g*.35+vec3(.2,.5,.55)*rip*.12)*fade*uW,1.); }`,
  }), []);
  useDispose(geo.body, geo.radG, geo.radNG, geo.cordG, geo.gangG, geo.headG, geo.eyeG, ...Object.values(mats), floorMat);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const ceph = near(eventPos('cephalization'), 0.5), bil = near(eventPos('bilateral-symmetry-ganglia'), 0.5);
    U.uTime.value = time; U.uPx.value = pxScale(state); U.uW.value = w;
    U.uM.value = smoothstep(0.04, 0.4, t);
    U.uRad.value = 1 - smoothstep(0.18, 0.4, t);
    U.uCord.value = smoothstep(0.22, 0.45, t);
    U.uHead.value = smoothstep(0.45, 0.85, t);
    U.uFlash.value = Math.max(ceph, bil * 0.4);
    U.uSig.value = (t * 9) % 1;
    floorMat.uniforms.uW.value = w; floorMat.uniforms.uS.value = world.stationF * 2.5; floorMat.uniforms.uTime.value = time;
  });

  return (
    <group>
      <Backdrop color="#2fb4a8" caustics={0.18} shafts={0.18} haze={0.12} z={-14} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, -1.2]} material={floorMat} frustumCulled={false}>
          <planeGeometry args={[60, 40]} />
        </mesh>
        <group position={[0, 0, 0.2]} rotation={[0, 0, -0.05]}>
          <mesh geometry={geo.body} material={mats.body} frustumCulled={false} />
          <lineSegments geometry={geo.radG} material={mats.rad} frustumCulled={false} />
          <points geometry={geo.radNG} material={mats.radN} frustumCulled={false} />
          <lineSegments geometry={geo.cordG} material={mats.cord} frustumCulled={false} />
          <points geometry={geo.gangG} material={mats.gang} frustumCulled={false} />
          <points geometry={geo.headG} material={mats.head} frustumCulled={false} />
          <points geometry={geo.eyeG} material={mats.eye} frustumCulled={false} />
        </group>
      </group>
      <Plankton count={700} box={[22, 8, 14]} color="#aaffe8" size={0.04} dir={[0, 0, 0]} scroll={2.5} />
    </group>
  );
}
