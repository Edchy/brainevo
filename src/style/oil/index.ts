import type { StyleDef } from '../types';
import './theme.css';

/** TODO(style agent): replace the no-op Effects with this look's post-processing. */
const Effects = () => null;

export const oilStyle: StyleDef = {
  id: 'oil',
  name: "Oil painting",
  blurb: "Impasto brush strokes, painterly colour, visible canvas.",
  Effects,
};
