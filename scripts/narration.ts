/**
 * Narration + music for ElevenLabs.
 *
 *   npx tsx scripts/narration.ts export   writes narration/SCRIPT.md (every line, in order, with its file name) and
 *                                         narration/lines.json, from the event data (src/data). Re-run after editing text.
 *   npx tsx scripts/narration.ts voice    records every missing line through the ElevenLabs API into
 *                                         src/assets/narration/<event-id>.mp3 (needs ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID;
 *                                         optional ELEVENLABS_MODEL, default eleven_v4). Existing files are kept,
 *                                         so delete one to re-record it. --force re-records everything.
 *                                         --limit=N records only the next N missing lines; event ids (`voice fire speech`)
 *                                         record just those; --dry lists what would be recorded and its characters.
 *                                         64 kbps mono MP3: a podcast's voice quality at half the size of 128.
 *   npx tsx scripts/narration.ts music    composes one instrumental bed per era into src/assets/music/<era>.mp3 with the
 *                                         ElevenLabs Music API (needs ELEVENLABS_API_KEY; optional ELEVENLABS_MUSIC_MODEL,
 *                                         default music_v1). A recorded bed replaces the generated score for that era.
 *
 * Keys are read from the environment or .env.local (gitignored). The key needs Text to Speech (and Music for `music`).
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
const ENV_FILE = join(ROOT, '.env.local');

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const lines = events.map((e, i) => ({ n: i, id: e.id, file: `${e.id}.mp3`, title: e.title, era: e.era, text: e.summary.trim() }));

const VOICE_DIRECTION = `Warm, unhurried, intimate documentary narration: think a late-night natural history programme, not a trailer.
Mid-low register, gentle smile in the voice, real curiosity. Leave air at full stops. Never announce or sell.
Pace about 150 words a minute. The listener is scrolling through deep time; each line is a small, complete thought.
Each line is also the caption on screen, so keep every take word for word: regenerate any take that skips or changes a word.
The last chapter, Here and Now, is slower and closer, as if to one person: half a beat more between sentences, no
emphasis on the facts, warmth on "Breathe in" and "Now go and spend the rest". "Try to imagine being dead." is said
plainly and followed by silence (the site holds it).`;

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

**Automatic (recommended).** Put \`ELEVENLABS_API_KEY=...\` (with Text to Speech access) and
\`ELEVENLABS_VOICE_ID=...\` (the voice you picked) in \`.env.local\`, then:

\`\`\`
npm run narration -- voice --dry        # what is missing and how many characters (credits) it would take
npm run narration -- voice --limit=10   # the next 10 missing lines
npm run narration -- voice fire speech  # just these events
npm run narration -- voice              # everything still missing
\`\`\`

Every line becomes \`src/assets/narration/<file>\` (64 kbps mono). Each request sends the neighbouring lines as context
so the delivery flows from one event to the next. Lines that already have a file are skipped.

**By hand.** In ElevenLabs Text to Speech, paste one line at a time, generate, download, and save it under exactly
the file name shown (for example \`big-bang.mp3\`) in \`src/assets/narration/\`.

Settings: model Eleven v4 (the same voice sounds far better on it than on Multilingual v2), with the voice's own
settings.

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
  return { audio: Buffer.from(await res.arrayBuffer()), cost: Number(res.headers.get('character-cost')) || 0 };
}

async function voice(force: boolean, ids: string[], limit: number, dry: boolean) {
  const unknown = ids.filter((id) => !lines.some((l) => l.id === id));
  if (unknown.length) { console.error(`Unknown event id: ${unknown.join(', ')} (see narration/lines.json)`); process.exit(1); }
  const todo = lines
    .filter((l) => (ids.length ? ids.includes(l.id) : force || !existsSync(join(OUT_VOICE, l.file))))
    .slice(0, limit);
  const chars = todo.reduce((a, l) => a + l.text.length, 0);
  console.log(`${todo.length} line${todo.length === 1 ? '' : 's'} to record, ${chars.toLocaleString('en-US')} characters`);
  if (dry) { for (const l of todo) console.log(`${String(l.n).padStart(3)} ${l.id} (${l.text.length})`); return; }
  const voiceId = env('ELEVENLABS_VOICE_ID');
  const model = env('ELEVENLABS_MODEL', 'eleven_v4');
  // v4 reads best with the voice's own settings, as on the ElevenLabs website; the older models get these narration ones
  const settings = model === 'eleven_v4' ? undefined
    : { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 0.95 };
  console.log(`model ${model}`);
  mkdirSync(OUT_VOICE, { recursive: true });
  let made = 0, spent = 0;
  for (const l of todo) {
    const i = l.n;
    const out = join(OUT_VOICE, l.file);
    process.stdout.write(`${String(i).padStart(3)} ${l.id} ... `);
    const { audio, cost } = await post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      text: l.text,
      model_id: model,
      previous_text: lines[i - 1]?.text,
      next_text: lines[i + 1]?.text,
      voice_settings: settings,
    });
    writeFileSync(out, audio);
    made++;
    spent += cost;
    console.log(`${Math.round(audio.length / 1024)} KB${cost ? `, ${cost} credits` : ''}`);
  }
  const have = lines.filter((l) => existsSync(join(OUT_VOICE, l.file))).length;
  console.log(`${made} recorded${spent ? ` (${spent.toLocaleString('en-US')} credits)` : ''}; ${have} of ${lines.length} lines now have a recording.`);
}

async function music(force: boolean) {
  const model = env('ELEVENLABS_MUSIC_MODEL', 'music_v1');
  mkdirSync(OUT_MUSIC, { recursive: true });
  for (const era of ERA_ORDER) {
    const out = join(OUT_MUSIC, `${era}.mp3`);
    if (existsSync(out) && !force) continue;
    process.stdout.write(`${era} ... `);
    const { audio } = await post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      prompt: MUSIC[era], music_length_ms: 150_000, model_id: model, force_instrumental: true,
    });
    writeFileSync(out, audio);
    console.log(`${Math.round(audio.length / 1024)} KB`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const limit = Number(rest.find((a) => a.startsWith('--limit='))?.slice(8)) || Infinity;
const ids = rest.filter((a) => !a.startsWith('--'));
if (cmd === 'export') exportScript();
else if (cmd === 'voice') voice(force, ids, limit, rest.includes('--dry')).catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'music') music(force).catch((e) => { console.error(e.message); process.exit(1); });
else { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(cmd ? 1 : 0); }
