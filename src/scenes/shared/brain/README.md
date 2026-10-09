# Shared procedural brain

One reusable, high-resolution displaced-mesh brain (no assets). Every brain in the piece uses it.

```tsx
import { Brain, useBrainCtl, stageGrow } from '../shared/brain';

const brain = useBrainCtl({ grow: stageGrow('human') });          // mutable control object, no React renders
useFrame(() => { brain.alpha = scene.weight; brain.grow = ...; });  // drive it from your scene
<Brain ctl={brain} position={[0,0,0]} scale={1} />                  // +x = front, +y up, +z = left/right
```

Human cerebrum is ~4.1 units long (`ctl.size` or the group `scale` resizes). Lighting is camera-relative; the mesh is opaque
(dithered fade for `alpha`), so it composes with depth and the headline sandwich.

## Anatomy: stages + `grow`
`ctl.grow` 0..1 morphs smoothly through `tube -> fish -> reptile -> mammal -> primate -> hominin -> human`
(`STAGE_NAMES`, `stageGrow('fish')` gives the exact value of a stage). `ctl.shape` overrides any `BrainShape` field on top
(e.g. `{ frontal: 0.9, fold: 0.5, cerS: 1.2, cbS: 0.8 }`, see `params.ts`: tube/tilt, cerebrum axes, fold/ff, fiss/hemi,
temporal/frontal/glob/occ, olfactory bulbs, cerebellum size/folia, tectum, brainstem).
Parts: cerebrum (domain-warped ridged-noise gyri, longitudinal/Sylvian/central fissures, temporal lobe), cerebellum (folia),
brainstem/neural tube (three vesicles at `tube`=1), olfactory bulbs, optic tectum.

## Looks
- `glass` 0..1: translucent shell with fresnel rims; `inner` 0..1 + `nuc.{striatum,thalamus,hippocampus,amygdala}` shows glowing nuclei.
- `holo` 0..1: hologram line art (sulcal network + contour lines), tint with `holoColor`.
- `cut` 1 + `cutAxis` ('sagittal'|'axial'|'coronal') + `cutPos` (-1..1) + `cutFlip`: cutaway with a procedural MRI-style cap
  (white/grey matter, 6-strata ribbon, ventricles, thalamus, putamen). Activity regions show on the cap too. Keep |cutPos| >= ~0.25 for sagittal.
- `explode` 0..1 separates parts vertically; `tint` 0..1 + `tintColors` colours each part (diagram mode).
- `stars` 0..1: constellation of stars + links drawing in over the cortex (`starColor`).

## Activity (colour splash)
`ctl.regions = [{ at: 'broca', color: '#ffa31c', i: 0 }, ...]` (max 8 surface regions; mutate `.i` per frame, values up to ~2).
`at`: 'frontal' | 'prefrontal' | 'motor' | 'sensory' | 'broca' | 'wernicke' | 'parietal' | 'occipital' | 'visual' | 'temporal',
or a unit direction `[x,y,z]` (+ `r`, `sym`, `band`); part regions 'pallium' | 'cerebellum' | 'brainstem' | 'tectum' | 'olfactory'
glow a whole part. Use saturated hues so the mono grade keeps them.

## Files
`Brain.tsx` component + ctl, `params.ts` stage presets/regions, `glsl.ts` shaders, `geometry.ts` cached cube-sphere/lathe/constellation meshes.
Shared geometry is cached module-wide; shader programs are shared across instances. Cost is ~85k-vertex displaced meshes (72 per cube face when `world.quality < 0.6`).
