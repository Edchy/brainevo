import type { StyleDef } from '../types';
import './theme.css';

/** The first version's look: the scenes exactly as authored (bloom + vignette only), no style pass. */
export const originalStyle: StyleDef = {
  id: 'original',
  name: 'Original',
  blurb: 'The first version: scenes as authored, just bloom and vignette.',
  Effects: () => null,
};
