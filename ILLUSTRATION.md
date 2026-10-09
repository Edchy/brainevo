# Illustration bar (phase 2)

User feedback, verbatim: "the animals also look awful with stick figure legs. overall the illustrations need to be a lot
better. they feel like a first draft now. it's cool but it can be a lot better and more detailed. we also don't have to be
100% monochrome. Color splashes can be used where it makes sense." And earlier: minimal, immersive, black-and-white dominant,
"professional and organic", "when you pause on a screen it must not feel like a first draft".

## What "good" means
- Every hero is MODELLED, not a primitive: believable anatomy and proportion, organic transitions (smooth blends, tapered
  forms, subtle asymmetry), fine surface detail that survives pausing (fur/skin/membrane/stone texture, micro-relief, thin
  rim light, soft fresnel, plausible shadowing), eyes/faces/hands that read. No capsules-on-sticks, no floating spheres,
  no clip-art, no grey low-poly.
- Motion is natural: eased, secondary motion (breathing, sway, settle), planted feet, no mechanical loops.
- Composition stays minimal: ONE hero, black negative space, headlines sit top-left (see src/style/titles/anchors.ts) so keep the hero
  centre-right/below-left unless a scene override exists. Detail and minimalism are compatible: few things, each rich.
- DETAIL WITHOUT CLUTTER: add richness to the hero (surface, light, micro-motion), not more objects.

## Colour splashes
The Monochrome grade (src/style/mono) now keeps colour per pixel when the SOURCE is strongly saturated (a coherent area >= ~10px,
emissive, saturation >= ~0.5-0.85; pastels and noisy specks are desaturated). So author ONE deliberate accent per scene only
where it earns it: ember/fire orange, dopamine gold, blood red, ripe-fruit red, bioluminescent cyan, impulse electric-blue,
ochre pigment, lightning blue-white. Everything else stays neutral white/grey light. Pick pure saturated hues (not pastels).
Check under `window.__set('style','mono')` that the accent reads as intentional and elegant.

## Tools
- Creature toolkit: src/scenes/shared/creatures/README.md (SDF raymarched quadruped/biped rigs, IK gait, fur shading, depth-correct).
  Read it fully before using or extending it.
- Rules for scene code: SCENES.md. Look/feel pipeline: STYLE.md. Keep scene ids, windows and the SceneDef contract.
- Perf: <=3 creatures on screen, keep total frame cost sane; scale counts by world.quality. No per-frame allocations.
- Do not edit files outside your ownership list. Other agents are editing neighbouring files right now.

## Verification (REQUIRED)
STYLE.md workflow: ONE Chrome tab of your own, close it at the end. Judge PAUSED stills with the real scroller (the headline and caption
follow the real scroll; `__setF` pins only the scene) under `window.__set('style','mono')`, and glance at 'original'. For each
station in your files: critique honestly as a premium still; iterate until it is genuinely good. Report what remains weak.
