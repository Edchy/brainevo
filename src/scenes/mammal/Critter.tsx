import { useCallback } from 'react';
import type { MutableRefObject, Ref } from 'react';
import * as THREE from 'three';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';
import type { QuadParams, QuadPresetName } from '../shared/creatures/quadruped';
import { QUAD_PRESETS } from '../shared/creatures/quadruped';

/** which animal, plus how it sits in the legacy scene frames (origin = old body centre, facing +x) */
export interface CritterShape {
  preset: QuadPresetName;
  params?: Partial<QuadParams>;
  /** uniform scale relative to the old capsule critter so existing call-site scales keep working */
  scale: number;
  /** distance from the old origin down to where the feet stand */
  ground: number;
}
export const SHAPES = {
  cyno: { preset: 'cynodont', scale: 1.3, ground: 0.635 },
  shrew: { preset: 'shrew', scale: 1.85, ground: 0.606 },
  mammal: { preset: 'rat', scale: 1.35, ground: 0.72 },
} satisfies Record<string, CritterShape>;

interface Props {
  /** legacy silhouette material: only its uniforms are read (uW weight, uK rim strength, uRim rim colour) */
  mat?: THREE.Material;
  /** legacy eye material: its (HDR) colour becomes the eye's accent glow */
  eyeMat?: THREE.Material;
  shape?: CritterShape;
  /** gait amount 0..1 (omit = automatic from the group's motion along +x) */
  walk?: number;
  /** head tracking target in world space */
  lookAt?: THREE.Vector3 | null;
  /** 0..1 alert posture */
  alert?: number;
  /** ignored (kept so old call sites compile): legs are IK-driven now */
  legRefs?: MutableRefObject<(THREE.Object3D | null)[]>;
  handleRef?: Ref<CreatureHandle>;
}

const _c = new THREE.Color();
/** smooth little quadruped facing +x on the new procedural creature toolkit (src/scenes/shared/creatures). */
export default function Critter({ mat, eyeMat, shape = SHAPES.mammal, walk, lookAt, alert = 0, handleRef }: Props) {
  const sync = useCallback((c: CreatureHandle) => {
    const u = (mat as THREE.ShaderMaterial | undefined)?.uniforms;
    if (u) {
      if (u.uW) c.look.w = u.uW.value as number;
      if (u.uK) c.look.rimK = 0.95 * (u.uK.value as number);
      if (u.uRim) c.palette.rim = '#' + (u.uRim.value as THREE.Color).getHexString();
    }
    const ec = (eyeMat as THREE.MeshBasicMaterial | undefined)?.color;
    if (ec) {
      const m = Math.max(ec.r, ec.g, ec.b, 1e-4);
      _c.copy(ec).multiplyScalar(1 / m);
      c.palette.splash = '#' + _c.getHexString();
      c.look.splashK = Math.min(1, m / 2.2) * 0.045;
    }
    c.state.alert = alert;
  }, [mat, eyeMat, alert]);
  const P = QUAD_PRESETS[shape.preset];
  void P;
  return (
    <group scale={shape.scale} position={[0, -shape.ground * shape.scale, 0]}>
      <Creature ref={handleRef} rig="quadruped" preset={shape.preset} params={shape.params} walk={walk} lookAt={lookAt} onBeforeDraw={sync} />
    </group>
  );
}
