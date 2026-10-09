import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Creature } from './Creature';
import type { CreatureHandle } from './Creature';
import type { QuadPresetName } from './quadruped';
import type { BipedPresetName } from './biped';
import { world } from '../../../world/store';

/**
 * Dev-only lineup of every preset. Control from the console: window.__creatureDemo = { walk: 1, phase: 0.3, free: true }
 * (free = phase runs with time). Mount temporarily from any scene, e.g. <CreatureDemo kind="quadruped" />.
 */
const QUADS: QuadPresetName[] = ['shrew', 'cynodont', 'rat', 'primate'];
const BIPS: BipedPresetName[] = ['sahelanthropus', 'lucy', 'erectus', 'sapiens'];

export default function CreatureDemo({ kind = 'quadruped', solo, y = -0.95, z = -1 }: { kind?: 'quadruped' | 'biped'; solo?: string; y?: number; z?: number }) {
  const refs = useRef<(CreatureHandle | null)[]>([]);
  useEffect(() => { (window as unknown as Record<string, unknown>).__creatureDemo ??= { walk: 0, phase: 0, free: false }; }, []);
  useFrame(() => {
    const d = (window as unknown as Record<string, { walk: number; phase: number; free: boolean }>).__creatureDemo;
    if (!d) return;
    refs.current.forEach((h) => { if (h) { h.override.walk = d.walk; h.override.phase = d.free ? world.time * 0.7 : d.phase; } });
  });
  const list: string[] = solo ? [solo] : kind === 'quadruped' ? QUADS : BIPS;
  const quad = kind === 'quadruped';
  const sc = solo ? (quad ? 2.6 : 1.45) : quad ? 0.95 : 1.15;
  const gap = quad ? 2.7 : 2.2;
  return (
    <group position={[0, y, z]}>
      {list.map((p, i) => (
        <group key={p} position={[solo ? 0 : (i - 1.5) * gap - (quad ? 0.3 : 0), 0, 0]} scale={sc}>
          <Creature ref={(h) => { refs.current[i] = h; }} rig={kind} preset={p as QuadPresetName} />
        </group>
      ))}
    </group>
  );
}
