import * as THREE from 'three';

/**
 * Anatomy "genome" of the procedural brain. Every stage preset is one of these; `grow` interpolates between them.
 * Axes: +x anterior (front), +y up, +z lateral (left/right). Human cerebrum is ~4.1 units long.
 */
export interface BrainShape {
  /** 0 = brainstem/spinal cord, 1 = neural tube with three vesicles */
  tube: number;
  /** brainstem orientation: 0 horizontal (fish) .. 1 hanging down (human) */
  tilt: number;
  stemX: number; stemY: number; stemLen: number; stemR: number; pons: number;
  /** cerebrum half-axes, centre offset and overall scale (0 hides it) */
  cx: number; cy: number; cz: number; cox: number; coy: number; cerS: number;
  /** gyrification 0..1, folding spatial frequency, longitudinal fissure depth, hemisphere separation 0 (fused) .. 1 (two lobes) */
  fold: number; ff: number; fiss: number; hemi: number;
  /** primary sulci (Sylvian/central), temporal lobe bulge, frontal expansion, globular parietal bulge, occipital taper, flat base */
  prim: number; temporal: number; frontal: number; glob: number; occ: number; flat: number;
  /** olfactory bulb scale and length of the olfactory tract */
  olfS: number; olfX: number;
  /** cerebellum scale, fineness of folia (amplitude), folia frequency, position */
  cbS: number; cbFolia: number; cbK: number; cbAt: number; cbx: number; cby: number;
  /** optic tectum (midbrain roof) scale */
  tecS: number;
}

export const STAGE_NAMES = ['tube', 'fish', 'reptile', 'mammal', 'primate', 'hominin', 'human'] as const;
export type StageName = (typeof STAGE_NAMES)[number];

const BASE: BrainShape = {
  tube: 0, tilt: 1, stemX: 0.0, stemY: -0.3, stemLen: 1.45, stemR: 0.24, pons: 1,
  cx: 2.05, cy: 1.2, cz: 1.62, cox: -0.05, coy: 0.3, cerS: 1,
  fold: 1, ff: 3.2, fiss: 0.55, hemi: 0,
  prim: 1, temporal: 1, frontal: 0.85, glob: 1, occ: 0.75, flat: 1,
  olfS: 0.25, olfX: 0,
  cbS: 1, cbFolia: 1, cbK: 34, cbAt: 0.22, cbx: -0.25, cby: 0,
  tecS: 0.18,
};
const mk = (o: Partial<BrainShape>): BrainShape => ({ ...BASE, ...o });

export const STAGES: Record<StageName, BrainShape> = {
  /** neural tube folded into forebrain / midbrain / hindbrain vesicles, no hemispheres yet */
  tube: mk({ tube: 1, tilt: 0, stemX: 2.9, stemY: 0.15, stemLen: 6.0, stemR: 1, pons: 0, cerS: 0, cbS: 0, tecS: 0, olfS: 0, fold: 0, fiss: 0 }),
  /** fish: small paired smooth forebrain lobes, big optic tectum, olfactory bulbs on tracts */
  fish: mk({
    tube: 0, tilt: 0.1, stemX: 1.35, stemY: 0.0, stemLen: 2.9, stemR: 0.36, pons: 0,
    cx: 0.72, cy: 0.52, cz: 0.58, cox: 1.95, coy: 0.12, fold: 0.0, ff: 3, fiss: 0.7, hemi: 1,
    prim: 0, temporal: 0, frontal: 0.5, glob: 0, occ: 0, flat: 0,
    olfS: 1, olfX: 0.7, cbS: 0.62, cbFolia: 0, cbK: 20, cbAt: 0.52, cbx: 0, cby: 0, tecS: 1,
  }),
  /** reptile: small smooth pallium, large tectum, modest cerebellum, long horizontal stem */
  reptile: mk({
    tube: 0, tilt: 0.3, stemX: 1.1, stemY: -0.05, stemLen: 3.0, stemR: 0.38, pons: 0.3,
    cx: 0.95, cy: 0.62, cz: 0.82, cox: 1.35, coy: 0.2, fold: 0.0, ff: 3, fiss: 0.5, hemi: 0.5,
    prim: 0, temporal: 0.15, frontal: 0.45, glob: 0, occ: 0.1, flat: 0.5,
    olfS: 1, olfX: 0.4, cbS: 0.68, cbFolia: 0.2, cbK: 28, cbAt: 0.42, cbx: 0, cby: 0, tecS: 0.8,
  }),
  /** early mammal: smooth neocortex, big olfactory bulbs, folia appear */
  mammal: mk({
    tube: 0, tilt: 0.55, stemX: 0.5, stemY: -0.2, stemLen: 2.9, stemR: 0.34, pons: 0.7,
    cx: 1.4, cy: 0.92, cz: 1.1, cox: 0.7, coy: 0.28, fold: 0.1, ff: 3.5, fiss: 0.38, hemi: 0.12,
    prim: 0.1, temporal: 0.25, frontal: 0.3, glob: 0, occ: 0.4, flat: 0.7,
    olfS: 1, olfX: 0.5, cbS: 0.82, cbFolia: 0.6, cbK: 36, cbAt: 0.3, cbx: -0.1, cby: 0, tecS: 0.35,
  }),
  /** primate: gyri increasing, big frontal */
  primate: mk({
    tube: 0, tilt: 0.8, stemX: 0.3, stemY: -0.3, stemLen: 2.4, stemR: 0.32, pons: 0.9,
    cx: 1.8, cy: 1.08, cz: 1.38, cox: 0.15, coy: 0.3, fold: 0.58, ff: 3.3, fiss: 0.5,
    prim: 0.8, temporal: 0.8, frontal: 0.6, glob: 0.2, occ: 0.55, flat: 0.9,
    olfS: 0.45, olfX: 0.1, cbS: 0.95, cbFolia: 0.85, cbK: 34, cbAt: 0.25, cbx: -0.2, cby: 0, tecS: 0.2,
  }),
  /** hominin: large, elongated, strongly folded */
  hominin: mk({
    tube: 0, tilt: 0.95, stemX: 0.15, stemY: -0.34, stemLen: 2.2, stemR: 0.3, pons: 1,
    cx: 2.05, cy: 1.14, cz: 1.5, cox: -0.02, coy: 0.3, fold: 0.85, ff: 3.5, fiss: 0.55,
    prim: 1, temporal: 0.95, frontal: 0.7, glob: 0.3, occ: 1.0, flat: 1,
    olfS: 0.3, cbS: 1, cbFolia: 1, cbK: 34,
  }),
  /** modern human: globular, full gyrification */
  human: mk({}),
};

export function stageIndex(name: StageName): number { return STAGE_NAMES.indexOf(name); }
/** `grow` value (0..1) that lands exactly on a stage */
export function stageGrow(name: StageName): number { return stageIndex(name) / (STAGE_NAMES.length - 1); }

const KEYS = Object.keys(BASE) as (keyof BrainShape)[];

/** interpolate between stage presets; `grow` 0..1 runs tube -> fish -> reptile -> mammal -> primate -> hominin -> human */
export function shapeAt(grow: number, out: BrainShape): BrainShape {
  const n = STAGE_NAMES.length - 1;
  const g = Math.min(1, Math.max(0, grow)) * n;
  const i = Math.min(n - 1, Math.floor(g));
  const f0 = g - i;
  const f = f0 * f0 * (3 - 2 * f0);
  const a = STAGES[STAGE_NAMES[i]], b = STAGES[STAGE_NAMES[i + 1]];
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * f;
  return out;
}

export type RegionName =
  | 'frontal' | 'prefrontal' | 'motor' | 'sensory' | 'broca' | 'wernicke' | 'parietal' | 'occipital' | 'temporal' | 'visual'
  | 'pallium' | 'cerebellum' | 'brainstem' | 'tectum' | 'olfactory';

/** named locations on the cerebral surface as unit directions (+x front, +y up, +z left); `r` = angular radius, kind 0 blob / 1 band */
export const REGION_DEFS: Record<string, { dir: [number, number, number]; r: number; kind: 0 | 1; sym: boolean }> = {
  frontal: { dir: [0.72, 0.5, 0.0], r: 0.62, kind: 0, sym: true },
  prefrontal: { dir: [0.94, 0.28, 0.0], r: 0.5, kind: 0, sym: true },
  motor: { dir: [0.16, 0.97, 0.0], r: 0.13, kind: 1, sym: true },
  sensory: { dir: [-0.1, 0.97, 0.0], r: 0.12, kind: 1, sym: true },
  broca: { dir: [0.62, 0.1, 0.78], r: 0.26, kind: 0, sym: false },
  wernicke: { dir: [-0.28, 0.12, 0.95], r: 0.28, kind: 0, sym: false },
  parietal: { dir: [-0.42, 0.85, 0.3], r: 0.55, kind: 0, sym: true },
  occipital: { dir: [-0.96, 0.12, 0.0], r: 0.5, kind: 0, sym: true },
  visual: { dir: [-0.98, 0.0, 0.0], r: 0.38, kind: 0, sym: true },
  temporal: { dir: [0.2, -0.55, 0.8], r: 0.5, kind: 0, sym: true },
};

export const PART_REGIONS = ['pallium', 'cerebellum', 'brainstem', 'tectum', 'olfactory'] as const;

export interface BrainRegion {
  /** a RegionName, or an explicit unit direction on the cerebrum */
  at: RegionName | [number, number, number];
  /** angular radius override (radians-ish on the unit sphere) */
  r?: number;
  /** emissive colour (use saturated hues; values > 1 bloom) */
  color: THREE.ColorRepresentation;
  /** 0..~2, animate this per frame */
  i: number;
  /** explicit placement overrides (when `at` is a vector): band across the dorsal arc, and mirrored on both hemispheres */
  band?: boolean;
  sym?: boolean;
}
