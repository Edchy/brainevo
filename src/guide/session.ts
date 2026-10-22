import { useSyncExternalStore } from 'react';
import type { VoiceConversation } from '@elevenlabs/client';
import { events } from '../data';
import { world } from '../world/store';
import { getNav } from '../lib/nav';
import { closeMirror, getMirror, onMirror, openMirror } from '../lib/mirror';
import { getAge, onAge, setAge } from '../lib/age';
import { getPlay, onPlay, openPlay } from '../play/kit';
import { holdNarration } from '../audio/narration';
import { duck } from '../audio/engine';
import { stopWatch } from '../lib/watch';
import { BREAKTHROUGHS } from './tools';
import type { Breakthrough } from '../types';

/**
 * The voice guide's session (dev only, see scripts/guide-agent.ts): connects to the ElevenLabs agent with a token
 * from the local dev server, gives it hands on the site (the tools in ./tools.ts), and keeps it in step with notes
 * marked "[site]": quiet context as the visitor moves, and an occasional nudge to offer something (the mirror test,
 * their age, a toy, the question at the end). The recorded narration keeps quiet while the guide is on.
 */
export type GuideStatus = 'idle' | 'connecting' | 'on' | 'error';
export interface Line { who: 'you' | 'guide'; text: string }
interface State { status: GuideStatus; speaking: boolean; lines: Line[]; error: string | null; since: number }

let state: State = { status: 'idle', speaking: false, lines: [], error: null, since: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const getGuide = () => state;
export const useGuide = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);

let convo: VoiceConversation | null = null;
export const getConversation = () => convo;

// ---- where the visitor is ----------------------------------------------------------------------------------------
/** the station the visitor has settled on, or -1 (between stations, in the intro, past the end) */
function settledIndex() {
  const f = world.stationF, i = Math.round(f);
  return i >= 0 && i < events.length && Math.abs(f - i) < 0.3 ? i : -1;
}
const nearestIndex = () => Math.max(0, Math.min(events.length - 1, Math.round(world.stationF)));
const label = (i: number) => {
  const e = events[i];
  if (e.kind === 'coda') return `the closing reflection: "${e.summary}"`;
  return e.yearLabel === e.title ? e.title : `${e.title}, ${e.yearLabel}`;
};
/** the first moment of each breakthrough: where its chapter (and its "Try it yourself") begins */
const firstOf = new Map<string, number>();
events.forEach((e, i) => { if (e.breakthrough && !firstOf.has(e.breakthrough)) firstOf.set(e.breakthrough, i); });
function stationText() {
  const i = settledIndex();
  return world.stationF < -0.5 ? 'the very beginning, just before the Big Bang' : label(i >= 0 ? i : nearestIndex());
}

function describe() {
  const i = settledIndex(), e = events[i >= 0 ? i : nearestIndex()];
  const m = getMirror(), toy = getPlay(), age = getAge();
  const open = [
    m.wanted && m.status === 'on' ? `the mirror is open${e.id === 'mirror-self-recognition' ? ` (mirror test: ${m.phase})` : ''}` : null,
    toy ? `the "${toy}" toy is open` : null,
    age ? `they gave their age: ${age}` : null,
  ].filter(Boolean);
  return `${i >= 0 ? 'At' : 'Moving near'} [${e.id}] ${label(events.indexOf(e))}. On screen: "${e.summary}"${open.length ? `. Also: ${open.join('; ')}.` : ''}`;
}

/** travel, then answer once the journey has settled on the target (so the agent speaks about where they arrived) */
function travelTo(i: number) {
  const nav = getNav();
  if (!nav) return 'The timeline is not ready yet.';
  nav.goToIndex(i);
  lastPlace = i; // the arrival is the answer: no separate "now at" note
  return `Travelling to [${events[i].id}] ${label(i)}.`;
}

// ---- tools ---------------------------------------------------------------------------------------------------------
const ids = new Map(events.map((e, i) => [e.id, i]));
const lookup = (id: unknown) => (typeof id === 'string' ? ids.get(id.trim()) : undefined);
const unknownId = (id: unknown) => `There is no event "${String(id)}". Use an id exactly as written in the timeline.`;

const clientTools: Record<string, (p: Record<string, unknown>) => string | Promise<string>> = {
  go_to_event: ({ event_id }) => { const i = lookup(event_id); return i === undefined ? unknownId(event_id) : travelTo(i); },
  next_event: () => travelTo(Math.min(events.length - 1, (settledIndex() >= 0 ? settledIndex() : Math.floor(world.stationF)) + 1)),
  previous_event: () => travelTo(Math.max(0, (settledIndex() >= 0 ? settledIndex() : Math.ceil(world.stationF)) - 1)),
  where_are_we: () => describe(),
  get_event_details: ({ event_id }) => {
    const i = lookup(event_id);
    if (i === undefined) return unknownId(event_id);
    const e = events[i];
    return [
      `[${e.id}] ${label(i)}`,
      `What it meant for the brain: ${e.brainSignificance}`,
      e.details ? `More: ${e.details}` : '',
      e.brainVolumeCc ? `Brain size: about ${e.brainVolumeCc} cubic centimetres.` : '',
      e.sources?.length ? `Sources: ${e.sources.map((s) => s.label).join('; ')}.` : 'No sources listed.',
    ].filter(Boolean).join('\n');
  },
  open_mirror: async () => {
    const m = getMirror();
    if (m.status === 'unsupported') return 'This browser has no camera access, so the mirror cannot open.';
    let note = '';
    if (!['mirror-self-recognition', 'now'].includes(events[settledIndex()]?.id)) { getNav()?.goToEvent('mirror-self-recognition'); note = 'Travelling to the mirror test. '; await wait(2200); }
    openMirror();
    const s = await until(() => getMirror().status !== 'asking' && getMirror().status !== 'off', 15000);
    if (getMirror().status === 'denied') return `${note}The camera is blocked in this browser; they can allow it from the address bar.`;
    return s ? `${note}The mirror is open: they can see themselves.` : `${note}Asking for the camera: the browser is showing them a permission prompt.`;
  },
  close_mirror: () => { closeMirror(); return 'The mirror is closed and the camera is off.'; },
  set_visitor_age: ({ age }) => {
    const n = Math.round(Number(age));
    if (!(n > 0 && n < 120)) return 'That is not an age the chart can show (1 to 119).';
    ageFromGuide = n; // (before setAge: its listeners run at once)
    setAge(n);
    return `Done: ${Math.round(n * 52.18).toLocaleString('en')} of about 4,000 weeks are filled in.${events[settledIndex()]?.id === 'your-lifetime' ? '' : ' They will see it at Four Thousand Weeks.'}`;
  },
  open_toy: ({ breakthrough }) => {
    const b = String(breakthrough) as Breakthrough;
    if (!BREAKTHROUGHS.includes(b)) return `Unknown breakthrough. Use one of: ${BREAKTHROUGHS.join(', ')}.`;
    toyFromGuide = b;
    openPlay(b);
    return `The ${b} toy is open on their screen.`;
  },
  close_toy: () => { toyFromGuide = getPlay(); openPlay(null); return 'Closed.'; },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms: number) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { if (f()) return true; await wait(150); }
  return f();
}

// ---- notes from the site -------------------------------------------------------------------------------------------
let lastPlace = -2, placeSince = 0, candidate = -2, lastTalk = 0;
let ageFromGuide: number | null = null, toyFromGuide: Breakthrough | null = null;
const offered = new Set<string>();
const context = (text: string) => convo?.sendContextualUpdate(`[site] ${text}`);
/** a nudge the agent answers out loud: only when the conversation is quiet, and each kind only once */
function nudge(key: string, text: string) {
  if (!convo || offered.has(key) || state.speaking || performance.now() - lastTalk < 3500) return false;
  offered.add(key);
  convo.sendUserMessage(`[site] ${text}`);
  return true;
}

function arrived(i: number) {
  const e = events[i];
  lastPlace = i;
  context(`The visitor is now at [${e.id}] ${label(i)}.`);
  const m = getMirror();
  const mirrorOpen = m.wanted && m.status === 'on';
  if (e.id === 'mirror-self-recognition' && !mirrorOpen) pending = ['mirror-test', 'They have reached the mirror test. Offer, in a sentence, to let them take it themselves with their camera.'];
  else if (e.id === 'now' && !mirrorOpen) pending = ['now-mirror', 'They have reached Now. You might offer to show them, in the mirror, the brain this whole story led to.'];
  else if (e.id === 'your-lifetime' && getAge() == null) pending = ['age', 'Four Thousand Weeks. Ask, gently, how old they are, so the weeks they have lived can fill in. They may prefer not to say, which is fine.'];
  else if (e.id === 'coda-imagine') pending = ['imagine', 'The line on screen asks them to imagine being dead. Let it land. Then, softly, ask what they pictured.'];
  else if (e.breakthrough && firstOf.get(e.breakthrough) === i) {
    const n = BREAKTHROUGHS.indexOf(e.breakthrough) + 1;
    pending = [`bt-${e.breakthrough}`, `Breakthrough ${n} of 5, ${e.breakthrough}, begins here. If it fits the conversation, offer to let them try it themselves.`];
  } else pending = null;
  if (e.id === 'now' && mirrorOpen) context('The mirror is open here: it shows a painted brain inside their head, and the line "Behind your eyes, right now: 86 billion neurons, running on about 20 watts."');
}
let pending: [string, string] | null = null;

let lastPhase = '', lastToy: Breakthrough | null = null, lastAge: number | null = null, mirrorAnnounced = false;
const TEST = events.findIndex((e) => e.id === 'mirror-self-recognition');
function watchSite() {
  // where they are: a note once they have settled on a station for a moment (racing past says nothing)
  const i = settledIndex(), now = performance.now();
  if (i !== candidate) { candidate = i; placeSince = now; }
  else if (i >= 0 && i !== lastPlace && now - placeSince > 1400 && Math.abs(world.velocity) < 0.2) arrived(i); // velocity: viewport-widths per second
  // an offer waits for a quiet moment, and lapses if they move on
  if (pending && i === lastPlace && now - placeSince > 2500 && nudge(...pending)) pending = null;
  if (pending && i !== lastPlace) pending = null;
}

function onSiteChange() {
  const m = getMirror();
  const open = m.wanted && m.status === 'on';
  if (open && !mirrorAnnounced) { mirrorAnnounced = true; context('The mirror is open: they can see their own face, painted.'); }
  if (!m.wanted && mirrorAnnounced) { mirrorAnnounced = false; lastPhase = ''; context('The mirror is closed and the camera is off.'); }
  // the test's steps, while they are at the test (it starts over each time they come back to it)
  const atTest = Math.abs(world.stationF - TEST) < 0.6;
  const phase = open && atTest ? m.phase : '';
  if (phase && phase !== lastPhase) {
    if (phase === 'mark') context('The mirror test has begun: a red mark has appeared on their forehead in the mirror, and the screen asks "Something has changed. Can you find it?". Don\'t tell them where it is.');
    if (phase === 'hint') context('They have not found the mark yet; the screen now hints at their forehead.');
    if (phase === 'ask') context('The screen now asks whether they would reach for their own forehead or for the mirror, with two buttons.');
    if (phase === 'touched') {
      const t = 'They just touched their own forehead, not the mirror: they passed the mirror test.';
      offered.delete('touched');
      if (!nudge('touched', `${t} React, warmly and briefly.`)) context(t);
    }
    if (phase === 'answered') context(`They answered with a button: "${m.answer === 'forehead' ? 'my own forehead' : 'the mirror'}". The screen explains what that means.`);
  }
  if (open && atTest) lastPhase = phase;
  if (m.status === 'denied' && !offered.has('denied')) { offered.add('denied'); context('The camera is blocked in this browser.'); }

  const toy = getPlay();
  if (toy !== lastToy) {
    if (toy && toy !== toyFromGuide) context(`They opened the "${toy}" toy themselves.`);
    if (!toy && lastToy && lastToy !== toyFromGuide) context(`They closed the "${lastToy}" toy.`);
    toyFromGuide = null;
    lastToy = toy;
  }
  const age = getAge();
  if (age !== lastAge) { if (age != null && age !== ageFromGuide) context(`They typed their age: ${age}.`); lastAge = age; }
}

// ---- session ------------------------------------------------------------------------------------------------------
const ERRORS: Record<string, string> = {
  'no-key': 'Add ELEVENLABS_API_KEY to .env.local, then run npm run guide:setup.',
  'no-agent': 'Run npm run guide:setup once to create the guide.',
  'local-only': 'The guide only answers on this computer.',
  upstream: 'ElevenLabs refused the token (key, agent or credits?).',
  offline: 'Could not reach ElevenLabs.',
};

let timers: number[] = [];
let unsubs: (() => void)[] = [];

export async function startGuide() {
  if (state.status === 'connecting' || state.status === 'on') return;
  set({ status: 'connecting', error: null, lines: [], speaking: false, since: performance.now() });
  try {
    const fake = (window as unknown as { __guideFake?: boolean }).__guideFake;
    const r = fake ? null : await fetch('/__guide/token');
    const body = r ? await r.json().catch(() => ({})) as { token?: string; error?: string; detail?: string } : { token: 'fake' };
    if (r && (!r.ok || !body.token)) throw new Error(ERRORS[body.error ?? ''] ?? `Token request failed (${r.status}).`);
    const { Conversation } = fake ? { Conversation: fakeConversation } : await import('@elevenlabs/client');
    stopWatch();
    holdNarration(true);
    offered.clear(); pending = null; lastPlace = settledIndex(); candidate = lastPlace; placeSince = performance.now();
    lastPhase = ''; lastToy = getPlay(); lastAge = getAge(); mirrorAnnounced = false;
    convo = await Conversation.startSession({
      conversationToken: body.token!,
      connectionType: 'webrtc',
      dynamicVariables: { station: stationText(), visitor_age: getAge() ? String(getAge()) : 'not given' },
      clientTools,
      onConnect: () => set({ status: 'on', since: performance.now() }),
      onDisconnect: (d) => end(d.reason === 'error' ? d.message : null),
      onError: (message) => console.warn('[guide]', message),
      onModeChange: ({ mode }) => { set({ speaking: mode === 'speaking' }); lastTalk = performance.now(); },
      onMessage: ({ message, source }) => {
        if (message.startsWith('[site]')) return;
        lastTalk = performance.now();
        const line: Line = { who: source === 'ai' ? 'guide' : 'you', text: message };
        set({ lines: [...state.lines, line].slice(-6) });
      },
    }) as VoiceConversation;
    duck(true); // music sinks for the whole conversation (and leaks less into the microphone)
    timers = [window.setInterval(watchSite, 250)];
    unsubs = [onMirror(onSiteChange), onPlay(onSiteChange), onAge(onSiteChange)];
    if (getGuide().status === 'connecting') set({ status: 'on', since: performance.now() }); // (onConnect may already have)
  } catch (e) {
    end(e instanceof Error ? e.message : String(e));
  }
}

function end(error: string | null) {
  timers.forEach(clearInterval); timers = [];
  unsubs.forEach((u) => u()); unsubs = [];
  const c = convo;
  convo = null;
  if (c) c.endSession().catch(() => {});
  holdNarration(false);
  duck(false);
  set({ status: error ? 'error' : 'idle', speaking: false, error, since: performance.now() });
}
export const stopGuide = () => end(null);

/**
 * dev: `window.__guideFake = true` before pressing Talk runs the whole session against a stand-in that records what
 * the site would send (window.__guideLog), to check the notes and their timing without spending credits.
 */
const fakeConversation = {
  async startSession(o: { onConnect?: (p: { conversationId: string }) => void; dynamicVariables?: object }) {
    const log = ((window as unknown as { __guideLog?: unknown[] }).__guideLog = [] as unknown[]);
    log.push({ t: 0, start: o.dynamicVariables });
    const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
    setTimeout(() => o.onConnect?.({ conversationId: 'fake' }), 50);
    return {
      sendContextualUpdate: (text: string) => log.push({ t: at(), context: text }),
      sendUserMessage: (text: string) => log.push({ t: at(), nudge: text }),
      endSession: async () => { log.push({ t: at(), end: true }); },
      getInputVolume: () => 0, getOutputVolume: () => 0.2 + 0.2 * Math.sin(performance.now() / 300),
    } as unknown as VoiceConversation;
  },
};

if (typeof document !== 'undefined') {
  // a forgotten conversation in a background tab still costs minutes: end it after a minute out of sight
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now();
    else hiddenAt = 0;
    if (document.hidden) setTimeout(() => { if (hiddenAt && performance.now() - hiddenAt >= 59_000 && convo) stopGuide(); }, 60_000);
  });
  window.addEventListener('pagehide', () => { if (convo) stopGuide(); });
  // dev: window.__guide() -> state; window.__guideTool('go_to_event', { event_id: 'control-of-fire' }) runs a tool locally
  Object.assign(window as unknown as Record<string, unknown>, {
    __guide: () => ({ ...state, describe: describe() }),
    __guideTool: (name: string, p: Record<string, unknown> = {}) => clientTools[name]?.(p),
  });
}
