import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range, rng, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM, latheX, makeBodyMat } from './shared';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const BOX: [number, number, number] = [20, 11, 8];

function makeCrestMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uProg: { value: 0 }, uOp: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aEnd; attribute vec4 aR; uniform float uProg,uTime; varying float vA;
      void main(){ float e=clamp((uProg-aR.x*.45)/.55,0.,1.); e=e*e*(3.-2.*e);
        vec3 p=mix(position,aEnd,e); float sw=sin(3.14159*e);
        p+=vec3(sin(aR.y*30.+e*6.),cos(aR.z*25.+e*5.),sin(aR.w*20.+e*7.))*.22*sw;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=(0.06+aR.w*.07)*480./max(.3,-mv.z); vA=smoothstep(0.,.08,uProg)*(0.35+0.65*sw+0.3*e); }`,
    fragmentShader: /* glsl */ `
      uniform float uOp; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.62,.22)*a*a*vA*uOp*1.6,1.); }`,
  });
}

/** fish head ghost + neural tube swelling into fore/mid/hind vesicles, folding, hemispheres; neural-crest migration */
export default function BrainGrow() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const brain = useBrainCtl({ grow: 0, tissue: '#ab9fa6' });
  const stemGlow = useMemo(() => [{ at: 'brainstem' as const, color: '#42e8ff', i: 0 }, { at: 'pallium' as const, color: '#42e8ff', i: 0 }], []);
  brain.regions = stemGlow;
  const stage = useMemo(() => {
    // a small jawless fish: rounded head, body tapering back toward the tail (it runs off frame to the left)
    const head = latheX((x) => (x >= 0 ? 1.05 * Math.sqrt(Math.max(0, 1 - Math.pow(x / 3.5, 2))) : Math.max(0.06, 1.05 * (1 - Math.pow(-x / 7.5, 1.3)))), -7.5, 3.5, 110, 44, 0.95);
    const headM = makeBodyMat('#58b8ff', { rim: 0.42, base: 0.012, stripe: 0 });
    const eyeM = makeBodyMat('#9be7ff', { rim: 2.5, base: 0.7 });
    const eyeG = new THREE.SphereGeometry(0.2, 24, 16);
    const n = Math.floor(900 * world.quality);
    const r = rng(5);
    const p0 = new Float32Array(n * 3), p1 = new Float32Array(n * 3), rr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      p0[i * 3] = -0.8 + r() * 3.2; p0[i * 3 + 1] = 0.8 + r() * 0.3; p0[i * 3 + 2] = (r() - 0.5) * 0.3;
      const a = r() * Math.PI * 2, rad = 0.5 + r() * 0.45;
      p1[i * 3] = 1.3 + r() * 1.9; p1[i * 3 + 1] = -0.2 + Math.sin(a) * rad * 0.9; p1[i * 3 + 2] = Math.cos(a) * rad;
      rr[i * 4] = r(); rr[i * 4 + 1] = r(); rr[i * 4 + 2] = r(); rr[i * 4 + 3] = r();
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(p0, 3));
    cg.setAttribute('aEnd', new THREE.BufferAttribute(p1, 3));
    cg.setAttribute('aR', new THREE.BufferAttribute(rr, 4));
    return { head, headM, eyeM, eyeG, cg, crestM: makeCrestMat() };
  }, []);
  useEffect(() => () => { stage.head.dispose(); stage.headM.dispose(); stage.eyeM.dispose(); stage.eyeG.dispose(); stage.cg.dispose(); stage.crestM.dispose(); }, [stage]);

  const p16 = eventPos('first-vertebrates-neural-crest');
  const p17 = eventPos('tripartite-brain');
  useFrame(() => {
    if (!scene.active) return;
    const f = world.stationF;
    const s = range(p16 - 0.45, p17 + 0.15, f);
    brain.grow = smoothstep(0.02, 0.98, s) * stageGrow('fish');
    brain.alpha = scene.weight;
    stemGlow[0].i = (0.25 + 0.2 * Math.sin(TM() * 2 + f * 3)) * (1 - smoothstep(0.5, 0.9, s)) + near(p17, 0.7) * 0.5;
    stemGlow[1].i = smoothstep(0.55, 0.95, s) * (0.35 + 0.5 * near(p17, 0.7));
    // the head ghost frames the first fish, then steps back so the formed brain is not read against a pale 'plate'
    stage.headM.uniforms.uOpacity.value = scene.weight * 0.7 * (1 - smoothstep(0.42, 0.78, s));
    stage.eyeM.uniforms.uOpacity.value = scene.weight * smoothstep(0.25, 0.6, s);
    stage.crestM.uniforms.uProg.value = range(p16 - 0.6, p16 + 0.5, f);
    stage.crestM.uniforms.uOp.value = scene.weight * (1 - smoothstep(0.1, 0.6, f - p16 - 0.4));
    stage.crestM.uniforms.uTime.value = TM();
    const es = 0.4 + smoothstep(0.25, 0.7, s) * 0.9;
    if (eyeL.current && eyeR.current) { eyeL.current.scale.setScalar(es); eyeR.current.scale.setScalar(es); }
    if (grp.current) grp.current.rotation.y = -0.45 + s * 0.75 + (world.reduced ? 0 : Math.sin(world.time * 0.2) * 0.04);
  });
  return (
    <group>
      <Backdrop top="#0b3a6e" bottom="#02060f" ray={0.35} />
      <Plankton count={600} box={BOX} color="#78c8ff" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={grp} position={[0, 0.2, 0]} scale={1.05}>
        <mesh geometry={stage.head} material={stage.headM} frustumCulled={false} position={[0, -0.3, 0]} scale={[1.0, 0.95, 0.95]} />
        <Brain ctl={brain} position={[-0.2, 0.25, 0]} scale={1.5} />
        <mesh ref={eyeL} geometry={stage.eyeG} material={stage.eyeM} position={[1.6, 0.0, 1.45]} />
        <mesh ref={eyeR} geometry={stage.eyeG} material={stage.eyeM} position={[1.6, 0.0, -1.45]} />
        <points geometry={stage.cg} material={stage.crestM} frustumCulled={false} />
      </group>
    </group>
  );
}
