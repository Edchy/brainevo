import type { StyleDef } from '../types';
import './theme.css';

/** TODO(style agent): replace the no-op Effects with this look's post-processing. */
const Effects = () => null;

export const signalStyle: StyleDef = {
  id: 'signal',
  name: "Signal and noise",
  blurb: "Neon gradients, scanlines and chromatic aberration that surge with scroll speed.",
  Effects,
};
