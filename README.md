# Evolution of the Brain

A side-scrolling, painted journey from the Big Bang to the modern human brain, then on into what comes next and a closing
reflection on being a brain that knows it will end: 102 stations, 11 chapters, organised around the five breakthroughs
(steering, reinforcing, simulating, mentalizing, speaking) of Max Bennett's *A Brief History of Intelligence* (2023). Every
event lists its sources; each caption is its narration line, word for word. Narration plays as you arrive, over a generative
score that gains a voice at each breakthrough.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # tsc -b && vite build

## How it works
- A single WebGL canvas (three.js via react-three-fiber) behind a minimal HTML reading layer. Scroll drives `world.stationF`
  (a continuous event index) and each scene in `src/scenes/<group>/` plays as you pass its events. Everything is procedural:
  no image or model downloads. 69 scenes. Engine contract and dev hooks: `SCENES.md`.
- **See through their eyes** (`src/lib/vision.ts`): the painting shows each stretch the way its brains could see: no colour
  before eyes, the first eyes, four-cone colour in fish and reptiles, two colours in the mammals' night, colour flooding back at
  trichromacy. The human future is only a chalk underdrawing ("not painted yet"); the Sun's and the stars' are painted.
- **Try it yourself** (`src/play/`): each breakthrough card opens a small toy where the visitor's own brain does it (steer
  blind, learn from surprise, imagine before moving, model a false belief, put a picture into another mind with words).
- **The mirror** (`src/lib/mirror.ts`, `src/scenes/shared/Mirror.tsx`): opt-in camera, painted in oil; the visitor takes the
  mirror test at the chimpanzee event and sees themselves at "Now" and inside the closing light. Nothing leaves the device.
- **Watch**: the intro (or Menu) can play the whole piece like a film (`src/lib/watch.ts`); any scroll or key hands back control.
- The whole frame is painted by an oil-painting pass in five palettes (Prussian, Grisaille, Umber, Verdigris, Oxblood), with fine
  or full brushwork. The headline is composited into the painting in depth; the caption sits on a darkened, painted ground. See
  `STYLE.md`. Switch looks live from the **Lab** button (`?lab=0` hides it).
- Sound (`src/audio`): narration that auto-plays per event, music that follows the eras, synthesized sounds for every scene
  (sea, fire, crickets, a bone flute, neurons firing...), all reacting to where you are and how fast you move, and sound
  effects on story beats. Off until the
  visitor chooses "Begin with sound" or the speaker button (browsers require a click or key press before audio).

## Narration and music (ElevenLabs)
The script is generated from the data: `narration/SCRIPT.md` (all 102 lines in order, with file names, voice direction and music
prompts). Re-export after editing text with `npx tsx scripts/narration.ts export`.

- Record automatically: put `ELEVENLABS_API_KEY=...` (a key with Text to Speech access) and `ELEVENLABS_VOICE_ID=...` in
  `.env.local`, then `npm run narration -- voice --dry` (what is missing, in characters = credits), `-- voice --limit=10`
  (the next ten), `-- voice fire speech` (just those events) or `-- voice` (everything missing). Files land in
  `src/assets/narration/<event-id>.mp3` at 64 kbps mono. Or record by hand and save under the same names.
- Optional recorded music: `npx tsx scripts/narration.ts music` composes one bed per era into `src/assets/music/<era>.mp3`;
  any era without a file keeps the generated score.
- An event without a recording stays quiet (its caption still shows); there is no synthetic stand-in voice.

## The voice guide (parked; private test, local only)
Parked on 2026-10-21: the site uses the recorded narration only. The code stays, switched off; nothing below has been run against
ElevenLabs yet. To try it, add `VITE_GUIDE=1` to `.env.local` as well (the mic button is hidden without it).

A guide you can talk to: the narrator's voice as an ElevenLabs agent (Claude as its mind) that answers questions about what is on
screen, takes you anywhere on the timeline, opens the mirror, asks your age, opens the toys, and asks what you pictured at the end.
It exists only under `npm run dev`; the public build has no guide, no key and no agent.

1. Put `ELEVENLABS_API_KEY=...` and `ELEVENLABS_VOICE_ID=...` (the narrator) in `.env.local` (gitignored).
2. `npm run guide:setup` creates the agent (instructions, the whole script, the tools) and saves `ELEVENLABS_AGENT_ID` to
   `.env.local`. Run it again after editing `scripts/guide-agent.ts` or the event texts.
3. `VITE_GUIDE=1` in `.env.local`, `npm run dev`, then the microphone button under the sound switch. Headphones help.
   The key needs only "ElevenLabs Agents: Write"; give it a credit limit.

Costs ElevenLabs agent minutes plus the LLM (roughly $0.08/min + model); capped at 15 minutes and 40 conversations a day, it hangs
up after 5 silent minutes or a minute in a background tab. Microphone audio goes to ElevenLabs (the agent keeps transcripts, not
recordings). `npm run guide:setup -- print` shows the instructions without calling ElevenLabs.

## Structure
- `src/data/events.*.ts`: content and sources, one file per stretch of time; merged and sorted in `src/data/index.ts`
- `src/scenes/`: the 69 procedural scenes (`future/` holds the future chapter and the closing reflection); `src/scenes/shared/brain`,
  `shared/creatures` and `shared/Mirror.tsx`: the shared brain, creature rigs and the visitor's reflection
- `src/play/`: the five "try it yourself" toys
- `src/guide/`: the dev-only voice guide (session, tools, panel); `scripts/guide-agent.ts` sets up its agent
- `src/lib/`: layout, eras, breakthroughs, vision (perception per era), mirror, age, watch
- `src/world/`: engine (scroll store, Stage, scene blending, dip and reading shade)
- `src/style/`: the oil pass, palettes, theme tokens, depth headlines
- `src/components/`: caption, menu, time axis, Lab, sound button, interstitials
- `src/audio/`: audio graph, narration director, generative score, scene soundscape
- `scripts/`: `list-events.ts` (event indices), `narration.ts` (script export and ElevenLabs generation), `guide-agent.ts`

Handover notes, open work and verification gotchas: `HANDOFF.md`.
