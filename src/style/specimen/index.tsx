import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';
import type { StyleDef } from '../types';
import { world } from '../../world/store';
import './theme.css';

const frag = /* glsl */ `
uniform float uTime;
uniform float uVel;
uniform float uPaper;

float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  float aspect = resolution.x / resolution.y;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc*vec2(aspect,1.0), cc*vec2(aspect,1.0));

  // watercolour bleed: low-frequency wobble of the sampling position (static, paper-fixed)
  vec2 wob = vec2(vn(px*0.011), vn(px*0.011 + 17.3)) - 0.5;
  vec2 suv = uv + wob * 0.0035;

  // old-optics fringing: radial R/B displacement growing toward the edges (+ a touch with scroll speed)
  vec2 dir = cc * (0.0016 + 0.010 * r2 + 0.0015 * min(abs(uVel), 2.0));
  vec3 col;
  col.r = texture2D(inputBuffer, suv + dir).r;
  col.g = texture2D(inputBuffer, suv).g;
  col.b = texture2D(inputBuffer, suv - dir).b;
  // cheap bleed: blend a soft offset tap so edges feather like wet pigment
  vec3 soft = 0.5*(texture2D(inputBuffer, suv + vec2(1.6,0.9)*texelSize).rgb + texture2D(inputBuffer, suv - vec2(1.6,0.9)*texelSize).rgb);
  col = mix(col, soft, 0.28);

  col = max(col, 0.0);
  float L = luma(col);
  float Lt = L / (1.0 + L*0.55);               // soft shoulder so bloom doesn't blow to white
  Lt = clamp(Lt * 1.3, 0.0, 1.0);

  // engraving bands: gentle posterisation of tone + 45deg hatching in the shadows
  float bands = floor(Lt * 9.0 + 0.5) / 9.0;
  Lt = mix(Lt, bands, 0.22);
  float hatch = abs(fract((px.x + px.y) * 0.34) - 0.5) * 2.0;     // 0..1 triangle
  float hatchMask = smoothstep(0.42, 0.04, Lt) * 0.5 + smoothstep(0.2, 0.0, Lt) * 0.2;
  float hatchLine = smoothstep(0.55, 0.9, hatch);
  Lt *= 1.0 - hatchMask * hatchLine * 0.5;
  // fine halftone dots in midtones
  vec2 hp = mat2(0.707,-0.707,0.707,0.707) * px / 5.5;
  float dots = length(fract(hp) - 0.5);
  float dotMask = smoothstep(0.0, 0.5, Lt) * smoothstep(1.0, 0.45, Lt);
  Lt *= 1.0 - dotMask * smoothstep(0.30, 0.46, dots) * 0.07;

  // warm duotone-ish map: umber shadows -> sepia mid -> parchment lights
  vec3 shadow = vec3(0.085, 0.045, 0.026);
  vec3 midc   = vec3(0.420, 0.285, 0.170);
  vec3 light  = vec3(1.000, 0.925, 0.760);
  vec3 sep = mix(shadow, midc, smoothstep(0.0, 0.5, Lt));
  sep = mix(sep, light, smoothstep(0.38, 1.0, Lt));

  // keep muted pigment: desaturate original, tint toward paper, then multiply-ish into sepia
  vec3 muted = mix(vec3(L), col, 0.40);
  muted = muted / (1.0 + muted*0.45);
  vec3 pig = muted * vec3(1.10, 0.96, 0.74);
  float cm = smoothstep(0.03, 0.35, Lt);              // colour only appears where there's light
  vec3 outc = mix(sep, sep * (0.55 + 1.15*pig) , 0.9 * cm);
  outc = mix(outc, pig * light * 1.1, 0.16 * cm * smoothstep(0.35, 0.9, Lt));

  // paper: fibres (stretched noise at two angles) + grain + mottling, mostly felt in the lights
  float fib1 = vn(vec2(px.x*0.9 + px.y*0.25, px.y*0.05) * 0.5);
  float fib2 = vn(vec2(px.y*0.8 - px.x*0.2, px.x*0.045) * 0.5 + 9.0);
  float fibre = (fib1 + fib2) - 1.0;
  float grain = h21(px + floor(uTime*0.0)) - 0.5;
  float mottle = vn(px*0.004) * 0.6 + vn(px*0.02) * 0.4 - 0.5;
  float paper = (fibre*0.07 + grain*0.07 + mottle*0.10) * uPaper;
  outc *= 1.0 + paper * (0.35 + 0.85*Lt);
  outc += vec3(0.05,0.03,0.015) * (grain*0.06 + mottle*0.1) * uPaper * (1.0-Lt);
  // sparse foxing flecks + dust
  float fleck = step(0.9993, h21(floor(px*0.5)));
  outc = mix(outc, shadow*1.6, fleck * 0.35);

  // plate vignette: lightbox glow in centre, burnt umber edges, faint inner plate-mark rule
  float vg = smoothstep(0.1, 0.62, r2*1.1);
  outc = mix(outc * (1.0 + 0.10*(1.0 - vg)), outc * vec3(0.30, 0.22, 0.15) , vg * 0.75);
  vec2 e = abs(cc * vec2(1.0)) ;
  float edge = max(e.x/0.485, e.y/0.47);
  outc *= 1.0 - smoothstep(0.985, 1.0, edge) * 0.4;
  float rule = smoothstep(0.004, 0.0, abs(edge - 0.955) * 0.5);
  outc = mix(outc, light*0.75, rule * 0.05);

  // lift black floor to umber so the cosmic opening reads as dark warm ground
  outc = pow(max(outc, 0.0), vec3(1.7)) * vec3(1.04, 0.97, 0.86);   // palette authored in display space; pipeline is linear
  outc = max(outc, vec3(0.011, 0.0065, 0.004));
  outputColor = vec4(outc, inputColor.a);
}
`;

class SpecimenEffect extends Effect {
  constructor() {
    super('SpecimenEffect', frag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uVel', new Uniform(0)],
        ['uPaper', new Uniform(1)],
      ]),
    });
  }
  set(time: number, vel: number, paper: number) {
    (this.uniforms.get('uTime') as Uniform).value = time;
    (this.uniforms.get('uVel') as Uniform).value = vel;
    (this.uniforms.get('uPaper') as Uniform).value = paper;
  }
}

const Effects = () => {
  const fx = useMemo(() => new SpecimenEffect(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame(() => fx.set(world.time, world.reduced ? 0 : world.velocity, 1));
  return <primitive object={fx} dispose={null} />;
};

export const specimenStyle: StyleDef = {
  id: 'specimen',
  name: "Living specimen",
  blurb: "Backlit museum plates and microscope slides: warm paper grain, organic colour.",
  Effects,
  bloomScale: 0.6,
};
