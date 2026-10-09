import type { StyleDef, StyleId } from './types';
import { monoStyle } from './mono';
import { originalStyle } from './original';
import { inkStyle } from './ink';
import { specimenStyle } from './specimen';
import { signalStyle } from './signal';
import { cartoonStyle } from './cartoon';
import { oilStyle } from './oil';

export const STYLE_DEFS: Record<StyleId, StyleDef> = {
  mono: monoStyle,
  original: originalStyle,
  ink: inkStyle,
  specimen: specimenStyle,
  signal: signalStyle,
  cartoon: cartoonStyle,
  oil: oilStyle,
};
