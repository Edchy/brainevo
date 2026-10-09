import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { eventPos, near, range, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import { Backdrop, Plankton } from './shared';
import type * as THREE from 'three';

const BOX: [number, number, number] = [22, 10, 6];
const N = 9, L = 12, DX = L / N, AY = 1.0, BY = -1.8;

/** zoomed axon: myelin internodes wrap, the impulse leaps node to node (saltatory conduction) racing a bare axon below */
export default function Myelin() {
  const scene = useScene();
  const a = useRef<AquaHandle>(null), b = useRef<AquaHandle>(null);
  const ga = useRef<THREE.Group>(null), gb = useRef<THREE.Group>(null);
  const fish = useRef<AquaHandle>(null), gf = useRef<THREE.Group>(null);
  const p21 = eventPos('myelin-jawed-fish');
  useFrame(() => {
    if (!scene.active) return;
    const A = a.current, B = b.current; if (!A || !B) return;
    const w = scene.weight, t = scene.t, n = near(p21, 0.8);
    const wrap = range(0.05, 0.45, t);
    const cyc = (range(0.3, 1, t) * 2.4) % 1;
    const run = range(0.3, 0.34, t);
    const arrive = 1 - smoothstep(0.4, 0.5, cyc);
    const pm = Math.min(1, cyc / 0.4) * (N - 1);
    const k = Math.min(N - 2, Math.floor(pm)), fr = pm - k;
    const leap = smoothstep(0.0, 0.3, fr);
    // node k+1 sits at (k+1)*DX from the left end; the spike hops between nodes
    const sA = ((0.5 + k + leap) * DX) / L;
    A.state.grow = wrap; B.state.grow = 1;
    A.state.sig = run > 0 ? sA : -3; B.state.sig = run > 0 ? cyc * 0.9 : -3;
    A.look.w = w; B.look.w = w;
    A.look.sigK = 5 * run * arrive * (1 + n * 0.6); B.look.sigK = 3.5 * run;
    A.look.glowK = 0.9 + n * 0.5; B.look.glowK = 0.8;
    const F = fish.current;
    if (F) { F.look.w = w * 0.85; F.state.phase = t * 9 + scene.t * 2; F.state.beat = 0.9; }
    if (gf.current) gf.current.position.set(7.0 - t * 6.5, 3.7 + Math.sin(t * 7) * 0.15, -6.0);
    if (ga.current) ga.current.position.set(0, AY, 0);
    if (gb.current) gb.current.position.set(0, BY, 0);
  });
  return (
    <group>
      <Backdrop top="#0d3b3a" bottom="#02070a" ray={0.25} />
      <Plankton count={600} box={BOX} color="#9fe8ff" size={0.035} flow={-2.5} drift={[0.0, 0.03, 0]} center={[0, 0, -1]} />
      <group ref={ga}><AquaCreature ref={a} kind="axon" params={{ len: L, nodes: N, radius: 0.4, myelin: 1, seed: 1.3 }} /></group>
      <group ref={gf}><group scale={1.7} rotation={[0.25, Math.PI, 0]}><AquaCreature ref={fish} kind="fish" resolution={0.6} /></group></group>
      <group ref={gb}><AquaCreature ref={b} kind="axon" params={{ len: L, nodes: N, radius: 0.4, myelin: 0, seed: 4.1, bend: 0.1 }} /></group>
    </group>
  );
}
