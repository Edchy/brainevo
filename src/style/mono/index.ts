import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';
import type { StyleDef } from '../types';
import { world } from '../../world/store';
import './theme.css';

/**
 * Monochrome: one cheap pass (5 taps). Filmic tone curve with deep blacks, hue reduced to a whisper that survives only in
 * the most emissive light, dim detail softened and sunk into negative space, a gentle centre emphasis, soft frame edges,
 * and film grain that only re-seeds while the timeline moves (frozen at rest and with reduced motion).
 */
const frag = /* glsl */ `
uniform vec2 uRes;
uniform float uColor;   // fraction of source chroma kept (0 = pure greyscale)
uniform float uSeed;
uniform float uGrain;   // grain amplitude
uniform float uCrush;   // black-point / clutter suppression 0..1

float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 px = 1.0 / uRes;
  float s = max(1.0, uRes.y / 1000.0);
  vec2 o = px * 1.5 * s;                                   // bilinear taps => a smooth ~4px kernel
  vec3 raw = texture2D(inputBuffer, uv).rgb;
  vec3 soft = 0.25 * (texture2D(inputBuffer, uv + vec2(-o.x, -o.y)).rgb + texture2D(inputBuffer, uv + vec2(o.x, -o.y)).rgb
                    + texture2D(inputBuffer, uv + vec2(-o.x,  o.y)).rgb + texture2D(inputBuffer, uv + vec2(o.x,  o.y)).rgb);
  vec3 delta = inputColor.rgb - raw;                       // bloom + headline layer + vignette

  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(p * vec2(0.85, 1.0));

  float L = lum(raw);
  // dim detail falls out of focus; the frame edge softens a touch
  float dim = smoothstep(0.30, 0.015, L);
  float k = clamp(dim * 0.75 * uCrush + smoothstep(0.62, 1.05, r) * 0.55, 0.0, 0.9);
  vec3 c = mix(raw, soft, k);
  // clean local contrast on lit forms (unsharp, clamped: no ringing)
  vec3 det = clamp(raw - soft, -0.25, 0.25);
  c += det * 0.3 * smoothstep(0.08, 0.5, L) * (1.0 - k);
  c = max(c + delta, 0.0);

  // luminance, then a filmic curve: black point, toe, shoulder
  float g = lum(c);
  float x = max(g - 0.022 * uCrush, 0.0);
  float toe = x / (x + 0.05 * uCrush + 1e-4);               // crushes the lowest levels
  x = mix(x, x * toe, 0.9 * uCrush);
  float y = 1.0 - exp(-x * 1.1);                            // soft shoulder, whites stay luminous
  y = pow(y, mix(1.0, 2.0, uCrush));                       // sinks haze and mid fog into the dark
  y = mix(y, y * y * (3.0 - 2.0 * y), 0.3);                 // gentle S
  // centre emphasis (dim things recede more than bright ones)
  float vg = 1.0 - smoothstep(0.25, 1.0, r);
  y *= mix(mix(0.62, 1.0, vg), 1.0, smoothstep(0.2, 0.9, y));

  // a soft pocket of shade under the caption (lower left) and along the time axis, part of the grade rather than a box
  vec2 cq = (uv - vec2(0.2, 0.17)) * vec2(uRes.x / uRes.y, 1.0);
  y *= 1.0 - 0.5 * smoothstep(0.38, 0.0, length(cq * vec2(0.8, 1.35))) * uCrush;
  y *= 1.0 - 0.35 * smoothstep(0.1, 0.0, uv.y) * uCrush;

  // hue: a whisper, strongest only in genuinely emissive light
  vec3 chroma = (c - g) / max(g, 0.02);
  chroma = clamp(chroma, -1.5, 1.5);
  float emis = smoothstep(0.12, 0.9, y);
  vec3 col = vec3(y) * (1.0 + chroma * uColor * (0.35 + 0.65 * emis));
  // faint cool-white in highlights, near-neutral shadows
  col *= mix(vec3(1.0), vec3(0.975, 0.99, 1.02), smoothstep(0.35, 1.0, y));

  // grain: fine, luminance dependent, frozen unless the timeline moves
  vec2 fc = floor(gl_FragCoord.xy / max(1.0, s));
  float n = hash(fc + uSeed) + hash(fc * 1.37 + uSeed + 17.0) - 1.0;
  float gl = 4.0 * y * (1.0 - y) * smoothstep(0.0, 0.05, y);
  col += n * uGrain * (0.25 + gl) * (0.4 + 0.6 * y);
  // banding dither (static)
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.002, y);

  outputColor = vec4(max(col, 0.0), 1.0);
}
`;

class MonoEffect extends Effect {
  constructor() {
    super('MonoEffect', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uRes', new Uniform(new Vector2(1280, 720))],
        ['uColor', new Uniform(0.12)],
        ['uSeed', new Uniform(0)],
        ['uGrain', new Uniform(0.016)],
        ['uCrush', new Uniform(1)],
      ]),
    });
  }
  override setSize(width: number, height: number) {
    (this.uniforms.get('uRes')!.value as Vector2).set(width, height);
  }
}

function Effects() {
  const fx = useMemo(() => new MonoEffect(), []);
  useEffect(() => {
    (window as unknown as { __mono?: MonoEffect }).__mono = fx;
    return () => fx.dispose();
  }, [fx]);
  useFrame(() => {
    // grain re-seeds in steps only while the timeline moves; at rest (and with reduced motion) it is frozen
    fx.uniforms.get('uSeed')!.value = world.reduced ? 0 : (Math.floor(world.stationF * 24) % 997) * 7.31;
    fx.uniforms.get('uGrain')!.value = world.reduced ? 0.012 : 0.016;
  });
  return createElement('primitive', { object: fx });
}

export const monoStyle: StyleDef = {
  id: 'mono',
  name: 'Monochrome',
  blurb: 'Black, white and light. Minimal, precise, immersive.',
  Effects,
  bloomScale: 0.9,
};
