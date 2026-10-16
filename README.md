# Evolution of the Brain

A side-scrolling, painted journey from the Big Bang to the modern human brain: 84 events, 9 eras, organised around the five
breakthroughs (steering, reinforcing, simulating, mentalizing, speaking) of Max Bennett's *A Brief History of Intelligence*
(2023). Every event lists its sources. Narration plays as you arrive at each event, over a generative score.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # tsc -b && vite build

## How it works
- A single WebGL canvas (three.js via react-three-fiber) behind a minimal HTML reading layer. Scroll drives `world.stationF`
  (a continuous event index) and each scene in `src/scenes/<group>/` plays as you pass its events. Everything is procedural:
  no image or model downloads. 65 scenes. Engine contract and dev hooks: `SCENES.md`.
- The whole frame is painted by an oil-painting pass in five palettes (Prussian, Grisaille, Umber, Verdigris, Oxblood), with fine
  or full brushwork. The headline is composited into the painting in depth; the caption sits on a darkened, painted ground. See
  `STYLE.md`. Switch looks live from the **Lab** button (`?lab=0` hides it).
- Sound (`src/audio`): narration that auto-plays per event, music that follows the eras, sound effects on story beats. Off until the
  visitor chooses "Begin with sound" or the speaker button (browsers require a click or key press before audio).

## Narration and music (ElevenLabs)
The script is generated from the data: `narration/SCRIPT.md` (all 84 lines in order, with file names, voice direction and music
prompts). Re-export after editing text with `npx tsx scripts/narration.ts export`.

- Record automatically: `ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npx tsx scripts/narration.ts voice` writes
  `src/assets/narration/<event-id>.mp3` for every missing line. Or record by hand and save under the same names.
- Optional recorded music: `npx tsx scripts/narration.ts music` composes one bed per era into `src/assets/music/<era>.mp3`;
  any era without a file keeps the generated score.
- Until recordings exist, the system voice reads the transcripts (Lab: "System voice until recordings exist").

## Structure
- `src/data/events.*.ts`: content and sources, one file per stretch of time; merged and sorted in `src/data/index.ts`
- `src/scenes/`: the 65 procedural scenes; `src/scenes/shared/brain` and `shared/creatures`: the shared brain and creature rigs
- `src/world/`: engine (scroll store, Stage, scene blending, dip and reading shade)
- `src/style/`: the oil pass, palettes, theme tokens, depth headlines
- `src/components/`: caption, menu, time axis, Lab, sound button, interstitials
- `src/audio/`: audio graph, narration director, generative score
- `scripts/`: `list-events.ts` (event indices), `narration.ts` (script export and ElevenLabs generation)

Handover notes, open work and verification gotchas: `HANDOFF.md`.
