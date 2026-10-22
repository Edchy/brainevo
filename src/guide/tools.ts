/**
 * The guide's hands: what the voice guide (an ElevenLabs agent) may do on the site. One list, read by both sides:
 * scripts/guide-agent.ts registers these with ElevenLabs, src/guide/session.ts implements them in the browser. Plain
 * data only (no DOM), so the setup script can import it.
 */
export interface GuideTool {
  name: string;
  description: string;
  /** JSON schema of the parameters (ElevenLabs' subset: object of string/number properties) */
  parameters?: { type: 'object'; properties: Record<string, { type: 'string' | 'number'; description: string; enum?: string[] }>; required: string[] };
  /** the agent waits for the browser's answer and hears it */
  expectsResponse: boolean;
}

export const BREAKTHROUGHS = ['steering', 'reinforcing', 'simulating', 'mentalizing', 'speaking'] as const;

export const GUIDE_TOOLS: GuideTool[] = [
  {
    name: 'go_to_event',
    description: 'Travel the timeline to one moment, by its event id from the timeline in your instructions. Use it whenever the visitor asks to go, see or show somewhere ("take me to the dinosaurs", "show me fire", "back to the start"). Returns where you arrived.',
    parameters: { type: 'object', properties: { event_id: { type: 'string', description: 'An event id exactly as written in the timeline, e.g. "control-of-fire".' } }, required: ['event_id'] },
    expectsResponse: true,
  },
  {
    name: 'next_event',
    description: 'Move one moment forward along the timeline ("carry on", "next", "keep going"). Returns where you arrived.',
    expectsResponse: true,
  },
  {
    name: 'previous_event',
    description: 'Move one moment back along the timeline ("go back", "the one before"). Returns where you arrived.',
    expectsResponse: true,
  },
  {
    name: 'where_are_we',
    description: 'What the visitor has on screen right now: the moment, its caption, and anything open (mirror, toy, their age). Use it when you are unsure where they are.',
    expectsResponse: true,
  },
  {
    name: 'get_event_details',
    description: 'The depth behind one moment: what it meant for the brain, extra detail, and the sources it rests on. Use it when the visitor asks "how do we know?", "tell me more", or a question the caption alone cannot answer.',
    parameters: { type: 'object', properties: { event_id: { type: 'string', description: 'An event id exactly as written in the timeline.' } }, required: ['event_id'] },
    expectsResponse: true,
  },
  {
    name: 'open_mirror',
    description: 'Open the mirror: the visitor\'s own face from their camera, painted in oil (the image stays on their device). Only after they have said yes. At "mirror-self-recognition" it runs the mirror test; at "now" it shows a painted brain inside their head. If they are elsewhere, it first travels to the mirror test.',
    expectsResponse: true,
  },
  {
    name: 'close_mirror',
    description: 'Close the mirror and switch the camera off.',
    expectsResponse: true,
  },
  {
    name: 'set_visitor_age',
    description: 'Fill in the weeks the visitor has already lived at "Four Thousand Weeks". Only with an age they told you themselves. It stays in their browser.',
    parameters: { type: 'object', properties: { age: { type: 'number', description: 'Their age in years, as they said it.' } }, required: ['age'] },
    expectsResponse: true,
  },
  {
    name: 'open_toy',
    description: 'Open one of the five "Try it yourself" moments, so the visitor\'s own brain does that breakthrough. Only after they want to.',
    parameters: { type: 'object', properties: { breakthrough: { type: 'string', description: 'Which breakthrough.', enum: [...BREAKTHROUGHS] } }, required: ['breakthrough'] },
    expectsResponse: true,
  },
  {
    name: 'close_toy',
    description: 'Close the open "Try it yourself" moment.',
    expectsResponse: true,
  },
];
