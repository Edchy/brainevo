import type { ComponentType } from 'react';

export type StyleId = 'ink' | 'specimen' | 'signal' | 'cartoon' | 'oil';
export type UiVariant = 'minimal' | 'hud' | 'tidy';

export interface StyleDef {
  id: StyleId;
  name: string;
  blurb: string;
  /**
   * Post-processing for this look, rendered inside the EffectComposer AFTER bloom (and after the title layer).
   * Return react-postprocessing effects (e.g. `<primitive object={effect} />` or wrapEffect components). Must be
   * switchable at runtime. May read `world` (scroll velocity etc.) in useFrame to animate uniforms.
   */
  Effects: ComponentType;
  /** multiplier on the mood-driven bloom intensity (default 1) */
  bloomScale?: number;
  /** clear colour tint multiplier / extra: optional, 0..1 mix of scene background toward `bg` */
  bg?: string;
}

export interface Settings {
  style: StyleId;
  ui: UiVariant;
  /** depth-sandwiched headlines on/off */
  titles: boolean;
  /** show the Lab panel (always on while experimenting) */
  lab: boolean;
}
