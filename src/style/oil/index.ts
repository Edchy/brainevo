import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { world } from '../../world/store';
import type { StyleDef } from '../types';
import './theme.css';

/*
 * Oil painting, one fullscreen pass, 21 taps:
 *  - 4 taps of luminance give a local gradient -> stroke direction (perpendicular), blended with a swirling
 *    Van Gogh flow field where the image is flat.
 *  - anisotropic 4-sector Kuwahara (4 taps per sector, rotated to the stroke frame) picks the calmest sector => flat daubs
 *    with crisp painterly edges.
 *  - impasto relief: stroke-stretched noise + luminance gradient -> normal -> diffuse + specular glints on ridges.
 *  - canvas weave, warm palette grade, butter-soft highlights.
 */
const frag = /* glsl */ `
uniform float uTime;
uniform float uScale;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
// soft shoulder: HDR (bloom/neon >1) is compressed to <=1 per channel BEFORE filtering/grading, otherwise the
// contrast curve c*c*(3-2c) goes negative for channels >1.5 and clips channels differently => rainbow rims.
vec3 tm(vec3 c){ c = max(c, 0.); vec3 o = (c - .72) / .28; return mix(c, .72 + .28*(1. - exp(-o)), step(.72, c)); }
vec4 T(vec2 u){ return vec4(tm(texture2D(inputBuffer, u).rgb), 1.); }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }

void mainImage(const in vec4 inputColor0, const in vec2 uv, out vec4 outputColor) {
  vec4 inputColor = vec4(tm(inputColor0.rgb), inputColor0.a);
  vec2 px = 1.0 / resolution.xy;
  float s = uScale;                       // pixel scale so strokes keep size across resolutions
  vec2 asp = vec2(resolution.x / resolution.y, 1.0);

  // --- stroke orientation
  vec2 g1 = px * 3.0 * s;
  float lr = lum(T(uv + vec2(g1.x, 0.)).rgb);
  float ll = lum(T(uv - vec2(g1.x, 0.)).rgb);
  float lu = lum(T(uv + vec2(0., g1.y)).rgb);
  float ld = lum(T(uv - vec2(0., g1.y)).rgb);
  vec2 grad = vec2(lr - ll, lu - ld);
  float gm = length(grad);
  // swirling flow (Starry Night curls)
  vec2 q = uv * asp * 3.0;
  float fa = 6.2831 * (vn(q + vec2(0., uTime*.02)) + .5*vn(q*2.3 - 7.0)) ;
  vec2 flow = vec2(cos(fa), sin(fa));
  vec2 edge = gm > 1e-4 ? vec2(-grad.y, grad.x) / gm : flow;
  // sign-agnostic blend (orientation is a line field)
  if (dot(edge, flow) < 0.) edge = -edge;
  vec2 t = normalize(mix(flow, edge, smoothstep(.01, .08, gm)));
  vec2 n = vec2(-t.y, t.x);
  vec2 st = px * s;

  // --- anisotropic Kuwahara: sectors along +t,-t,+n,-n
  vec3 mean[4]; float vr[4];
  vec3 sum[4]; vec3 sq[4];
  for (int k = 0; k < 4; k++) {
    vec2 d = (k < 2) ? t : n;
    vec2 p = (k < 2) ? n : t;
    float sg = (k == 0 || k == 2) ? 1. : -1.;
    d *= sg;
    float a0 = (k < 2) ? 2.0 : 1.5;
    float a1 = (k < 2) ? 7.0 : 4.5;
    float b  = (k < 2) ? 1.5 : 3.0;
    vec3 c0 = T(uv + (d*a0 + p*b) * st).rgb;
    vec3 c1 = T(uv + (d*a0 - p*b) * st).rgb;
    vec3 c2 = T(uv + (d*a1 + p*b) * st).rgb;
    vec3 c3 = T(uv + (d*a1 - p*b) * st).rgb;
    vec3 m = (c0 + c1 + c2 + c3 + inputColor.rgb) * .2;
    vec3 sqm = (c0*c0 + c1*c1 + c2*c2 + c3*c3 + inputColor.rgb*inputColor.rgb) * .2;
    mean[k] = m;
    vec3 v = sqm - m*m;
    vr[k] = v.r + v.g + v.b;
  }
  vec3 col = vec3(0.); float wsum = 0.;
  for (int k = 0; k < 4; k++) {
    float w = 1.0 / (1.0 + pow(min(vr[k] * 900.0, 20.0), 4.0)) + 1e-4;
    col += mean[k] * w; wsum += w;
  }
  col = col / max(wsum, 1e-4);

  // --- impasto relief
  vec2 pp = uv * resolution.xy / s;               // paint-space pixels
  vec2 rp = vec2(dot(pp, t), dot(pp, n));         // stroke frame
  float bristle = vn(vec2(rp.x * .06, rp.y * 1.15)) * .6 + vn(vec2(rp.x * .17 + 3., rp.y * 2.6)) * .4;
  float weave = (sin(pp.x * 1.25) * .5 + .5) * (sin(pp.y * 1.25) * .5 + .5) * .6
              + (sin((pp.x + pp.y) * .62) * .5 + .5) * .4;
  float h = lum(col) * 1.6 + bristle * .8;
  vec2 hg = vec2(dFdx(h), dFdy(h));
  vec2 bump = clamp(-vec2(grad.x, grad.y) * 4.5 - hg * 1.6, vec2(-1.5), vec2(1.5));
  float rel = .2 + .8 * smoothstep(.04, .45, lum(col));
  vec3 N = normalize(vec3(bump * 2.4 * rel, 1.0));
  vec3 L = normalize(vec3(-.45, .55, .70));
  float diff = clamp(dot(N, L), 0., 1.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = min(pow(clamp(dot(N, H), 0., 1.), 60.0), 1.0);
  float paint = smoothstep(.04, .5, lum(col)); // dark thin glazes are flatter than thick highlights

  // --- colour grade: rich, warm, slightly Prussian shadows
  float l = lum(col);
  vec3 c = mix(vec3(l), col, 1.2);                              // saturation
  c = c * (vec3(1.06, 1.0, .88));                                  // warm cast
  c += vec3(.012, .016, .05) * (1. - smoothstep(0., .35, l));     // blue umber in shadows
  c = mix(c, c*c*(3. - 2.*c), .25) ;                               // gentle contrast
  c.r += max(0., c.g - c.b) * .06;                                 // golden yellows lean to cadmium
  c = pow(max(c, 0.), vec3(.95));
  c = c / (1. + .22 * c);                                          // soften neon peaks into buttery daubs
  c *= 1.12;

  c *= .7 + .68 * diff;                                           // paint ridges catch the light
  c += vec3(1., .93, .78) * spec * (.28 + .5 * paint);
  c *= 1. - .07 * weave * (1.0 - paint*.6);                        // canvas tooth shows in thin paint
  c = mix(c, c * (.85 + .3 * bristle), .9);
  c = min(c, vec3(1.0));

  outputColor = vec4(max(c, 0.), inputColor.a);
}
`;

class OilEffect extends Effect {
  constructor() {
    super('OilEffect', frag, {
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uScale', new Uniform(1)],
      ]),
    });
  }
  setTime(t: number) { (this.uniforms.get('uTime') as Uniform).value = t; }
  setScale(s: number) { (this.uniforms.get('uScale') as Uniform).value = s; }
}

const Effects = () => {
  const fx = useMemo(() => new OilEffect(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame((state) => {
    fx.setTime(world.reduced ? 0 : world.time);
    // stroke size relative to a 900px-tall viewport, in device pixels
    fx.setScale(Math.max(1, state.size.height * state.viewport.dpr / 900));
  });
  return createElement('primitive', { object: fx });
};

export const oilStyle: StyleDef = {
  id: 'oil',
  name: 'Oil painting',
  blurb: 'Impasto brush strokes, painterly colour, visible canvas.',
  Effects,
  bloomScale: 1.25,
};
