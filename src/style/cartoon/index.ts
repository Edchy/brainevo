import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Uniform, Vector2 } from 'three';
import { Effect, EffectAttribute } from 'postprocessing';
import type { StyleDef } from '../types';
import { world } from '../../world/store';
import './theme.css';

/**
 * Cartoon: one fullscreen pass (5 taps).
 *  1. dark void -> flat banded backdrop tinted by era accent (lifts the darkness)
 *  2. luminance posterised into 4 cel bands, hue preserved, saturation pumped
 *  3. halftone dots in the shadow band, sparkle crosses on hot highlights
 *  4. thick wobbly ink outline from a Roberts-cross on luma + chroma, widened by a second ring
 */
const frag = /* glsl */ `
uniform vec3 uAccent;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }

vec3 sampleW(vec2 uv){
  vec3 c = texture2D(inputBuffer, uv).rgb;
  return min(c, vec3(2.0));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = 1.0 / uRes;
  float s = clamp(uRes.y / 900.0, 0.8, 2.0);        // line scale with resolution
  float tq = floor(uTime * 6.0);                    // wobble ticks at 6fps (boiling line)
  vec2 wob = vec2(sin(uv.y * 38.0 + tq * 1.7), cos(uv.x * 31.0 + tq * 2.3)) * px * 1.4 * s;
  vec2 wuv = uv + wob;

  vec3 c = sampleW(uv);
  // wobbly neighbours, two rings (inner 1.4px, outer 2.6px) -> thick line
  vec2 d1 = px * 1.4 * s, d2 = px * 2.8 * s;
  vec3 a = sampleW(wuv + vec2(-d1.x, -d1.y));
  vec3 b = sampleW(wuv + vec2( d1.x,  d1.y));
  vec3 e = sampleW(wuv + vec2( d2.x, -d2.y));
  vec3 f = sampleW(wuv + vec2(-d2.x,  d2.y));
  float la = luma(a), lb = luma(b), le = luma(e), lf = luma(f);
  // compress so dim detail still reads: use sqrt-ish luminance
  float g1 = abs(sqrt(la) - sqrt(lb));
  float g2 = abs(sqrt(le) - sqrt(lf));
  float ch = length(a - b) * 0.5 + length(e - f) * 0.5;
  float edge = max(g1, g2) * 1.6 + ch * 0.6;
  float line = smoothstep(0.16, 0.30, edge);

  float L = luma(c);
  float Lc = sqrt(max(L, 0.0));

  // ---- backdrop: flat banded gradient in the era accent
  vec3 deep = vec3(0.10, 0.07, 0.30);
  vec3 tint = mix(deep, uAccent * 0.62, 0.8);
  float yb = floor((uv.y * 0.7 + (1.0 - uv.x) * 0.15) * 4.0) / 4.0; // 4 flat bands
  vec3 back = mix(tint * 0.38, tint * 0.95 + vec3(0.02, 0.0, 0.06), yb);
  back = sat(back, 1.6);
  // soft float: more backdrop where the scene is dark
  float voidM = 1.0 - smoothstep(0.03, 0.22, Lc * Lc * 1.0 + 0.0);
  voidM = 1.0 - smoothstep(0.02, 0.2, L);

  // ---- cel shading on the scene colour (hue kept: scale rgb by banded luma)
  float lum = max(L, 1e-4);
  float lq = Lc * 3.2;                                // 4 bands over sqrt-luma
  float fl = floor(lq), fr = fract(lq);
  float band = (fl + smoothstep(0.42, 0.58, fr)) / 3.2;
  float Lb = band * band;
  vec3 hue = c / lum;
  hue = normalize(hue + 1e-3) * 1.2;                  // keep chroma only
  vec3 cel = sat(hue * (0.12 + Lb * 1.15), 1.0);
  // fully bright lights go to a creamy highlight
  float hi = smoothstep(0.78, 0.9, Lc);
  cel = mix(cel, mix(cel, vec3(1.0, 0.97, 0.85), 0.55), hi);
  cel = sat(cel, 1.45);

  // halftone dots in the shadow bands
  vec2 hp = gl_FragCoord.xy / (5.0 * s);
  hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * hp;
  float dots = length(fract(hp) - 0.5);
  float shadowAmt = 1.0 - smoothstep(0.1, 0.55, Lc);
  float dotM = step(dots, 0.12 + 0.28 * shadowAmt) * smoothstep(0.02, 0.2, Lc) * (1.0 - smoothstep(0.35, 0.6, Lc));
  cel = mix(cel, cel * 0.55, dotM);

  vec3 col = mix(cel, back, voidM);
  // faint dots on the backdrop too (paper-print feel)
  col = mix(col, col * 1.18 + 0.03, step(dots, 0.1) * voidM * 0.7);

  // ---- sparkles on hot highlights (twinkling four-point stars)
  vec2 cell = floor(gl_FragCoord.xy / (34.0 * s));
  float hsh = hash(cell);
  vec2 cp = (fract(gl_FragCoord.xy / (34.0 * s)) - 0.5) * 34.0 * s;
  float tw = 0.5 + 0.5 * sin(uTime * 3.0 + hsh * 40.0);
  float arm = min(abs(cp.x), abs(cp.y));
  float rad = length(cp);
  float spark = step(0.9, hsh) * step(0.82, Lc) * smoothstep((7.0 + 7.0 * tw) * s, 0.0, rad) * smoothstep(1.4 * s, 0.0, arm);
  col = mix(col, vec3(1.0, 0.98, 0.9), clamp(spark * 1.5, 0.0, 1.0));

  // ---- ink
  vec3 ink = vec3(0.07, 0.03, 0.14);
  col = mix(col, ink, line * 0.95);

  // gentle vignette in colour (keeps edges rich, not black)
  float vg = smoothstep(0.95, 0.35, length((uv - 0.5) * vec2(1.0, 0.9)));
  col *= mix(0.78, 1.0, vg);

  outputColor = vec4(col, 1.0);
}
`;

class CartoonEffect extends Effect {
  constructor() {
    super('CartoonEffect', frag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uAccent', new Uniform(new Color('#7aa2ff'))],
        ['uRes', new Uniform(new Vector2(1280, 800))],
        ['uTime', new Uniform(0)],
      ]),
    });
  }
  override setSize(width: number, height: number) {
    (this.uniforms.get('uRes')!.value as Vector2).set(width, height);
  }
}

const Effects = () => {
  const fx = useMemo(() => new CartoonEffect(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  const target = useMemo(() => new Color(), []);
  useFrame((_, dt) => {
    target.set(world.eraAccent);
    const acc = fx.uniforms.get('uAccent')!.value as Color;
    acc.lerp(target, 1 - Math.exp(-dt * 3));
    fx.uniforms.get('uTime')!.value = world.reduced ? 0 : world.time;
  });
  return createElement('primitive', { object: fx, dispose: null });
};

export const cartoonStyle: StyleDef = {
  id: 'cartoon',
  name: 'Cartoon',
  blurb: 'Bold outlines, flat cel shading, playful and bright.',
  Effects,
  bloomScale: 0.45,
};
