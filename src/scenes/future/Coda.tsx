import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU, type V3 } from '../human/common';
import { makeGlowMat } from '../hominin/common';

// The closing reflection, in the dark. One light carries it: absent while you try to imagine being dead, a faraway point
// when the 13.8 billion years before you come up, a single dot among the stars ("we are dots"), crackling with electricity
// when thoughts come up, one among a crowd of other small lights when everyone is figuring it out, breathing slowly at
// "here, now", lit by a dawn at "still morning", and beating like a heart at the very end.

/** breath cycle shared with the soundscape (src/audio/instruments.ts Breath): 4 s in, 6 s out, from page time */
export function breathAt(seconds: number) {
  const p = (seconds % 10) / 10;
  return p < 0.4 ? Math.sin((p / 0.4) * Math.PI / 2) ** 2 : Math.cos(((p - 0.4) / 0.6) * Math.PI / 2) ** 2;
}
/** lub-dub at 70 a minute */
function heartAt(seconds: number) {
  const p = (seconds * 70 / 60) % 1;
  return Math.exp(-(((p - 0.02) / 0.05) ** 2)) + 0.6 * Math.exp(-(((p - 0.3) / 0.05) ** 2));
}

const LIGHT_AT: [number, number, number] = [0, 1.55, 0];

const DAWN_FS = /* glsl */ `
uniform float uW, uRise; varying vec2 vUv;
void main(){
  // a low band of dawn along the bottom of the frame: the text above it stays on dark sky
  float y = vUv.y;
  float horizon = .12 + .05*uRise;
  float glow = exp(-max(y - horizon, 0.)*14.) * smoothstep(horizon - .12, horizon, y);
  float x = (vUv.x - .5)*2.;
  vec3 c = mix(vec3(.9, .26, .12), vec3(1.2, .72, .36), smoothstep(-.06, .05, y - horizon));
  c *= glow * (1. - .45*x*x) * uRise * .7;
  gl_FragColor = vec4(c * uW, 1.);
}`;

export default function Coda() {
  const scene = useScene();
  const orb = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const R = useMemo(() => {
    const sb = new PBuf(501);
    const r = sb.r;
    for (let i = 0; i < 1400 * world.quality; i++) {
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(40 + r() * 90);
      if (v.z > 0) v.z = -v.z;
      sb.add(v.x, v.y, v.z, r() < 0.2 ? [2.0, 1.5, 1.0] : [1.3, 1.5, 2.2], 0);
    }
    const sMat = pointMat({
      decl: 'uniform float uOn;', uniforms: { uOn: { value: 0 } }, size: 2,
      body: `a = uOn*(.25 + .6*aSeed.x)*(.6+.4*sin(uTime*(.4+aSeed.y)+aSeed.z*60.)); size = .25 + aSeed.x*.8;`,
    });
    // dust in the dark, close by
    const db = new PBuf(502);
    for (let i = 0; i < 260; i++) db.add((db.r() - 0.5) * 14, (db.r() - 0.5) * 8, (db.r() - 0.5) * 6, [1.1, 1.1, 1.2], 0);
    const dMat = pointMat({
      decl: 'uniform float uOn;', uniforms: { uOn: { value: 0 } }, size: 0.5,
      body: `p += vec3(sin(uTime*.05 + aSeed.x*30.), cos(uTime*.04 + aSeed.y*30.), 0.)*.6;
        a = uOn*(.15 + .35*aSeed.z); size = .3 + aSeed.x*.4;`,
    });
    // a crowd of small lights, each its own person, each flickering with its own doubts
    const cb = new PBuf(503);
    for (let i = 0; i < 900 * world.quality; i++) {
      const x = (cb.r() - 0.5) * 26, z = -2 - cb.r() * 26;
      cb.add(x, -0.7 + cb.r() * 0.25 + (-z) * 0.02, z, cb.r() < 0.7 ? [2.0, 1.45, 0.8] : [1.3, 1.5, 2.1], 0);
    }
    const cMat = pointMat({
      decl: 'uniform float uOn;', uniforms: { uOn: { value: 0 } }, size: 2.6,
      body: `float doubt = .5 + .5*sin(uTime*(1.+aSeed.y*2.5) + aSeed.z*80.);
        a = uOn*(.25 + .75*doubt*doubt)*(.4 + .6*aSeed.x); size = .4 + .5*aSeed.x;`,
    });
    // electricity: branching sparks round the light
    const lb = new LBuf(504);
    const grow = (a: V3, dir: V3, len: number, depth: number, id: number) => {
      let p = a;
      const n = 6;
      for (let i = 1; i <= n; i++) {
        const q: V3 = [p[0] + dir[0] * len / n + (lb.r() - 0.5) * 0.18, p[1] + dir[1] * len / n + (lb.r() - 0.5) * 0.18, p[2] + (lb.r() - 0.5) * 0.12];
        lb.seg(p, q, (i - 1) / n, i / n, [0.6, 1.0, 2.4], id);
        if (depth > 0 && lb.r() < 0.35) {
          const ang = Math.atan2(dir[1], dir[0]) + (lb.r() < 0.5 ? 1 : -1) * (0.4 + lb.r() * 0.6);
          grow(q, [Math.cos(ang), Math.sin(ang), 0], len * 0.5, depth - 1, id);
        }
        p = q;
      }
    };
    for (let k = 0; k < 14; k++) { const ang = (k / 14) * Math.PI * 2 + lb.r() * 0.3; grow([Math.cos(ang) * 0.35, Math.sin(ang) * 0.35, 0], [Math.cos(ang), Math.sin(ang), 0], 1.6 + lb.r() * 1.2, 2, k / 14); }
    const lMat = lineMat({
      decl: 'uniform float uOn;', uniforms: { uOn: { value: 0 } },
      body: `float fire = step(.82, fract(sin(floor(uTime*7. + aSeed.w*13.)*91.7 + aSeed.w*7.)*43758.5));
        float travel = exp(-pow((aG - fract(uTime*1.7 + aSeed.w))*6., 2.));
        a = uOn*(.05 + fire*(.4 + 1.2*travel));`,
    });
    const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 1.4), transparent: true, opacity: 0, toneMapped: false });
    const haloMat = makeGlowMat('#ffcf8a', 2.2);
    const dawnMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uW: { value: 0 }, uRise: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: DAWN_FS,
    });
    return { sGeo: sb.build(), sMat, dGeo: db.build(), dMat, cGeo: cb.build(), cMat, lGeo: lb.build(), lMat, orbMat, haloMat, dawnMat };
  }, []);
  useEffect(() => () => {
    [R.sGeo, R.dGeo, R.cGeo, R.lGeo].forEach((g) => g.dispose());
    [R.sMat, R.dMat, R.cMat, R.lMat, R.orbMat, R.haloMat, R.dawnMat].forEach((m) => m.dispose());
  }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, pr = st.gl.getPixelRatio();
    const now = performance.now() / 1000;
    const at = (id: string, width = 0.75) => near(eventPos(id), width);
    // how present each element is, by station
    const stars = Math.max(at('coda-before') * 0.25, at('coda-scale') * 0.75, at('coda-electricity') * 0.3, at('coda-nobody') * 0.35,
      at('coda-invented') * 0.35, at('coda-mistakes') * 0.35, at('coda-here') * 0.45, at('coda-morning') * 1, at('coda-heartbeats') * 0.6);
    const dust = Math.max(at('coda-someone'), at('coda-before') * 0.5);
    const crowd = Math.max(at('coda-nobody'), at('coda-invented') * 0.8, at('coda-mistakes') * 0.5);
    const sparks = at('coda-electricity');
    const dawn = Math.max(at('coda-morning'), at('coda-heartbeats') * 0.7);
    const breath = at('coda-here', 0.9);
    const beat = at('coda-heartbeats');
    // the light: nothing at "imagine", a far point "before", a dot "scale", then it grows, breathes, beats
    const size = Math.max(at('coda-before') * 0.02, at('coda-scale') * 0.035, at('coda-electricity') * 0.12, at('coda-nobody') * 0.05,
      at('coda-invented') * 0.06, at('coda-mistakes') * 0.09, breath * 0.34, at('coda-morning') * 0.3, beat * 0.32);
    const pulse = 1 + breath * 0.22 * breathAt(now) + beat * 0.16 * heartAt(now);
    const imagine = at('coda-imagine', 0.6);
    const on = w * (1 - imagine);
    for (const [m, v] of [[R.sMat, stars], [R.dMat, dust], [R.cMat, crowd], [R.lMat, sparks]] as const) { tickU(m, scene, pr); m.uniforms.uOn.value = v * on; }
    R.orbMat.opacity = Math.min(1, size * 12) * on;
    if (orb.current) orb.current.scale.setScalar(Math.max(0.001, size * pulse));
    if (halo.current) { halo.current.quaternion.copy(st.camera.quaternion); halo.current.scale.setScalar(Math.max(0.001, (0.3 + size * 9) * pulse)); }
    R.haloMat.uniforms.uAlpha.value = on * Math.min(1, size * 6) * (0.5 + 0.3 * breath);
    R.dawnMat.uniforms.uW.value = on * dawn; R.dawnMat.uniforms.uRise.value = dawn;
  });

  return (
    <group>
      <points geometry={R.sGeo} material={R.sMat} frustumCulled={false} />
      <points geometry={R.dGeo} material={R.dMat} frustumCulled={false} />
      <points geometry={R.cGeo} material={R.cMat} frustumCulled={false} />
      <mesh position={[0, -1, -30]} material={R.dawnMat}><planeGeometry args={[90, 40]} /></mesh>
      {/* the light sits in the upper third, above the centred line of text */}
      <group position={LIGHT_AT}>
        <lineSegments geometry={R.lGeo} material={R.lMat} frustumCulled={false} />
        <mesh ref={halo} material={R.haloMat}><planeGeometry args={[1, 1]} /></mesh>
        <mesh ref={orb} material={R.orbMat}><sphereGeometry args={[1, 48, 32]} /></mesh>
      </group>
    </group>
  );
}
