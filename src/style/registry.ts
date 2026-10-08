import type { StyleDef, StyleId } from './types';
import { inkStyle } from './ink';
import { specimenStyle } from './specimen';
import { signalStyle } from './signal';
import { cartoonStyle } from './cartoon';
import { oilStyle } from './oil';

export const STYLE_DEFS: Record<StyleId, StyleDef> = {
  ink: inkStyle,
  specimen: specimenStyle,
  signal: signalStyle,
  cartoon: cartoonStyle,
  oil: oilStyle,
};
