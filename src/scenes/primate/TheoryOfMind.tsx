import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { lerp, smoothstep } from '../../world/util';
import { Primate, ambientTime, fruitMaterial, neutral, reach } from './common';
import type { CreatureHandle } from './common';

const A_X = -2.1, B_X = 3.2, WALL_X = 1.3, FRUIT_X = -0.4;

const BUBBLE_F = /* glsl */ `varying vec2 vUv; uniform vec3 uCol; uniform float uI, uTime;
void main(){ float d=length(vUv-.5)*2.; float edge=smoothstep(.9,.97,d)*smoothstep(1.,.97,d);
  float fill=smoothstep(1.,.0,d)*.05; float g=edge*.75+fill+pow(smoothstep(1.,.6,d),2.)*.02;
  g *= .85+.15*sin(uTime*1.5);
  gl_FragColor=vec4(uCol*g*uI, g*uI*.9); }`;
const BUBBLE_V = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

function Bubble({ meshRef, col }: { meshRef: React.RefObject<THREE.Mesh | null>; col: [number, number, number] }) {
  const u = useMemo(() => ({ uCol: { value: new THREE.Color(...col) }, uI: { value: 0 }, uTime: { value: 0 } }), [col]);
  return (
    <mesh ref={meshRef} renderOrder={6}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={BUBBLE_V} fragmentShader={BUBBLE_F} uniforms={u} />
    </mesh>
  );
}

export default function TheoryOfMind() {
  const scene = useScene();
  const hA = useRef<CreatureHandle>(null);
  const hB = useRef<CreatureHandle>(null);
  const fruitMat = useMemo(() => fruitMaterial(), []);
  const wallEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1, 2.4, 1.6)), []);
  const wallMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 0.55, 0.8), toneMapped: false, transparent: true }), []);
  const gA = useRef<THREE.Group>(null);
  const gB = useRef<THREE.Group>(null);
  const fruit = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  const bubble = useRef<THREE.Mesh>(null);
  const bubble2 = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Group>(null);
  const mini = useRef<THREE.Group>(null);
  const miniCone = useRef<THREE.Mesh>(null);
  const miniFruit = useRef<THREE.Mesh>(null);
  const miniMarks = useRef<THREE.Group>(null);
  const wall = useRef<THREE.Mesh>(null);

  const coneGeo = useMemo(() => {
    const len = 1, g = new THREE.ConeGeometry(0.34, len, 28, 1, true);
    g.translate(0, -len / 2, 0); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI); // apex at origin, opening toward -x
    return g;
  }, []);
  useEffect(() => () => { coneGeo.dispose(); wallEdges.dispose(); wallMat.dispose(); fruitMat.dispose(); }, [coneGeo, wallEdges, wallMat, fruitMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = ambientTime();
    const notice = smoothstep(0.05, 0.22, t);
    const think = smoothstep(0.22, 0.45, t);
    const infer = smoothstep(0.45, 0.65, t);
    const act = smoothstep(0.78, 0.95, t);
    const bLook = smoothstep(0.62, 0.8, t); // dominant glances away at the end

    // subordinate A: faces right; notices the fruit, sits up to think (hand to chin), then drops to all fours and sneaks over
    const sitA = think * (1 - act);
    const ax = lerp(A_X, FRUIT_X - 0.95, act);
    const a = hA.current, b = hB.current;
    if (a) {
      const pm = a.state.pm; neutral(pm);
      pm.sit = sitA;
      pm.tilt = -0.15 * sitA;
      const chin = smoothstep(0.3, 0.5, t) * (1 - act);
      reach(pm.hand, 1, a.state.headX + 0.06, a.state.headY - 0.14, 0.1, chin);
      pm.gripL = 0.5; pm.brow = 0.4 + 0.5 * think;
      a.state.headPitch = -0.2 * notice * (1 - think) + 0.1 * think; a.state.alert = 0.3 + 0.5 * notice;
      a.state.crouch = 0.4 * act;
      if (act < 0.01) { a.override.walk = 0; a.override.phase = 0; } else { a.override.walk = undefined; a.override.phase = undefined; }
      a.look.w = w; a.look.splashK = 0.2 + 0.5 * think;
    }
    // dominant B: seated, facing left; glances away at the end
    if (b) {
      const pm = b.state.pm; neutral(pm);
      pm.sit = 1; pm.tilt = -0.05; pm.gripL = pm.gripR = 0.4; pm.brow = 0.1;
      b.state.headYaw = lerp(0, 0.8, bLook); b.state.headPitch = 0.05; b.override.walk = 0; b.override.phase = 0;
      b.look.w = w;
    }
    if (gA.current) { gA.current.position.set(ax, 0, 0.2); gA.current.scale.setScalar(1.5); }
    if (gB.current) { gB.current.position.set(B_X, 0, 0); gB.current.rotation.y = Math.PI; gB.current.scale.setScalar(1.7); }
    wallMat.opacity = w * 0.7;
    fruitMat.uniforms.uW.value = w; fruitMat.uniforms.uGlow.value = 0.25 + 0.25 * Math.sin(tm * 3) + 0.4 * think;

    // fruit: glows, is carried at the end
    if (fruit.current) {
      const carried = smoothstep(0.92, 1, t);
      fruit.current.position.set(lerp(FRUIT_X, ax + 0.9, carried), lerp(0.2, 0.7, carried), 0.2);
      fruit.current.scale.setScalar(0.2 * (1 + 0.04 * Math.sin(tm * 3)));
    }
    // dominant's view cone, stopped by the wall
    if (cone.current) {
      const len = B_X - 0.4 - WALL_X - 0.05;
      cone.current.position.set(B_X - 0.5, 1.9, 0.2);
      cone.current.scale.set(len, 1, 1);
      (cone.current.material as THREE.MeshBasicMaterial).opacity = w * (0.1 + 0.2 * infer) * (1 - bLook);
      cone.current.rotation.y = 0;
    }

    // thought bubbles over A (trail of small bubbles + big halo containing a miniature of the situation)
    const bx = ax + 0.4, by = 4.35;
    const bub = (m: THREE.Mesh | null, x: number, y: number, s: number, k: number) => {
      if (!m) return;
      m.position.set(x, y, 0.5);
      m.scale.setScalar(Math.max(0.0001, s * k));
      m.quaternion.copy(state.camera.quaternion);
      (m.material as THREE.ShaderMaterial).uniforms.uI.value = w * (0.5 + 0.7 * k);
      (m.material as THREE.ShaderMaterial).uniforms.uTime.value = tm;
    };
    bub(bubble.current, bx + 0.7, by, 2.5, think);
    if (trail.current) {
      trail.current.position.set(ax, 0, 0);
      trail.current.children.forEach((c, i) => {
        const m = c as THREE.Mesh;
        const f = smoothstep(0.05 + i * 0.05, 0.2 + i * 0.05, t);
        m.position.set(0.15 + i * 0.22, 2.5 + i * 0.55, 0.5);
        m.scale.setScalar(Math.max(0.0001, (0.16 + i * 0.1) * f));
        m.quaternion.copy(state.camera.quaternion);
        (m.material as THREE.ShaderMaterial).uniforms.uI.value = w * 0.9;
      });
    }
    // miniature: B + wall + fruit + B's cone, inside the bubble
    if (mini.current) {
      mini.current.position.set(bx + 0.7, by, 0.6);
      mini.current.scale.setScalar(0.5 * think);
      mini.current.visible = think > 0.02;
    }
    if (miniCone.current) {
      (miniCone.current.material as THREE.MeshBasicMaterial).opacity = w * (0.1 + 0.25 * infer);
    }
    if (miniFruit.current) {
      (miniFruit.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - 0.8 * infer); // unseen by B in A's model
    }
    if (miniMarks.current) miniMarks.current.scale.setScalar(infer);
    bub(bubble2.current, 0, 0, 0.0001, 0); // reserved (unused)
  });

  return (
    <group>
      <group ref={gA}><Primate ref={hA} preset="primate" rim="#ffddb8" /></group>
      <group ref={gB}><Primate ref={hB} preset="ape" rim="#cfe2ff" palette={{ base: '#4a4440', belly: '#8a8078' }} /></group>
      <mesh ref={fruit} material={fruitMat}>
        <sphereGeometry args={[1, 28, 20]} />
      </mesh>
      <mesh ref={wall} position={[WALL_X, 1.2, 0.2]}>
        <boxGeometry args={[0.1, 2.4, 1.6]} />
        <meshBasicMaterial color={[0.015, 0.02, 0.03]} toneMapped={false} />
      </mesh>
      <lineSegments position={[WALL_X, 1.2, 0.2]} geometry={wallEdges} material={wallMat} />
      <mesh ref={cone} geometry={coneGeo}>
        <meshBasicMaterial color={[0.55, 0.75, 1.3]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Bubble meshRef={bubble} col={[1.0, 1.1, 1.5]} />
      <group ref={trail}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} renderOrder={6}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={BUBBLE_V} fragmentShader={BUBBLE_F}
              uniforms={{ uCol: { value: new THREE.Color(1.0, 1.1, 1.5) }, uI: { value: 0 }, uTime: { value: 0 } }} />
          </mesh>
        ))}
      </group>
      <group ref={mini}>
        {/* the "model of B's mind": B, the wall, the fruit, and what B can/cannot see */}
        <mesh position={[0.4, 0.05, 0]}>
          <boxGeometry args={[0.05, 1.8, 0.1]} />
          <meshBasicMaterial color={[0.7, 0.8, 1.0]} toneMapped={false} />
        </mesh>
        <mesh ref={miniFruit} position={[-1.5, -0.55, 0]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshBasicMaterial color={[3, 0.5, 0.3]} toneMapped={false} transparent />
        </mesh>
        <mesh ref={miniCone} position={[1.1, 0.5, 0]} scale={[1.5, 1.2, 1.2]}>
          <coneGeometry args={[0.55, 1, 20, 1, true]} />
          <meshBasicMaterial color={[0.55, 0.75, 1.3]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
        <group ref={miniMarks} position={[-0.2, 0.4, 0.2]}>
          {/* "?" mark: bar and dot, glowing */}
          <mesh position={[-0.5, 0.55, 0]}><boxGeometry args={[0.12, 0.45, 0.1]} /><meshBasicMaterial color={[2.4, 2.4, 2.1]} toneMapped={false} /></mesh>
          <mesh position={[-0.5, 0.2, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={[2.4, 2.4, 2.1]} toneMapped={false} /></mesh>
        </group>
      </group>
    </group>
  );
}

export const tomCamera = (t: number) => ({
  pos: [lerp(-3.0, -1.4, t), 2.6, 8.2] as [number, number, number],
  look: [-1.8, 2.4, 0] as [number, number, number],
  fov: 50,
});
