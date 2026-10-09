import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, range, rng, smoothstep } from '../../world/util';
import { ambientTime } from './common';

const HALF = 0.62; // cone half-angle (rad), ~35deg
const EYE_X = 0.42;
const CONE_LEN = 15;

const CONE_V = /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
const CONE_F = /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform vec3 uCol; uniform float uOp;
void main(){
  float f = pow(1.-abs(dot(normalize(vN),normalize(vV))),1.4);
  float along = smoothstep(0.,1.5,-vP.z)*(1.-smoothstep(5.,${CONE_LEN.toFixed(1)},-vP.z));
  float a = (.025+f*.32)*along*uOp;
  gl_FragColor = vec4(uCol*a, a);
}`;

const PTS_V = /* glsl */ `
attribute float aS;
uniform vec3 uEL, uER, uAL, uAR; uniform float uCos, uReveal, uOp, uTime, uPulse;
varying vec3 vC; varying float vA;
void main(){
  vec3 p = position; p.y += sin(uTime*.5+aS*30.)*.05;
  bool inL = dot(normalize(p-uEL),uAL) > uCos;
  bool inR = dot(normalize(p-uER),uAR) > uCos;
  float depth = clamp(length(p-.5*(uEL+uER))/14.,0.,1.);
  vec3 col; float a;
  if(inL&&inR){ // seen by both eyes: this is where depth is read, so this is where the light is
    col = vec3(1.7,1.7,1.65)*mix(1., 1.-depth*.8, uReveal)*(1.+uPulse*.5); a = .95; }
  else if(inL||inR){ col = vec3(.5,.62,.85); a = .16; }
  else { col = vec3(.4,.45,.55); a = .035; }
  vC = col; vA = a*uOp;
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_PointSize = (a>.5? 3.2: 2.0)*(1.+aS*1.1)*60./ -mv.z * .22;
  gl_Position = projectionMatrix*mv;
}`;
const PTS_F = /* glsl */ `varying vec3 vC; varying float vA;
void main(){ vec2 c=gl_PointCoord-.5; float g=smoothstep(.5,.0,length(c)); gl_FragColor=vec4(vC*g*vA, g*vA); }`;

export default function Stereo() {
  const scene = useScene();
  const coneL = useRef<THREE.Mesh>(null);
  const coneR = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const target = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ptsMat = useRef<THREE.ShaderMaterial>(null);
  const cmL = useRef<THREE.ShaderMaterial>(null);
  const cmR = useRef<THREE.ShaderMaterial>(null);

  const coneGeo = useMemo(() => {
    const r = CONE_LEN * Math.tan(HALF);
    const g = new THREE.ConeGeometry(r, CONE_LEN, 56, 1, true);
    g.translate(0, -CONE_LEN / 2, 0);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const ptsGeo = useMemo(() => {
    const n = Math.floor(1500 * world.quality);
    const r = rng(11);
    const pos = new Float32Array(n * 3);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // a forest of vertical twigs/branches in front of the head
      const z = -1.5 - Math.pow(r(), 0.8) * 14;
      const spread = 3 + -z * 0.9;
      const clump = Math.floor(r() * 40);
      const cx = (rng(clump + 5)() - 0.5) * 2 * spread;
      const x = r() < 0.55 ? cx + (r() - 0.5) * 1.2 : (r() - 0.5) * 2 * spread;
      const y = (r() - 0.5) * 0.5 + (r() < 0.3 ? (r() - 0.5) * 5 : 0);
      pos.set([x, y, z], i * 3);
      s[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    return g;
  }, []);
  useEffect(() => () => { coneGeo.dispose(); ptsGeo.dispose(); }, [coneGeo, ptsGeo]);

  const tmp = useMemo(() => ({ aL: new THREE.Vector3(), aR: new THREE.Vector3(), eL: new THREE.Vector3(), eR: new THREE.Vector3() }), []);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight;
    const t = scene.t;
    const tm = ambientTime();
    const beat = near(eventPos('forward-eyes-visual-cortex'), 0.7);
    // eyes rotate from lateral to forward
    const conv = smoothstep(0.12, 0.62, t);
    const ang = lerp(1.15, 0.13, conv);
    const reveal = smoothstep(0.5, 0.8, t);
    const { aL, aR, eL, eR } = tmp;
    eL.set(-EYE_X, 0, 0); eR.set(EYE_X, 0, 0);
    aL.set(-Math.sin(ang), 0, -Math.cos(ang)); // left eye looks left of centre (ang>0 = outward)
    aR.set(Math.sin(ang), 0, -Math.cos(ang));
    if (coneL.current) coneL.current.rotation.y = ang;
    if (coneR.current) coneR.current.rotation.y = -ang;
    coneL.current?.position.copy(eL);
    coneR.current?.position.copy(eR);
    for (const m of [cmL.current, cmR.current]) if (m) m.uniforms.uOp.value = w * (0.8 + beat * 0.6);
    const pm = ptsMat.current;
    if (pm) {
      const u = pm.uniforms;
      u.uEL.value.copy(eL); u.uER.value.copy(eR); u.uAL.value.copy(aL); u.uAR.value.copy(aR);
      u.uCos.value = Math.cos(HALF); u.uReveal.value = reveal; u.uOp.value = w; u.uTime.value = tm;
      u.uPulse.value = beat;
    }
    const fuse = smoothstep(0.35, 0.7, t);
    if (target.current) {
      target.current.scale.setScalar(0.25 + fuse * 0.2 + beat * 0.15);
      (target.current.material as THREE.MeshBasicMaterial).opacity = w;
    }
    if (ring.current) {
      const k = (t * 3) % 1;
      ring.current.scale.setScalar(0.4 + k * 3);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = w * fuse * (1 - k) * 0.8;
    }
    const eyeS = 0.09;
    if (eyeL.current) { eyeL.current.position.copy(eL); eyeL.current.scale.setScalar(eyeS); }
    if (eyeR.current) { eyeR.current.position.copy(eR); eyeR.current.scale.setScalar(eyeS); }
  });

  return (
    <group>
      {/* head */}
      <mesh position={[0, 0, 0.55]} scale={[0.95, 0.5, 0.9]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#010102" />
      </mesh>
      <mesh ref={eyeL}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={[3, 3, 2.4]} toneMapped={false} /></mesh>
      <mesh ref={eyeR}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={[3, 3, 2.4]} toneMapped={false} /></mesh>
      <mesh ref={coneL} geometry={coneGeo} renderOrder={3}>
        <shaderMaterial ref={cmL} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
          vertexShader={CONE_V} fragmentShader={CONE_F} uniforms={{ uCol: { value: new THREE.Color(0.55, 0.8, 1.4) }, uOp: { value: 0 } }} />
      </mesh>
      <mesh ref={coneR} geometry={coneGeo} renderOrder={3}>
        <shaderMaterial ref={cmR} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
          vertexShader={CONE_V} fragmentShader={CONE_F} uniforms={{ uCol: { value: new THREE.Color(1.4, 0.85, 0.6) }, uOp: { value: 0 } }} />
      </mesh>
      <points geometry={ptsGeo} renderOrder={2}>
        <shaderMaterial ref={ptsMat} transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={PTS_V} fragmentShader={PTS_F}
          uniforms={{
            uEL: { value: new THREE.Vector3() }, uER: { value: new THREE.Vector3() }, uAL: { value: new THREE.Vector3() }, uAR: { value: new THREE.Vector3() },
            uCos: { value: 1 }, uReveal: { value: 0 }, uOp: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 },
          }} />
      </points>
      <mesh ref={target} position={[0, 0, -6]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color={[2.8, 2.6, 2.2]} toneMapped={false} transparent />
      </mesh>
      <mesh ref={ring} position={[0, 0, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color={[1.6, 1.5, 1.3]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export const stereoCamera = (t: number) => ({
  pos: [lerp(5, 0.5, range(0, 1, t)), lerp(7, 10, smoothstep(0, 1, t)), lerp(9, 6, t)] as [number, number, number],
  look: [0, 0, -5] as [number, number, number],
  fov: 55,
});
