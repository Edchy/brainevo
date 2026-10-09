import type { StyleDef } from '../types';
import './theme.css';

/** TODO(mono agent): implement the Monochrome look (see brief). */
export const monoStyle: StyleDef = {
  id: 'mono',
  name: 'Monochrome',
  blurb: 'Black, white and light. Minimal, precise, immersive.',
  Effects: () => null,
};
