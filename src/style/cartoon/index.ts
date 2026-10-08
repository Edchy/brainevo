import type { StyleDef } from '../types';
import './theme.css';

/** TODO(style agent): replace the no-op Effects with this look's post-processing. */
const Effects = () => null;

export const cartoonStyle: StyleDef = {
  id: 'cartoon',
  name: "Cartoon",
  blurb: "Bold outlines, flat cel shading, playful and bright.",
  Effects,
};
