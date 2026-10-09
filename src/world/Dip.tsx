import { createElement, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { world } from './store';

/**
 * Dip-through-dark between scenes. While two scenes overlap, their half-faded layers stack into a busy double exposure;
 * instead the whole frame sinks toward black in the middle of the crossfade (`world.overlap`, 0..1) and rises into the
 * next scene. The centre keeps a little light so the hand-off reads as a breath, not a blackout.
 */
const frag = /* glsl */ `
uniform float uDip;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 p = uv - 0.5;
  float edge = smoothstep(0.15, 0.75, length(p * vec2(1.6, 1.0)));
  float k = uDip * mix(0.8, 1.0, edge);
  // linear light: (1-k)^2.4 so the dip is perceptually as deep as k says once encoded to sRGB
  outputColor = vec4(inputColor.rgb * pow(1.0 - k, 2.4), inputColor.a);
}`;

class DipEffect extends Effect {
  constructor() {
    super('DipEffect', frag, { uniforms: new Map([['uDip', new Uniform(0)]]) });
  }
}

/** how deep the dip goes at full overlap */
const DEPTH = 0.88;

export default function Dip() {
  const effect = useMemo(() => new DipEffect(), []);
  if (import.meta.env.DEV) (window as unknown as { __dip?: DipEffect }).__dip = effect;
  useFrame(() => {
    // already deep by the time a second scene is a third of the frame, so the double exposure is never seen in full.
    // A pure function of the (already eased) scroll position, so it scrubs exactly and holds still when paused.
    const o = Math.min(1, world.overlap / 0.6);
    (effect.uniforms.get('uDip') as Uniform<number>).value = DEPTH * o * o * (3 - 2 * o);
  });
  return createElement('primitive', { object: effect, dispose: null });
}
