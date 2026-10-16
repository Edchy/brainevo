# Handoff: Evolution of the Brain

Read this first, then the docs it points to (SCENES.md, STYLE.md, ILLUSTRATION.md, the READMEs in `src/scenes/shared/*`).
State as of 2026-10-16: everything is merged to `main` and deployed on Vercel (see "Deploy").

## What it is
A side-scrolling, scroll-driven journey through evolution, Big Bang to now: 84 events, 9 eras, the five "breakthroughs" of
Max Bennett's *A Brief History of Intelligence* (2023) as the spine. One full-screen WebGL canvas (three.js via
react-three-fiber), painted by an oil-painting pass, behind a minimal HTML reading layer. Everything visual is procedural.
Vite + React 19 + TypeScript. Deps: three, @react-three/fiber, drei, postprocessing.

## Run it
```
npm install
npm run dev -- --port 5199      # any port
npm run build                   # tsc -b && vite build, must stay clean
npx tsx scripts/list-events.ts  # events with their station indices
npx tsx scripts/narration.ts export   # regenerate narration/SCRIPT.md from the data
```
URL params (all optional, they override the saved settings): `?palette=prussian|grisaille|umber|verdigris|oxblood`,
`?brush=fine|full`, `?text=scrim|band|overlay`, `?headline=text|top`, `?titles=0|1`, `?lab=0|1`, `?perf=1` (FPS/GPU overlay),
`?safe=1` (no post-processing), `?dpr=1`, `?adaptive=0`. Settings persist in localStorage `brainevo.settings.v3`.

## Where things are
| Path | What |
|---|---|
| `src/types.ts`, `src/data/events.*.ts` | `TimelineEvent` schema and the 84 events: text, dates, narration transcript, **sources**. |
| `src/lib/` | layout (log spacing, `focusX`), eras, breakthroughs, smooth scroll, date formatting (`fmtWhen`). |
| `src/components/`, `src/App.tsx`, `src/index.css` | Reading layer: Caption (+ Read more sheet), Menu (with Sound), Axis, SoundButton, LabPanel, Track (intro, chapter and breakthrough interstitials, outro). `readingGeometry()` in App is the single source of the layout numbers. |
| `src/world/` | Engine: `store.ts` (`world.stationF`), `Stage.tsx` (Canvas, scene blending, PostFX chain, dev tools), `Dip.tsx`, `Scrim.tsx`, `PerfHud.tsx`. |
| `src/style/` | `oil/` (the paint pass + theme tokens), `palettes.ts`, `store.ts` (settings), `titles/` (depth headlines). |
| `src/audio/` | `engine.ts` (graph, unlock on gesture, ducking), `narration.ts` (auto-play director), `score.ts` (generative music). |
| `src/scenes/<group>/` | 65 scenes in 7 groups; `shared/brain` (anatomical brain, BrainLab), `shared/creatures` (SDF rigs). |
| `narration/` | `SCRIPT.md` (the ElevenLabs script, generated) and `lines.json`. |
| `scripts/narration.ts` | export the script; record missing lines and compose era music through the ElevenLabs API. |

## Core concepts
- `world.stationF` is a continuous index into the sorted events (12.5 = halfway between 12 and 13; negative = intro; >83 = outro).
  Scenes are scrub-reversible: drive visuals from it, not from elapsed time. Engine contract: SCENES.md.
- Post chain: scene -> bloom -> vignette -> dip -> reading shade | oil (own pass) -> depth headline. Why the split matters: STYLE.md.
- Reading layer: the headline is painted into the frame and rests on its own caption (lower left); captions are measured from
  hidden copies so each headline knows its baseline. The text layouts are `scrim` (default), `band`, `overlay`.
- Audio: off until "Begin with sound" or the speaker button (a click or key is required by browsers). Narration auto-plays for
  the event at the focus after a 0.45 s dwell, fades between events, pauses/resumes, does not repeat a clip finished in the last
  45 s, resumes one interrupted in the last minute. Files: `src/assets/narration/<event-id>.mp3` (picked up at build time);
  until they exist the system voice reads the transcript (Lab toggle). Music ducks under the voice.

## What the user wants (their words, paraphrased)
- Earlier: super immersive; then more minimal, black-and-white dominant with colour splashes, "professional and organic", and
  *"when you pause on a screen it must not feel like a first draft"*.
- 2026-10-16: **oil painting** as the look, **minimal** interface. Try a "follo-style" oil painting (word unclear, see open work) and
  a few colour worlds: keep the blue one, add a monochrome one and two or three others (done: five palettes, two brushworks).
- Headlines: keep them **in depth** ("pretty cool"), but they were too big, too screamy, took too much space. Visuals are the focal
  point, text secondary. The explanatory text must be very readable. They were unsure between overlay / separate dark band /
  bottom gradient: all three are in the Lab (default: painted shade = gradient), plus two headline placements.
- Narration from a script they will put into ElevenLabs; it should **play by itself as you slide**, no play button needed, but
  pausable; a fluent experience. Also a cool cinematic soundtrack. Scrolling a little slower (done: wheel gain 0.8, longer glide).

## Session 2026-10-16 (what changed)
- Oil only: deleted the six other styles and the HUD/tidy UIs; palettes and brushwork as live uniforms; oil in its own pass.
- Reading layer redesign (headline ~6% of frame height, rests on the caption; EB Garamond caption with an italic gilt date);
  only lit geometry occludes the headline; headline plane at 0.7 x focal distance; scroll-driven fade on interstitials.
- Audio system and generative score; ElevenLabs tooling; dev silent mode.
- Fact-check of all 84 events: every event has verified sources (DOIs resolved against Crossref by title, web pages fetched
  with HTTP 200 on 2026-10-16); 54 events corrected or hedged (see commit `feeec4a` for the list). Breakthrough markers now
  follow the animal groups Bennett names, dated from the fossil record.
- Visual polish under oil: early brain stages (mid-tone glossy tissue, pial vessels, contiguous fish/reptile anatomy), first
  vertebrate as a small jawless fish, neocortex slice with readable layers, first cells on time, Phoenician letters, marble brain
  on a column for Philosophy, a Sunghir-style bead burial with a stone lamp, thicker family tree, portrait-screen framing.

## Testing and verification gotchas (these cost hours)
- The browser tool's tab is **hidden**: `requestAnimationFrame` stalls; a screenshot wakes it. After navigating: screenshot, wait
  ~8 s, then use hooks (`__setF`, `__tick`, `__set`, `__world`, `__gl`). `__setF` pins only the scene, not the HTML caption: for true
  stills move the real scroller (the `__goF` bisection helper in SCENES.md and earlier notes).
- **Contact sheets need awaits** between stations (React must commit scene mounts); a synchronous loop renders empty scenes.
  Long walks exceed the tool's 45 s script timeout but keep running in the page: wait and screenshot.
- The test tab is the user's real Chrome: **set `window.__silent = true` before any audio test**, or narration plays aloud.
- The window could not be resized on this machine: test phone width with an iframe of 390 x 780 on the same origin.
- Shader/effect edits need a full reload (HMR keeps the old postprocessing Effect instance). After adding a dependency restart
  Vite with `--force`. Editing a hook-bearing file can crash Fast Refresh: reload.
- Dev tools: `?brainlab=<stage>` (brain turntable), `?creatures=<kind>` (rig lineup), `__td`, `__scoreTest`, `__narration`, `__bus`.

## Bugs already fixed, do not regress
- Black flashes (bloom NaN scrub `sanitizeBloom`; memoised `PostFX`; scenes kept mounted and pre-compiled against a render target;
  discrete downward-only adaptive resolution). Not re-confirmed by the user on their machine: ask.
- Oil sampling the raw scene when merged into the first pass (everything before it at ~20% strength): keep `Scrim`'s `mainUv`.
- Slow-scroll backward jitter (wheel axis locked per gesture, float scroll position).
- `THREE.PointsMaterial` draws squares: use `roundSprite()`. A JSX `<shaderMaterial uniforms>` object does not keep its reference.

## Open work, roughly in priority order
1. **The user chooses**: palette, brushwork, text layout, headline placement (Lab). Then delete the losing options and, if they
   want, hide the Lab (`?lab=0` default) for the public site.
2. **"follo-style" oil painting**: the word was unclear. Interpreted as a fuller, more painterly oil ("Full" brushwork). Ask which
   painter or style they meant (a specific artist? fauvist?) and add it as a brush or palette.
3. **Narration**: record with ElevenLabs (`narration/SCRIPT.md`; `scripts/narration.ts voice`). Then listen through the whole
   piece: clip lengths (~15 s) vs. scroll pace, the dwell and fade timings in `src/audio/narration.ts`.
4. **Listen to the score**: it was written and level-checked offline (bed about -28 dB RMS, ducks ~7.5 dB under voice) but never
   heard. Tune `HARMONY` / `LEVEL` in `src/audio/score.ts`, or compose recorded beds (`scripts/narration.ts music`).
5. **Performance on real GPUs is still unmeasured** (`?perf=1`): heavy scenes are hominin-savanna, neocortex, cave, canopy, fire,
   the press, and crossfades with several creatures. The oil pass is a 21-tap fullscreen pass in its own EffectPass.
6. **Remaining weak frames** (from the 2026-10-16 contact sheets under oil): the eukaryote cell (#8) is diagrammatic, oceans (#3)
   and first stars (#1) are sparse, the Denisovan family tree (#61) still reads weakly, four similar brain-in-glass frames
   (#50, 51, 54, 55), the band layout shows an empty band on the intro.
7. **Fact-check caveats**: claims were checked against the cited sources and corrected where wrong, but not every sentence of every
   transcript was traced to a page; the Bennett book itself was never consulted (breakthrough dates come from the fossil record of
   the groups he names). A domain expert read would still be worth it.
8. Late cleanup once options are chosen: unused palettes/text layouts, BrainLab and CreatureDemo can stay (dev-only, not bundled).

## Deploy
Vercel project `brainevo` (CLI, account linked in `.vercel/`). `vercel deploy --prod` from the repo root after `npm run build`
passes; Vercel builds with `npm run build` and serves `dist`. Narration/music files in `src/assets/` are bundled at build time.

## How the work was run (reusable)
Earlier sessions used parallel sub-agents with strict file ownership and screenshot verification (see git history). This session
ran inline: contact sheets of all 84 stations under oil, targeted fixes, re-checks. Commit after each integrated pass; all commits
end with the Co-Authored-By line from the session's attribution rules.
