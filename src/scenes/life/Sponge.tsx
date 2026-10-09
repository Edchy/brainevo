import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const H = 3.3, SC = 1.38; // hero sponge: world height of the vase, uniform scale of the rig
const R0 = 0.5;
const WALLR_GLSL = `float wallR(float h){ float u=clamp(h/${H.toFixed(2)},0.,1.); return ${(R0 * SC).toFixed(3)}*(.5+.62*pow(u,.7)-.14*pow(u,4.)); }`;

const SPONGES = [
  { pos: [0.4, -1.45, 0] as [number, number, number], s: SC, rot: 0.8, main: true, seed: 3, r: 'auto' as number | 'auto' },
  { pos: [-4.6, -1.45, -3] as [number, number, number], s: 0.95, rot: 2.2, main: false, seed: 11, r: 0.6 },
  { pos: [4.7, -1.45, -4.2] as [number, number, number], s: 0.8, rot: 4.1, main: false, seed: 5, r: 0.55 },
];

/** a sponge without neurons: pumps water through pores and a central atrium; a slow wave of contraction crawls over it */
export default function Sponge() {
  const scene = useScene();
  const hs = useRef<(AquaHandle | null)[]>([]);
  const gs = useRef<(THREE.Group | null)[]>([]);
  const seaMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uW,uTime; ${NOISE}
      void main(){ float n=fbm(vP*vec3(.5,1.,.5)); float rip=pow(1.-abs(vnoise(vec3(vP.xz*1.2,uTime*.2))*2.-1.),6.);
       float grain=vnoise(vec3(vP.xz*16.,3.));
       float fade=exp(-length(vP.xz-vec2(0.,-2.))*.09);
       gl_FragColor=vec4((vec3(.05,.07,.08)*(.5+n)*(.7+.6*grain)+vec3(.3,.45,.5)*rip*.16)*fade*uW,1.); }`,
  }), []);
  const flowGeo = useMemo(() => {
    const r = rng(81), n = Math.floor(1100 * world.quality);
    const a = new Float32Array(n * 3 * 4), t = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const b = [r(), r(), r(), r()]; for (let k = 0; k < 3; k++) { a.set(b, (i * 3 + k) * 4); t[i * 3 + k] = k; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    return g;
  }, []);
  const flowMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uFlow: { value: 1 }, uGrow: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uTime,uPx,uW,uFlow,uGrow; attribute vec4 aR; attribute float aT; varying vec3 vC; varying float vA; ${WALLR_GLSL}
      void main(){
        float s=fract(aR.x+uTime*.075*uFlow*(.7+.6*aR.y)-aT*.011);
        float h0=.35+aR.z*2.5; float a=aR.w*6.2832; float wr=wallR(h0);
        vec3 p;
        if(s<.4){ float u=s/.4; float rad=mix(3.4,wr*.98,u*u*(3.-2.*u)); p=vec3(sin(a)*rad,h0+sin(u*3.)*.12,cos(a)*rad); vC=vec3(.4,.85,1.2); }
        else { float u=(s-.4)/.6; float rad=mix(wr*.62,.06,pow(u,.6)); float y=h0+pow(u,1.25)*(${H.toFixed(2)}+.12-h0);
          float sw=a+u*3.+aR.y*2.;
          p=vec3(sin(sw)*rad,y,cos(sw)*rad);
          if(u>.9){ float j=(u-.9)*10.; p.y+=j*j*1.5; p.xz+=vec2(sin(a),cos(a))*j*(.5+aR.y)*1.2; }
          vC=mix(vec3(.4,.85,1.2),vec3(1.4,1.1,.8),smoothstep(.3,1.,u)); }
        p*=uGrow; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.5,.1*(.6+aR.y)*(1.-.22*aT)*uPx/-mv.z); vA=uW*smoothstep(0.,.06,s)*smoothstep(1.,.88,s)*(1.-.3*aT)*.95; }`,
    fragmentShader: POINT_FRAG,
  }), []);
  useDispose(seaMat, flowGeo, flowMat);
  const pEv = eventPos('sponges-no-neurons');

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const pulse = near(pEv, 0.7);
    const grow = 0.4 + 0.6 * smoothstep(0, 0.5, t);
    const amp = 0.4 + 0.6 * smoothstep(0.2, 0.55, t);
    seaMat.uniforms.uW.value = w; seaMat.uniforms.uTime.value = time;
    flowMat.uniforms.uTime.value = time + t * 6; flowMat.uniforms.uPx.value = px; flowMat.uniforms.uW.value = w;
    flowMat.uniforms.uFlow.value = 0.5 + 0.7 * grow; flowMat.uniforms.uGrow.value = 0.9 + 0.1 * grow;
    const front = ((t * 4.5) % 1) * 3.6;
    SPONGES.forEach((sp, i) => {
      const a = hs.current[i], g = gs.current[i];
      if (!a || !g) return;
      const k = sp.main ? 0.5 + 0.5 * grow : 0.8;
      a.state.grow = sp.main ? 0.75 + 0.25 * grow : 1;
      a.netO.set(0.4, 1.0, 0.2, ((front + i * 1.1) % 3.6) * (sp.main ? 1 : 1));
      a.look.w = w; a.look.glowK = (0.4 + amp * 1.1 + pulse * 0.7) * (sp.main ? 1 : 0.6);
      g.position.set(sp.pos[0], sp.pos[1], sp.pos[2]); g.rotation.y = sp.rot;
      g.scale.setScalar(sp.s * (sp.main ? 1 : 0.5 + 0.5 * k));
    });
  });

  return (
    <group>
      <Backdrop color="#35a8c0" caustics={0.35} shafts={0.4} haze={0.12} z={-16} />
      <mesh material={seaMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, -4]} frustumCulled={false}>
        <planeGeometry args={[60, 40, 1, 1]} />
      </mesh>
      <Plankton count={700} box={[24, 12, 14]} color="#9fe4ff" size={0.04} dir={[0.04, 0.03, 0]} />
      {SPONGES.map((sp, i) => (
        <group key={i} ref={(g) => { gs.current[i] = g; }}>
          <AquaCreature ref={(a) => { hs.current[i] = a; }} kind="sponge" params={{ seed: sp.seed, height: H / SC, radius: R0 }} resolution={sp.r} />
        </group>
      ))}
      <group position={[0.4, -1.45, 0]}><points geometry={flowGeo} material={flowMat} frustumCulled={false} /></group>
    </group>
  );
}
void NOISE;
