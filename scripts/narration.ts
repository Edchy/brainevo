/**
 * Narration + music for ElevenLabs.
 *
 *   npx tsx scripts/narration.ts export   writes narration/SCRIPT.md (every line, in order, with its file name) and
 *                                         narration/lines.json, from the event data (src/data). Re-run after editing text.
 *   npx tsx scripts/narration.ts voice    records every missing line through the ElevenLabs API into
 *                                         src/assets/narration/<event-id>.mp3 (needs ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID;
 *                                         optional ELEVENLABS_MODEL, default eleven_multilingual_v2). Existing files are kept,
 *                                         so delete one to re-record it. --force re-records everything.
 *   npx tsx scripts/narration.ts music    composes one instrumental bed per era into src/assets/music/<era>.mp3 with the
 *                                         ElevenLabs Music API (needs ELEVENLABS_API_KEY; optional ELEVENLABS_MUSIC_MODEL,
 *                                         default music_v1). A recorded bed replaces the generated score for that era.
 *
 * The site picks up whatever files exist at build time; nothing else needs changing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { events } from '../src/data';
import { ERA_META, ERA_ORDER } from '../src/lib/eras';
import type { Era } from '../src/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_VOICE = join(ROOT, 'src/assets/narration');
const OUT_MUSIC = join(ROOT, 'src/assets/music');
const DOC = join(ROOT, 'narration');

const lines = events.map((e, i) => ({ n: i, id: e.id, file: `${e.id}.mp3`, title: e.title, era: e.era, text: (e.audio?.transcript ?? e.summary).trim() }));

const VOICE_DIRECTION = `Warm, unhurried, intimate documentary narration: think a late-night natural history programme, not a trailer.
Mid-low register, gentle smile in the voice, real curiosity. Leave air at full stops. Never announce or sell.
Pace about 150 words a minute. The listener is scrolling through deep time; each line is a small, complete thought.`;

const MUSIC: Record<Era, string> = {
  cosmic: 'Vast dark ambient orchestral drone, deep sub bass, slow-evolving low strings in D minor, distant glassy shimmer, no drums, cinematic, sense of cosmic emptiness and the first light, 60 bpm feel, no melody hooks, seamless loop',
  origin: 'Watery ambient soundscape in E Lydian, soft warm pads, gentle bubbling textures, slow harp-like plucks far in the background, no drums, wonder at the first living cells, cinematic and calm, seamless loop',
  nerves: 'Delicate electronic-orchestral ambient in F sharp minor, soft pulsing pads like faint electrical signals, sparse celesta notes, no drums, curious and alive, cinematic, seamless loop',
  vertebrate: 'Deep ocean cinematic ambient in G dorian, slow cello and low strings, muted swells, distant whale-like resonances, no drums, ancient and patient, seamless loop',
  mammal: 'Warm nocturnal forest ambient in A minor, intimate strings and soft woodwind pads, a hint of heartbeat-like low pulse, no drums, tender and alert, cinematic, seamless loop',
  primate: 'Lush canopy ambient in C major and A minor, warm string pads, soft marimba-like plucks, gentle and social, no drums, cinematic nature documentary, seamless loop',
  hominin: 'Earthy cinematic ambient in D minor, low frame drum pulses very sparse, warm cello, breath-like textures, open savanna at dusk, slow and grounded, seamless loop',
  sapiens: 'Hopeful cinematic ambient in E flat major, choir-like pads, soft piano notes far apart, cave-echo reverb, wonder at the first art and music, no drums, seamless loop',
  modern: 'Luminous modern cinematic ambient in E major, shimmering strings, soft piano and subtle electronic textures, reflective and quietly awe-struck, no drums, seamless loop',
};

function exportScript() {
  mkdirSync(DOC, { recursive: true });
  const words = lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
  const mins = Math.round(words / 150);
  let md = `# Narration script: Evolution of the Brain

${lines.length} lines, ${words.toLocaleString('en-US')} words, about ${mins} minutes at 150 words a minute.
Generated from the event data by \`npx tsx scripts/narration.ts export\`; edit the text in \`src/data/\`, not here.

## How to record

**Automatic (recommended).** With an ElevenLabs API key and the voice you picked:

\`\`\`
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npx tsx scripts/narration.ts voice
\`\`\`

Every line becomes \`src/assets/narration/<file>\`. Each request sends the neighbouring lines as context so the
delivery flows from one event to the next. Lines that already have a file are skipped.

**By hand.** In ElevenLabs Text to Speech, paste one line at a time, generate, download, and save it under exactly
the file name shown (for example \`big-bang.mp3\`) in \`src/assets/narration/\`.

Suggested settings: model Multilingual v2 (or v3 for more expressive reads), stability 0.5, similarity 0.75,
style 0.15, speaker boost on, speed 0.95.

### Voice direction

${VOICE_DIRECTION}

## Lines

`;
  let era: string | null = null;
  for (const l of lines) {
    if (l.era !== era) { era = l.era; md += `### ${ERA_META[l.era as Era].name}\n\n`; }
    md += `**${String(l.n).padStart(2, '0')} · \`${l.file}\`** · ${l.title}\n\n${l.text}\n\n`;
  }
  md += `## Music (optional)

The site plays a generative score by default. To use recorded music instead, compose one loopable bed per era
(\`npx tsx scripts/narration.ts music\`, or paste these prompts into ElevenLabs Music, instrumental, about 2.5 minutes)
and save each as \`src/assets/music/<era>.mp3\`. Any era without a file keeps the generated score.

`;
  for (const e of ERA_ORDER) md += `- **\`${e}.mp3\`** (${ERA_META[e].name}): ${MUSIC[e]}\n`;
  writeFileSync(join(DOC, 'SCRIPT.md'), md);
  writeFileSync(join(DOC, 'lines.json'), JSON.stringify(lines, null, 2) + '\n');
  console.log(`wrote narration/SCRIPT.md and narration/lines.json (${lines.length} lines, ~${mins} min)`);
}

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) { console.error(`Missing ${name}. See narration/SCRIPT.md.`); process.exit(1); }
  return v;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function voice(force: boolean) {
  const voiceId = env('ELEVENLABS_VOICE_ID');
  const model = env('ELEVENLABS_MODEL', 'eleven_multilingual_v2');
  mkdirSync(OUT_VOICE, { recursive: true });
  let made = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const out = join(OUT_VOICE, l.file);
    if (existsSync(out) && !force) continue;
    process.stdout.write(`${String(i).padStart(2)} ${l.id} ... `);
    const audio = await post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      text: l.text,
      model_id: model,
      previous_text: lines[i - 1]?.text,
      next_text: lines[i + 1]?.text,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 0.95 },
    });
    writeFileSync(out, audio);
    made++;
    console.log(`${Math.round(audio.length / 1024)} KB`);
  }
  console.log(`${made} recorded, ${lines.length - made} already there. Rebuild or restart the dev server to pick them up.`);
}

async function music(force: boolean) {
  const model = env('ELEVENLABS_MUSIC_MODEL', 'music_v1');
  mkdirSync(OUT_MUSIC, { recursive: true });
  for (const era of ERA_ORDER) {
    const out = join(OUT_MUSIC, `${era}.mp3`);
    if (existsSync(out) && !force) continue;
    process.stdout.write(`${era} ... `);
    const audio = await post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      prompt: MUSIC[era], music_length_ms: 150_000, model_id: model, force_instrumental: true,
    });
    writeFileSync(out, audio);
    console.log(`${Math.round(audio.length / 1024)} KB`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
if (cmd === 'export') exportScript();
else if (cmd === 'voice') voice(force).catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'music') music(force).catch((e) => { console.error(e.message); process.exit(1); });
else { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(cmd ? 1 : 0); }
