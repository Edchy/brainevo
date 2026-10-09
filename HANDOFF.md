# Handoff: Evolution of the Brain

Read this first, then the docs it points to. It records what exists, what the user wants, what is unverified, and the traps
that cost time. Written at commit `a9aadf1` on branch `style-and-ui-iteration`. `main` holds only the first working version
(`09bb579`) and nothing has been merged back. Do not merge or push without the user asking.

## What it is
A side-scrolling, scroll-driven "journey through evolution", Big Bang to now, ending on the modern brain and AI.
84 events, 9 eras, five "breakthroughs" as a narrative spine. The experience is a single full-screen WebGL canvas
(three.js via react-three-fiber) behind a minimal HTML UI. **Everything is procedural: no downloaded assets.**
Vite + React 19 + TypeScript. Deps: three, @react-three/fiber, drei, postprocessing.

## Run it
```
npm install
npm run dev -- --port 5199      # any port; agents used 5199
npm run build                   # tsc -b && vite build, must stay clean
npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep <path>   # fast check while other work is in flight
```
Default look is `mono`. URL params (all optional): `?style=mono|original|ink|specimen|signal|cartoon|oil`, `?ui=minimal|hud|tidy`,
`?titles=0|1`, `?lab=0|1` (Lab switcher button), `?perf=1` (FPS/GPU/context-loss overlay), `?safe=1` (no post-processing at all),
`?dpr=1` (force pixel ratio), `?adaptive=0` (disable automatic resolution step-down).
Settings persist in localStorage (key `brainevo.settings.v2`); URL params override them. A stale `?lab=0` can hide the Lab button.

## Where things are
| Path | What |
|---|---|
| `src/types.ts`, `src/data/events.*.ts` | `TimelineEvent` schema and the 84 events (text, dates, tags, audio transcripts). Merged and sorted by `yearsAgo` in `src/data/index.ts`. |
| `src/lib/` | layout (non-linear log spacing, `focusX`), eras, smooth scroll (`useSmoothScroll`), breakthroughs. |
| `src/components/`, `src/App.tsx`, `src/index.css` | HTML UI: Caption, Axis, Menu, sheet, Track/cards, Minimap, LabPanel. Three variants via `data-ui`. |
| `src/world/` | The engine. `store.ts` (mutable scroll state `world.stationF`), `Stage.tsx` (Canvas, scene blending, camera/bloom/background blending, `PostFX`, adaptive DPR), `PerfHud.tsx`, `sprite.ts`. |
| `src/scenes/<group>/` | 65 scenes in 7 groups (cosmic, life, vertebrate, mammal, primate, hominin, human), registered in `src/scenes/index.ts`. |
| `src/scenes/shared/creatures/` | SDF-raymarched creature toolkit: quadruped, biped, primate, aquatic rigs. See its `README.md`. |
| `src/scenes/shared/brain/` | The shared anatomical brain (stages tube to human, glass/holo/cutaway looks, activity regions). See its `README.md`. |
| `src/style/<id>/` | Seven looks, each a global post-process `Effects` plus `theme.css`. `src/style/titles/` is the depth-sandwiched headline layer (`anchors.ts` places titles per scene). |

Docs: `SCENES.md` (engine/scene contract, dev hooks), `STYLE.md` (style system, UI tokens, ownership), `ILLUSTRATION.md` (the quality
bar, colour-splash rules). Project memory note: `~/.claude/projects/-Users-eddietovebeppearonelsa-dev-wip-brainevo/memory/`.

## Core concepts
- `world.stationF` is a continuous index into the sorted events (12.5 = halfway between event 12 and 13; negative = intro; >83 = outro).
  Scrolling writes it; scenes read it inside `useFrame`. Scenes are scrub-reversible, so drive visuals from it, not from elapsed time.
- A scene (`SceneDef`) owns `[from, to]` events plus `lead/tail/fade`; the engine gives it `t` (0..1) and a crossfade `weight`, and blends
  camera pose and mood (bg, bloom) across overlapping scenes. Scenes stay mounted until ~9 stations away and are pre-compiled.
- Style is global post-processing, so scenes must not hard-code a look. The Monochrome grade keeps colour only where the source is strongly
  saturated (a "splash"), so author pure saturated accents sparingly.

## What the user wants (their words, paraphrased)
- Super immersive, cinematic, "the coolest thing ever", not static illustrations.
- Then: **more minimal**, black-and-white dominant, colour as splashes only where it makes sense, "professional and organic", and
  *"when you pause on a screen it must not feel like a first draft"*. They liked the Original's clean black-and-white Big Bang.
- Cleaner UI, headlines that sit between scene layers (done), animals with real anatomy, more detailed illustrations.
- They have not yet chosen a final style. Monochrome is the current direction; the other looks remain in the Lab for comparison.
  Expect to cut the Lab down to one look eventually.

## Testing and verification gotchas (these cost hours)
- The browser tool's tab is **hidden**: `requestAnimationFrame` and `ResizeObserver` stall. A screenshot wakes it. The stage mounts lazily, so
  after navigating: take a screenshot, wait ~8-10s, take another, then use hooks.
- Hooks (dev only): `window.__setF(f|null)` pins the scene position; `window.__tick(n)` renders n frames; `window.__set('style'|'ui'|'titles'|'lab', v)`;
  `window.__world`. **`__setF` pins only the scene, not the HTML caption/headline.** For a true paused still, scroll the real scroller:
  ```js
  const el=document.querySelector('.scroller');
  window.__goF=(f)=>{window.__setF(null);let lo=0,hi=el.scrollWidth-el.clientWidth;for(let i=0;i<30;i++){const m=(lo+hi)/2;el.scrollLeft=m;el.dispatchEvent(new Event('scroll'));if(window.__world.stationF<f)lo=m;else hi=m;}el.scrollLeft=hi;el.dispatchEvent(new Event('scroll'));window.__tick(60);return window.__world.stationF};
  ```
- Use ONE Chrome tab and close it. Several agents each running heavy WebGL tabs froze everything; other agents' hot reloads also reset your page.
- After adding a dependency, restart Vite with `--force` or the page white-screens on a stale optimised-deps cache.
- Editing a hook-bearing file can crash the page via Fast Refresh ("change in the order of Hooks"). A full reload fixes it; it is not a real bug.
- Black-frame detector used to verify the flash fix: step `__setF` in small increments, `__tick(1)`, `readPixels` a grid, flag frames with ~0 brightness.

## Bugs already fixed, do not regress
- **Black flashes:** (1) bloom's luminance pass let a NaN/Inf texel smear across the frame; now scrubbed in `sanitizeBloom` (`Stage.tsx`). (2) The post chain was rebuilt
  every time a scene mounted; `PostFX` is now a memoised component, keep `EffectComposer` out of `World`'s render path. (3) Scenes recompiled on every remount;
  now kept mounted and pre-compiled with `compileAsync`. (4) Adaptive resolution is discrete and downward-only (continuous changes cleared the canvas).
  The user confirmed `?safe=1` made the flash disappear, which located it in post-processing. After the bloom fix my sweep showed 0 dips, but I could not
  observe the user's real display, so **ask the user to confirm** it is gone on their machine.
- **Slow-scroll backward jitter:** wheel axis is locked per gesture and the smoother owns a float position (`useSmoothScroll.ts`). Confirmed by simulation, not by a real trackpad.
- Plain `THREE.PointsMaterial` draws squares: use `roundSprite()` (`src/world/sprite.ts`). Passing a `uniforms` object to JSX `<shaderMaterial>` does not keep the reference.

## Open work, roughly in priority order
1. **Ask the user** whether the flash and the scroll jitter are actually gone.
2. **Performance is unmeasured.** The hidden test tab cannot give real GPU numbers. Phase 2 added heavy shaders (raymarched creatures up to 80 prims, an ~85k-vertex brain,
   a raymarched press, 21-tap oil filter). Have the user run `?perf=1`; profile hominin-savanna, neocortex, cave, canopy, fire, the press, and crossfades that draw up to 5 creatures.
   The creature shader raised its prim limit 32 to 80 (uniform count could fail on very low-limit GPUs). Not re-verified against the quadruped/primate scenes after that merge
   (build is clean).
3. **Brain refinement.** Folds look chaotic (brain-coral/walnut), stem is bulb-like, fish/reptile forms are odd. It appears in ~14 scenes, so it is the highest-leverage fix.
4. **Faces and hands** on hominins/primates (soft, clay-like, no eyelids); seated primates look stocky; tetrapod reads as salamander; lancelet stripes zebra-like.
5. Remaining weak frames the agents reported: crude Earth coastlines/grey globe; press wood toy-like; Neuron/AiMirror impulse reads lavender not electric blue; Egg desaturates
   under mono; hominin Skulls/Tissue/Broca still use an ellipsoid skull ghost; Oldowan has no brain pulse target; Laetoli shows unexplained dark ground blobs; a few
   mid-crossfade frames are busy (about 9.5, 10.5, 66.5, 76.5, 80.5); at ~3.62 the headline overlaps the soup helix (anchor mismatch).
6. **Sources and fact-check (not started).** The text was written by AI agents from general knowledge, with no web access and no citations; only 13 of 84 date labels are hedged.
   The Bennett framework (*A Brief History of Intelligence*, 2023) was reconstructed from memory and the book was never consulted. The schema has no `sources` field.
   Plan: add `sources` per event, run web-enabled fact-check agents, fix or hedge dates, show a "Sources" line in the expanded view, and check breakthrough assignments against the book.
7. Narration audio does not exist (transcripts do; `audio.src` files are missing and the UI shows "coming soon").
8. A few late-sapiens events sort slightly out of chronological order (burial, flutes). Data is untouched since the sort fix.
9. Housekeeping once a look is chosen: delete losing styles and the Lab, dev-only demo hook `?creatures=` in `mammal/Cynodont.tsx`, debug hooks (`__inkDbg`, `__signalSurge`, `__worldRenders`), and old `ImageSlot` if unused.
10. Deployment (Vercel) was never done.

## How the work was run (reusable)
Parallel sub-agents with strict **file ownership** (each told which files it may edit; shared files edited additively), a written contract
(`SCENES.md`/`STYLE.md`/`ILLUSTRATION.md`), and a mandatory screenshot-based verification step. Agents reliably under-report what they did not check; I spot-checked key frames
myself and ran `tsc` + `npm run build` after every merge. Commit after each integrated pass (all commits end with the Co-Authored-By line from the session's attribution rules).
Their self-reports list weak spots honestly: mine them for the next task list.
