import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform, Vector3 } from 'three';
import { world } from '../../world/store';
import { BRUSH, PALETTE } from '../palettes';
import { visionAt } from '../../lib/vision';
import { GLAZE, SHADE_GLSL } from '../../world/shade';

/*
 * Oil painting, one fullscreen pass, 21 taps:
 *  - 4 taps of luminance give a local gradient -> stroke direction (perpendicular), blended with a swirling
 *    Van Gogh flow field where the image is flat.
 *  - anisotropic 4-sector Kuwahara (4 taps per sector, rotated to the stroke frame) picks the calmest sector => flat daubs
 *    with crisp painterly edges.
 *  - impasto relief: stroke-stretched noise + luminance gradient -> normal -> diffuse + specular glints on ridges.
 *  - canvas weave, palette grade (ground, cast, tone, saturation; see palettes.ts), butter-soft highlights.
 *  - perception ("see through their eyes", src/lib/vision.ts): no colour sense before eyes, two-cone mammal vision,
 *    richer-than-human four-cone colour, all eased by where you are in the story.
 * Palette and brushwork are uniforms, so switching them never recompiles the pass.
 */
const frag = /* glsl */ `${SHADE_GLSL}
uniform float uGlaze;   // the painted shade's glaze (world/shade.ts)
uniform float uTime;
uniform float uScale;
uniform float uBrush;   // stroke footprint multiplier (1 = fine)
uniform float uRelief;  // impasto strength multiplier
uniform vec3 uGround;   // what thin dark paint sinks into
uniform vec3 uCast;
uniform vec3 uToneLo;
uniform vec3 uToneHi;
uniform vec3 uSpec;
uniform float uSat;
uniform float uMono;
uniform float uBlind;   // no colour sense at all (before eyes)
uniform float uDichro;  // two-cone vision: red and green collapse into one channel
uniform float uRich;    // four-cone vision: more saturated than ours, light leans violet
uniform float uSketch;  // not painted yet: chalk underdrawing on the toned ground

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
  float s = uScale * uBrush;              // pixel scale so strokes keep size across resolutions
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
  // dichromat (deuteranope-like: an S cone and one long-wave cone), Machado et al. 2009, severity 1
  vec3 dic = vec3(dot(col, vec3(.367322, .860646, -.227968)), dot(col, vec3(.280085, .672501, .047413)), dot(col, vec3(-.011820, .042940, .968881)));
  col = mix(col, max(dic, 0.), uDichro);

  // --- impasto relief
  vec2 pp = uv * resolution.xy / s;               // paint-space pixels
  vec2 rp = vec2(dot(pp, t), dot(pp, n));         // stroke frame
  // bristle streaks a few pixels wide (finer than ~3 device pixels aliased into salt-and-pepper speckle)
  float bristle = vn(vec2(rp.x * .05, rp.y * .34)) * .6 + vn(vec2(rp.x * .12 + 3., rp.y * .68)) * .4;
  vec2 cp = uv * resolution.xy / uScale;           // canvas weave keeps its size whatever the brush
  float weave = (sin(cp.x * 1.25) * .5 + .5) * (sin(cp.y * 1.25) * .5 + .5) * .6
              + (sin((cp.x + cp.y) * .62) * .5 + .5) * .4;
  float h = lum(col) * 1.6 + bristle * .8;
  vec2 hg = vec2(dFdx(h), dFdy(h));
  vec2 bump = clamp(-vec2(grad.x, grad.y) * 4.5 - hg * 1.6, vec2(-1.5), vec2(1.5));
  float rel = .2 + .8 * smoothstep(.04, .45, lum(col));
  vec3 N = normalize(vec3(bump * 2.4 * rel * uRelief, 1.0));
  vec3 L = normalize(vec3(-.45, .55, .70));
  float diff = clamp(dot(N, L), 0., 1.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = min(pow(clamp(dot(N, H), 0., 1.), 60.0), 1.0);
  float paint = smoothstep(.04, .5, lum(col)); // dark thin glazes are flatter than thick highlights

  // --- colour grade: palette ground, cast and tone
  float l = lum(col);
  vec3 c = mix(vec3(l), col, uSat * (1. + .32 * uRich));         // saturation (four cones: richer)
  // grisaille-style palettes drain hue except where the (stroke-averaged) source is strongly saturated and lit
  float mxc = max(max(col.r, col.g), col.b), mnc = min(min(col.r, col.g), col.b);
  float satc = (mxc - mnc) / max(mxc, 0.04);
  float splash = smoothstep(.42, .78, satc) * smoothstep(.05, .22, mxc);
  c = mix(c, vec3(l), uMono * (1. - splash * .9));
  c = mix(c, vec3(l), uBlind);                                    // no eyes: light and dark only
  c += vec3(.045, 0., .085) * uRich * smoothstep(.45, .95, l);     // ultraviolet, hinted as violet in the light
  c = c * uCast;                                                  // cast
  c *= mix(uToneLo, uToneHi, smoothstep(.12, .8, l));             // cool/warm split tone
  c += uGround * (1. - smoothstep(0., .35, l));                   // the ground shows through thin dark paint
  c = mix(c, c*c*(3. - 2.*c), .25) ;                               // gentle contrast
  c.r += max(0., c.g - c.b) * .06 * (1. - uMono);                  // golden yellows lean to cadmium
  c = pow(max(c, 0.), vec3(.95));
  c = c / (1. + .22 * c);                                          // soften neon peaks into buttery daubs
  c *= 1.12;

  c *= .7 + .68 * diff;                                           // paint ridges catch the light
  c += uSpec * spec * (.16 + .34 * paint) * min(uRelief, 1.25);
  c *= 1. - .07 * weave * (1.0 - paint*.6);                        // canvas tooth shows in thin paint
  c = mix(c, c * (.85 + .3 * bristle), .9);
  c = min(c, vec3(1.0));

  // --- the future is not painted yet: edges and hatching in pale chalk on the dark ground, a faint wash of colour
  if (uSketch > .001) {
    float lineE = smoothstep(.02, .12, gm);
    float hatch = smoothstep(.55, .92, .5 + .5 * sin(dot(pp, n) * .55 + bristle * 2.2));
    float lit = smoothstep(.03, .42, l);                          // chalk goes where the light is
    vec3 sk = (uGround * 1.25 + vec3(.012, .011, .01)) * (1. - .12 * weave);
    sk += vec3(.86, .83, .76) * clamp(lineE * .8 + lit * (.3 + .7 * hatch), 0., 1.) * (.65 + .35 * bristle);
    sk += col * .05;
    c = mix(c, min(sk, vec3(1.)), uSketch);
  }

  // a thin dark glaze over the dry paint under the reading text: the shade before this pass stops at the floor this pass
  // lifts dark paint to (ground, relief), the glaze takes that floor down too. The headline is composited after it.
  c *= pow(1. - uGlaze * shade(uv), 2.);

  outputColor = vec4(max(c, 0.), inputColor.a);
}
`;

class OilEffect extends Effect {
  constructor() {
    super('OilEffect', frag, {
      // its taps must see the finished frame (bloom, shade, dip), so it starts its own pass instead of being merged
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uAspect', new Uniform(1.6)],
        ['uGlaze', new Uniform(GLAZE)],
        ['uScale', new Uniform(1)],
        ['uBrush', new Uniform(1)],
        ['uRelief', new Uniform(1)],
        ['uGround', new Uniform(new Vector3())],
        ['uCast', new Uniform(new Vector3(1, 1, 1))],
        ['uToneLo', new Uniform(new Vector3(1, 1, 1))],
        ['uToneHi', new Uniform(new Vector3(1, 1, 1))],
        ['uSpec', new Uniform(new Vector3(1, 1, 1))],
        ['uSat', new Uniform(1)],
        ['uMono', new Uniform(0)],
        ['uBlind', new Uniform(0)],
        ['uDichro', new Uniform(0)],
        ['uRich', new Uniform(0)],
        ['uSketch', new Uniform(0)],
      ]),
    });
  }
  set(name: string, v: number) { (this.uniforms.get(name) as Uniform<number>).value = v; }
  /** eases every palette/brush uniform toward its target, so the perception stages cross-dissolve as you travel */
  ease(k: number) {
    const p = PALETTE, b = BRUSH;
    const u = this.uniforms;
    const go = (n: string, t: number) => { const x = u.get(n) as Uniform<number>; x.value += (t - x.value) * k; };
    const go3 = (n: string, t: [number, number, number]) => { (u.get(n)!.value as Vector3).lerp(tmp.set(t[0], t[1], t[2]), k); };
    const v = visionAt(world.stationF);
    // dev: window.__vis = { sketch: 0 } overrides the perception stage (to inspect a scene unfiltered)
    if (import.meta.env.DEV) Object.assign(v, (window as unknown as { __vis?: object }).__vis);
    go('uBrush', b.size * v.brush); go('uRelief', b.relief); go('uSat', p.sat); go('uMono', p.mono);
    go('uBlind', v.blind); go('uDichro', v.dichro); go('uRich', v.rich); go('uSketch', v.sketch);
    go3('uGround', p.ground); go3('uCast', p.cast); go3('uToneLo', p.toneLo); go3('uToneHi', p.toneHi); go3('uSpec', p.spec);
  }
}
const tmp = new Vector3();

export function OilEffects() {
  const fx = useMemo(() => { const e = new OilEffect(); e.ease(1); return e; }, []);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame((state, dt) => {
    fx.set('uTime', world.reduced ? 0 : world.time);
    // stroke size relative to a 900px-tall viewport, in device pixels
    fx.set('uScale', Math.max(1, state.size.height * state.viewport.dpr / 900));
    fx.set('uAspect', state.size.width / Math.max(1, state.size.height));
    // dev: window.__glaze = 0.3 tries another strength of the painted shade's glaze live
    if (import.meta.env.DEV) fx.set('uGlaze', (window as unknown as { __glaze?: number }).__glaze ?? GLAZE);
    fx.ease(1 - Math.exp(-Math.min(dt, 0.1) * 5));
  });
  return createElement('primitive', { object: fx });
}

/** multiplier on the mood-driven bloom intensity */
export const OIL_BLOOM = 1.25;
