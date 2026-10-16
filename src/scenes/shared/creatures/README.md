# Procedural creature toolkit

Raymarched, smooth-blended organic animals and hominins. No assets, no meshes: each creature is a bag of <= 32
tapered capsules ("round cones") that a small rig re-poses every frame, and a fragment shader sphere-traces their
smooth union inside a tight bounding box. Anatomy blends (haunch into belly into ribcage into neck into skull), legs are
real thigh/shin/foot chains with IK that plant feet on the ground, fur is an anisotropic strand illusion with a soft
fuzzy silhouette, eyes are moist with a glint, and `gl_FragDepth` is written so creatures depth-sort with everything
else (including the title layer).

```
sdf.ts         PrimSet (the primitive buffer), shader, material factory, palette/look types
rig.ts         2-bone IK, gait cycle (footCycle), RigState (the live controls)
quadruped.ts   QuadParams + presets shrew | cynodont | rat | primate, solveQuad()
biped.ts       BipedParams + presets sahelanthropus | ardipithecus | lucy | habilis | erectus | heidelbergensis | neanderthal | sapiens, solveBiped(), morphBiped()
Creature.tsx   <Creature/> React component (+ CreatureHandle for per-frame control)
CreatureDemo.tsx   dev lineup (see "Demo")
```

## Use

```tsx
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';

const h = useRef<CreatureHandle>(null);
useFrame(() => { h.current!.state.alert = beat; h.current!.look.w = scene.weight; });

<group position={[x, groundY, z]} scale={1.5}>         {/* UNIFORM scale only; feet are at local y = 0, facing +x */}
  <Creature ref={h} rig="quadruped" preset="rat" />      {/* or rig="biped" preset="lucy" */}
</group>
```

Move the parent group along its +x axis and the creature **walks by itself**: the gait phase is the signed distance
travelled divided by the stride length, so feet stay planted, speed up/slow down with the scroll, and run backwards when you
scrub back. `walk` (0..1) is derived from speed. Override with props `walk`, `phase` (cycles) or imperatively with
`handle.override = { walk: 1, phase: 0.3 }`. Ambient motion (breathing, tail sway, ear twitch, sniffing) uses `world.time`.

### Props

| prop | meaning |
|---|---|
| `rig` | `'quadruped'` (default) or `'biped'` |
| `preset` | quadruped: `shrew`, `cynodont`, `rat`, `primate`. biped: `sahelanthropus`, `ardipithecus`, `lucy`, `habilis`, `erectus`, `heidelbergensis`, `neanderthal`, `sapiens` |
| `params` | partial override of any `QuadParams` / `BipedParams` field (lengths, radii, digitigrade, ear size, tail, gait...) |
| `palette` | `{ base, belly, rim, skin, splash, key, bone }` CSS colours. `splash` is the optional accent for eyes/embers |
| `look` | `{ rimK, rimPow, keyK, amb, fur, furScale, sss, splashK, groundAO, gloss, rimDir, keyDir, w }` (`w` = scene fade weight) |
| `walk`, `phase`, `cadence` | gait overrides (see above) |
| `lookAt` | world-space `Vector3` the head tracks (damped, clamped) |
| `resolution` | `'auto'` (default) or 0.4..1, see Performance |
| `every` | rig update every N rendered frames (2 = half rate) |
| `onBeforeDraw(handle)` | called right before drawing; mutate `handle.look/palette/state` here to avoid frame lag |

`CreatureHandle`: `state` (RigState: `alert, mouth, sniff, headYaw, headPitch, crouch, armsFree, armL, armR`, plus the read-only
outputs `headX/Y/Z`), `look`, `palette`, `override`, `material`.

Light directions are in **view space** (`look.rimDir` xy = where the back-rim comes from on screen, `look.keyDir` = fill from
the camera side), so a creature keeps the same lighting no matter how it is rotated. Defaults: restrained key, strong rim.

### Making a new animal

Copy a preset and change numbers: `quadParams('rat', { tailLen: 1.4, earSize: 0.25, digi: 0.8 })`, or pass `params`.
Key quadruped knobs: `bodyLen, chestR/waistR/hipR, front/hind [upper, lower, foot], digi (0 plantigrade .. 1 digitigrade),
sprawl, ext (leg extension), neck*, skull*, muzzle*, ear*, whisker, tail*, gait/stride/lift/bob/wave`. Biped knobs:
`thigh/shin/foot, arm lengths, cranR, cranElong, brow, prognath, jaw, chin, lean, kneeFlex, gait`.
Units: quadrupeds are ~1 unit of body (rat ~2.4 incl. tail), bipeds are metres.

### Biped rig (hominins)

Up to 88 prims (MAXP; a dev warning fires if a pose overflows): tapered muscled limbs, a trapezius/deltoid shoulder girdle, ribcage + pelvis, a modelled face (cranial vault, brow ridge,
orbits with recessed eyes, cheekbones, nose with alae, lips + mouth line, mandible with chin, ears), hair/beard caps and hands with a
curling thumb and three finger groups; feet have heel, arch, ball, hallux and toes. Facing +x, z+ is the figure's RIGHT (the near side for a
camera on +z). Per-preset knobs: `vault, brow, prognath, jaw, chin, noseL/noseW, cheek, hairy (fur vs skin body), hair, beard, barrel, hallux, arch`...
Gait: heel strike with foot pitch, toe-off, hip yaw, counter-swinging arms; the pelvis drops just enough to keep both stance legs planted.

RigState extras (all optional, biped only):
* `crouch` 0..1 (deep squat), `bend` (extra forward trunk lean), `twist` (shoulder yaw), `headYaw/headPitch`, `mouth`.
* Hands: `hLx/y/z + hLw` (and `hR*`) = wrist IK targets in creature space blended by weight; `gripL/R` 0 open .. 1 fist; `rollL/R` wrist roll;
  `propL/R` = 0 none, 1 cobble, 2 stick, 3 spear, 4 torch, 5 handaxe, 6 hammerstone, 7 core. Outputs `pL*/pR*` (palm/grip centre) and `tL*/tR*` (prop tip).
* Poses: `reach` (+`reachY` hand height) both arms forward, `strike` 0 (down) .. 1 (raised, right arm), `throwK` -1 cocked .. +1 follow-through.
* `carry` 0..1 draws an infant at creature-space anchor `kx,ky,kz` (head direction `kyaw`); hand targets are up to the scene.
* `detail` < 0.5 simplifies the hands (fewer prims) for distant figures.
`handle.params` exposes the live parameters: pass a stable `params={{}}` (private copy) and call `morphBiped(h.params, presetA, presetB, t)` per frame
to change species continuously (Sahelanthropus -> Ardipithecus, Neanderthal -> Denisovan).

## Demo (dev only)

`?creatures=quadruped` (or `biped`, or a single preset name such as `?creatures=lucy`) renders a lineup instead of the
timeline (wired in `src/world/Stage.tsx`, dev builds only). Scroll a little way in so the intro does not cover it. In the console: `window.__creatureDemo = { walk: 1, phase: 0.3, free: false }` (`free: true` = phase runs with time).

## Performance notes

* Per frame CPU: one rig solve (~30 prims, no allocation) + ~6 uniform array uploads. Only runs when the creature is
  actually drawn (`onBeforeRender`), so hidden scenes cost nothing. `every={2}` halves it.
* GPU: a tight per-creature box; per pixel the ray is first tested against each primitive (sphere, then axis segment) to
  build a short list of 5-12 relevant prims and a tight [near, far] span; <=44 steps, early out on miss; one normal, 3-tap AO.
  Whiskers are a separate list drawn as soft sub-pixel lines.
* `resolution: 'auto'` renders natively up to a pixel ratio of ~1.25; above that the SDF is drawn into ONE shared half-float
  buffer at 1.25/dpr and blitted back with colour + depth (cost scales with pixels). On the dev Mac at dpr 2 a full-screen
  cynodont costs ~7 ms GPU in this mode (~17 ms was the first draft). Use `resolution={0.5}` for background creatures.
* Gotchas: **uniform scale only** on the parent group; keep <= 3 large creatures on screen; shaders are compiled once and shared.
* Dev: `window.__creaturesOff = true` disables drawing (A/B GPU cost), `window.__sdfSteps = 24` lowers the step count.

## Aquatic rigs (`aquatic.ts`, `AquaCreature.tsx`)

A second shader and rig set for water animals and early-life forms. Same idea as above (smooth-unioned round cones, sphere
traced in a tight box, `gl_FragDepth` written, low-res blit above dpr 1.25) but built for translucent, patterned, glowing bodies.
Kinds: `lancelet`, `lamprey`, `ostracoderm`, `fish`, `tetrapod` (Tiktaalik-like, IK limbs that plant on the ground),
`anomalocaris`, `trilobite`, `flatworm` (radial disc -> bilateral worm via `state.morph`), `jellyfish`, `sponge` (vase cluster),
`axon` (myelinated or bare, saltatory impulse), `egg` (amniote egg with cutaway), `bacterium` (helical flagella, run/tumble),
`cell` (eukaryote host that engulfs a bacterium), `colony` (Volvox-like), `skull` (synapsid / diapsid fenestrae).

```tsx
import { AquaCreature } from '../shared/creatures/AquaCreature';
import type { AquaHandle } from '../shared/creatures/AquaCreature';
const h = useRef<AquaHandle>(null);
useFrame(() => { const s = h.current!.state; s.phase += dt * 0.6; s.beat = 1; s.sig = (t * 3) % 1; h.current!.look.w = scene.weight; });
<group scale={1.8} rotation={[0.85, 0, 0]}><AquaCreature ref={h} kind="lancelet" params={{ len: 3 }} /></group>
```

Local frame: +x = head/forward, +y up, z lateral; UNIFORM parent scale only. `AquaState` (all optional, per-kind meaning):
`phase` (cycles of swim wave / pulse / gait), `beat` (swim amplitude), `turn`, `mouth` (jaw, grasp, tumble), `land` (tetrapod 0 water .. 1 walking),
`morph` (flatworm disc -> worm; cell: bacterium distance), `net`, `sig` (impulse position 0..1 along the body, -1 = none),
`grow` (appearance / myelin wrap / egg embryo / mitochondria), `aux` (jelly manual contraction 0..1; egg cutaway 0..1; cell bulge).
`handle.look` (`rimK, keyK, amb, trans, glowK, glowFall, sheen, filK, bump, sigW, sigK, eyeK, see, w`), `handle.palette`
(`base, belly, rim, shell, accent, glowA, glowB, key, fil`), `handle.k` (rig knobs e.g. `len, girth, amp, waves`), `handle.netO`
(nerve-net impulse origin + front radius for `net` surfaces).

Materials per primitive: `AM.skin | trans | eye | fin | hard | glow | carve` (carve subtracts everything added before it). Patterns:
`PAT.chevron` (myomeres), `scales` (lattice + per-scale shimmer), `rays` (fin rays fanning from the root), `canals`, `carapace`, `facets`
(compound eye), `bands`, `net` (voronoi nerve net with ripples), `pits` (sponge), `glow` / `cristae` (organ glow with impulse pulses).
Translucent tissue lights internal `glow` organs analytically (notochord, nerve cord, gonads) and `look.see = 1` makes hollow translucent
shells show their contents as real surfaces (cells, colonies). Thin strands (`AquaSet.fil`) are tentacles, cirri, antennae, flagella.
Budget: <= 44 primitives, <= 48 strands. Dev: `window.__aqs` holds the live rigs, `window.__aqSkip = [5]` hides a material id.
