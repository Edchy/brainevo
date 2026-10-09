import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, NOISE, Plankton, timeNow, useDispose } from './common';

const FLOOR_Y = -2.5;
const TRI = [
  { x: 0.2, z: 0.8, s: 1.7, yaw: 0.35, sp: 0.1, ph: 0.0 },
  { x: 3.4, z: -1.6, s: 1.4, yaw: 3.3, sp: 0.1, ph: 2.1 },
];

/**
 * Cambrian: dark water, an Anomalocaris glides in; at the eyes event its compound eyes flash cyan and light floods the
 * seabed where trilobites graze.
 */
export default function Cambrian() {
  const scene = useScene();
  const hero = useRef<AquaHandle>(null);
  const tri = useRef<(AquaHandle | null)[]>([]);
  const heroG = useRef<THREE.Group>(null);
  const triG = useRef<(THREE.Group | null)[]>([]);
  const U = useMemo(() => ({ uLight: { value: 0.2 } }), []);
  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uLight: U.uLight },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec3 vP; uniform float uW,uTime,uLight; ${NOISE}
      void main(){ float n=fbm(vec3(vP.xz*.6,0.));
       float rip=pow(1.-abs(vnoise(vec3(vP.xz*1.0,uTime*.25))*2.-1.),8.)+pow(1.-abs(vnoise(vec3(vP.xz*1.6+4.,uTime*.3))*2.-1.),8.);
       float grain=vnoise(vec3(vP.xz*14.,1.));
       float fade=exp(-length(vP.xz-vec2(0.,-3.))*.1);
       gl_FragColor=vec4((vec3(.02,.035,.04)*(.4+n)*(.7+.6*grain)+vec3(.35,.8,.9)*rip*.07*uLight)*fade*uW*(.5+uLight),1.); }`,
  }), [U]);
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 2.4), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const beamMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uW; void main(){ float a=pow(vUv.y,1.6)*exp(-pow((vUv.x-.5)*4.5,2.)); gl_FragColor=vec4(vec3(.35,.8,.95)*a*uW*.022,1.); }',
  }), []);
  const beams = useRef<THREE.Group>(null);
  useDispose(floorMat, flashMat, beamMat);
  const pEv = eventPos('cambrian-explosion-eyes');

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const open = smoothstep(pEv - 0.18, pEv + 0.08, world.stationF);
    const fl = near(pEv, 0.22);
    const tail = 1 - smoothstep(0.75, 1, t);
    const light = (0.14 + 0.86 * smoothstep(pEv - 0.5, pEv + 0.5, world.stationF)) * (0.3 + 0.7 * tail);
    U.uLight.value = light;
    floorMat.uniforms.uW.value = w; floorMat.uniforms.uTime.value = time;
    flashMat.opacity = w * fl * fl * 0.01;
    beamMat.uniforms.uW.value = w * open * (0.6 + 0.4 * tail);
    if (beams.current) beams.current.visible = open > 0.02;
    const h = hero.current;
    if (h) {
      const st = h.state;
      st.phase = t * 9 + time * 0.55;
      st.beat = 0.7 + 0.3 * Math.sin(time * 0.5);
      st.mouth = 0.15 + 0.7 * smoothstep(pEv - 0.1, pEv + 0.25, world.stationF) * (0.6 + 0.4 * Math.sin(time * 1.3)) * (1 - 0.6 * smoothstep(0.8, 1, t));
      st.turn = Math.sin(time * 0.3) * 0.3;
      h.look.w = w;
      h.look.keyK = 0.25 + 0.7 * light; h.look.amb = 0.1 + 0.2 * light; h.look.rimK = 0.9 + 0.9 * light;
      h.look.eyeK = 0.12 + open * 0.9 + fl * 3.2;
    }
    if (heroG.current) {
      heroG.current.position.set(-1.3 + t * 2.4, 0.75 + Math.sin(time * 0.6) * 0.12 + Math.sin(t * 6) * 0.08, 0);
      heroG.current.rotation.set(0.42, -0.5 + t * 0.35, Math.sin(time * 0.5) * 0.04);
    }
    TRI.forEach((c, i) => {
      const g = triG.current[i], a = tri.current[i];
      if (!g || !a) return;
      const x = c.x + (t - 0.5) * 6 * c.sp * (i ? -1 : 1) * 3;
      g.position.set(x, FLOOR_Y, c.z); g.rotation.y = c.yaw; g.scale.setScalar(c.s);
      a.state.phase = x * 1.6 * (i ? -1 : 1) + c.ph; a.state.time = time;
      a.look.w = w; a.look.keyK = 0.2 + 0.7 * light; a.look.amb = 0.1 + 0.2 * light; a.look.rimK = 0.8 + 0.9 * light;
      a.look.eyeK = 0.1 + open * 0.8 + fl * 2;
    });
  });

  const shafts = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: -12 + i * 4 + (i % 2) * 1.2, w: 1.2 + (i % 3) * 0.8, tilt: 0.25 })), []);
  return (
    <group>
      <Backdrop color="#46c4d8" caustics={0} shafts={0.04} haze={0} z={-18} uLight={() => U.uLight.value} />
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.02, -4]} frustumCulled={false}>
        <planeGeometry args={[70, 40]} />
      </mesh>
      <Plankton count={110} box={[26, 14, 16]} color="#c8f4ff" size={0.035} dir={[0.02, -0.04, 0]} intensity={0.7} />
      <group ref={beams}>
        {shafts.map((sh, i) => (
          <mesh key={i} position={[sh.x, 4, -9 - (i % 3) * 2]} rotation={[0, 0, sh.tilt]} material={beamMat} frustumCulled={false}>
            <planeGeometry args={[sh.w, 18]} />
          </mesh>
        ))}
      </group>
      <group ref={heroG}>
        <group scale={1.55}>
          <AquaCreature ref={hero} kind="anomalocaris" />
        </group>
      </group>
      {TRI.map((_c, i) => (
        <group key={i} ref={(g) => { triG.current[i] = g; }}>
          <AquaCreature ref={(a) => { tri.current[i] = a; }} kind="trilobite" resolution={0.7} />
        </group>
      ))}
      <mesh position={[0, 0, 3]} material={flashMat} renderOrder={50} frustumCulled={false}>
        <planeGeometry args={[60, 40]} />
      </mesh>
    </group>
  );
}
