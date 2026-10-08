import type { StyleDef } from '../types';
import './theme.css';

/** TODO(style agent): replace the no-op Effects with this look's post-processing. */
const Effects = () => null;

export const specimenStyle: StyleDef = {
  id: 'specimen',
  name: "Living specimen",
  blurb: "Backlit museum plates and microscope slides: warm paper grain, organic colour.",
  Effects,
};
