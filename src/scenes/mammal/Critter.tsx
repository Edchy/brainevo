import { useCallback } from 'react';
import type { MutableRefObject, Ref } from 'react';
import * as THREE from 'three';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';
import type { Look, Palette } from '../shared/creatures/sdf';
import type { QuadParams, QuadPresetName } from '../shared/creatures/quadruped';
import { QUAD_PRESETS } from '../shared/creatures/quadruped';

/** which animal, plus how it sits in the legacy scene frames (origin = old body centre, facing +x) */
export interface CritterShape {
  preset: QuadPresetName;
  params?: Partial<QuadParams>;
  look?: Partial<Look>;
  /** coat colours: a warm brown coat keeps a moonlit animal from reading as a pale ghost */
  palette?: Partial<Palette>;
  /** uniform scale relative to the old capsule critter so existing call-site scales keep working */
  scale: number;
  /** distance from the old origin down to where the feet stand */
  ground: number;
}
export const SHAPES = {
  cyno: {
    preset: 'cynodont', scale: 1.3, ground: 0.635,
    // fuller, evenly blended trunk; a real skull (brow bump, ear ridge, bigger eye), vibrissae, a tail that tapers in four steps
    params: { skullR: 0.165, skullLen: 0.38, headDrop: 0.02, muzzleLen: 0.3, muzzleR: 0.09, muzzleTipR: 0.05, jaw: 1.25, eyeR: 0.04, eyeUp: 0.45, eyeFwd: 0.06,
      waistR: 0.178, chestR: 0.175, hipR: 0.185, belly: 0.15, arch: 0.12, wave: 0.012, tailSegs: 4, tailR0: 0.1, tailLen: 1.0, earSize: 0.045, earW: 1.2, whisker: 0 },
    look: { keyK: 1.0, amb: 0.3, rimK: 1.3, fur: 0.5 },
    palette: { base: '#4e3c30', belly: '#7a6650', skin: '#9a7464', key: '#c8bba6' },
  },
  shrew: {
    preset: 'shrew', scale: 1.85, ground: 0.606,
    params: { bodyLen: 0.7, chestR: 0.118, waistR: 0.105, hipR: 0.128, belly: 0.1, earSize: 0.085, whisker: 0.42, tailSegs: 4, tailLen: 0.55, eyeR: 0.021 },
    look: { keyK: 0.95, amb: 0.3, rimK: 1.3, fur: 0.55 },
    palette: { base: '#4a3a30', belly: '#7a6a5a', skin: '#a07c70', key: '#c8bba6' },
  },
  mammal: {
    preset: 'rat', scale: 1.35, ground: 0.72,
    params: { chestR: 0.145, waistR: 0.14, hipR: 0.17, belly: 0.25, eyeR: 0.034, earSize: 0.13, whisker: 0.55, tailSegs: 4 },
    look: { keyK: 1.0, amb: 0.3, rimK: 1.3, fur: 0.6 },
    palette: { base: '#4f4136', belly: '#837260', skin: '#a8847a', key: '#c8bba6' },
  },
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
/** dev: window.__qp = { cyno: {...}, shrew: {...}, mammal: {...} } overrides params live (tuning) */
const dev = (shape: CritterShape): Partial<QuadParams> | undefined => {
  if (!import.meta.env.DEV) return shape.params;
  const w = window as unknown as { __qp?: Record<string, Partial<QuadParams>> };
  const key = shape === SHAPES.cyno ? 'cyno' : shape === SHAPES.shrew ? 'shrew' : 'mammal';
  return w.__qp?.[key] ? { ...shape.params, ...w.__qp[key] } : shape.params;
};
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
      c.look.splashK = Math.min(1, m / 2.2) * 0.2;
    }
    c.state.alert = alert;
  }, [mat, eyeMat, alert]);
  const P = QUAD_PRESETS[shape.preset];
  void P;
  return (
    <group scale={shape.scale} position={[0, -shape.ground * shape.scale, 0]}>
      <Creature ref={handleRef} rig="quadruped" preset={shape.preset} params={dev(shape)} look={shape.look} palette={shape.palette} walk={walk} lookAt={lookAt} onBeforeDraw={sync} />
    </group>
  );
}
