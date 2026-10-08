import type { StyleDef } from '../types';
import './theme.css';

/** TODO(style agent): replace the no-op Effects with this look's post-processing. */
const Effects = () => null;

export const inkStyle: StyleDef = {
  id: 'ink',
  name: "Luminous ink",
  blurb: "Glowing line-work and light on near-black: Cajal's drawings meet a star chart.",
  Effects,
};
