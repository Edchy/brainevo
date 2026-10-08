import { createElement, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';
import type { StyleDef } from '../types';
import { world } from '../../world/store';
import './theme.css';

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSurge;   // 0..1 smoothed |velocity|
uniform float uDrop;    // dropout pulse 0..1
uniform vec2 uRes;

float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

vec3 ramp(float l){
  // deep indigo -> magenta -> cyan -> white
  vec3 c0 = vec3(0.012,0.008,0.055);
  vec3 c1 = vec3(0.10,0.03,0.42);
  vec3 c2 = vec3(0.95,0.10,0.72);
  vec3 c3 = vec3(0.05,0.86,1.0);
  vec3 c4 = vec3(0.93,1.0,1.0);
  vec3 c = mix(c0,c1,smoothstep(0.0,0.2,l));
  c = mix(c,c2,smoothstep(0.18,0.46,l));
  c = mix(c,c3,smoothstep(0.42,0.76,l));
  c = mix(c,c4,smoothstep(0.74,1.0,l));
  return c;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  float s = uSurge;
  float t = uTime;
  vec2 px = uv * uRes;

  // horizontal tearing: bands displaced, count & amplitude grow with speed
  float band = floor(uv.y * mix(14.0, 46.0, s));
  float tk = floor(t * mix(6.0, 22.0, s));
  float r = h21(vec2(band, tk));
  float gate = step(1.0 - (0.004 + s*0.34), r);
  float tear = gate * (h21(vec2(band+7.0, tk)) - .5) * (0.012 + s*0.16);
  // slow gentle line wobble at rest (oscilloscope jitter)
  tear += (h11(floor(uv.y*240.0) + tk) - .5) * 0.0006 * (1.0 + s*8.0);
  vec2 u = vec2(fract(uv.x + tear + 1.0), uv.y);

  // chromatic aberration: radial + horizontal, grows with speed
  vec2 d = uv - .5;
  float ca = 0.0007 + s * 0.011 + dot(d,d) * (0.003 + s*0.012);
  vec2 dir = normalize(vec2(d.x*1.0 + 1e-4, d.y*0.25));
  vec3 col;
  col.r = texture2D(inputBuffer, u + dir*ca).r;
  col.g = texture2D(inputBuffer, u).g;
  col.b = texture2D(inputBuffer, u - dir*ca).b;

  // gradient-map by luminance, keep a trace of source hue
  float l = dot(col, vec3(.2126,.7152,.0722));
  // per-channel luminance split gives subtle fringe colour through the ramp
  vec3 lc = vec3(dot(col,vec3(.5,.3,.2)), l, dot(col,vec3(.2,.3,.5)));
  float lm = pow(clamp(l*1.25, 0.0, 1.8), 1.3);
  vec3 mapped = ramp(lm);
  mapped.r = mix(mapped.r, ramp(pow(lc.x*1.25,1.3)).r, .5);
  mapped.b = mix(mapped.b, ramp(pow(lc.z*1.25,1.3)).b, .5);
  vec3 c = mix(mapped, mapped * (0.55 + col * 1.1), 0.18);

  // bit-crushed banding, harsher when moving
  float lv = mix(40.0, 5.0, smoothstep(0.05, 1.0, s));
  c = floor(c * lv + .5) / lv;

  // faint perspective grid (floor below horizon) + sparse vertical ticks above
  float hz = 0.42;
  float gy = hz - uv.y;
  float gridA = 0.0;
  if (gy > 0.0) {
    float z = 1.0 / (gy + .03);
    float gx = (uv.x - .5) * z * 1.6;
    float lz = fract(z * .5 - t * (.05 + s*.8));
    float vl = 1.0 - smoothstep(0.0, .04, abs(fract(gx) - .5) - .46);
    float hl = 1.0 - smoothstep(0.0, .05, lz);
    gridA = (vl + hl * .6) * smoothstep(0.0, .3, gy);
  }
  vec2 g2 = abs(fract(px / 64.0) - .5) * 64.0;
  float mesh = (1.0 - smoothstep(.0, 1.0, min(g2.x, g2.y))) * .5;
  float dark = 1.0 - smoothstep(.05, .45, l);
  c += vec3(0.1,0.35,0.9) * (gridA * .5 + mesh * .35) * dark * .11;

  // scanlines + aperture mask
  float sl = .5 + .5 * sin(px.y * 3.14159);
  c *= 1.0 - .13 * (1.0 - sl);
  float ap = mod(floor(px.x), 3.0);
  vec3 mask = vec3(ap<.5?1.0:.93, abs(ap-1.0)<.5?1.0:.93, ap>1.5?1.0:.93);
  c *= mask;
  // slow roll bar
  float roll = smoothstep(.0,.5, 1.0 - abs(fract(uv.y*.5 - t*.04) - .5)*2.0);
  c *= 1.0 + .035 * roll;

  // noise
  float n = h21(px + fract(t) * 91.7) - .5;
  c += n * (0.02 + s * .03) * (.4 + .6*dark);

  // signal dropout flicker
  float fl = 1.0 - uDrop * .2 * (.5 + .5*h11(floor(t*30.0)));
  c *= fl;
  // dropout line: brief white-noise strip
  float strip = step(abs(uv.y - fract(t*.37 + band*0.0)), .0016 + s*.004) * step(.985 - s*.1, h11(tk*3.1));
  c = mix(c, vec3(h21(px+t)) * vec3(.5,.9,1.0), strip*.6);

  // soft vignette + CRT corner darkening
  c *= 1.0 - dot(d,d) * .55;
  c *= 1.0 + s * .25;

  outputColor = vec4(c, inputColor.a);
}
`;

class SignalEffect extends Effect {
  constructor() {
    super('SignalEffect', FRAG, {
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uSurge', new Uniform(0)],
        ['uDrop', new Uniform(0)],
        ['uRes', new Uniform(new Vector2(1920, 1080))],
      ]),
    });
  }
  setSize(w: number, h: number) {
    (this.uniforms.get('uRes')!.value as Vector2).set(w, h);
  }
}

// postprocessing Effect.setSize is not called by wrapper for primitives in all versions; handled in useFrame too.
const Effects = () => {
  const fx = useMemo(() => new SignalEffect(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  let surge = 0;
  useFrame((state, dt) => {
    const u = fx.uniforms;
    const ov = (window as unknown as { __signalSurge?: number }).__signalSurge; // dev override (velocity units)
    const v = Math.min(Math.abs(ov ?? world.velocity), 4) / 3;
    surge += (Math.min(v, 1) - surge) * Math.min(1, dt * (v > surge ? 18 : 3));
    const reduced = world.reduced ? 0.3 : 1;
    u.get('uTime')!.value = world.time;
    u.get('uSurge')!.value = surge * reduced;
    // sparse dropout pulses (restrained when static)
    const tt = world.time;
    const p = Math.sin(tt * 2.1) * Math.sin(tt * 5.3 + 1.7);
    u.get('uDrop')!.value = (p > 0.93 ? 1 : 0) * reduced + surge * 0.4 * (Math.sin(tt * 40) > 0.3 ? 1 : 0);
    const size = state.size;
    const r = u.get('uRes')!.value as Vector2;
    const dpr = state.viewport.dpr;
    if (r.x !== size.width * dpr) r.set(size.width * dpr, size.height * dpr);
  });
  return createElement('primitive', { object: fx });
};

export const signalStyle: StyleDef = {
  id: 'signal',
  name: "Signal and noise",
  blurb: "Neon gradients, scanlines and chromatic aberration that surge with scroll speed.",
  Effects,
  bloomScale: 0.8,
};
