/**
 * Depth-sandwiched headlines: huge type composited INTO the frame using the scene depth buffer. Geometry nearer
 * than the title plane occludes the type; the background and farther geometry sit behind it.
 *
 * Theme knobs (CSS custom properties, read from <html>): --ui-font-display, --title-color ("accent" = era accent),
 * --title-opacity (0..1), --title-blend (normal | screen | add), --title-weight, --title-transform, --title-align
 * (center | left), --title-spacing (em, letter spacing), --title-size (multiplier), --title-parallax (frame widths per
 * station, default 0.8), --title-y (0..1 vertical centre, default 0.4), --title-softness (depth edge, 0..1),
 * --title-key (0..1: how strongly bright pixels with no depth, e.g. additive particles, occlude the type).
 * --title-placement (fixed | art; "art" places each headline using SceneDef.titleAnchor / the table in anchors.ts so the
 * type sits clear of the scene's hero, default fixed = always --title-y / --title-align),
 * --title-kicker-opacity / --title-year-opacity (0..1, 0 hides the line, default 0.85),
 * --title-kicker-mode (all | era: only on the first event of an era, default all).
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import { events } from '../../data';
import { ERA_META } from '../../lib/eras';
import { world } from '../../world/store';
import { titleState } from './state';
import { resolveAnchor, type TitleAnchor } from './anchors';

const BREAKTHROUGH: Record<string, string> = {
  steering: 'Breakthrough 1 · Steering', reinforcing: 'Breakthrough 2 · Reinforcing',
  simulating: 'Breakthrough 3 · Simulating', mentalizing: 'Breakthrough 4 · Mentalizing', speaking: 'Breakthrough 5 · Speaking',
};

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uOff;
uniform vec3 uAlpha;
uniform float uDepth;
uniform float uSoft;
uniform float uOpacity;
uniform float uMode;
uniform float uKey;

vec4 slot(float i, float off, vec2 uv) {
  float u = uv.x - off;
  if (u <= 0.0 || u >= 1.0) return vec4(0.0);
  return texture2D(uTex, vec2(u, (2.0 - i + clamp(uv.y, 0.002, 0.998)) / 3.0));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 a = slot(0.0, uOff.x, uv); a.a *= uAlpha.x;
  vec4 b = slot(1.0, uOff.y, uv); b.a *= uAlpha.y;
  vec4 c = slot(2.0, uOff.z, uv); c.a *= uAlpha.z;
  if (uMode > 2.5) { outputColor = vec4(vec3(depth, fract(-getViewZ(depth) / 10.0), 0.0), 1.0); return; }
  float cov = max(a.a, max(b.a, c.a));
  if (cov < 0.002) { outputColor = inputColor; return; }
  vec3 tint = (a.rgb * a.a + b.rgb * b.a + c.rgb * c.a) / (a.a + b.a + c.a + 1e-4);
  float dist = depth > 0.99995 ? 1e5 : -getViewZ(depth);
  float e = uSoft * uDepth + 0.02;
  float vis = smoothstep(uDepth - e, uDepth + e, dist);
  // many scenes are additive particles that write no depth: for those pixels fall back to a luminance key, so bright
  // glowing things still cut in front of the type and only the dark background sits behind it
  float lum = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  float key = depth > 0.99995 ? smoothstep(0.06, 0.55, lum) * uKey : 0.0;
  float k = cov * vis * uOpacity * (1.0 - key);
  vec3 normal = mix(inputColor.rgb, tint, k);
  vec3 screen = 1.0 - (1.0 - inputColor.rgb) * (1.0 - tint * k);
  vec3 add = inputColor.rgb + tint * k;
  vec3 rgb = uMode < 0.5 ? normal : (uMode < 1.5 ? screen : add);
  outputColor = vec4(rgb, inputColor.a);
}
`;

class TitleEffect extends Effect {
  constructor() {
    super('TitleEffect', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uTex', new THREE.Uniform<THREE.Texture | null>(null)],
        ['uOff', new THREE.Uniform(new THREE.Vector3(9, 9, 9))],
        ['uAlpha', new THREE.Uniform(new THREE.Vector3())],
        ['uDepth', new THREE.Uniform(6)],
        ['uSoft', new THREE.Uniform(0.04)],
        ['uOpacity', new THREE.Uniform(0.9)],
        ['uMode', new THREE.Uniform(1)],
        ['uKey', new THREE.Uniform(0.85)],
      ]),
    });
  }
}

interface Theme {
  family: string; color: string; weight: string; upper: boolean; align: string; spacing: number; size: number;
  opacity: number; key: number; mode: number; parallax: number; y: number; soft: number;
  art: boolean; kickerOpacity: number; yearOpacity: number; kickerEra: boolean;
}

function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  const blend = v('--title-blend', 'screen');
  return {
    family: v('--ui-font-display', 'Georgia, serif'),
    color: v('--title-color', '#ffffff'),
    weight: v('--title-weight', '700'),
    upper: v('--title-transform', 'none') === 'uppercase',
    align: v('--title-align', 'center'),
    spacing: parseFloat(v('--title-spacing', '-0.02')),
    size: parseFloat(v('--title-size', '1')),
    opacity: parseFloat(v('--title-opacity', '0.92')),
    key: parseFloat(v('--title-key', '0.85')),
    mode: blend === 'normal' ? 0 : blend === 'add' ? 2 : blend === 'debug' ? 3 : 1,
    parallax: parseFloat(v('--title-parallax', '0.8')),
    y: parseFloat(v('--title-y', '0.4')),
    soft: parseFloat(v('--title-softness', '0.04')),
    art: v('--title-placement', 'fixed') === 'art',
    kickerOpacity: parseFloat(v('--title-kicker-opacity', '0.85')),
    yearOpacity: parseFloat(v('--title-year-opacity', '0.85')),
    kickerEra: v('--title-kicker-mode', 'all') === 'era',
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSlot(ctx: CanvasRenderingContext2D, W: number, H: number, idx: number, th: Theme, accent: string) {
  const ev = events[idx];
  if (!ev) return;
  const eraStart = !events[idx - 1] || events[idx - 1].era !== ev.era;
  const font = (px: number, w = th.weight) => `${w} ${px}px ${th.family}`;
  const text = th.upper ? ev.title.toUpperCase() : ev.title;
  const color = th.color === 'accent' ? accent : th.color;
  const an: TitleAnchor = th.art
    ? resolveAnchor(idx)
    : { x: th.align === 'left' ? 0.05 : 0.5, y: th.y, align: th.align === 'left' ? 'left' : 'center', size: 1 };
  const side = an.align !== 'center';
  const maxW = W * (side ? Math.min(0.4, an.align === 'left' ? 0.94 - an.x : an.x - 0.06) : 0.9);
  const cap = H * (eraStart ? 0.34 : 0.27) * th.size * (an.size ?? 1);
  // largest size (<= cap) such that the text fits in <= 3 lines and the block is at most ~0.62 H tall
  let px = cap, lines: string[] = [];
  for (; px > H * 0.05; px *= 0.94) {
    ctx.font = font(px);
    ctx.letterSpacing = `${th.spacing * px}px`;
    lines = wrap(ctx, text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= 3 && widest <= maxW && lines.length * px * 0.96 <= H * 0.62) break;
  }
  const lh = px * 0.96;
  const total = lines.length * lh;
  const cy = H * an.y;
  const x = W * an.x;
  ctx.textAlign = an.align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = font(px);
  ctx.letterSpacing = `${th.spacing * px}px`;
  const top = Math.max(H * 0.07, cy - total / 2); // never ride up into the top edge
  lines.forEach((l, i) => ctx.fillText(l, x, top + (i + 0.82) * lh));
  // kicker (era / breakthrough) above, year label below; both optional (theme opacity 0 hides them)
  const small = Math.max(14, H * 0.026);
  const era = ERA_META[ev.era].name.toUpperCase();
  const kicker = eraStart ? era : ev.breakthrough ? BREAKTHROUGH[ev.breakthrough].toUpperCase() : era;
  if (th.kickerOpacity > 0.01 && (!th.kickerEra || eraStart)) {
    ctx.font = font(small, '600');
    ctx.letterSpacing = `${small * 0.32}px`;
    ctx.globalAlpha = th.kickerOpacity;
    ctx.fillText(kicker, x, top - small * 0.9);
  }
  if (th.yearOpacity > 0.01) {
    ctx.font = font(small * 1.25, '500');
    ctx.letterSpacing = `${small * 0.18}px`;
    ctx.globalAlpha = th.yearOpacity;
    ctx.fillText(ev.yearLabel.toUpperCase(), x, top + total + small * 2.1);
  }
  ctx.globalAlpha = 1;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function TitleLayer() {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const effect = useMemo(() => new TitleEffect(), []);
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const st = useMemo(() => ({ center: -999, key: '', frame: 0, theme: null as Theme | null, fontsReady: false, dirty: true, tex: null as THREE.CanvasTexture | null }), []);

  useEffect(() => {
    const redo = () => { st.dirty = true; };
    document.fonts.ready.then(() => { st.fontsReady = true; redo(); });
    document.fonts.addEventListener('loadingdone', redo);
    return () => { document.fonts.removeEventListener('loadingdone', redo); st.tex?.dispose(); effect.dispose(); };
  }, [effect, st]);

  // resize / dpr -> new canvas size
  useEffect(() => {
    const s = Math.min(dpr, 1.5, 2400 / Math.max(1, size.width), 1100 / Math.max(1, size.height));
    canvas.width = Math.max(64, Math.round(size.width * s));
    canvas.height = Math.max(64, Math.round(size.height * s)) * 3;
    // texture storage is immutable in WebGL2: a new size needs a new texture
    st.tex?.dispose();
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    st.tex = t;
    effect.uniforms.get('uTex')!.value = t;
    st.center = -999;
    st.dirty = true;
  }, [effect, size.width, size.height, dpr, canvas, st]);

  useFrame((state) => {
    const f = world.stationF;
    st.frame++;
    if (st.frame % 20 === 1 || !st.theme) {
      const th = readTheme();
      const key = JSON.stringify(th);
      if (key !== st.key) {
        st.key = key; st.theme = th; st.dirty = true;
        document.fonts.load(`${th.weight} 100px ${th.family}`).then(() => { st.dirty = true; }, () => {});
      }
    }
    const th = st.theme!;
    const last = events.length - 1;
    const c = Math.round(Math.min(last, Math.max(0, f)));
    const accent = ERA_META[events[c].era].accent;
    if (c !== st.center || st.dirty) {
      st.center = c; st.dirty = false;
      const ctx = canvas.getContext('2d')!;
      const W = canvas.width, H = canvas.height / 3;
      ctx.clearRect(0, 0, W, H * 3);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, k * H, W, H); ctx.clip();
        ctx.translate(0, k * H);
        drawSlot(ctx, W, H, c + k - 1, th, accent);
        ctx.restore();
      }
      st.tex!.needsUpdate = true;
    }
    void state;
    // slot k holds event c+k-1; its horizontal offset (in frame widths) follows the scroll at `parallax` speed
    const off = effect.uniforms.get('uOff')!.value as THREE.Vector3;
    const al = effect.uniforms.get('uAlpha')!.value as THREE.Vector3;
    let o = [-1, 0, 1].map((d) => (c + d - f) * th.parallax);
    // fade by distance in stations (not frame widths) so a low --title-parallax doesn't leave neighbours half-visible
    let fd = (_x: number, idx: number) => (idx < 0 || idx > last ? 0 : 1 - smooth(0.12, 0.5, Math.abs(idx - f)));
    // past the ends (intro / outro) the edge title stays put and just dissolves: it must not slide off-frame, where
    // its kicker would be clipped and it would sit over the finale/intro content
    if (f > last) { o = [9, 0, 9]; fd = (_x, idx) => (idx === last ? 1 - smooth(0.02, 0.4, f - last) : 0); }
    else if (f < 0) { o = [9, 0, 9]; fd = (_x, idx) => (idx === 0 ? 1 - smooth(0.02, 0.4, -f) : 0); }
    off.set(o[0], o[1], o[2]);
    al.set(fd(o[0], c - 1), fd(o[1], c), fd(o[2], c + 1));
    const dbg = import.meta.env.DEV ? (window as unknown as { __td?: number }).__td : undefined;
    effect.uniforms.get('uDepth')!.value = dbg ?? titleState.depth;
    effect.uniforms.get('uSoft')!.value = th.soft;
    effect.uniforms.get('uOpacity')!.value = th.opacity;
    effect.uniforms.get('uMode')!.value = th.mode;
    effect.uniforms.get('uKey')!.value = th.key;
  });

  return <primitive object={effect} dispose={null} />;
}
