import { createElement, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { getSettings } from '../style/store';

/**
 * Reading ground. The painting darkens toward its lower edge and most of all under the caption (lower left), the way a
 * painter lets a foreground sink into shadow, so the text always sits on dark paint. It runs BEFORE the title layer
 * and the oil pass: the darkened area is painted (ground colour, brush texture) rather than overlaid as a flat gradient.
 * Strength follows the text layout setting: 'scrim' full, 'band' only a soft edge into the text band, 'overlay' none.
 */
const frag = /* glsl */ `
// a (no-op) UV stage: the composer then ends this pass here, so the oil pass after it samples the finished frame
void mainUv(inout vec2 uv) {}
uniform float uScrim;
uniform float uEdge;
uniform float uAspect;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  // vertical fall-off: dark at the bottom, gone by just above the middle
  float v = 1.0 - smoothstep(0.0, 0.62, uv.y);
  v = v * v * (3.0 - 2.0 * v);
  // heavier on the left where the caption is; the right side keeps more of the picture
  float h = mix(1.0, 0.5, smoothstep(0.3, 0.95, uv.x));
  // an extra pocket of shade right under the caption block
  vec2 c = (uv - vec2(0.24, 0.17)) * vec2(uAspect, 1.0);
  float pocket = smoothstep(0.55, 0.0, length(c * vec2(0.62, 1.25)));
  float k = uScrim * clamp(v * h * 0.86 + pocket * 0.3, 0.0, 0.93);
  // band layout: the picture only melts into the band along its lower edge
  k = max(k, uEdge * smoothstep(0.16, 0.0, uv.y) * 0.9);
  // linear light: (1-k)^2 so the darkening reads as k once encoded
  outputColor = vec4(inputColor.rgb * pow(1.0 - k, 2.0), inputColor.a);
}`;

class ScrimEffect extends Effect {
  constructor() {
    super('ScrimEffect', frag, {
      uniforms: new Map([['uScrim', new Uniform(1)], ['uEdge', new Uniform(0)], ['uAspect', new Uniform(1.6)]]),
    });
  }
}

export default function Scrim() {
  const effect = useMemo(() => new ScrimEffect(), []);
  useFrame((state, dt) => {
    const mode = getSettings().text;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    const u = effect.uniforms;
    const s = u.get('uScrim') as Uniform<number>, e = u.get('uEdge') as Uniform<number>;
    s.value += ((mode === 'scrim' ? 1 : 0) - s.value) * k;
    e.value += ((mode === 'band' ? 1 : 0) - e.value) * k;
    (u.get('uAspect') as Uniform<number>).value = state.size.width / Math.max(1, state.size.height);
  });
  return createElement('primitive', { object: effect, dispose: null });
}
