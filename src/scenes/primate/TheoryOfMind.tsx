import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { lerp, rng, smoothstep } from '../../world/util';
import { Figure, ambientTime, makePose } from './common';

const A_X = -3.1, B_X = 3.1, WALL_X = 1.2, FRUIT_X = -0.3;

const BUBBLE_F = /* glsl */ `varying vec2 vUv; uniform vec3 uCol; uniform float uI, uTime;
void main(){ float d=length(vUv-.5)*2.; float edge=smoothstep(.9,.97,d)*smoothstep(1.,.97,d);
  float fill=smoothstep(1.,.0,d)*.22; float g=edge*1.3+fill+pow(smoothstep(1.,.6,d),2.)*.05;
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
  const pA = useMemo(makePose, []);
  const pB = useMemo(makePose, []);
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
  const dust = useRef<THREE.Points>(null);

  const coneGeo = useMemo(() => {
    const len = 1, g = new THREE.ConeGeometry(0.34, len, 28, 1, true);
    g.translate(0, -len / 2, 0); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI); // apex at origin, opening toward -x
    return g;
  }, []);
  const dustGeo = useMemo(() => {
    const r = rng(8);
    const n = Math.floor(240 * world.quality);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([(r() - 0.5) * 24, r() * 8 - 0.5, -3 - r() * 8], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  useEffect(() => () => { coneGeo.dispose(); dustGeo.dispose(); }, [coneGeo, dustGeo]);

  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = ambientTime();
    const notice = smoothstep(0.05, 0.22, t);
    const think = smoothstep(0.22, 0.45, t);
    const infer = smoothstep(0.45, 0.65, t);
    const act = smoothstep(0.78, 0.95, t);
    const bLook = smoothstep(0.62, 0.8, t); // dominant glances away at the end

    // subordinate A: faces right; notices fruit, thinks, then sneaks over
    pA.headYaw = 0; pA.headPitch = 0.2 * notice - 0.1 * act;
    pA.lean = 0.1 + 0.25 * act; pA.aL = [-0.2 - 0.9 * act, 0.15, -0.3 - 0.8 * act]; pA.aR = [-0.2, -0.15, -0.3];
    pA.glow = think * 0.8 + infer * 0.4; pA.tail = 0; pA.eye = 1;
    pB.headYaw = lerp(0, -0.7, bLook); pB.lean = 0.05; pB.aL = [0.15, 0.2, -0.2]; pB.aR = [0.15, -0.2, -0.2];
    pB.glow = 0.15; pB.tail = 0;
    const ax = lerp(A_X, FRUIT_X - 0.9, act);
    if (gA.current) { gA.current.position.set(ax, 0, 0.2); gA.current.rotation.y = Math.PI / 2; gA.current.scale.setScalar(1.35); }
    if (gB.current) { gB.current.position.set(B_X, 0, 0); gB.current.rotation.y = -Math.PI / 2; gB.current.scale.setScalar(1.8); }

    // fruit: glows, is carried at the end
    if (fruit.current) {
      const carried = smoothstep(0.92, 1, t);
      fruit.current.position.set(lerp(FRUIT_X, ax + 0.7, carried), lerp(0.28, 0.75, carried), 0.2);
      fruit.current.scale.setScalar(0.26 * (1 + 0.1 * Math.sin(tm * 3)));
      (fruit.current.material as THREE.MeshBasicMaterial).opacity = w;
    }
    if (wall.current) (wall.current.material as THREE.MeshBasicMaterial).opacity = w * 0.95;
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
    bub(bubble.current, bx + 0.5, by, 3.2, think);
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
      mini.current.position.set(bx + 0.5, by, 0.6);
      mini.current.scale.setScalar(0.62 * think);
      mini.current.visible = think > 0.02;
    }
    if (miniCone.current) {
      (miniCone.current.material as THREE.MeshBasicMaterial).opacity = w * (0.2 + 0.4 * infer);
    }
    if (miniFruit.current) {
      (miniFruit.current.material as THREE.MeshBasicMaterial).opacity = w * (1 - 0.8 * infer); // unseen by B in A's model
    }
    if (miniMarks.current) miniMarks.current.scale.setScalar(infer);
    bub(bubble2.current, 0, 0, 0.0001, 0); // reserved (unused)
    if (dust.current) (dust.current.material as THREE.PointsMaterial).opacity = w * 0.5;
  });

  return (
    <group>
      <group ref={gA}><Figure tail={false} pose={pA} base="#0a0807" rim="#ffb86a" rimGlow={2.6} /></group>
      <group ref={gB}><Figure tail={false} pose={pB} base="#070a0d" rim="#8fc8ff" rimGlow={2.4} eyeColor="#cfeaff" /></group>
      <mesh ref={fruit}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={[3, 0.5, 0.3]} toneMapped={false} transparent />
      </mesh>
      <mesh ref={wall} position={[WALL_X, 1.2, 0.2]}>
        <boxGeometry args={[0.25, 2.4, 1.6]} />
        <meshBasicMaterial color={[0.25, 0.35, 0.55]} toneMapped={false} transparent />
      </mesh>
      <mesh position={[WALL_X, 1.2, 0.2]}>
        <boxGeometry args={[0.28, 2.43, 1.63]} />
        <meshBasicMaterial color={[0.25, 0.5, 0.9]} wireframe toneMapped={false} transparent opacity={0.8} />
      </mesh>
      <mesh ref={cone} geometry={coneGeo}>
        <meshBasicMaterial color={[0.5, 1.1, 2]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Bubble meshRef={bubble} col={[0.9, 1.2, 2]} />
      <group ref={trail}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} renderOrder={6}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={BUBBLE_V} fragmentShader={BUBBLE_F}
              uniforms={{ uCol: { value: new THREE.Color(0.9, 1.2, 2) }, uI: { value: 0 }, uTime: { value: 0 } }} />
          </mesh>
        ))}
      </group>
      <group ref={mini}>
        {/* the "model of B's mind": B, the wall, the fruit, and what B can/cannot see */}
        <mesh position={[3.2 * 0.3 + 0.4, 0.2, 0]}>
          <capsuleGeometry args={[0.35, 0.8, 4, 10]} />
          <meshBasicMaterial color={[0.4, 0.8, 1.6]} toneMapped={false} />
        </mesh>
        <mesh position={[0.4, 0.05, 0]}>
          <boxGeometry args={[0.2, 1.8, 0.5]} />
          <meshBasicMaterial color={[0.7, 0.8, 1]} toneMapped={false} />
        </mesh>
        <mesh ref={miniFruit} position={[-1.5, -0.55, 0]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshBasicMaterial color={[3, 0.5, 0.3]} toneMapped={false} transparent />
        </mesh>
        <mesh ref={miniCone} position={[1.1, 0.5, 0]} scale={[1.5, 1.2, 1.2]}>
          <coneGeometry args={[0.55, 1, 20, 1, true]} />
          <meshBasicMaterial color={[0.5, 1.1, 2]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
        <group ref={miniMarks} position={[-0.2, 0.4, 0.2]}>
          {/* "?" mark: bar and dot, glowing */}
          <mesh position={[-0.5, 0.55, 0]}><boxGeometry args={[0.12, 0.45, 0.1]} /><meshBasicMaterial color={[2.5, 2.5, 1.4]} toneMapped={false} /></mesh>
          <mesh position={[-0.5, 0.2, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={[2.5, 2.5, 1.4]} toneMapped={false} /></mesh>
        </group>
      </group>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial color="#05080a" />
      </mesh>
      <points ref={dust} geometry={dustGeo}>
        <pointsMaterial size={0.09} color="#9fb8d8" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

export const tomCamera = (t: number) => ({
  pos: [lerp(-1.2, 0.6, t), 2.6, 8.2] as [number, number, number],
  look: [0, 2.4, 0] as [number, number, number],
  fov: 50,
});
