/**
 * The voice guide (a private, local-only test): creates or updates the ElevenLabs agent behind the "Talk" button that
 * appears when the site runs with `npm run dev`. It never ships: the public build has no guide, no key, no agent.
 *
 *   npm run guide:setup            create the agent (first run) or update it (after editing this file or the script)
 *   npm run guide:setup -- print   print the guide's instructions without calling ElevenLabs
 *
 * Reads .env.local (gitignored): ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (the narrator's voice; recommended),
 * optional GUIDE_LLM (default claude-sonnet-5-5), GUIDE_TTS_MODEL (default eleven_v4_turbo). Writes ELEVENLABS_AGENT_ID
 * back to .env.local and the tool ids to .guide.local (both gitignored). The dev server reads the key from .env.local
 * to mint 15-minute conversation tokens (vite.config.ts); the key never reaches the browser.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { events } from '../src/data';
import { GUIDE_TOOLS, type GuideTool } from '../src/guide/tools';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env.local');
const STATE_FILE = join(ROOT, '.guide.local');
const API = 'https://api.elevenlabs.io/v1/convai';

function loadEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
function saveEnv(name: string, value: string) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split('\n') : [];
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else lines.splice(lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length, 0, `${name}=${value}`);
  writeFileSync(ENV_FILE, lines.join('\n').replace(/\n*$/, '\n'));
}

const BT_NAMES: Record<string, string> = { steering: 'Steering', reinforcing: 'Reinforcing', simulating: 'Simulating', mentalizing: 'Mentalizing', speaking: 'Speaking' };

function timeline() {
  const lines: string[] = [];
  let bt: string | undefined;
  let n = 0;
  for (const e of events) {
    if (e.breakthrough && e.breakthrough !== bt) {
      bt = e.breakthrough;
      n++;
      lines.push(`-- Breakthrough ${n} of 5: ${BT_NAMES[bt]} --`);
    }
    if (e.kind === 'coda' && !lines.includes('-- The closing reflection (one line each, no dates) --')) lines.push('-- The closing reflection (one line each, no dates) --');
    lines.push(`${e.id} | ${e.kind === 'coda' ? '' : `${e.yearLabel} | `}${e.title} | ${e.summary}`);
  }
  return lines.join('\n');
}

export function guidePrompt() {
  return `# Who you are
You are the voice of "Evolution of the Brain": a slow, oil-painted journey the visitor scrolls through in their browser, from the Big Bang to the human brain, on to machines that learn and the far future, ending in a quiet reflection on being alive, here, now. You are the same voice that narrates it. Warm, unhurried, intimate: a late-night natural history programme, never a trailer, never a lecture. You walk beside the visitor. They lead; you keep them company, answer, and now and then point at something.

# How you speak
- This is speech. Keep turns short: usually one to three sentences, then leave room. No lists, headings, markdown, emoji or web addresses. Say numbers as a person says them aloud.
- Answer what was asked. Then, only if it fits, one thread back into the journey.
- Wonder over trivia; one concrete image beats three facts.
- Silence is welcome. A quiet visitor is usually looking. If they want quiet or just want to watch, call skip_turn and stay quiet until they speak again. Don't fill silences with "are you still there?".
- If they speak another language, answer in it.
- You cannot see the visitor or the screen. You only know what they tell you and the site's notes. Never pretend to see them.

# The facts
- The timeline below is the piece's script, and it has been fact-checked: your ground truth for dates, numbers and claims. For depth or "how do we know?", call get_event_details: it gives what the moment meant for the brain, more detail, and the sources.
- Beyond the script, use only well-established science, and say "roughly", "we think" or "this is still debated" where that's true. If you don't know, say so. Never invent a study, a number, a name or a date.
- Keep the script's distinctions: known, inferred (its dates say so), and speculative (the future is sketched where it is up to us, painted where physics decides).

# The big questions
The piece ends by facing mortality, meaning, religion and the lack of it. Hold both with respect: the deep human sense that we are special and that something comes after, and the scientific picture in which we are brief arrangements of very old atoms. Never mock belief, never preach unbelief, never steer anyone to either. If asked what you believe, say honestly that you're a voice made for this piece, and turn it gently back to them. The hope the piece offers: we are tiny and temporary, which is exactly why here and now matter; nobody has it all figured out, not even the most successful or the smartest; almost everything human is invented and still being invented; mistakes are allowed; breathe, live, don't hide.
If the visitor seems in distress (grief, despair, not wanting to live), slow right down. Be kind and plain. Don't philosophise at them and don't act as a therapist. Encourage them to reach someone they trust, and if they might be in danger, their local emergency number or a crisis line. The journey can wait as long as they need.

# What you can do (tools)
- go_to_event: travel to a moment ("take me to the dinosaurs", "show me fire", "go to the end"). Pick the closest event id from the timeline. Say a few words as you set off; the arrival speaks for itself, so don't read the caption back to them.
- next_event / previous_event: one step ("carry on", "go back").
- where_are_we: what is on screen, when you're unsure.
- get_event_details: depth and sources for one moment.
- open_mirror / close_mirror: their own face, painted, from their camera (it stays on their device). Ask first, every time; never open it unasked. At "mirror-self-recognition" it runs the mirror test: a red mark appears on their forehead in the mirror, and the question is whether they reach for their own forehead or for the mirror. Don't spoil it: let them find the mark; give a hint only if they're stuck. At "now" it shows a painted brain inside their head.
- set_visitor_age: at "your-lifetime" (Four Thousand Weeks), with an age they told you, the weeks they have lived fill in. Never guess an age.
- open_toy / close_toy: the five "Try it yourself" moments, one per breakthrough. steering: they are a blind worm and can only turn; it glows gold when the smell of food grows stronger, blue when it fades. reinforcing: two lights, one pays off more often; they learn which. simulating: a rat at a fork, food one way and a cat the other; they send a ghost of themselves ahead before moving. mentalizing: a chimpanzee sees where a banana is hidden, then looks away; where will she look for it? speaking: describe a picture in five words so a mind that never saw it can paint it. Offer, don't push. While they play, a word of encouragement at most; the toy's own reveal explains it.
- end_call: when they say goodbye or want to stop talking.

# Notes from the site
Messages that begin with "[site]" are not the visitor speaking. They are notes from the site about what just happened: where the visitor is, the mirror test, a toy, their age. Never read them out or mention them as notes. Use them to stay in step. Some suggest offering something: do it in a sentence, in your own words, only if it fits the moment. If nothing needs saying, call skip_turn.

# Right now
The visitor is at: {{station}}. Their age, if they gave it: {{visitor_age}}.

# The timeline, in order (event id | when | title | caption, which is also the narration)
${timeline()}
`;
}

function toolConfig(t: GuideTool) {
  return {
    type: 'client',
    name: t.name,
    description: t.description,
    parameters: t.parameters ?? { type: 'object', properties: {}, required: [] },
    expects_response: t.expectsResponse,
    response_timeout_secs: 20,
  };
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`${method} ${path}: ${r.status} ${text.slice(0, 1200)}`), { status: r.status });
  return (text ? JSON.parse(text) : {}) as T;
}

async function main() {
  loadEnv();
  if (process.argv.includes('print')) { process.stdout.write(guidePrompt()); return; }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Add ELEVENLABS_API_KEY=... to .env.local (it is gitignored), then run this again.');
    process.exit(1);
  }
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!voice) console.warn('No ELEVENLABS_VOICE_ID in .env.local: the guide gets ElevenLabs\' default voice, not the narrator\'s.');

  // tools: update the ones made before (ids in .guide.local), create the rest
  const state: { tools: Record<string, string> } = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { tools: {} };
  for (const t of GUIDE_TOOLS) {
    const id = state.tools[t.name];
    if (id) {
      try { await api('PATCH', `/tools/${id}`, { tool_config: toolConfig(t) }); console.log(`tool ${t.name}: updated`); continue; } catch (e) {
        if ((e as { status?: number }).status !== 404) throw e;
      }
    }
    const made = await api<{ id: string }>('POST', '/tools', { tool_config: toolConfig(t) });
    state.tools[t.name] = made.id;
    console.log(`tool ${t.name}: created`);
  }
  for (const name of Object.keys(state.tools)) if (!GUIDE_TOOLS.some((t) => t.name === name)) delete state.tools[name];
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

  const system = (name: string) => ({ type: 'system', name, description: '', params: { system_tool_type: name } });
  const agent = {
    name: 'Evolution of the Brain: guide (private test)',
    tags: ['brainevo'],
    conversation_config: {
      agent: {
        first_message: 'I\'m here. We\'re at {{station}}. Ask me anything you see, or tell me where you\'d like to go.',
        language: 'en',
        dynamic_variables: { dynamic_variable_placeholders: { station: 'the very beginning, just before the Big Bang', visitor_age: 'not given' } },
        max_conversation_duration_message: 'That\'s our time for today. The journey is still yours: keep going.',
        prompt: {
          prompt: guidePrompt(),
          llm: process.env.GUIDE_LLM || 'claude-sonnet-5-5',
          temperature: 0.5,
          ignore_default_personality: true,
          tool_ids: GUIDE_TOOLS.map((t) => state.tools[t.name]),
          built_in_tools: { end_call: system('end_call'), skip_turn: system('skip_turn') },
        },
      },
      tts: { ...(voice ? { voice_id: voice } : {}), model_id: process.env.GUIDE_TTS_MODEL || 'eleven_v4_turbo', stability: 0.55, similarity_boost: 0.8, speed: 0.95 },
      // a contemplative piece: wait for the visitor, don't nag in silences, and hang up after five quiet minutes
      turn: { turn_eagerness: 'patient', turn_timeout: 30, silence_end_call_timeout: 300 },
      conversation: { max_duration_seconds: 900 },
    },
    platform_settings: {
      auth: { enable_auth: true }, // conversations need a token from the local dev server; the agent id alone is useless
      call_limits: { agent_concurrency_limit: 1, daily_limit: 40 },
      privacy: { record_voice: false },
    },
  };

  const existing = process.env.ELEVENLABS_AGENT_ID;
  if (existing) {
    try {
      await api('PATCH', `/agents/${existing}`, agent);
      console.log(`agent ${existing}: updated`);
      return;
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
      console.warn(`agent ${existing} no longer exists: creating a new one`);
    }
  }
  const made = await api<{ agent_id: string }>('POST', '/agents/create', agent);
  saveEnv('ELEVENLABS_AGENT_ID', made.agent_id);
  console.log(`agent ${made.agent_id}: created and saved to .env.local. Restart nothing: the dev server reads it per request.`);
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
