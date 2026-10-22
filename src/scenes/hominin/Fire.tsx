import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp, smoothstep } from '../../world/util';
import { GLSL_NOISE, makeGlowMat } from './common';
import { Coals, Embers, Flame, newFlameCtl } from './flame';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';

const tNow = () => (world.reduced ? 0 : world.time);
const FIRE = new THREE.Vector3(0, 0.55, 0);
interface Fig { x: number; z: number; sc: number; preset: 'erectus' | 'heidelbergensis'; crouch: number; reach: number; from: number }
const FIGS: Fig[] = [
  { x: -1.95, z: -0.55, sc: 1.18, preset: 'erectus', crouch: 1, reach: 0.95, from: 0.1 },
  { x: 1.75, z: -0.8, sc: 1.05, preset: 'erectus', crouch: 0.92, reach: 0.85, from: 0.24 },
  { x: 2.0, z: 0.75, sc: 1.1, preset: 'heidelbergensis', crouch: 0, reach: 0.0, from: 0.55 },
];

export default function Fire() {
  const scene = useScene();
  const ctl = useMemo(newFlameCtl, []);
  const hs = useRef<(CreatureHandle | null)[]>([]);
  const gs = useRef<(THREE.Group | null)[]>([]);
  const halo = useRef<THREE.Mesh>(null);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const R = useMemo(() => {
    const ground = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uF: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE}
        uniform float uF, uAlpha; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          float n = n3(vec3(p*2.2, 0.))*.5 + n3(vec3(p*9., 1.))*.3 + n3(vec3(p*40., 2.))*.2;
          float d = length(p);
          float lit = uF/(1. + pow(d/1.5, 2.)) ;
          vec3 c = vec3(.012,.013,.02)*(.6 + n*.8);
          c += vec3(1.,.4,.12)*lit*(.12 + n*.9)*.3;
          c = mix(c, vec3(.004,.004,.008), smoothstep(5., 14., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    const halo = makeGlowMat('#ff7a28', 2.0), floor = makeGlowMat('#ff8a3a', 1.4);
    return { ground, halo, floor };
  }, []);
  useEffect(() => () => { R.ground.dispose(); R.halo.dispose(); R.floor.dispose(); }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = tNow();
    const F = smoothstep(0.05, 0.3, t);
    const flick = 0.84 + 0.16 * Math.sin(tm * 11.3) * Math.sin(tm * 7.1 + 1.) + 0.05 * Math.sin(tm * 23.);
    ctl.F = F; ctl.flick = flick; ctl.alpha = w;
    R.ground.uniforms.uF.value = F * flick * w; R.ground.uniforms.uAlpha.value = w;
    R.halo.uniforms.uAlpha.value = w * F * (0.16 + 0.05 * flick); R.floor.uniforms.uAlpha.value = w * F * flick * 0.22;
    if (halo.current) { halo.current.position.set(0, 1.0, -1.9); halo.current.quaternion.copy(st.camera.quaternion); halo.current.scale.setScalar(5.2 + F * 1.2); }
    FIGS.forEach((f, i) => {
      const h = hs.current[i], g = gs.current[i];
      if (!h || !g) return;
      const appear = smoothstep(f.from, f.from + 0.14, t);
      const enter = f.preset === 'heidelbergensis' ? smoothstep(0.55, 0.85, t) : 1;
      const x = f.preset === 'heidelbergensis' ? lerp(f.x + 2.4, f.x, enter) : f.x;
      g.position.set(x, 0, f.z);
      g.rotation.y = Math.atan2(-(FIRE.z - f.z), FIRE.x - x);
      g.scale.setScalar(f.sc);
      g.visible = appear > 0.01;
      const stand = f.preset === 'heidelbergensis';
      h.override.phase = undefined;
      h.state.crouch = stand ? 0 : f.crouch;
      h.state.reach = f.reach * (0.85 + 0.15 * Math.sin(tm * 0.7 + i * 2));
      h.state.armsFree = 0; h.state.reachY = -0.3; h.state.gripL = 0.1; h.state.gripR = 0.1;
      h.state.propR = stand ? 3 : 0; h.state.gripR = stand ? 0.7 : 0.1; h.state.rollR = stand ? 1.45 : 0;
      h.state.mouth = 0;
      // light from the fire in view space (so each face is lit from where the flames are)
      g.getWorldPosition(v); tgt.copy(FIRE).sub(v); const d = tgt.length();
      tgt.transformDirection(st.camera.matrixWorldInverse).normalize();
      const k = F * flick * Math.min(1.5, 1.3 / (0.45 + d * d * 0.22));
      // a painter's cheat: the fire lights them from the side, not from the camera, so their forms turn into shadow
      h.look.keyDir = [tgt.x, tgt.y - 0.1, tgt.z * 0.3]; h.look.keyK = k * 1.15; h.look.amb = 0.07 + 0.05 * F;
      h.look.rimDir = [tgt.x, Math.max(0.1, tgt.y + 0.4)]; h.look.rimK = 0.5 + 1.8 * F * flick * (tgt.z < 0 ? 1 : 0.35);
      h.look.sss = 0.25; h.look.w = w * appear;
    });
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.ground}><circleGeometry args={[16, 48]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={R.floor}><planeGeometry args={[7, 7]} /></mesh>
      <mesh ref={halo} material={R.halo} renderOrder={1}><planeGeometry args={[1, 1]} /></mesh>
      <Coals ctl={ctl} />
      <Flame ctl={ctl} height={1.95} width={1.0} tongues={8} />
      <Embers ctl={ctl} count={190} rise={4.0} />
      {FIGS.map((f, i) => (
        <group key={i} ref={(g) => { gs.current[i] = g; }} position={[f.x, 0, f.z]}>
          <Creature ref={(h) => { hs.current[i] = h; }} rig="biped" preset={f.preset} lookAt={FIRE}
            palette={{ key: '#ff8a3c', rim: '#ff9a50', base: f.preset === 'erectus' ? '#2c1e16' : '#3a2a20' }} look={{ gloss: 0.35, groundAO: 0.8 }} />
        </group>
      ))}
    </group>
  );
}

export const fireCamera = (t: number) => ({ pos: [Math.sin(t * 2.2 - 1.1) * 0.7, 1.05, 4.3 - t * 0.3] as [number, number, number], look: [0.15, 0.8, 0] as [number, number, number], fov: 44 });
