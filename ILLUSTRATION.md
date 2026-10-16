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
- Composition stays minimal: ONE hero, dark negative space. The headline and caption form one block at the lower left, so keep
  the hero centre or centre-right and above the bottom third. Detail and minimalism are compatible: few things, each rich.
- DETAIL WITHOUT CLUTTER: add richness to the hero (surface, light, micro-motion), not more objects.

## Colour and the oil pass
The look is now an oil painting in five palettes (STYLE.md). The painting keeps saturated, emissive colour as colour; under
the Grisaille palette only strongly saturated, lit areas keep their hue, so the old rule still holds: author ONE deliberate
accent per scene where it earns it (ember orange, dopamine gold, blood red, ripe-fruit red, bioluminescent cyan, impulse
electric blue, ochre, lightning blue-white) and keep the rest neutral. What the brush does to detail is in SCENES.md
("Painting for the oil pass"): detail below stroke size vanishes, mottling on smooth bright surfaces turns into lumps,
mid-tone colour with gloss and rim light models form best. Check every scene in at least Prussian and Grisaille.

## Tools
- Creature toolkit: src/scenes/shared/creatures/README.md (SDF raymarched quadruped/biped rigs, IK gait, fur shading, depth-correct).
  Read it fully before using or extending it.
- Rules for scene code: SCENES.md. Look/feel pipeline: STYLE.md. Keep scene ids, windows and the SceneDef contract.
- Perf: <=3 creatures on screen, keep total frame cost sane; scale counts by world.quality. No per-frame allocations.
- Do not edit files outside your ownership list. Other agents are editing neighbouring files right now.

## Verification (REQUIRED)
STYLE.md workflow: ONE Chrome tab of your own, close it at the end. Judge PAUSED stills with the real scroller (the headline and caption
follow the real scroll; `__setF` pins only the scene) under `window.__set('palette','prussian')`, and glance at 'grisaille'. For each
station in your files: critique honestly as a premium still; iterate until it is genuinely good. Report what remains weak.
