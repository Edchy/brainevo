import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { profileBody } from './kit';

export interface CritterShape { tail: number; snout: number; head: number; ear: number; leg: number; fat: number }
export const SHAPES = {
  cyno: { tail: 1.0, snout: 1.15, head: 1.1, ear: 0, leg: 0.75, fat: 0.95 },
  shrew: { tail: 0.8, snout: 1.7, head: 0.8, ear: 0.7, leg: 0.7, fat: 0.9 },
  mammal: { tail: 0.9, snout: 1.05, head: 1.0, ear: 1.0, leg: 0.9, fat: 1.0 },
} satisfies Record<string, CritterShape>;

/** smooth little quadruped facing +x, ~1.6 long: nose-to-tail is ONE continuous surface so the silhouette stays clean. */
export default function Critter({ mat, shape = SHAPES.mammal, legRefs, eyeMat }: { mat: THREE.Material; eyeMat?: THREE.Material; shape?: CritterShape; legRefs?: MutableRefObject<(THREE.Object3D | null)[]> }) {
  const s = shape;
  const geo = useMemo(() => {
    const f = s.fat, T = s.tail, S = s.snout, H = s.head;
    const keys: [number, number, number][] = [
      [-0.5 - 1.6 * T, 0.005, 0.08], [-0.5 - 1.15 * T, 0.018, 0.04], [-0.5 - 0.7 * T, 0.04, 0.01], [-0.62, 0.09, 0.04],
      [-0.45, 0.22 * f, 0.05], [-0.15, 0.27 * f, 0.09], [0.2, 0.26 * f, 0.07], [0.42, 0.17 * f, 0.07],
      [0.56, 0.115, 0.1], [0.68, 0.15 * H, 0.13], [0.82, 0.135 * H, 0.12], [0.82 + 0.2 * S, 0.075 * H, 0.08], [0.82 + 0.4 * S, 0.04 * H, 0.06], [0.82 + 0.5 * S, 0.01, 0.05],
    ];
    const body = profileBody(keys, 1.08);
    const upper = profileBody([[-0.02, 0.0, 0], [0.0, 0.05, 0], [0.07, 0.066, 0], [0.3 * s.leg, 0.036, 0], [0.3 * s.leg + 0.03, 0.0, 0]], 1, 20, 12); upper.rotateZ(-Math.PI / 2);
    const lower = profileBody([[-0.02, 0.0, 0], [0.0, 0.036, 0], [0.1, 0.032, 0], [0.3 * s.leg, 0.02, 0], [0.3 * s.leg + 0.03, 0.0, 0]], 1, 20, 10); lower.rotateZ(-Math.PI / 2);
    const foot = new THREE.SphereGeometry(1, 12, 8); foot.scale(0.07, 0.022, 0.034);
    const ear = s.ear > 0 ? new THREE.SphereGeometry(1, 14, 10) : null;
    ear?.scale(0.07 * s.ear, 0.13 * s.ear, 0.04 * s.ear);
    return { body, upper, lower, ear, foot };
  }, [s]);
  useEffect(() => () => { Object.values(geo).forEach((g) => g?.dispose()); }, [geo]);
  const legs: [number, number][] = [[0.34, 1], [0.34, -1], [-0.42, 1], [-0.42, -1]];
  return (
    <group>
      <mesh geometry={geo.body} material={mat} />
      {eyeMat && [-1, 1].map((sd) => <mesh key={`e${sd}`} material={eyeMat} position={[0.74, 0.17, sd * 0.125 * s.head]} scale={s.head}><sphereGeometry args={[0.022, 10, 8]} /></mesh>)}
      {geo.ear && [-1, 1].map((sd) => <mesh key={sd} geometry={geo.ear!} material={mat} position={[0.62, 0.3 * s.head, sd * 0.1]} rotation={[sd * 0.3, 0, -0.25]} />)}
      {legs.map(([x, sd], i) => (
        <group key={i} position={[x, -0.2, sd * 0.15]} ref={(o) => { if (legRefs) legRefs.current[i] = o; }}>
          <mesh geometry={geo.upper} material={mat} />
          <group position={[0, -0.28 * s.leg, 0]} rotation={[0, 0, 0.4]}><mesh geometry={geo.lower} material={mat} /><mesh geometry={geo.foot} material={mat} position={[0.04, -0.3 * s.leg - 0.01, 0]} rotation={[0, 0, -0.4]} /></group>
        </group>
      ))}
    </group>
  );
}
