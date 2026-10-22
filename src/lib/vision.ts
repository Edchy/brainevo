import { events } from '../data';

/**
 * "See through their eyes": the painting shows each stretch of the story the way the brains of the time could perceive
 * it. Nobody watches the cosmos; the first life only senses light and dark; the Cambrian brings the first image-forming
 * eyes; early vertebrates see with four kinds of colour cone (some reaching into ultraviolet), more than we do; the
 * mammals' long night costs them two of those cones, so they see in two colours; Old World primates regain a third and
 * ripe fruit leaps out of the leaves. The oil pass reads these as uniforms (src/style/oil), the time axis shows the note.
 *
 * Sources: Lamb (2013) Evolution of phototransduction, vertebrate photoreceptors and retina; Jacobs (2009) Evolution of
 * colour vision in mammals; Gerkema et al. (2013) The nocturnal bottleneck and the evolution of activity patterns in
 * mammals. (Listed under the matching events too.)
 */
export interface Vision {
  /** brush footprint multiplier: a coarse, unfocused image is painted with broader strokes */
  brush: number;
  /** 0..1 how far colour is drained to light and dark, with no exceptions (no colour sense at all) */
  blind: number;
  /** 0..1 red-green collapsed into one channel (two-cone, dichromatic vision) */
  dichro: number;
  /** 0..1 richer than human colour (four cones, ultraviolet): saturation and a violet lift in the light */
  rich: number;
  /** 0..1 not painted yet: the human future is only a chalk underdrawing on the ground */
  sketch: number;
}

interface Stage {
  from: string; v: Vision; note: string | null;
  /** stations the note stays up (default: the whole stage) */
  noteFor?: number;
  /** when the change happens, in stations relative to the event (default: while you approach it) */
  ramp?: readonly [number, number];
}

const NONE: Vision = { brush: 1, blind: 0, dichro: 0, rich: 0, sketch: 0 };
const STAGES: Stage[] = [
  { from: 'big-bang', v: NONE, note: 'Nobody is watching yet' },
  { from: 'first-life', v: { ...NONE, brush: 1.55, blind: 0.86 }, note: 'No eyes yet: only light and dark' },
  { from: 'cambrian-explosion-eyes', v: { ...NONE, brush: 1.2, rich: 0.35 }, note: 'Through the first eyes' },
  { from: 'first-vertebrates-neural-crest', v: { ...NONE, rich: 1 }, note: 'In four colours, more than you see' },
  { from: 'nocturnal-bottleneck', v: { ...NONE, dichro: 1 }, note: 'In two colours, as early mammals saw' },
  // the colour floods in as you arrive, while the fruit is on screen
  { from: 'trichromatic-vision', v: NONE, note: 'In three colours, as you see', noteFor: 2.5, ramp: [-0.32, 0.02] },
  // what comes next: the human future is only sketched; where physics decides, it is painted again
  { from: 'minds-and-machines', v: { ...NONE, sketch: 1 }, note: 'Only sketched: this part is up to us' },
  { from: 'sun-brightens', v: NONE, note: 'Painted again: physics decides this part', noteFor: 1.2 },
];

const index = (id: string) => events.findIndex((e) => e.id === id);
const AT = STAGES.map((s) => index(s.from));
/** a stage takes over while you approach its event: done by the time you arrive */
const RAMP = [-0.75, -0.08] as const;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** perception at a continuous station position */
export function visionAt(f: number): Vision {
  const out = { ...STAGES[0].v };
  for (let i = 1; i < STAGES.length; i++) {
    const [r0, r1] = STAGES[i].ramp ?? RAMP;
    const k = smooth((f - (AT[i] + r0)) / (r1 - r0));
    if (k <= 0) break;
    const v = STAGES[i].v;
    out.brush += (v.brush - out.brush) * k;
    out.blind += (v.blind - out.blind) * k;
    out.dichro += (v.dichro - out.dichro) * k;
    out.rich += (v.rich - out.rich) * k;
    out.sketch += (v.sketch - out.sketch) * k;
  }
  return out;
}

/** the note for the time axis at a station position, or null once vision is like ours */
export function visionNote(f: number): string | null {
  let s = 0;
  for (let i = 1; i < STAGES.length; i++) if (f >= AT[i] + (STAGES[i].ramp ?? RAMP)[0] * 0.5) s = i;
  const st = STAGES[s];
  if (st.noteFor !== undefined && f > AT[s] + st.noteFor) return null;
  return st.note;
}
