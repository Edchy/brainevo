import { createElement, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { SHADE_GLSL } from './shade';

/**
 * Reading ground (the "painted shade"). The painting darkens toward its lower edge and most of all under the caption
 * (lower left), the way a painter lets a foreground sink into shadow, so the text always sits on dark paint. It runs
 * BEFORE the oil pass, so the darkened area is painted (ground colour, brush texture) rather than overlaid as a flat
 * gradient; the oil pass ends with a glaze in the same shape (shade.ts) that takes its painted floor darker still.
 */
const frag = /* glsl */ `${SHADE_GLSL}
// a (no-op) UV stage: the composer then ends this pass here, so the oil pass after it samples the finished frame
void mainUv(inout vec2 uv) {}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  // linear light: (1-k)^2 so the darkening reads as k once encoded
  outputColor = vec4(inputColor.rgb * pow(1.0 - shade(uv), 2.0), inputColor.a);
}`;

class ScrimEffect extends Effect {
  constructor() {
    super('ScrimEffect', frag, { uniforms: new Map([['uAspect', new Uniform(1.6)]]) });
  }
}

export default function Scrim() {
  const effect = useMemo(() => new ScrimEffect(), []);
  useFrame((state) => {
    (effect.uniforms.get('uAspect') as Uniform<number>).value = state.size.width / Math.max(1, state.size.height);
  });
  return createElement('primitive', { object: effect, dispose: null });
}
