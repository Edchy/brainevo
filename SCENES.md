# Immersive scene system

The timeline is not a slideshow. A single full-screen WebGL canvas (three.js via react-three-fiber, with bloom)
sits behind the HTML event cards. As the user scrolls through time the world *plays*: the Big Bang detonates,
stars ignite, cells swim, neurons fire. Everything is **procedural** (shaders, particles, instancing, maths).
No image/model/audio downloads. Make it the coolest thing anyone has seen in a browser.

## Mental model
- Scroll position is mapped to `world.stationF`, a continuous index into the sorted events
  (`npx tsx scripts/list-events.ts` prints them with indices). 12.0 = exactly on event #12, 12.5 = halfway to #13.
  Negative = intro screen, > 83 = outro.
- A **scene** (`SceneDef`, see `src/world/types.ts`) owns a window of events `[from, to]` (+ `lead`/`tail` stations)
  and gets `t` (0..1 progress through its window) and `weight` (0..1 crossfade) via `useScene()`.
- Scenes are scrubbed both directions. Drive visuals from `t`/`stationF`, NOT from elapsed time, so scrolling back
  rewinds the story. Small ambient shimmer from `world.time` is fine (skip it if `world.reduced`).
- Use `near(eventPos('some-event-id'), width)` (src/world/util.ts) for a beat locked to a specific event
  (1 when the viewer is exactly on that event). Each important event deserves a visible *moment*.
- The engine blends camera pose (`camera(t)`), background and bloom (`mood(t)`) across overlapping scenes by weight.
  Do not touch `state.camera` yourself; return poses from `camera(t)`.
- Hand-offs: the engine trims neighbouring scenes' *visibility* windows so each hand-off is one short crossfade centred
  between them, and the frame dips through dark at its midpoint (`world.overlap`, `src/world/Dip.tsx`). `t` still runs over
  your full `[from-lead, to+tail]` window. Set `layer: true` on a scene that continues the previous shot (it then plays over
  its predecessor with no trim and no dip; used by first-stars and planet).
- Overlapping scenes crossfade: your scene must look right at any weight. Fade with `weight` (opacity uniform, scale,
  emissive intensity). Hidden scenes (weight 0) are `group.visible=false`, but their useFrame still runs: early-return
  when `!scene.active`.

## Contract
```tsx
// src/scenes/<group>/MyScene.tsx
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
export default function MyScene() {
  const scene = useScene();            // stable mutated object: {t, weight, active}
  useFrame((state) => { if (!scene.active) return; /* animate refs/uniforms from scene.t */ });
  return <group>...</group>;
}
// src/scenes/<group>/index.ts
export const xScenes: SceneDef[] = [{ id:'big-bang', from:'big-bang', to:'big-bang', lead:1.5, Component: MyScene,
  camera:(t)=>({pos:[0,0,8-t*3], look:[0,0,0], fov:55}), mood:(t)=>({bg:'#02030a', bloom:1.2}) }];
```
Helpers: `src/world/util.ts` (smoothstep, range, easing, seeded `rng`, `near`, `eventPos`), `world` from
`src/world/store.ts` (`world.quality` particle multiplier, `world.reduced`, `world.velocity` scroll speed which you can use for
streaking/warp/motion-blur-like effects, `world.eraAccent`).

## Craft rules
- Be ambitious and cinematic. Think: custom GLSL ShaderMaterial / drei `shaderMaterial`, GPU particle systems animated in the
  vertex shader from a `uTime`/`uT` uniform, InstancedMesh, noise-driven fluid/nebula/aurora fakes, additive blending,
  fresnel rims, camera dolly/orbit/parallax, depth layers, light shafts, scale shifts (zoom from cosmic to microscopic).
- Bloom: make emissive things *bright* (colour values > 1 with `toneMapped={false}` or additive blending) and use `mood().bloom` (0.4–2.5).
- Every scene needs an **arc**: something changes between t=0 and t=1 and at the key event beats (ignite, erupt, connect, evolve).
  Visual metaphors must be scientifically honest (don't invent facts), but stylised beauty is welcome.
- Performance: target 60fps on a laptop iGPU. Budget ≈ 50–150k particles total on screen, instancing over many meshes,
  no per-frame allocations in useFrame (reuse vectors/colors), dispose geometries you create. Scale counts by `world.quality`.
  Prefer vertex-shader animation over CPU loops for >5k elements.
- Keep the HTML cards usable: they overlay the canvas near the lower-middle of the screen (a ~380px wide panel) with a
  top-of-screen title area and a ~110px minimap at the bottom. Put the hero action where it is visible (screenshot to check),
  e.g. upper-centre, or let it fill the whole screen behind the card.
- Boundaries between groups: your first scene's `mood.bg` at t=0 and your last scene's at t=1 should be near `#03050b`
  so crossfades with neighbours are seamless. Camera poses blend by weight, so keep start/end poses near `pos [0,0,6] look [0,0,0]`.
- TypeScript strict; project uses `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums), `noUnusedLocals`.
- Only edit files in your own `src/scenes/<group>/` folder. Do not edit `src/world`, `src/App.tsx`, `src/data`, or other groups.
  If you hit an engine bug or need an engine feature, note it in your final report (and work around it).

## Verifying (REQUIRED, with real screenshots)
The dev server is already running at http://localhost:5199 (do NOT start another). Use the Chrome tools
(load via ToolSearch: tabs_context_mcp, tabs_create_mcp, navigate, javascript_tool, computer, read_console_messages).
Create your OWN tab. The tab is "hidden" so requestAnimationFrame is throttled; use the dev hooks instead:
`window.__setF(f)` pins the scroll position (station units; pass `null` to release) and `window.__tick(n)` renders n frames.
Typical loop: `__setF(12.3); __tick(40)` then screenshot. Sweep several f values across your whole range (start, each event, in-between,
and the crossfade edges) and look at the images critically: is it beautiful, legible, alive, performant? Iterate until it is.
Also check the console for errors/warnings (shader compile errors are silent otherwise!).
Type-check just your folder: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "src/scenes/<group>"` (other agents are editing concurrently,
so the full build may transiently fail elsewhere).
