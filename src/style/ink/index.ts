import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';
import type { StyleDef } from '../types';
import { world } from '../../world/store';
import './theme.css';

const frag = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uStation;
uniform float uVel;
uniform float uDbg;

float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float g(float x){ return x / (x + 0.35); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// luminance -> restrained palette: abyss ink, deep teal, teal, antique gold, warm white
vec3 ramp(float l){
  vec3 c0 = vec3(0.004, 0.010, 0.020);
  vec3 c1 = vec3(0.020, 0.150, 0.190);
  vec3 c2 = vec3(0.200, 0.640, 0.640);
  vec3 c3 = vec3(0.900, 0.700, 0.330);
  vec3 c4 = vec3(1.000, 0.930, 0.800);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.14, l));
  c = mix(c, c2, smoothstep(0.10, 0.38, l));
  c = mix(c, c3, smoothstep(0.34, 0.72, l));
  c = mix(c, c4, smoothstep(0.70, 1.15, l));
  return c;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 px = 1.0 / uRes;
  float s = max(1.0, uRes.y / 900.0) * 1.15;
  vec2 o = px * s;
  vec3 raw = texture2D(inputBuffer, uv).rgb;
  // inputColor = raw + bloom + headlines (+vignette): the surplus over raw is light we render as ink-glow
  vec3 extra = max(inputColor.rgb - raw, 0.0);
  float l0 = g(lum(raw));
  float a = g(lum(texture2D(inputBuffer, uv + vec2(-o.x, -o.y)).rgb));
  float b = g(lum(texture2D(inputBuffer, uv + vec2( o.x, -o.y)).rgb));
  float c = g(lum(texture2D(inputBuffer, uv + vec2(-o.x,  o.y)).rgb));
  float d = g(lum(texture2D(inputBuffer, uv + vec2( o.x,  o.y)).rgb));
  float gx = (b + d) - (a + c);
  float gy = (c + d) - (a + b);
  float edge = length(vec2(gx, gy));
  float lap = abs(a + b + c + d - 4.0 * l0);
  float e = smoothstep(0.03, 0.30, edge) * 1.1 + smoothstep(0.05, 0.3, lap) * 0.35;
  float halo = (a + b + c + d) * 0.25;

  float eL = g(lum(extra));
  // fills are dimmed to a whisper so the contours carry the image
  float L = l0;
  float fill = 0.13 * L;

  // aspect-aware screen coords
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 fc = uv * uRes;

  // hatching in the shadows: crossed families, only on faintly lit forms (never on true black or bright)
  float shadow = smoothstep(0.04, 0.1, L) * smoothstep(0.55, 0.22, L);
  float h1 = smoothstep(0.80, 0.97, sin((fc.x + fc.y) * 1.1));
  float h2 = smoothstep(0.86, 0.98, sin((fc.x - fc.y) * 1.1)) * smoothstep(0.3, 0.1, L);
  float hatch = (h1 + h2 * 0.8) * shadow * (0.25 + 0.75 * smoothstep(0.03, 0.22, eL));
  // stipple: sparse grains at the penumbra
  float st = step(0.985, hash(floor(fc / 1.5))) * smoothstep(0.04, 0.1, L) * smoothstep(0.6, 0.25, L);

  // star-chart graticule on the dark: rings + meridians, drifting with the timeline
  vec2 q = p - vec2(0.0, -0.1);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float w = px.y * 1.3;
  float ring = smoothstep(w, 0.0, abs(fract(r * 2.4 - uStation * 0.01 + 0.5) - 0.5) / 2.4);
  float mer = smoothstep(w, 0.0, abs(fract(ang / 6.2831853 * 24.0 + uStation * 0.004 + 0.5) - 0.5) * r * 6.2831853 / 24.0);
  mer *= smoothstep(0.12, 0.35, r);
  float grat = (ring * 0.9 + mer * 0.6) * 0.06 + ring * mer * 0.2;
  grat *= smoothstep(0.35, 0.05, L);

  // compose
  vec3 rgb = raw + extra;
  float warm = clamp((rgb.r - rgb.b) / (lum(rgb) + 0.15) * 0.8 + 0.25, 0.0, 1.0);
  vec3 teal = vec3(0.16, 0.62, 0.64);
  vec3 gold = vec3(0.95, 0.74, 0.36);
  vec3 tint = mix(teal, gold, warm);
  vec3 col = ramp(fill * 0.9) * 0.8;
  // contours: thin bright strokes, gold where the scene is warm, teal where cool, ivory at the hottest points
  vec3 stroke = mix(tint, vec3(1.0, 0.94, 0.82), smoothstep(0.55, 1.0, l0) * 0.7);
  col += stroke * min(e, 1.3) * (0.6 + 0.45 * l0);
  col += vec3(0.3, 0.75, 0.75) * hatch * 0.11 + vec3(0.9, 0.72, 0.4) * st * 0.4;
  col += vec3(0.15, 0.5, 0.55) * grat;
  // ink-bleed glow around bright forms
  col += tint * halo * halo * 0.08;
  col += mix(tint, vec3(1.0, 0.93, 0.8), smoothstep(0.35, 0.8, eL)) * pow(eL, 1.6) * 0.7 * (1.0 - 0.85 * smoothstep(0.3, 0.8, l0));
  // vignette to pure dark
  float vg = smoothstep(1.05, 0.3, length(p * vec2(0.9, 1.1)));
  col *= mix(0.45, 1.0, vg);
  // gentle dither to avoid banding on dark gradients
  col += (hash(fc + uTime) - 0.5) / 255.0;
  if (uDbg > 0.5 && uDbg < 1.5) col = vec3(e);
  if (uDbg > 1.5 && uDbg < 2.5) col = vec3(fill);
  if (uDbg > 2.5 && uDbg < 3.5) col = vec3(L);
  if (uDbg > 3.5) col = vec3(lum(extra));
  outputColor = vec4(max(col, 0.0), 1.0);
}
`;

class InkEffect extends Effect {
  constructor() {
    super('InkEffect', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uRes', new Uniform(new Vector2(1280, 720))],
        ['uTime', new Uniform(0)],
        ['uStation', new Uniform(0)],
        ['uVel', new Uniform(0)],
        ['uDbg', new Uniform(0)],
      ]),
    });
  }
  override setSize(width: number, height: number) {
    (this.uniforms.get('uRes')!.value as Vector2).set(width, height);
  }
}

function Effects() {
  const fx = useMemo(() => new InkEffect(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame(() => {
    fx.uniforms.get('uTime')!.value = world.reduced ? 0 : world.time % 100;
    fx.uniforms.get('uStation')!.value = world.stationF;
    fx.uniforms.get('uVel')!.value = world.velocity;
    fx.uniforms.get('uDbg')!.value = (window as unknown as { __inkDbg?: number }).__inkDbg ?? 0;
  });
  return createElement('primitive', { object: fx });
}

export const inkStyle: StyleDef = {
  id: 'ink',
  name: "Luminous ink",
  blurb: "Glowing line-work and light on near-black: Cajal's drawings meet a star chart.",
  Effects,
  bloomScale: 0.8,
};
