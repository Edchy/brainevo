import type { BrushId, PaletteId } from './types';

type V3 = [number, number, number];

export interface Palette {
  id: PaletteId;
  name: string;
  blurb: string;
  /** linear-light colour the painting's shadows sink into (the ground showing through thin dark paint) */
  ground: V3;
  /** overall colour cast (multiplier) */
  cast: V3;
  /** tint of shadows and of highlights (multipliers, blended by luminance) */
  toneLo: V3;
  toneHi: V3;
  /** colour of the light glinting on impasto ridges */
  spec: V3;
  /** saturation (1 = source) */
  sat: number;
  /** 0..1 how far colour is drained to a single hue; saturated, emissive sources keep theirs as colour splashes */
  mono: number;
}

export const PALETTES_DEF: Record<PaletteId, Palette> = {
  prussian: {
    id: 'prussian', name: 'Prussian', blurb: 'Night-blue ground, warm lamplit highlights.',
    ground: [0.012, 0.016, 0.05], cast: [1.06, 1.0, 0.88], toneLo: [1, 1, 1], toneHi: [1, 1, 1], spec: [1, 0.93, 0.78], sat: 1.2, mono: 0,
  },
  grisaille: {
    id: 'grisaille', name: 'Grisaille', blurb: 'Monochrome underpainting in greys; only true colour survives.',
    ground: [0.014, 0.0145, 0.016], cast: [1, 1, 1], toneLo: [0.95, 0.98, 1.04], toneHi: [1.05, 1.0, 0.92], spec: [1, 0.97, 0.92], sat: 1.05, mono: 1,
  },
  umber: {
    id: 'umber', name: 'Umber', blurb: 'Rembrandt browns: warm dark ground, golden light.',
    ground: [0.04, 0.021, 0.008], cast: [1.08, 0.97, 0.8], toneLo: [1.02, 0.98, 0.94], toneHi: [1.05, 1.0, 0.86], spec: [1, 0.9, 0.7], sat: 1.05, mono: 0,
  },
  verdigris: {
    id: 'verdigris', name: 'Verdigris', blurb: 'Deep green-teal ground, cool shadows, warm light.',
    ground: [0.006, 0.03, 0.026], cast: [0.96, 1.02, 0.98], toneLo: [0.94, 1.02, 1.0], toneHi: [1.04, 1.0, 0.92], spec: [0.95, 1, 0.92], sat: 1.05, mono: 0,
  },
  oxblood: {
    id: 'oxblood', name: 'Oxblood', blurb: 'Deep crimson ground, like a red-primed canvas.',
    ground: [0.045, 0.008, 0.011], cast: [1.04, 0.96, 0.94], toneLo: [1.04, 0.95, 0.96], toneHi: [1.04, 0.98, 0.9], spec: [1, 0.9, 0.82], sat: 1.08, mono: 0,
  },
};

export const BRUSH_DEF: Record<BrushId, { name: string; blurb: string; size: number; relief: number }> = {
  fine: { name: 'Fine', blurb: 'Small strokes, detail survives.', size: 0.8, relief: 1 },
  full: { name: 'Full', blurb: 'Broad loaded strokes, heavy impasto.', size: 1.75, relief: 1.45 },
};
