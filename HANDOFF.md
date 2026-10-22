# Handoff: Evolution of the Brain

Read this first, then the docs it points to (SCENES.md, STYLE.md, ILLUSTRATION.md, the READMEs in `src/scenes/shared/*`).
State as of 2026-10-16: everything is merged to `main` and deployed on Vercel (see "Deploy").

## What it is
A side-scrolling, scroll-driven journey through evolution, Big Bang to now and beyond: 102 stations, 11 chapters, the five "breakthroughs" of
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
| `src/types.ts`, `src/data/events.*.ts` | `TimelineEvent` schema and the 102 stations: text (`summary` is both the caption and the narration line, word for word), dates, **sources**. `events.future.ts` holds the future chapter and the closing reflection (`kind: 'coda'`, centred line, no headline; `extra` = weeks / imagine / breath / heartbeats). Negative `yearsAgo` = the future. |
| `src/lib/` | layout (signed log spacing, `focusX`), eras, breakthroughs, smooth scroll, date formatting (`fmtWhen`, `captionParts`), `vision.ts` (perception per era + sketch), `mirror.ts` (opt-in camera, mirror test), `age.ts`, `watch.ts` (film mode). |
| `src/components/`, `src/App.tsx`, `src/index.css` | Reading layer: Caption (+ Read more sheet), Menu (with Sound), Axis, SoundButton, LabPanel, Track (intro, chapter and breakthrough interstitials, outro). `readingGeometry()` in App is the single source of the layout numbers. |
| `src/world/` | Engine: `store.ts` (`world.stationF`), `Stage.tsx` (Canvas, scene blending, PostFX chain, dev tools), `Dip.tsx`, `Scrim.tsx`, `PerfHud.tsx`. |
| `src/style/` | `oil/` (the paint pass + theme tokens), `palettes.ts`, `store.ts` (settings), `titles/` (depth headlines). |
| `src/audio/` | `engine.ts` (graph, unlock on gesture, ducking), `narration.ts` (auto-play director), `score.ts` (generative music), `soundscape.ts` (the sounds of each event, and how they react to movement), `instruments.ts` (those sounds, synthesized), `dev.ts` (offline level/spectrogram bench). |
| `src/scenes/<group>/` | 69 scenes in 8 groups (`future/`: Minds, Weeks, SunEnd, Coda); `shared/brain` (anatomical brain, BrainLab), `shared/creatures` (SDF rigs), `shared/Mirror.tsx` (the visitor's reflection, mounted once in Stage). |
| `src/play/` | "Try it yourself" toys, one per breakthrough, opened from the breakthrough cards (`PlayDialog`). |
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
  an event without one stays quiet (no Listen button; Watch gives it reading time). The browser's system voice was removed on
  2026-10-22 at the user's request ("so bad"). Music and scene sounds duck under the voice.
- Sound follows position and movement: each event has its own synthesized scene sounds (`SCAPES` in `soundscape.ts`: sea,
  under water, wind, fire, crickets, birds, cave drips, a bone flute, knapping, neurons firing, a press, a clock, an MRI...),
  crossfading between neighbours. Moving fast blurs them (they sink and darken under the score's rush of air) and new ones only
  start once you slow down. The score bends its pads' pitch slightly while you travel (tape-like; up forward, down back), plays
  a soft plucked note for every event you pass (up the chord forward, down it backward; a fast scroll arpeggiates), and changes
  chords faster as history speeds up. The heart quickens and neurons fire faster with speed; the brain's chatter grows denser
  later in the story. Menu: Sound / Narration / Music / Sounds of each scene.

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
- Sound that is **aware of where you are in the timeline and how fast you scroll**, so it becomes immersive (done: scene
  soundscape + movement-aware score, see above).

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

## Session 2026-10-17 (what changed)
- Captions are the narration lines word for word (one `summary` field); a line that opens with its own date has that clause
  set as the gilt date. 26 date lines moved to figures; 6 long lines tightened. Big Bang recording still matches.
- See through their eyes (oil uniforms uBlind / uDichro / uRich / uSketch, note on the time axis); hearing muffled until the
  mammalian middle ear; the score gains one voice per breakthrough (`src/audio/ensemble.ts`).
- New: Göbekli Tepe ("Minds in Everything", agency detection and religion, held with respect), Machines Learn Our Language,
  a burial line asking "where did they go?"; chapter What Comes Next (Minds and Machines sketched, Four Thousand Weeks with
  an age field, the Sun brightening, red giant, last stars) and Here and Now (11 coda lines: imagine being dead, Lucretius'
  symmetry, both scales are true, thoughts are electricity, nobody has it figured out, everything is invented, get it wrong,
  here and now / breathe, still morning, your heartbeats). Music hushes for "imagine"; a breath sound syncs with the light.
- The mirror (opt-in camera, painted; mirror test with touch detection, no face tracking), Try it yourself toys, Watch mode.
- All new facts verified (Crossref DOIs / pages); notable corrections from memory: habitability 1-2 Gyr (Wolf & Toon 2015),
  oldest burials Skhul/Qafzeh 100-130 ka.

## Session 2026-10-17, later: creatures and paint (what changed)
- The user found the animals and humans "sloppy". Causes found and fixed:
  1. **Speckle everywhere**: the oil pass's bristle noise ran at ~1.5 cycles per device pixel (aliased white noise) and its
     impasto glints sparkled off it. Bristles are now a few pixels wide and the glints softer (src/style/oil).
  2. **Glowing ghosts**: the creature shader lit bodies almost only by a hot rim on near-black fur, the bloom turned the rim
     into a halo, and additive glows (the fire's halo sprite) were drawn over the figures. Now: painted chiaroscuro (one key
     with a clear terminator, cool sky in the shadows, ground bounce, thin capped rim; key light desaturated so firelit skin
     reads amber, not red), fur lifted to mid-tones (`uAlb`), skin left as is, figures fade by transparency (not to black),
     bloom threshold 0.15 -> 0.3 with radius 0.62, the fire halo moved behind the people.
  3. **Flat lighting**: scenes lit figures from the camera; key lights now come from the side (fire scene: a painter's cheat),
     the savanna is contre-jour, Lucy is lit by the volcano; per-scene sss (wrap) lowered so forms turn into shadow.
  4. **Mannequins**: hair caps stand clear of the skull (they blended into skin), arms hang clear of the torso; mammal coats
     are warm browns under a neutral key (they were cool grey under lavender, i.e. pale ghosts).
  5. Creatures render at 1.5/dpr (was 1.25/dpr), the default "Fine" brush is 0.8 (was 1.0) so figures keep their form.
- The weeks grid is a crisp 2D chart over the painting (src/components/WeeksChart.tsx); painted, its few-pixel squares were moire.
- Dev hooks for tuning: `window.__creatureLook = { sss: 0.3, keyKx: 1.2 }` (x suffix = multiply), `window.__creatureU = { uAlb, uKeySat }`,
  `window.__creatureRes = 1`, `window.__bloom` (the BloomEffect), `?safe=1` (no post) to see the raw render.
- Still procedural capsule figures: faces read best at "Oldowan"/"Teaching" scale; at distance they are painted shapes. GPU cost of
  the higher creature resolution is unmeasured on the user's machine (`?perf=1` on hominin-fire, -savanna, -teaching).

## The mirror (rebuilt 2026-10-17 after the user found it passive: "I just see myself and a red dot, nothing happens")
- `src/lib/mirror.ts`: opt-in camera + MediaPipe face and hand tracking (`@mediapipe/tasks-vision` 1.0.1, lazy chunk; wasm from
  jsDelivr, models from Google storage, ~11 MB on first open; GPU delegate, CPU fallback). The test: look into the mirror ->
  the mark appears on the tracked forehead -> "Something has changed. Can you find it?" -> hint -> buttons ("my own forehead" /
  "the mirror") if no touch is seen -> reveal; a fingertip within ~0.38 face-widths of the mark counts as a touch (the hand
  check keeps the last forehead for 2 s, since a hand can hide the face). If tracking cannot load in 25 s it falls back to the
  oval guide and the buttons. "Now": a painted brain (warm tissue, darker folds, sparks) inside the visitor's tracked head and
  the line "Behind your eyes, right now: 86 billion neurons...". "Here, Now": the light frames the tracked face.
- Tested only with a synthetic camera (MediaPipe's sample portrait + a cropped pointing-hand photo pasted on the forehead):
  face found in ~3 s after load, mark on the forehead, touch detected, brain placed, face framed. Not yet tried with a real
  camera. When testing, import the module by the URL the app loaded (`performance.getEntriesByType('resource')`): after a hot
  reload a bare `import('/src/lib/mirror.ts')` returns a stale copy.

## Invitations (2026-10-17: the user found the interactive parts easy to miss)
- One look for "you can do something here" (`src/components/Invite.tsx`, `.invite-card`, `.bt-play`, the age pill): a large
  gilt card in the picture that breathes once the event settles; the narration names it ("You can take it yourself, right
  here." / "Look into the mirror: there it is."; the weeks line already asks for the age). Watch mode rests longer at
  invitations and waits while a toy, the mirror test or the age field is in use (`src/lib/watch.ts`).

## The voice guide (2026-10-17; the user's private test, never public) — PARKED 2026-10-21
- **Parked by the user**: "will skip doing live voice for now. only prerecorded instead." The code stays but is off: the button
  renders only with `VITE_GUIDE=1` in `.env.local` (plus `npm run dev`). Do not build on it unless the user brings it back.
  The invitation cards and the narration lines that name them are part of the recorded experience and stay.
- The user chose: keep the public site on recorded narration; the talking guide is a test for themselves only, on ElevenLabs
  (same voice as the narration). Everything is dev-only: `App.tsx` lazy-loads `src/guide/Guide.tsx` behind `import.meta.env.DEV`,
  so the build drops it (checked: no guide/ElevenLabs/livekit code in `dist`). `@elevenlabs/client` 1.26.0 is a devDependency.
- Pieces: `scripts/guide-agent.ts` (`npm run guide:setup`) creates/updates the agent and its client tools from
  `src/guide/tools.ts` (one list for both sides) with the whole script as its instructions (~35k chars; depth comes from the
  `get_event_details` tool), Claude Sonnet 5.5, `enable_auth`, 15-min cap, 40/day, patient turns, no voice recordings.
  `vite.config.ts` serves `/__guide/token` (loopback only, key read from `.env.local` per request). `src/guide/session.ts`
  runs the tools and keeps the agent in step with "[site]" notes: context when the visitor settles on a station, the mirror
  test's steps, toys, age; and one-time nudges (spoken offers) at the mirror test, Now, Four Thousand Weeks, coda-imagine and the
  first moment of each breakthrough. The recorded narration holds while the guide is on (`holdNarration`), music ducks.
- Verified with a stand-in conversation (`window.__guideFake = true` before pressing Talk; notes land in `window.__guideLog`;
  `window.__guideTool(name, params)` runs a tool): travel, unknown ids, notes and their timing, the mirror test via the tool
  (synthetic camera), age/toy attribution. NOT verified: the real ElevenLabs agent (no key here: the create/update payload may
  need a field fixed on first run; the script prints the API's error), real voice latency, echo of the music into the mic.

## Testing and verification gotchas (these cost hours)
- Never grant the real camera in tests: replace `navigator.mediaDevices.getUserMedia` with a canvas `captureStream()` (a drawn
  face; paint a rectangle over the forehead to simulate the touch). `window.__vis = { sketch: 0 }` shows a scene unfiltered;
  `window.__three()` returns the R3F state for scene-graph inspection.
- A scene with a long `tail` swallows the next scene's window (resolve() trims overlaps): "Now" had tail 2.0 and hid Minds.
- The browser tool's tab is **hidden**: `requestAnimationFrame` stalls; a screenshot wakes it. After navigating: screenshot, wait
  ~8 s, then use hooks (`__setF`, `__tick`, `__set`, `__world`, `__gl`). `__setF` pins only the scene, not the HTML caption: for true
  stills move the real scroller (the `__goF` bisection helper in SCENES.md and earlier notes).
- **Contact sheets need awaits** between stations (React must commit scene mounts); a synchronous loop renders empty scenes.
  Long walks exceed the tool's 45 s script timeout but keep running in the page: wait and screenshot.
- The test tab is the user's real Chrome: **set `window.__silent = true` before any audio test**, or narration plays aloud.
- The window could not be resized on this machine: test phone width with an iframe of 390 x 780 on the same origin.
- GPU cost per moment: `EXT_disjoint_timer_query_webgl2` (available in Chrome on the M2) around a manual `__tick(1)`, after
  `__setF(i)` and ~25 warm-up ticks. To attribute cost, hide MATERIALS (`material.visible = false`), not scene groups: Stage
  resets each scene group's `visible` every frame, so hiding a group silently does nothing.
- Shader/effect edits need a full reload (HMR keeps the old postprocessing Effect instance). After adding a dependency restart
  Vite with `--force`. Editing a hook-bearing file can crash Fast Refresh: reload.
- Dev tools: `?brainlab=<stage>` (brain turntable), `?creatures=<kind>` (rig lineup), `__td`, `__scoreTest`, `__scapeTest`, `__scapeSheet`, `__scape`, `__narration`, `__bus`.

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
3. **Narration**: being recorded through the API (`npm run narration -- voice --limit=N`), Multilingual v2, the voice in
   `ELEVENLABS_VOICE_ID`. On 2026-10-22 the first six lines (Big Bang re-recorded so every line matches, through
   chemical-signalling) cost 521 credits for 1,303 characters: about 0.4 credits per character, and the
   `previous_text`/`next_text` context is not billed (checked against the account balance). The remaining 96 lines are about
   8.2k credits. The user's Starter plan resets on the 11th of each month. Then listen through the whole piece, and Watch mode:
   clip lengths vs. pace, the dwell and fade timings in `src/audio/narration.ts`, the rests in `src/lib/watch.ts`.
4. **Leave a light** (parked by the user, 2026-10-17): visitors place a light at the moment that moved them and see everyone
   else's across deep time. Needs a small shared database; come back to it.
5. **Listen to the score and the scene sounds** (and the breakthrough ensemble, the breath, the hush at "imagine"): written and level-checked offline (bed about -28 dB RMS, ducks ~7.5 dB under
   voice; scene beds -27..-29 dB RMS, one-shot peaks about -11..-22 dB; `await __scapeSheet(8)` draws spectrograms of every
   layer) but never heard. Tune `HARMONY` / `LEVEL` in `src/audio/score.ts`, per-layer gains (`super(k, scale, wet)`) in
   `src/audio/instruments.ts` and the per-event mix in `SCAPES`, or compose recorded beds (`scripts/narration.ts music`).
6. **Performance** (measured 2026-10-21 on the user's M2, GPU time per frame at dpr 1.75, `?adaptive=0`): median 11 ms, 90% of
   moments under 17 ms; the oil pass and an empty scene cost ~6 ms. Fixed that day: cave art 97 -> 17 ms and bone flutes 152 -> 17
   (Cave.tsx: one relief sample, normals from screen-space slope, unlit rock and off-moment layers skipped), the language heads
   41 -> 10 (Language.tsx: no noise outside the heads), the brains 45 -> 20-25 (Brain.tsx: a cut-free shader variant, because a
   shader that can write gl_FragDepth loses early depth testing; a depth-only pre-pass so only the front fold is shaded; the
   hologram skips tissue shading). Still heaviest: **neocortex 43 ms and fMRI 25 ms, both the cutaway brain** (BRAIN_CUT
   variant: next step would be splitting it into a front pass without depth writes plus a back-face cap pass), Jebel Irhoud 25.
   Adaptive resolution only ever steps DOWN, so one heavy moment lowered the whole rest of the journey on weaker machines:
   keep outliers out. Phones still unmeasured.
7. **Remaining weak frames** (from the 2026-10-16 contact sheets under oil): the eukaryote cell (#8) is diagrammatic, oceans (#3)
   and first stars (#1) are sparse, the Denisovan family tree (#61) still reads weakly, four similar brain-in-glass frames
   (#50, 51, 54, 55), the band layout shows an empty band on the intro.
8. **Fact-check caveats**: claims were checked against the cited sources and corrected where wrong, but not every sentence of every
   transcript was traced to a page; the Bennett book itself was never consulted (breakthrough dates come from the fossil record of
   the groups he names). A domain expert read would still be worth it.
9. Real-camera check of the mirror test (only tested with a synthetic camera); the touch threshold may need tuning in
   different light. Phone check of the new UI (coda, weeks, mirror panel, play toys, watch bar).
10. Late cleanup once options are chosen: unused palettes/text layouts, BrainLab and CreatureDemo can stay (dev-only, not bundled).

## Deploy
Vercel project `brainevo` (CLI, account linked in `.vercel/`). `vercel deploy --prod` from the repo root after `npm run build`
passes; Vercel builds with `npm run build` and serves `dist`. Narration/music files in `src/assets/` are bundled at build time.

## How the work was run (reusable)
Earlier sessions used parallel sub-agents with strict file ownership and screenshot verification (see git history). This session
ran inline: contact sheets of all 84 stations under oil, targeted fixes, re-checks. Commit after each integrated pass; all commits
end with the Co-Authored-By line from the session's attribution rules.
