import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import Critter, { SHAPES } from './Critter';
import { GLSL_NOISE, pointMaterial, pointScale, silhouetteMaterial } from './kit';

// One cynodont, rim-lit against black. Its edge warms from cold steel to ember-white as the animal turns endothermic;
// a pool of warmth gathers on the ground beneath it and a few motes rise. Nothing else.
const FLOOR_FRAG = /* glsl */ `
uniform float uW, uHeat, uX; varying vec3 vWp; ${GLSL_NOISE}
void main(){
  float d = length((vWp.xz - vec2(uX, -1.)) * vec2(.55, 1.15));
  float pool = exp(-d*d*.55) * (.015 + uHeat*.2);
  float n = fbm(vWp.xz*.8);
  float far = smoothstep(2., -14., vWp.z);
  vec3 c = vec3(1.,.74,.5)*pool*(.7+.5*n) + vec3(.012,.014,.02)*(1.-far);
  gl_FragColor = vec4(c*uW,1.);
}`;
const FLOOR_VERT = /* glsl */ `varying vec3 vWp; void main(){ vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

export default function Cynodont() {
  const scene = useScene();
  const body = useMemo(() => silhouetteMaterial('#8fa3cf', '#010203', 3.0, 1.0), []);
  const floor = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, toneMapped: false,
    uniforms: { uW: { value: 1 }, uHeat: { value: 0 }, uX: { value: 0 } },
  }), []);
  const cyno = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const cold = useMemo(() => new THREE.Color('#7f93c0'), []);
  const hot = useMemo(() => new THREE.Color('#ffd2a0'), []);

  const motes = useMemo(() => {
    const n = Math.floor(70 * world.quality); const r = rng(5);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 4; i++) seed[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uHeat; uniform vec3 uOrigin; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.05+aSeed.y*.05));
        vec3 p = uOrigin + vec3((aSeed.y-.5)*1.5*(1.-life*.5), .1 + life*2.6, (aSeed.z-.5)*.6);
        p.x += sin(life*6.+aSeed.w*20.)*.14*life;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (.03+aSeed.w*.05)*uScale/-mv.z;
        vCol = vec3(1.,.8,.6)*1.4; vA = uW*uHeat*(1.-life)*smoothstep(0.,.12,life)*.5;
      }`, { uHeat: { value: 0 }, uOrigin: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);

  useEffect(() => () => { motes.g.dispose(); motes.m.dispose(); body.dispose(); floor.dispose(); }, [motes, body, floor]);

  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const beat = near(eventPos('cynodont-endothermy'), 0.9);
    const heat = 0.12 + smoothstep(0.05, 0.8, t) * 0.88;
    body.uniforms.uW.value = w;
    body.uniforms.uK.value = 1.0 + heat * 1.5 + beat * 0.5;
    (body.uniforms.uRim.value as THREE.Color).copy(cold).lerp(hot, smoothstep(0.1, 0.85, heat));
    const x = -1.2 + t * 2.4;
    floor.uniforms.uW.value = w; floor.uniforms.uHeat.value = heat; floor.uniforms.uX.value = x;
    motes.m.uniforms.uW.value = w; motes.m.uniforms.uTime.value = time; motes.m.uniforms.uScale.value = pointScale(state);
    motes.m.uniforms.uHeat.value = smoothstep(0.15, 0.7, t);
    (motes.m.uniforms.uOrigin.value as THREE.Vector3).set(x - 0.1, -0.5, -1);

    const c = cyno.current!;
    c.position.set(x, -0.45 + Math.abs(Math.sin(x * 6)) * 0.02, -1);
    c.scale.setScalar(1.75);
    for (let i = 0; i < 4; i++) { const l = legs.current[i]; if (l) l.rotation.z = Math.sin(x * 6 + (i % 2) * Math.PI + (i > 1 ? 1.1 : 0)) * 0.42; }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.92, -6]} material={floor}><planeGeometry args={[60, 30]} /></mesh>
      <group ref={cyno}><Critter mat={body} shape={SHAPES.cyno} legRefs={legs} /></group>
      <points geometry={motes.g} material={motes.m} frustumCulled={false} />
    </group>
  );
}
