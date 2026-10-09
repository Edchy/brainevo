import * as THREE from 'three';
import { rng } from '../../world/util';

/** One lightning strike: midpoint-displaced main channel + tapering forks, as camera-facing mitred ribbons. */
export interface BoltSpec { seed: number; topX: number; botX: number; z: number; top: number; bot: number; forks: number; amp: number }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function displace(a: THREE.Vector3, b: THREE.Vector3, levels: number, amp0: number, r: () => number) {
  let pts = [a.clone(), b.clone()];
  let amp = amp0;
  for (let l = 0; l < levels; l++) {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const m = p.clone().add(q).multiplyScalar(0.5);
      m.x += (r() - 0.5) * 2 * amp; m.z += (r() - 0.5) * amp * 0.5;
      out.push(p, m);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
    amp *= 0.56;
  }
  return pts;
}

interface Strip { pts: THREE.Vector3[]; taper: number[]; bright: number; d0: number }

export function buildBolt(s: BoltSpec) {
  const r = rng(s.seed);
  const top = V(s.topX, s.top, s.z), bot = V(s.botX, s.bot, s.z);
  const len = top.distanceTo(bot);
  const main = displace(top, bot, 7, len * 0.085, r);
  const strips: Strip[] = [];
  const cum: number[] = [0];
  for (let i = 1; i < main.length; i++) cum.push(cum[i - 1] + main[i].distanceTo(main[i - 1]));
  strips.push({ pts: main, taper: main.map((_, i) => 0.75 + 0.25 * (i / (main.length - 1))), bright: 1, d0: 0 });
  const total = cum[cum.length - 1];

  const addFork = (from: THREE.Vector3, d0: number, flen: number, side: number, bright: number, depth: number) => {
    const end = from.clone().add(V(side * flen * (0.45 + r() * 0.45), -flen * (0.8 + r() * 0.3), (r() - 0.5) * flen * 0.2));
    const pts = displace(from, end, depth === 0 ? 5 : 4, flen * 0.13, r);
    const n = pts.length;
    strips.push({ pts, taper: pts.map((_, i) => 0.4 * Math.pow(1 - i / (n - 1), 0.85) + 0.02), bright, d0 });
    return pts;
  };
  for (let k = 0; k < s.forks; k++) {
    const idx = Math.floor((0.2 + 0.55 * ((k + r() * 0.7) / s.forks)) * (main.length - 1));
    const side = (k % 2 === 0 ? 1 : -1) * (r() < 0.2 ? -1 : 1);
    const flen = 3.4 + r() * 4.2;
    const fp = addFork(main[idx], cum[idx], flen, side, 0.55, 0);
    if (r() < 0.6 && fp.length > 12) {
      const j = Math.floor(fp.length * (0.35 + r() * 0.2));
      let dd = 0; for (let q = 1; q <= j; q++) dd += fp[q].distanceTo(fp[q - 1]);
      addFork(fp[j], cum[idx] + dd, flen * 0.42, -side, 0.3, 1);
    }
  }

  // assemble the mitred strip geometry
  let nv = 0; for (const st of strips) nv += st.pts.length * 2;
  const pos = new Float32Array(nv * 3), prev = new Float32Array(nv * 3), next = new Float32Array(nv * 3);
  const side = new Float32Array(nv), info = new Float32Array(nv * 4);
  const index: number[] = [];
  let o = 0;
  for (const st of strips) {
    const n = st.pts.length;
    let dist = st.d0;
    const kk = Math.max(2, Math.min(12, Math.floor(n / 5)));
    for (let i = 0; i < n; i++) {
      if (i > 0) dist += st.pts[i].distanceTo(st.pts[i - 1]);
      const p = st.pts[i], a = st.pts[Math.max(0, i - kk)], b = st.pts[Math.min(n - 1, i + kk)];
      for (let sd = 0; sd < 2; sd++) {
        const v = o + i * 2 + sd;
        pos.set([p.x, p.y, p.z], v * 3); prev.set([a.x, a.y, a.z], v * 3); next.set([b.x, b.y, b.z], v * 3);
        side[v] = sd === 0 ? -1 : 1;
        info.set([st.taper[i], st.bright, dist, 0], v * 4);
      }
      if (i < n - 1) { const v = o + i * 2; index.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
    }
    o += n * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  g.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return { geo: g, total };
}

const vert = /* glsl */ `
attribute vec3 aPrev; attribute vec3 aNext; attribute float aSide; attribute vec4 aInfo;
uniform vec2 uRes; uniform float uWpx, uHead, uMirror, uSurf;
varying float vPx; varying float vI; varying float vTip; varying float vEdge; varying float vWorldY;
vec3 mir(vec3 p){ return uMirror > .5 ? vec3(p.x, 2. * uSurf - p.y, p.z) : p; }
void main(){
  vec3 p = mir(position), a = mir(aPrev), b = mir(aNext);
  vec4 cp = projectionMatrix * viewMatrix * vec4(p, 1.);
  vec4 ca = projectionMatrix * viewMatrix * vec4(a, 1.);
  vec4 cb = projectionMatrix * viewMatrix * vec4(b, 1.);
  vec2 sp = cp.xy / cp.w * uRes * .5, sa = ca.xy / ca.w * uRes * .5, sb = cb.xy / cb.w * uRes * .5;
  vec2 d2 = sb - sp, d1 = sp - sa;
  float l1 = length(d1), l2 = length(d2);
  if (l1 < 1e-3) d1 = d2; if (l2 < 1e-3) d2 = d1;
  d1 = normalize(d1 + vec2(1e-6, 0.)); d2 = normalize(d2 + vec2(1e-6, 0.));
  vec2 tn = normalize(d1 + d2 + vec2(1e-6, 0.));
  vec2 nrm = vec2(-tn.y, tn.x);
  float miter = min(1. / max(dot(nrm, vec2(-d1.y, d1.x)), .6), 1.35);
  float w = uWpx * aInfo.x * miter;
  vec2 s = sp + nrm * aSide * w;
  gl_Position = vec4(s / (uRes * .5) * cp.w, cp.z, cp.w);
  vPx = aSide * w / miter;                         // true perpendicular distance in px (miter stretched out)
  vEdge = aSide;
  float behind = uHead - aInfo.z;                  // how far the leader has travelled past this point
  vI = aInfo.y * smoothstep(0., 1.2, behind);
  vTip = exp(-pow(behind * .7, 2.)) * aInfo.y;     // bright leader tip
  vWorldY = p.y;
}`;
const frag = /* glsl */ `
uniform float uCore, uGlow, uAura, uK, uMirror, uTime;
varying float vPx; varying float vI; varying float vTip; varying float vEdge; varying float vWorldY;
void main(){
  float px = abs(vPx) / uK;                        // normalised to a 900px-tall viewport
  float core = exp(-px * px / (2. * .85 * .85));
  float glow = exp(-px * px / (2. * 3.6 * 3.6)) * .8 + exp(-px / 9.) * .12;
  float aura = exp(-px * px / (2. * 38. * 38.));
  float edge = 1. - smoothstep(.72, 1., abs(vEdge));
  float k = vI * edge;
  float e = k * (core * uCore + glow * uGlow + aura * uAura) + vTip * edge * (core * 1.4 + glow * .6) * step(uCore, 4.);
  vec3 col = vec3(.88, .94, 1.) * e;
  col += vec3(1.) * k * core * uCore * .6;                 // white-hot centre
  if (uMirror > .5) {
    // sea reflection: broken into ripples, fading with depth below the surface
    float rip = .55 + .45 * sin(vWorldY * 7.3 + uTime * 1.2) * sin(vWorldY * 2.1 - uTime * .7);
    col *= .42 * rip * exp((vWorldY - 6.) * .055);
  }
  gl_FragColor = vec4(col, 1.);
}`;

export function makeBoltMaterial(mirror: boolean, surf: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uRes: { value: new THREE.Vector2(1280, 720) }, uWpx: { value: 90 }, uHead: { value: 0 }, uMirror: { value: mirror ? 1 : 0 }, uSurf: { value: surf },
      uCore: { value: 0 }, uGlow: { value: 0 }, uAura: { value: 0 }, uK: { value: 1 }, uTime: { value: 0 },
    },
  });
}

/** strike envelope: fast leader, sharp return stroke, a weaker restrike, then a lingering afterimage. tau in station units */
export function boltEnv(tau: number) {
  if (tau < 0) return { c: 0, g: 0, lead: 0 };
  const rise = Math.min(1, tau / 0.0025);
  const main = rise * Math.exp(-tau / 0.011);
  const t2 = tau - 0.024;
  const re = t2 > 0 ? Math.min(1, t2 / 0.0025) * Math.exp(-t2 / 0.012) * 0.62 : 0;
  const flick = 0.9 + 0.1 * Math.sin(tau * 1700);
  const c = (main + re) * flick;
  const g = Math.min(1.1, c * 0.65 + 0.4 * Math.exp(-tau / 0.03) * Math.min(1, tau / 0.004));
  return { c, g, lead: tau / 0.0035 };
}
