import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const SRC = new THREE.Vector2(4.2, 0.6);
const STEPS = 420, DT = 0.1, K = 12;

interface Walk { x: Float32Array; y: Float32Array; tum: Uint8Array }

function simulate(seed: number): Walk {
  const r = rng(seed);
  const x = new Float32Array(STEPS), y = new Float32Array(STEPS), tum = new Uint8Array(STEPS);
  let px = -7 + r() * 3, py = (r() - 0.5) * 7, ang = r() * 6.28, tumble = 0;
  let prevC = 0;
  for (let i = 0; i < STEPS; i++) {
    const c = Math.exp(-Math.hypot(px - SRC.x, py - SRC.y) / 5);
    const dc = c - prevC; prevC = c;
    // run-and-tumble: tumble less if concentration is rising
    const pT = dc > 0 ? 0.02 : 0.14;
    if (tumble > 0) { tumble--; ang += (r() - 0.5) * 1.6; tum[i] = 1; }
    else if (r() < pT) tumble = 2 + Math.floor(r() * 2);
    const sp = tumble > 0 ? 0.25 : 1.15 + r() * 0.1;
    px += Math.cos(ang) * sp * DT * 1.5; py += Math.sin(ang) * sp * DT * 1.5;
    if (px < -8.5 || px > 8.5) { ang = Math.PI - ang; px = THREE.MathUtils.clamp(px, -8.5, 8.5); }
    if (py < -4.2 || py > 4.2) { ang = -ang; py = THREE.MathUtils.clamp(py, -4.2, 4.2); }
    x[i] = px; y[i] = py;
  }
  return { x, y, tum };
}

const NB = 44;

/** run-and-tumble bacteria climbing a nutrient gradient. Fully scrubbable: positions are sampled from precomputed walks. */
export default function Chemotaxis() {
  const scene = useScene();
  const walks = useMemo(() => Array.from({ length: NB }, (_, i) => simulate(1000 + i * 17)), []);
  const bodyMat = useMemo(() => makeGlass('#a6ff9a', { rim: 1.8, fill: 0.55, power: 1.3, noise: 4 }), []);
  const flagMat = useMemo(() => makeGlass('#d8ffd0', { rim: 0.5, fill: 0.9, power: 1 }), []);
  const bodies = useRef<THREE.InstancedMesh>(null), flags = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  const headings = useMemo(() => new Float32Array(NB), []);

  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * K * 3), 3));
    const a = new Float32Array(NB * K);
    for (let i = 0; i < NB * K; i++) a[i] = (i % K) / (K - 1);
    g.setAttribute('aK', new THREE.BufferAttribute(a, 1));
    return g;
  }, []);
  const trailMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx,uW; attribute float aK; varying vec3 vC; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=max(1.,(.09*(1.-aK))*uPx/-mv.z); vC=mix(vec3(.5,1.,.5),vec3(.1,.5,.9),aK); vA=uW*(1.-aK)*.7; }`,
    fragmentShader: POINT_FRAG,
  }), []);

  // nutrient field
  const fieldMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uSrc: { value: SRC.clone() }, uBoost: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uTime,uW,uBoost; uniform vec2 uSrc; ${NOISE}
      void main(){ vec2 q=vP.xy-uSrc; float d=length(q);
        float n=fbm(vec3(vP.xy*.45+vec2(uTime*.05,0.),uTime*.08));
        float f=exp(-d/3.0)*(.6+.8*n);
        f*=f;
        float iso=smoothstep(.04,0.,abs(fract(f*7.)-.5)-.44)*f;
        vec3 c=vec3(.9,.7,.3)*f*.10+vec3(1.,.9,.5)*iso*.10*smoothstep(.05,.3,f);
        c+=vec3(1.6,1.1,.5)*exp(-d*d*2.2)*.8*(1.+uBoost);
        gl_FragColor=vec4(c*uW,1.); }`,
  }), []);
  // food particles
  const foodGeo = useMemo(() => {
    const r = rng(5), n = Math.floor(90 * world.quality);
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, rad = Math.pow(r(), 1.7) * 7;
      p.set([SRC.x + Math.cos(a) * rad, SRC.y + Math.sin(a) * rad * 0.7, -0.5 + r() * 1.2], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  const foodMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx,uW,uTime; varying vec3 vC; varying float vA;
      void main(){ vec3 p=position; p.y+=sin(uTime*.6+p.x*3.)*.1; p.x+=cos(uTime*.5+p.y*2.)*.1; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=max(1.,.1*uPx/-mv.z); vC=vec3(1.4,1.,.35); vA=uW*.8; }`,
    fragmentShader: POINT_FRAG,
  }), []);
  useDispose(bodyMat, flagMat, trailGeo, trailMat, fieldMat, foodGeo, foodMat);

  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight, time = timeNow(), px = pxScale(state);
    const span = smoothstep(0, 1, scene.t);
    const s = 0.3 + span * (STEPS - 60);
    const pulse = near(eventPos('bacterial-chemotaxis'), 0.6);
    bodyMat.uniforms.uW.value = w; bodyMat.uniforms.uTime.value = time; flagMat.uniforms.uW.value = w * 0.7;
    trailMat.uniforms.uPx.value = px; trailMat.uniforms.uW.value = w;
    foodMat.uniforms.uPx.value = px; foodMat.uniforms.uW.value = w; foodMat.uniforms.uTime.value = time;
    fieldMat.uniforms.uW.value = w; fieldMat.uniforms.uTime.value = time; fieldMat.uniforms.uBoost.value = pulse * 0.6;
    const tp = trailGeo.attributes.position as THREE.BufferAttribute;
    const at = (wk: Walk, f: number, out: [number, number]) => {
      const i0 = Math.min(STEPS - 2, Math.max(0, Math.floor(f))), fr = f - i0;
      out[0] = wk.x[i0] + (wk.x[i0 + 1] - wk.x[i0]) * fr; out[1] = wk.y[i0] + (wk.y[i0 + 1] - wk.y[i0]) * fr;
    };
    const a: [number, number] = [0, 0], b: [number, number] = [0, 0];
    for (let i = 0; i < NB; i++) {
      const wk = walks[i];
      at(wk, s, a); at(wk, s - 1.2, b);
      const z = Math.sin(i * 12.9) * 0.9;
      const tum = wk.tum[Math.floor(s)] === 1;
      const target = Math.atan2(a[1] - b[1], a[0] - b[0]);
      let dh = target - headings[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      headings[i] += dh * (tum ? 0.5 : 0.25);
      const h = headings[i];
      d.position.set(a[0], a[1], z); d.rotation.set(0, 0, h - Math.PI / 2); d.scale.set(0.2, 0.2, 0.2);
      d.updateMatrix(); bodies.current?.setMatrixAt(i, d.matrix);
      // flagellum behind the cell, flailing when tumbling
      const fa = h + Math.PI + (tum ? Math.sin(time * 14 + i) * 1.2 : Math.sin(time * 20 + i) * 0.12);
      d.position.set(a[0] + Math.cos(fa) * 0.42, a[1] + Math.sin(fa) * 0.42, z); d.rotation.set(0, 0, fa - Math.PI / 2);
      d.scale.set(0.025, tum ? 0.4 : 0.55, 0.025); d.updateMatrix(); flags.current?.setMatrixAt(i, d.matrix);
      for (let k = 0; k < K; k++) {
        at(wk, Math.max(0, s - 1 - k * 1.1), b);
        tp.setXYZ(i * K + k, b[0], b[1], z);
      }
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (flags.current) flags.current.instanceMatrix.needsUpdate = true;
    tp.needsUpdate = true;
  });

  return (
    <group>
            <mesh material={fieldMat} position={[0, 0, -2]} frustumCulled={false}>
        <planeGeometry args={[30, 16]} />
      </mesh>
      <Plankton count={90} box={[22, 12, 8]} color="#aaffcc" size={0.03} dir={[0.02, 0.02, 0]} />
      <points geometry={foodGeo} material={foodMat} frustumCulled={false} />
      <points geometry={trailGeo} material={trailMat} frustumCulled={false} />
      <instancedMesh ref={bodies} args={[undefined, undefined, NB]} material={bodyMat} frustumCulled={false}>
        <capsuleGeometry args={[0.5, 1.2, 4, 10]} />
      </instancedMesh>
      <instancedMesh ref={flags} args={[undefined, undefined, NB]} material={flagMat} frustumCulled={false}>
        <cylinderGeometry args={[1, 0.3, 1, 5, 1]} />
      </instancedMesh>
    </group>
  );
}
