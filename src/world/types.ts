import type { ComponentType } from 'react';

export interface CameraPose {
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
}

export interface Mood {
  /** background clear colour (any CSS colour string) */
  bg?: string;
  /** bloom intensity, roughly 0..3 */
  bloom?: number;
}

/** Mutable per-scene state, updated every frame by the engine. Read it inside useFrame. */
export interface SceneState {
  /** 0..1 progress through this scene's window. Scrubs both directions. */
  t: number;
  /** 0..1 crossfade weight. 0 = invisible (scene is hidden), 1 = fully present. */
  weight: number;
  /** true when weight > 0 */
  active: boolean;
}

export interface SceneDef {
  /** unique, kebab-case */
  id: string;
  /** event ids bounding the scene: window = [index(from) - lead, index(to) + tail] in "station" units */
  from: string;
  to: string;
  /** station units the window extends before `from` / after `to` (default 0.4) */
  lead?: number;
  tail?: number;
  /** station units over which weight ramps 0..1 outside the window (default 0.6) */
  fade?: number;
  /**
   * This scene continues the previous one as a single shot (it plays over it rather than replacing it), so the engine
   * skips the dip-to-dark at the hand-off. Default false: overlapping scenes dip through dark at the crossfade midpoint.
   */
  layer?: boolean;
  /** The 3D content. Render into the parent <group>. Use useScene() + useFrame() to animate. */
  Component: ComponentType;
  /** Camera pose as a function of local progress t. Blended by weight across scenes. */
  camera?: (t: number) => CameraPose;
  /** Background colour / bloom as a function of local progress t. Blended by weight. */
  mood?: (t: number) => Mood;
  /**
   * Distance from the camera (world units) of the plane the depth-sandwiched headline sits on: nearer geometry
   * hides the type, farther geometry sits behind it. Number or function of t. Default: the camera's focal distance
   * |pos - look|, so things at the focal point are half in front of / half behind the title.
   */
  titleDepth?: number | ((t: number) => number);
  /**
   * Where the headline sits for events in this scene (themes with --title-placement: art). x,y are 0..1 of the frame
   * (x is the left edge / centre / right edge depending on `align`); size multiplies the type size. Pick the half of
   * the frame the hero is not in. Can also be set centrally in src/style/titles/anchors.ts.
   */
  titleAnchor?: { x: number; y: number; align?: 'left' | 'center' | 'right'; size?: number };
}
