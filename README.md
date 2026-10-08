# Evolution of the Brain

A side-scrolling journey from the Big Bang to the modern human brain: 84 events, 9 eras,
organised around five breakthroughs (steering, reinforcing, simulating, mentalizing, speaking),
a framework after Max Bennett's *A Brief History of Intelligence* (2023).

    npm install
    npm run dev      # http://localhost:5173
    npm run build

## Immersive 3D layer
A single WebGL canvas (three.js via react-three-fiber, bloom) sits behind the cards. Scroll drives `world.stationF`
(a continuous event index) and each *scene* in `src/scenes/<group>/` plays as you pass its events: the Big Bang detonates,
stars ignite, cells swim, neurons fire. Everything is procedural, no asset downloads. 65 scenes. See `SCENES.md` for the
engine contract and the dev hooks (`window.__setF(f)`, `window.__tick(n)`) used to render any scroll position, even in a hidden tab.

## Structure
- `src/types.ts` - `TimelineEvent` schema
- `src/data/events.*.ts` - content, one file per stretch of time; merged and sorted in `src/data/index.ts`
- `src/lib/layout.ts` - non-linear (log-ish) spacing so every event has room
- `src/world/` - engine: scroll store, Stage (camera/bloom blending, adaptive resolution), scene contract
- `src/scenes/` - the 65 procedural scenes, grouped by era
- `src/components/` - Track, EventCard, Minimap, Ruler, BreakthroughMarker, AboutDialog, ...

## Adding media (currently placeholders)
Drop files into `public/media/` named after the event id: `<id>.svg` (or change the extension in the data) and `<id>.mp3`.
Missing files fall back to a generated image and "Narration coming soon". Each event already has an audio `transcript` to use as the narration script.

## Known TODOs
- Frame rate not yet measured on real GPUs (only in a throttled tab). Adaptive resolution is in; profile the heavy scenes (hominin-savanna, neocortex, cave, primate-canopy) on an integrated GPU.
- Weaker scenes flagged by their authors: hominin-oldowan, hominin-teaching, life Protocells vent, sponge, primate figures.
- A few events in the late sapiens era sort slightly out of chronological order (burial, flutes).
- Narration audio not yet recorded; transcripts exist per event.
- Scroll/drag/touch feel was only partly verified in a real browser (throttled background tab).
- Dates are approximate for range events; `yearsAgo` is a representative point inside the `yearLabel` range.
- "Speaking" breakthrough currently spans from first stone tools through modern science; consider splitting a 'modern' chapter.
