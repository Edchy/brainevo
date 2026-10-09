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
uniform float uSplash;  // max hue kept for strongly saturated source pixels
uniform float uSatLow;
uniform float uSatHigh;
uniform float uBase;    // hue kept for low-saturation pixels
uniform float uClarity; // local contrast

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
  // only the frame edge and the very dimmest haze soften; detail elsewhere is kept
  float dim = smoothstep(0.10, 0.008, L);
  float k = clamp(dim * 0.45 * uCrush + smoothstep(0.7, 1.1, r) * 0.45, 0.0, 0.8);
  vec3 c = mix(raw, soft, k);
  // clarity: unsharp local contrast, strongest in shadows and mids so surfaces, fur and membranes read
  vec3 det = clamp(raw - soft, -0.3, 0.3);
  c += det * uClarity * (0.35 + 0.65 * smoothstep(0.01, 0.2, L)) * (1.0 - k);
  c = max(c + delta, 0.0);

  // luminance, then a filmic curve: gentle black point and toe, soft shoulder
  float g = lum(c);
  float x = max(g - 0.006 * uCrush, 0.0);
  float toe = x / (x + 0.012 * uCrush + 1e-4);
  x = mix(x, x * toe, 0.6 * uCrush);
  float y = 1.0 - exp(-x * 1.25);
  y = pow(y, mix(1.0, 1.14, uCrush));                      // keeps haze down, but shadow detail stays visible
  y = mix(y, y * y * (3.0 - 2.0 * y), 0.22);
  float vg = 1.0 - smoothstep(0.25, 1.0, r);
  y *= mix(mix(0.8, 1.0, vg), 1.0, smoothstep(0.15, 0.8, y));

  // a soft pocket of shade under the caption and along the time axis
  vec2 cq = (uv - vec2(0.2, 0.17)) * vec2(uRes.x / uRes.y, 1.0);
  y *= 1.0 - 0.42 * smoothstep(0.38, 0.0, length(cq * vec2(0.8, 1.35))) * uCrush;
  y *= 1.0 - 0.3 * smoothstep(0.1, 0.0, uv.y) * uCrush;

  // colour splashes: keep hue where the SOURCE is strongly saturated over a coherent area, desaturate the rest
  vec3 sc = max(soft, raw * 0.5);
  float mxs = max(max(sc.r, sc.g), sc.b), mns = min(min(sc.r, sc.g), sc.b);
  float satS = (mxs - mns) / max(mxs, 0.04);                 // blurred saturation: tiny noisy specks average out
  float mxr = max(max(raw.r, raw.g), raw.b), mnr = min(min(raw.r, raw.g), raw.b);
  float satR = (mxr - mnr) / max(mxr, 0.04);
  float sat = min(satR, satS * 1.25);
  float lit = smoothstep(0.04, 0.24, max(mxr, mxs));         // dark pixels have meaningless saturation
  float keep = smoothstep(uSatLow, uSatHigh, sat) * lit;
  keep = uBase + (uSplash - uBase) * keep;
  vec3 chroma = clamp((c - g) / max(g, 0.03), -1.6, 1.6);
  vec3 col = vec3(y) * (1.0 + chroma * keep);
  col = max(col, 0.0);
  // filmic shoulder on the brightest channel so saturated light rolls off to white instead of clipping
  float m = max(max(col.r, col.g), col.b);
  float mc = m > 0.7 ? 0.7 + (1.0 - exp(-(m - 0.7) * 2.2)) * 0.45 : m;
  col *= mc / max(m, 1e-4);
  col *= mix(vec3(1.0), vec3(0.985, 0.995, 1.015), smoothstep(0.35, 1.0, y) * (1.0 - keep));

  // grain: fine, luminance dependent, frozen unless the timeline moves
  vec2 fc = floor(gl_FragCoord.xy / max(1.0, s));
  float n = hash(fc + uSeed) + hash(fc * 1.37 + uSeed + 17.0) - 1.0;
  float gl = 4.0 * y * (1.0 - y) * smoothstep(0.0, 0.05, y);
  col += n * uGrain * (0.25 + gl) * (0.4 + 0.6 * y);
  // dither against banding in dark gradients (static, triangular)
  col += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 7.0) - 1.0) / 255.0 * step(0.0015, y);

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
        ['uSplash', new Uniform(0.85)],
        ['uSatLow', new Uniform(0.5)],
        ['uSatHigh', new Uniform(0.85)],
        ['uBase', new Uniform(0.1)],
        ['uClarity', new Uniform(0.55)],
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
