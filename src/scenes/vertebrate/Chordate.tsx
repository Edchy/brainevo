import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
import type { AquaKind } from '../shared/creatures/aquatic';
import { Backdrop, Plankton, TM } from './shared';

const BOX: [number, number, number] = [22, 12, 10];

/** dev lineup hook: window.__aq = { kind, s, rx, land, mouth, aux, ph, ...state } overrides the hero (dev only) */
type Dev = Record<string, number | string | undefined>;
const dev = (): Dev | undefined => (import.meta.env.DEV ? (window as unknown as { __aq?: Dev }).__aq : undefined);

/** Lancelet-like chordate: translucent segmented body, stiff notochord, hollow dorsal nerve cord lit as a bright cyan line. */
export default function Chordate() {
  const scene = useScene();
  const h = useRef<AquaHandle>(null);
  const grp = useRef<import('three').Group>(null);
  const rot = useRef<import('three').Group>(null);
  const [kind, setKind] = useState<AquaKind>('lancelet');
  const pos = eventPos('chordates-notochord-nerve-cord');
  useFrame(() => {
    if (!scene.active) return;
    const a = h.current; if (!a) return;
    const t = scene.t, n = near(pos, 0.9);
    const st = a.state;
    st.phase = t * 7 + TM() * 0.28;
    st.beat = 0.8 + 0.2 * Math.sin(TM() * 0.4);
    // an impulse runs head to tail down the cord
    const cyc = (t * 3.2 + TM() * 0.12) % 1;
    st.sig = cyc * 1.3 - 0.15;
    a.look.glowK = (0.7 + 0.9 * smoothstep(0.1, 0.5, t)) * (1 + n * 0.5);
    a.look.w = scene.weight;
    if (grp.current) grp.current.position.set(0.6 - t * 0.8, -0.2 + Math.sin(TM() * 0.5) * 0.08, 0);
    const d = dev();
    if (d) {
      if (d.kind && d.kind !== kind) setKind(d.kind as AquaKind);
      if (rot.current) { rot.current.scale.setScalar(+(d.s ?? 1.75)); rot.current.rotation.set(+(d.rx ?? 0.85), +(d.ry ?? -0.1), +(d.rz ?? 0.08)); }
      for (const k of ['land', 'morph', 'mouth', 'aux', 'beat', 'net', 'grow', 'turn'] as const) if (d[k] !== undefined) (st as unknown as Record<string, number>)[k] = +d[k]!;
      if (d.ph !== undefined) st.phase = +d.ph;
      if (d.sig !== undefined) st.sig = +d.sig;
    }
  });
  return (
    <group>
      <Backdrop top="#0a4a5c" bottom="#020a14" ray={0.35} />
      <Plankton count={900} box={BOX} color="#6fe9ff" size={0.045} flow={-3} drift={[-0.12, 0.02, 0]} center={[0, 0, -1]} />
      <group ref={grp}>
        <group ref={rot} rotation={[0.85, -0.1, 0.08]} scale={1.75}>
          <AquaCreature ref={h} kind={kind} />
        </group>
      </group>
    </group>
  );
}
