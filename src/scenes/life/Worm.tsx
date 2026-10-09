import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, NOISE, Plankton, timeNow, useDispose } from './common';

/**
 * Radial nerve net on a disc-shaped flatworm-like animal elongates into a bilateral worm: ladder nervous system, brain
 * ganglion at the head, eyespots flaring at cephalization. Seen from above on a rippled seabed.
 */
export default function Worm() {
  const scene = useScene();
  const h = useRef<AquaHandle>(null);
  const grp = useRef<THREE.Group>(null);
  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uS: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uW,uS,uTime; varying vec2 vP; ${NOISE}
      void main(){ vec2 q=vP+vec2(uS,0.); float n=fbm(vec3(q*.7,0.)); float g=pow(vnoise(vec3(q*3.,uTime*.05)),3.);
        float rip=pow(1.-abs(vnoise(vec3(q*1.1,uTime*.2))*2.-1.),7.);
        float rip2=pow(1.-abs(vnoise(vec3(q*2.3+4.,uTime*.15))*2.-1.),9.);
        float fade=exp(-length(vP)*.07);
        gl_FragColor=vec4((vec3(.05,.07,.07)*n+vec3(.25,.3,.28)*g*.2+vec3(.35,.45,.45)*(rip*.06+rip2*.04))*fade*uW,1.); }`,
  }), []);
  useDispose(floorMat);
  const pCeph = eventPos('cephalization'), pBil = eventPos('bilateral-symmetry-ganglia');

  useFrame(() => {
    if (!scene.active) return;
    const a = h.current; if (!a) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const ceph = near(pCeph, 0.5), bil = near(pBil, 0.5);
    const st = a.state;
    st.morph = smoothstep(0.04, 0.5, t);
    st.net = 1;
    st.beat = 0.55 + 0.45 * smoothstep(0.1, 0.6, t);
    st.phase = t * 4 + time * 0.22;
    st.sig = ((t * 7) % 1) * 1.4 - 0.2;
    a.look.glowK = 1.2 + ceph * 1.6 + bil * 0.6;
    a.look.eyeK = 0.4 + ceph * 2;
    a.look.w = w;
    floorMat.uniforms.uW.value = w; floorMat.uniforms.uS.value = world.stationF * 2.5; floorMat.uniforms.uTime.value = time;
    if (grp.current) { grp.current.position.set(-0.9 + t * 2.0, 0.2, 0.2 + Math.sin(time * 0.3) * 0.05); grp.current.rotation.y = -0.05 - 0.1 * Math.sin(time * 0.2 + t * 3); }
  });

  return (
    <group>
      <Backdrop color="#2fb4a8" caustics={0.12} shafts={0.1} haze={0.1} z={-14} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, -1.2]} material={floorMat} frustumCulled={false}>
          <planeGeometry args={[60, 40]} />
        </mesh>
      </group>
      <group ref={grp}>
        <group scale={1.35}>
          <AquaCreature ref={h} kind="flatworm" />
        </group>
      </group>
      <Plankton count={450} box={[22, 8, 14]} color="#aaffe8" size={0.04} dir={[0, 0, 0]} scroll={2.5} />
    </group>
  );
}
