import * as THREE from 'three';
import { createCompositeMaterial } from './sdf';
import { clamp, footCycle, hash1, ik2, mix } from './rig';
import type { Leg } from './rig';

/**
 * Aquatic / early-life creature toolkit. Same idea as sdf.ts (smooth-unioned tapered capsules, sphere traced inside a
 * tight box, depth written) but with a shader built for water animals:
 *   - translucent tissue with a thin-shell look and a short volumetric march that lights up internal organs
 *     (notochord, nerve cord, canals, gonads) with travelling impulses
 *   - patterned surfaces (myomere chevrons, fish scales with shimmer, fin rays, radial canals, carapace segments,
 *     compound-eye facets, voronoi nerve net, sponge pits)
 *   - CSG carving (bell cavities, mouths, pores), thin hair-like filaments (tentacles, cirri, antennae)
 * See README.md ("Aquatic rigs") for usage.
 */

export const MAXP = 44;
export const MAXF = 48;
/** material ids */
export const AM = { skin: 0, trans: 1, eye: 2, fin: 3, hard: 4, glow: 5, carve: 9 } as const;
/** surface pattern ids */
export const PAT = { speckle: 13, cristae: 12, none: 0, chevron: 1, scales: 2, rays: 3, canals: 4, carapace: 5, facets: 6, bands: 7, glow: 8, net: 10, pits: 11 } as const;

const TAU = Math.PI * 2;

/** primitive buffer for one aquatic creature */
export class AquaSet {
  n = 0; nf = 0; last = -1;
  readonly A = new Float32Array(MAXP * 4);
  readonly B = new Float32Array(MAXP * 4);
  readonly P = new Float32Array(MAXP * 4); // k, mat, 1/zs (or -1/ys), tone
  readonly Q = new Float32Array(MAXP * 4); // pattern id, p0, p1, strength | glow: 8, s0, ds, colour mix
  readonly FA = new Float32Array(MAXF * 4);
  readonly FB = new Float32Array(MAXF * 4);
  readonly min = new THREE.Vector3();
  readonly max = new THREE.Vector3();

  reset() { this.n = 0; this.nf = 0; this.last = -1; this.min.set(1e5, 1e5, 1e5); this.max.set(-1e5, -1e5, -1e5); }

  private grow(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const m = this.min, M = this.max;
    m.set(Math.min(m.x, x0), Math.min(m.y, y0), Math.min(m.z, z0)); M.set(Math.max(M.x, x1), Math.max(M.y, y1), Math.max(M.z, z1));
  }

  /**
   * Round cone a(ra) -> b(rb). k = smooth-union radius, mat = AM.*, sq > 0 squashes z by sq (vertical fins, flanks),
   * sq < 0 squashes y by -sq (flat fins, dorsoventrally flat bodies), tone = albedo multiplier (glow: intensity).
   * Carve prims (AM.carve) subtract from everything added before them.
   */
  add(ax: number, ay: number, az: number, ra: number, bx: number, by: number, bz: number, rb: number, k = 0.05, mat = 0, sq = 1, tone = 1) {
    if (this.n >= MAXP) { this.last = -1; return; }
    if (import.meta.env.DEV) { const sk = (globalThis as unknown as { __aqSkip?: number[] }).__aqSkip; if (sk && sk.includes(mat)) { this.last = -1; return; } }
    const i = this.n++; this.last = i;
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    let len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) { bx = ax + 1e-3; dx = 1e-3; dy = 0; dz = 0; len = 1e-3; }
    const maxDiff = len * 0.97;
    if (ra - rb > maxDiff) rb = ra - maxDiff; else if (rb - ra > maxDiff) ra = rb - maxDiff;
    const o = i * 4;
    const flatZ = sq > 0;
    const s = flatZ ? sq : -sq; // squash factor
    this.A[o] = ax; this.A[o + 1] = flatZ ? ay : ay / s; this.A[o + 2] = flatZ ? az / s : az; this.A[o + 3] = ra;
    this.B[o] = dx; this.B[o + 1] = flatZ ? dy : dy / s; this.B[o + 2] = flatZ ? dz / s : dz; this.B[o + 3] = rb;
    this.P[o] = Math.max(k, 0.002); this.P[o + 1] = mat; this.P[o + 2] = flatZ ? 1 / s : -1 / s; this.P[o + 3] = tone;
    this.Q[o] = 0; this.Q[o + 1] = 0; this.Q[o + 2] = 0; this.Q[o + 3] = 0;
    if (mat < 8.5) {
      const r = Math.max(ra, rb), rx = r, ry = flatZ ? r : r * s, rz = flatZ ? r * s : r;
      this.grow(Math.min(ax, bx) - rx, Math.min(ay, by) - ry, Math.min(az, bz) - rz, Math.max(ax, bx) + rx, Math.max(ay, by) + ry, Math.max(az, bz) + rz);
    }
  }

  /** attach a surface pattern to the last added prim (strength = bump + tint amount; glow prims: p0 = s0, p1 = ds, strength = colour mix 0..1) */
  pat(id: number, p0 = 0, p1 = 1, strength = 1) {
    if (this.last < 0) return;
    const o = this.last * 4;
    this.Q[o] = id; this.Q[o + 1] = p0; this.Q[o + 2] = p1; this.Q[o + 3] = strength;
  }

  /** thin tapered strand (tentacle, cirrus, antenna, seta) */
  fil(ax: number, ay: number, az: number, ra: number, bx: number, by: number, bz: number, rb: number) {
    if (this.nf >= MAXF) return;
    const o = this.nf++ * 4;
    this.FA[o] = ax; this.FA[o + 1] = ay; this.FA[o + 2] = az; this.FA[o + 3] = ra;
    this.FB[o] = bx - ax; this.FB[o + 1] = by - ay; this.FB[o + 2] = bz - az; this.FB[o + 3] = rb;
    const r = Math.max(ra, rb);
    this.grow(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, Math.max(az, bz) + r);
  }
}

export interface AquaPalette {
  /** back / main tissue colour */ base: string;
  /** belly / counter-shade */ belly: string;
  /** back rim light colour */ rim: string;
  /** hard parts: carapace, teeth, shell */ shell: string;
  /** accent: eyes, tentacle light, bioluminescence on skin */ accent: string;
  /** internal glow A (notochord, gonads, canals) */ glowA: string;
  /** internal glow B (nerve cord, impulses) */ glowB: string;
  /** key light colour */ key: string;
  /** filament colour (tentacles, cirri) */ fil: string;
}

export interface AquaLook {
  rimK: number; rimPow: number; keyK: number; amb: number; sss: number;
  /** specular gloss on skin 0..1 */ gloss: number;
  /** translucent thickness gain */ trans: number;
  /** internal glow gain and falloff (1/world units) */ glowK: number; glowFall: number;
  /** fish-scale shimmer */ sheen: number;
  /** filament emission */ filK: number;
  /** surface bump strength multiplier */ bump: number;
  /** floor contact occlusion (creatures standing on y = 0) */ groundAO: number;
  /** impulse pulse width (1/s units in body fraction) and strength */ sigW: number; sigK: number;
  /** eye accent glow */ eyeK: number;
  /** 1 = translucent hollow shells reveal the opaque/glow organs behind them as real surfaces (cells, colonies) */ see: number;
  rimDir: [number, number]; keyDir: [number, number, number];
  /** scene fade */ w: number;
}

export const DEFAULT_AQUA_PALETTE: AquaPalette = {
  base: '#3b4048', belly: '#8a9096', rim: '#bfe4ff', shell: '#9a9488', accent: '#7fe8ff', glowA: '#ffe6b8', glowB: '#38d8ff', key: '#9aa8c0', fil: '#cfeaff',
};
export const DEFAULT_AQUA_LOOK: AquaLook = {
  rimK: 1.5, rimPow: 2.4, keyK: 0.8, amb: 0.3, sss: 0.5, gloss: 0.3, trans: 3.2, glowK: 1.6, glowFall: 9, sheen: 0.5, filK: 1, bump: 1, groundAO: 0,
  sigW: 7, sigK: 3, eyeK: 0.4, see: 0, rimDir: [-0.62, 0.78], keyDir: [0.45, 0.6, 0.65], w: 1,
};

/* ------------------------------------------------------------------------------------------------------------------ shader */

const VERT = /* glsl */ `
uniform vec3 uBMin, uBMax;
varying vec3 vOP; varying vec3 vRO;
void main(){
  vec3 p = mix(uBMin, uBMax, position + 0.5);
  vOP = p;
  vRO = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.);
}`;

const FRAG = /* glsl */ `
#define MAXP ${MAXP}
#define MAXF ${MAXF}
#define STEPS 64
#define NIN 16
uniform mat4 modelMatrix; uniform mat4 projectionMatrix;
uniform int uN; uniform int uNF;
uniform vec4 uA[MAXP]; uniform vec4 uB[MAXP]; uniform vec4 uP[MAXP]; uniform vec4 uQ[MAXP];
uniform vec4 uFA[MAXF]; uniform vec4 uFB[MAXF];
uniform vec3 uBMin, uBMax;
uniform vec3 uBase, uBelly, uRim, uShell, uAccent, uGlowA, uGlowB, uKeyCol, uFilC;
uniform float uW, uRimK, uRimPow, uKeyK, uAmb, uSss, uGloss, uTrans, uGlowK, uGlowFall, uSheen, uFilK, uBump, uGroundAO;
uniform float uSig, uSigW, uSigK, uEyeK, uPixAng, uTime, uSee;
uniform vec4 uNetO; // nerve-net impulse origin (xyz, model space) + front radius
uniform vec2 uL; uniform vec3 uKeyDir; uniform int uSteps;
varying vec3 vOP; varying vec3 vRO;

int gIds[MAXP]; int gCnt = 0;
int fIds[20]; int fCnt = 0;

float hash1(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
vec3 hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p)*43758.5453);
}
float hash3(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
vec2 worley3(vec3 x){
  vec3 i = floor(x), f = fract(x); float d1 = 8., d2 = 8.;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int xx = -1; xx <= 1; xx++){
    vec3 g = vec3(float(xx), float(y), float(z)); vec3 o = hash33(i + g); vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}

vec3 sqz(vec4 pp){ return pp.z >= 0. ? vec3(1., 1., 1./pp.z) : vec3(1., -1./pp.z, 1.); }

float primH(int i, vec3 p, out float h){
  vec4 a = uA[i]; vec4 b = uB[i]; vec4 pp = uP[i];
  vec3 q = p; if (pp.z >= 0.) q.z *= pp.z; else q.y *= -pp.z;
  vec3 pa = q - a.xyz;
  float l2 = dot(b.xyz, b.xyz);
  h = clamp(dot(pa, b.xyz)/l2, 0., 1.);
  float sl = a.w - b.w;
  float corr = min(1., 1./abs(pp.z)) * inversesqrt(1. + sl*sl/l2);
  return (length(pa - b.xyz*h) - mix(a.w, b.w, h))*corr;
}
float prim(int i, vec3 p){ float h; return primH(i, p, h); }
float smin(float a, float b, float k){ float h = max(k - abs(a-b), 0.)/k; return min(a,b) - h*h*k*0.25; }
float smax(float a, float b, float k){ float h = max(k - abs(a-b), 0.)/k; return max(a,b) + h*h*k*0.25; }

float map(vec3 p){
  float d = 1e5;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j]; vec4 pp = uP[i];
    float di = prim(i, p);
    if (pp.y > 8.5) d = smax(d, -di, pp.x); else d = smin(d, di, pp.x);
  }
  return d;
}
float mapInner(vec3 p){
  float d = 1e5;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j]; vec4 pp = uP[i];
    if (pp.y > 8.5 || (pp.y > 0.5 && pp.y < 1.5)) continue;
    d = smin(d, prim(i, p), pp.x);
  }
  return d;
}
float mapF(vec3 p){
  float d = 1e5;
  for (int j = 0; j < 20; j++){
    if (j >= fCnt) break;
    int i = fIds[j]; vec3 a = uFA[i].xyz; vec3 ba = uFB[i].xyz; vec3 pa = p - a;
    float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
    d = min(d, length(pa - ba*h) - mix(uFA[i].w, uFB[i].w, h));
  }
  return d;
}
float mapAll(vec3 p){ return min(map(p), fCnt > 0 ? mapF(p) : 1e5); }
vec3 calcNormal(vec3 p, float h){
  const vec2 e = vec2(1., -1.)*0.5773;
  return normalize(e.xyy*mapAll(p + e.xyy*h) + e.yyx*mapAll(p + e.yyx*h) + e.yxy*mapAll(p + e.yxy*h) + e.xxx*mapAll(p + e.xxx*h));
}

float spongeH(vec3 q, float fq){
  vec3 wq = q + (vec3(vn(q*2.7), vn(q*2.7 + 5.2), vn(q*2.7 + 9.1)) - 0.5)*0.35;
  vec2 a = worley3(wq*fq); vec2 b = worley3(wq*fq*2.9 + 3.3);
  return 0.62*smoothstep(0., 0.5, a.y - a.x) + 0.38*smoothstep(0., 0.45, b.y - b.x);
}
/* ---- surface patterns: return height 0..1, write albedo tint + sparkle id ---- */
float gTint = 1.; float gSpark = 0.;
float pat(int ty, float s, float c){
  gTint = 1.; gSpark = 0.;
  if (ty == 1){ float u = s - 0.42*abs(c); float h = 0.5 + 0.5*cos(6.2832*u); h = h*h*(3.-2.*h); gTint = 0.6 + 0.4*h; return h; }
  if (ty == 2){
    vec2 g = vec2(s + c, s - c); vec2 id = floor(g); vec2 f = fract(g) - 0.5; float d = length(f);
    float h = smoothstep(0.66, 0.1, d); float hr = hash1(id.x*17.3 + id.y*5.1);
    gTint = (0.42 + 0.58*h)*(0.8 + 0.4*hr); gSpark = hr; return h;
  }
  if (ty == 3){
    float r = pow(0.5 + 0.5*cos(6.2832*s), 2.2);
    float seg = smoothstep(0.8, 1., 0.5 + 0.5*cos(6.2832*c));
    gTint = 0.5 + 0.5*r; gTint *= 1. - 0.25*seg*r; return r;
  }
  if (ty == 4){ float r = pow(0.5 + 0.5*cos(6.2832*s), 16.); gTint = r; return r; }
  if (ty == 5){ float u = s + 0.12*c*c; float v = sin(3.1416*fract(u)); float h = pow(max(v, 0.), 0.5); gTint = 0.5 + 0.5*h; return h; }
  if (ty == 6){
    vec2 uv = vec2(s, c); float row = floor(uv.y); uv.x += 0.5*mod(row, 2.); vec2 id = floor(uv); vec2 f = fract(uv) - 0.5;
    float h = smoothstep(0.62, 0.12, length(f*vec2(1., 1.15))); gTint = 0.35 + 0.65*h; gSpark = hash1(id.x*13.1 + id.y*7.7 + row*3.3); return h;
  }
  if (ty == 7){ float v = 0.5 + 0.5*cos(6.2832*s); gTint = 0.78 + 0.22*v; return v; }
  return 0.;
}

void main(){
  vec3 ro = vRO; vec3 rd = normalize(vOP - ro);
  vec3 inv = 1./rd;
  vec3 t0 = (uBMin - ro)*inv, t1 = (uBMax - ro)*inv;
  vec3 tmn = min(t0, t1), tmx = max(t0, t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.)), tf = min(min(tmx.x, tmx.y), tmx.z);
  if (tf <= tn || uW < 0.003) discard;

  float sn = 1e5, sf = -1e5;
  for (int i = 0; i < MAXP; i++){
    if (i >= uN) break;
    vec4 pp = uP[i];
    vec3 sq = sqz(pp);
    vec3 a = uA[i].xyz*sq; vec3 u = uB[i].xyz*sq;
    float rmax = max(uA[i].w, uB[i].w)*max(1., 1./abs(pp.z));
    vec3 w0 = ro - a;
    float aa = dot(u,u), bb = dot(u,rd), dd = dot(u,w0), ee = dot(rd,w0);
    float den = aa - bb*bb;
    float sP = den > 1e-7 ? clamp((dd - bb*ee)/den, 0., 1.) : 0.;
    float tP = sP*bb - ee;
    vec3 dv = w0 + rd*tP - u*sP;
    float rp = rmax + pp.x + 0.05;
    if (dot(dv,dv) < rp*rp){
      gIds[gCnt++] = i;
      if (pp.y < 8.5){
        vec3 cc = a + u*0.5 - ro; float tc = dot(cc, rd); vec3 cr = cc - rd*tc;
        float R = length(u)*0.5 + rmax + 0.05; float h2 = R*R - dot(cr,cr);
        if (h2 > 0.){ float h = sqrt(h2); sn = min(sn, tc - h); sf = max(sf, tc + h); }
      }
    }
  }
  for (int i = 0; i < MAXF; i++){
    if (i >= uNF) break;
    vec3 a = uFA[i].xyz; vec3 u = uFB[i].xyz; vec3 w0 = ro - a;
    float aa = dot(u,u), bb = dot(u,rd), dd = dot(u,w0), ee = dot(rd,w0);
    float den = aa - bb*bb;
    float sP = den > 1e-7 ? clamp((dd - bb*ee)/den, 0., 1.) : 0.;
    float tP = sP*bb - ee;
    vec3 dv = w0 + rd*tP - u*sP;
    float rp = max(uFA[i].w, uFB[i].w) + tP*uPixAng*1.5 + 0.01;
    if (dot(dv,dv) < rp*rp && fCnt < 20){
      fIds[fCnt++] = i;
      vec3 cc = a + u*0.5 - ro; float tc = dot(cc, rd); vec3 cr = cc - rd*tc;
      float R = length(u)*0.5 + 0.04; float h2 = R*R - dot(cr,cr);
      if (h2 > 0.){ float h = sqrt(h2); sn = min(sn, tc - h); sf = max(sf, tc + h); }
    }
  }
  if (gCnt == 0 && fCnt == 0) discard;
  if (sf > sn){ tn = max(tn, sn); tf = min(tf, sf); }

  float t = tn, dmin = 1e5, tmin = tn; bool hit = false; bool isF = false;
  for (int i = 0; i < STEPS; i++){
    if (i >= uSteps) break;
    vec3 pp = ro + rd*t;
    float d = map(pp);
    float df = fCnt > 0 ? mapF(pp) : 1e5;
    bool fn = df < d; d = min(d, df);
    float eps = 0.0006 + t*uPixAng*0.45;
    if (d < dmin){ dmin = d; tmin = t; isF = fn; }
    if (d < eps){ hit = true; break; }
    t += max(d*0.88, eps*0.6);
    if (t > tf) break;
  }
  float ts = hit ? t : tmin;
  vec3 p = ro + rd*ts;
  float pix = ts*uPixAng;
  float alpha = 1.;
  if (!hit){
    float fw = pix*1.15;
    if (dmin > fw) discard;
    alpha = 1. - smoothstep(0., fw, dmin);
    alpha *= alpha*(3.-2.*alpha);
  }
  vec4 cpd = projectionMatrix*viewMatrix*modelMatrix*vec4(p, 1.);
  float depth = clamp(cpd.z/cpd.w*0.5 + 0.5, 0., 1.);

  vec3 N = calcNormal(p, 0.0012 + pix*0.5);
  vec3 Nw = normalize(mat3(modelMatrix)*N);
  vec3 Nv = normalize(mat3(viewMatrix)*Nw);
  vec3 pw = (modelMatrix*vec4(p, 1.)).xyz;
  vec3 V = normalize((viewMatrix*vec4(cameraPosition - pw, 0.)).xyz);
  float nv = clamp(dot(Nv, V), 0., 1.);
  float fres = pow(1. - nv, uRimPow);
  float side = dot(normalize(Nv.xy + 1e-4), uL);
  float rimLit = mix(0.25, 1., smoothstep(-0.45, 0.7, side));
  vec3 Lk = normalize(uKeyDir);
  vec3 Lr = normalize(vec3(uL*0.9, -0.5));

  if (isF){
    // tentacle / cirrus / antenna: thin, glassy, glowing, brighter toward the tip
    float ndl = clamp(dot(Nv, Lk)*0.5 + 0.5, 0., 1.);
    vec3 fc = uFilC*(0.18 + 0.5*ndl) + uRim*fres*uRimK*rimLit*0.8 + uAccent*0.25*uFilK;
    fc *= uFilK;
    gl_FragColor = vec4(fc*uW*alpha, alpha*0.9*clamp(uW, 0., 1.));
    gl_FragDepth = depth;
    return;
  }

  // ---- nearest primitive decides pattern; neighbours blend materials
  float bd = 1e5; int bi = -1;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j];
    if (uP[i].y > 8.5) continue;
    float di = prim(i, p);
    if (di < bd){ bd = di; bi = i; }
  }
  if (bi < 0){ discard; }
  float W[6]; for (int m = 0; m < 6; m++) W[m] = 0.;
  float tone = 0., wsum = 0.;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j];
    float m = uP[i].y; if (m > 8.5) continue;
    float w = exp(-(prim(i, p) - bd)*((m > 1.5 && m < 2.5) || (m > 4.5 && m < 5.5) ? 450. : 48.));
    W[int(m + 0.5)] += w; tone += w*uP[i].w; wsum += w;
  }
  tone /= wsum; for (int m = 0; m < 6; m++) W[m] /= wsum;

  // pattern on the nearest prim
  vec4 qq = uQ[bi]; int ty = int(qq.x + 0.5);
  vec4 pa4 = uA[bi], pb4 = uB[bi], pp4 = uP[bi];
  vec3 sqv = sqz(pp4);
  vec3 qs = p/sqv;                                  // prim's scaled space
  vec3 rel = qs - pa4.xyz;
  float len2 = dot(pb4.xyz, pb4.xyz);
  float hhu = dot(rel, pb4.xyz)/len2;
  float hh = hhu;
  vec3 vv = rel - pb4.xyz*hhu;
  float rr = max(mix(pa4.w, pb4.w, clamp(hhu, 0., 1.)), 1e-3);
  vec3 T = normalize(pb4.xyz*sqv);
  vec3 Tt = normalize(cross(T, N) + 1e-5);
  float H = 0., tintP = 1.; float spark = 0.; float netL = 0.; float pitD = 0.;
  vec3 Nb = N;
  float pstr = qq.w*uBump;
  if (ty >= 1 && ty <= 7){
    float s0, c0, es = 0.02, ec = 0.02;
    float alen = length(pb4.xyz*sqv);
    if (ty == 1){ s0 = qq.y + hh*qq.z; c0 = clamp(vv.y/rr, -1., 1.); }
    else if (ty == 2){ s0 = (qq.y + hh*alen)/qq.z; c0 = atan(vv.z, vv.y)*rr/qq.z; es = 0.04; ec = 0.04; }
    else if (ty == 3){
      vec2 r2 = pp4.z >= 0. ? rel.xy : rel.xz; float ang = atan(r2.y, r2.x);
      s0 = ang*qq.y; c0 = length(r2)*qq.z; es = 0.03; ec = 0.03;
    }
    else if (ty == 4){ vec3 rw = p - pa4.xyz*sqv; float ang = atan(rw.z, rw.x); s0 = ang/6.2832*qq.y; c0 = length(rw.xz); es = 0.01; }
    else if (ty == 5 || ty == 7){ s0 = qq.y + hh*qq.z; c0 = vv.y/rr; if (pp4.z >= 0.) c0 = vv.z/rr; }
    else { vec3 d = normalize(rel); s0 = atan(d.z, d.x)/6.2832*qq.y; c0 = asin(clamp(d.y, -1., 1.))/3.1416*qq.y*2.; es = 0.04; ec = 0.04; }
    H = pat(ty, s0, c0); tintP = gTint; spark = gSpark;
    
    float Hs = pat(ty, s0 + es, c0); float Hc = pat(ty, s0, c0 + ec);
    float dHs = (Hs - H)/es, dHc = (Hc - H)/ec;
    float cellW = ty == 2 ? qq.z : (ty == 1 ? alen/max(qq.z, 0.01) : 0.1);
    float lodF = 1. - smoothstep(0.12, 0.32, pix/max(cellW, 1e-3));
    pstr *= lodF;
    float bA = ty == 1 ? 0.07 : (ty == 2 ? 0.1 : (ty == 3 ? 0.05 : (ty == 4 ? 0.03 : (ty == 5 ? 0.1 : (ty == 6 ? 0.1 : 0.04)))));
    Nb = normalize(N - (T*dHs + Tt*dHc*(ty == 1 ? 0.3 : 1.))*pstr*bA);
    tintP = mix(1., tintP, clamp(qq.w, 0., 1.)*lodF);
    gTint = tintP;
  } else if (ty == 10){
    vec2 w = worley3(p*qq.y); float e = w.y - w.x;
    float line = 1. - smoothstep(0., uNetO.w < 0. ? 0.15 : 0.07, e);
    float dd = distance(p, uNetO.xyz);
    float rip = exp(-pow((dd - uNetO.w)*2.4, 2.))*step(0., uNetO.w);
    netL = line*((uNetO.w < 0. ? 0.6 : 0.22) + 1.7*rip) + exp(-pow((dd - uNetO.w)*2.4, 2.))*0.1*step(0., uNetO.w);
    H = line;
  } else if (ty == 13){
    float fq = qq.y; float dd2 = 0.25/fq;
    float h0 = 0.6*vn(p*fq) + 0.4*vn(p*fq*2.7 + 4.1);
    float h1 = 0.6*vn((p + T*dd2)*fq) + 0.4*vn((p + T*dd2)*fq*2.7 + 4.1);
    float h2 = 0.6*vn((p + Tt*dd2)*fq) + 0.4*vn((p + Tt*dd2)*fq*2.7 + 4.1);
    H = h0; Nb = normalize(N - (T*(h1 - h0) + Tt*(h2 - h0))*3.0*pstr);
  } else if (ty == 11){
    float fq = qq.y; float dd2 = 0.3/fq;
    float e0 = spongeH(p, fq), e1 = spongeH(p + T*dd2, fq), e2 = spongeH(p + Tt*dd2, fq);
    pitD = 1.; H = e0;
    float lodS = 1. - smoothstep(0.1, 0.3, pix*fq);
    Nb = normalize(N - (T*(e1 - e0) + Tt*(e2 - e0))*1.1*pstr*lodS);
  }
  // micro skin noise (always)
  float mn = vn(p*vec3(38., 38., 38.)/max(rr + 0.25, 0.3));
  Nb = normalize(Nb + (vec3(vn(p*61. + 3.1), vn(p*61. + 7.7), vn(p*61. + 1.3)) - 0.5)*0.12*uBump*(1. - W[3])*(1. - 0.5*W[1]));

  Nw = normalize(mat3(modelMatrix)*Nb);
  Nv = normalize(mat3(viewMatrix)*Nw);

  // ambient occlusion from the field + floor contact
  float occ = 0., sc = 1.;
  for (int i = 1; i <= 3; i++){ float h = 0.01*float(i*i); occ += (h - map(p + N*h))*sc; sc *= 0.6; }
  float ao = clamp(1. - 1.3*occ/(1. + pix*40.), 0.35, 1.);
  ao *= 1. - uGroundAO*exp(-max(p.y, 0.)*8.)*(0.35 + 0.65*clamp(0.5 - 0.5*N.y, 0., 1.));

  float belly = smoothstep(0.2, -0.8, N.y);
  vec3 skinA = mix(uBase, uBelly, belly)*(0.92 + 0.16*mn);
  float ndl = dot(Nv, Lk);
  float wrap = clamp((ndl + uSss)/(1. + uSss), 0., 1.);
  float term = exp(-pow((ndl - 0.05)*2.8, 2.));

  // ---- opaque / semi-opaque parts
  vec3 alb = skinA*W[0]*tintP;
  if (ty == 10) alb = skinA*W[0];
  if (ty == 13) alb = skinA*W[0]*(0.8 + 0.4*H);
  if (ty == 11){ float lodS2 = 1. - smoothstep(0.1, 0.3, pix*qq.y); alb = skinA*W[0]*mix(1., 0.5 + 0.5*H, lodS2)*(0.88 + 0.24*vn(p*7.)); }
  alb += uShell*(0.72 + 0.28*mn)*W[4]*(ty == 5 || ty == 6 ? tintP : (ty == 13 ? 0.65 + 0.7*H : 1.));
  alb += vec3(0.012, 0.012, 0.014)*W[2];
  alb += mix(uGlowA, uGlowB, qq.w)*0.3*W[5];
  alb += mix(uBase, uBelly, 0.4)*0.85*W[3]*tintP;
  alb *= tone;
  vec3 col = alb*(uKeyK*wrap*uKeyCol + uAmb*(0.5 + 0.5*Nw.y)*uKeyCol)*ao;
  col += alb*uRim*term*uSss*0.2*ao;
  col += alb*uKeyCol*0.35*clamp(-Nw.y, 0., 1.)*(0.5 + 0.5*ao);
  vec3 rimc = uRim*fres*rimLit*uRimK*(0.6 + 0.4*ao);
  col += rimc*(1. - 0.55*W[2]);

  // scale shimmer: every scale is a tiny mirror at a slightly different angle
  if (ty == 2 && uSheen > 0.){
    vec3 Ns = normalize(Nv + (vec3(hash1(spark*91.7), hash1(spark*37.1 + 4.), hash1(spark*13.3 + 9.)) - 0.5)*0.9*(0.4 + H));
    vec3 R = reflect(-V, Ns);
    float sp = pow(max(dot(R, Lk), 0.), 10.) + 0.8*pow(max(dot(R, Lr), 0.), 8.);
    float tw = 0.5 + 0.5*sin(uTime*1.7 + spark*40.);
    col += (uRim*0.9 + uKeyCol*0.4)*sp*uSheen*(0.35 + 0.65*tw)*H*W[0]*ao;
  }
  // hard parts: gloss
  if (W[4] > 0.01){
    vec3 R = reflect(-V, Nv);
    col += (uKeyCol*pow(max(dot(R, Lk), 0.), 30.)*0.5 + uRim*pow(max(dot(R, Lr), 0.), 18.)*0.5)*W[4]*(0.5 + 0.5*H);
  }
  // moist skin gloss
  float gl = uGloss*W[0];
  if (gl > 0.) col += (uKeyCol*pow(max(dot(reflect(-V, Nv), Lk), 0.), 36.)*0.22 + uRim*pow(max(dot(reflect(-V, Nv), Lr), 0.), 20.)*0.18)*gl*ao;

  // eye
  if (W[2] > 0.01){
    vec3 R = reflect(-V, Nv);
    float ring = smoothstep(0.2, 0.6, nv)*smoothstep(0.99, 0.75, nv);
    vec3 ec = vec3(0.012) + uAccent*(1. - exp(-uEyeK*(ty == 6 ? (0.04 + 0.96*H*H*(0.55 + 0.45*sin(uTime*2.5 + spark*30.)))*(0.5 + 0.5*nv) : (0.1 + 0.9*ring)*smoothstep(0.1, 0.5, nv))));
    ec += vec3(1.)*pow(max(dot(R, Lk), 0.), 160.)*1.3 + uRim*pow(max(dot(R, Lr), 0.), 80.)*0.5 + uRim*pow(1. - nv, 3.)*0.12;
    col = mix(col, ec, W[2]);
  }

  // net / canals / glow on the skin itself
  vec3 emit = vec3(0.);
  if (ty == 10) emit += mix(uGlowA*0.6, uGlowB, clamp(netL*0.7, 0., 1.))*netL*uGlowK*0.7;
  if (ty == 4) emit += uGlowB*H*uGlowK*0.5*(0.7 + 0.3*nv);
  if (ty == 11){ float rp = exp(-pow((distance(p, uNetO.xyz) - uNetO.w)*2.4, 2.))*step(0., uNetO.w); emit += mix(uGlowB, uGlowA, 0.25)*rp*(0.2 + 0.8*(1. - smoothstep(0.15, 0.55, H)))*uGlowK*0.7; }
  // surface glow prims
  if (W[5] > 0.02){
    vec3 gc = mix(uGlowA, uGlowB, qq.w);
    float s = qq.y + hh*qq.z; float pulse = 1. + uSigK*exp(-pow((s - uSig)*uSigW, 2.));
    emit += gc*pulse*(0.5 + 0.5*nv)*tone*W[5]*uGlowK;
  }

  float aOpq = 1.;
  // ---- translucent tissue: thin-shell look plus a short volumetric march that lights internal glow prims
  float aT = 1.;
  vec3 colT = vec3(0.);
  float wT = W[1];
  float aF = 1.;
  if (wT > 0.02){
    vec3 glowAcc = vec3(0.); float thick = 0.; float tin = 0.006;
    for (int j = 0; j < 8; j++){
      float d = map(p + rd*tin);
      if (d > 0.003 && j > 0) break;
      float sl = clamp(abs(d), 0.04, 0.35);
      thick += sl; tin += sl;
    }
    // internal glow: analytic closest approach between the ray path inside the body and each glowing organ
    for (int k = 0; k < MAXP; k++){
      if (k >= gCnt || uSee > 0.5) break;
      int i = gIds[k]; vec4 pr = uP[i];
      if (pr.y < 4.5 || pr.y > 5.5) continue;
      vec3 sq = sqz(pr); vec3 a = uA[i].xyz*sq; vec3 u = uB[i].xyz*sq; vec3 w0 = p - a;
      float aa = dot(u,u), bb = dot(u,rd), dd = dot(u,w0), ee = dot(rd,w0);
      float den = aa - bb*bb;
      float s1 = den > 1e-7 ? clamp((dd - bb*ee)/den, 0., 1.) : 0.;
      float tt = clamp(bb*s1 - ee, 0., tin);
      s1 = clamp((dd + bb*tt)/aa, 0., 1.);
      float dist = length(w0 + rd*tt - u*s1);
      float r = mix(uA[i].w, uB[i].w, s1);
      float e = exp(-max(dist - r, 0.)*uGlowFall) * (0.4 + 0.6*smoothstep(0., r*1.4, r*1.4 - max(dist - r*0.2, 0.)));
      float s = uQ[i].y + s1*uQ[i].z; float pulse = 1. + uSigK*exp(-pow((s - uSig)*uSigW, 2.));
      glowAcc += mix(uGlowA, uGlowB, uQ[i].w)*e*pulse*pr.w*0.55;
    }
    // light caught by the tissue
    vec3 tissue = mix(uBase, uBelly, belly*0.6 + 0.2)*tone*(0.9 + 0.2*mn)*(0.7 + 0.6*vn(p*vec3(4.5, 4.5, 4.5) + 3.1));
    vec3 lit = tissue*(uKeyK*wrap*0.55*uKeyCol + uAmb*0.7*uKeyCol)*ao*tintP;
    float edge = fres*rimLit;
    vec3 gSoft = 1. - exp(-glowAcc*uGlowK);
    colT = lit*0.8 + uRim*edge*uRimK*0.8*mix(1., tintP, 0.7) + gSoft*1.25;
    if (ty == 1) colT += uRim*0.2*H*(0.4 + 0.6*nv)*clamp(qq.w, 0., 1.)*(1. - 0.6*edge);
    colT += uRim*pow(1. - nv, 1.6)*0.14*tintP*uRimK;
    float lumG = dot(gSoft, vec3(0.33));
    aT = clamp(0.14 + 0.55*fres + thick*uTrans*0.28 + lumG*0.6, 0., 0.97);
    if (uSee > 0.5){
      float t2 = ts + 0.05; bool h2 = false;
      for (int j = 0; j < 44; j++){
        float dd = mapInner(ro + rd*t2);
        if (dd < 0.0008 + t2*uPixAng*0.45){ h2 = true; break; }
        t2 += max(dd*0.9, 0.002); if (t2 > tf) break;
      }
      if (h2){
        vec3 p2 = ro + rd*t2; const vec2 e2 = vec2(1., -1.)*0.5773;
        vec3 N2 = normalize(e2.xyy*mapInner(p2 + e2.xyy*0.004) + e2.yyx*mapInner(p2 + e2.yyx*0.004) + e2.yxy*mapInner(p2 + e2.yxy*0.004) + e2.xxx*mapInner(p2 + e2.xxx*0.004));
        float bd2 = 1e5; int b2 = 0;
        for (int j = 0; j < MAXP; j++){ if (j >= gCnt) break; int i = gIds[j]; float m = uP[i].y; if (m > 8.5 || (m > 0.5 && m < 1.5)) continue; float di = prim(i, p2); if (di < bd2){ bd2 = di; b2 = i; } }
        vec3 N2v = normalize(mat3(viewMatrix)*normalize(mat3(modelMatrix)*N2));
        float nv2 = clamp(dot(N2v, V), 0., 1.);
        vec3 gc = mix(uGlowA, uGlowB, uQ[b2].w);
        float lam = clamp(dot(N2v, Lk)*0.5 + 0.5, 0., 1.);
        float oc = 0.; float sc2 = 1.; for (int i = 1; i <= 3; i++){ float hh2 = 0.02*float(i*i); oc += (hh2 - mapInner(p2 + N2*hh2))*sc2; sc2 *= 0.6; }
        float ao2 = clamp(1. - 1.2*oc, 0.3, 1.);
        float hq; primH(b2, p2, hq);
        float cr = 1.; if (int(uQ[b2].x + 0.5) == 12){ cr = 0.5 + 0.5*smoothstep(-0.3, 0.6, sin(6.2832*hq*uQ[b2].z)); }
        float grain = 0.85 + 0.3*vn(p2*vec3(16.));
        vec3 R2 = reflect(-V, N2v);
        vec3 ic = gc*min(uP[b2].w, 1.6)*(0.16 + 0.84*lam)*ao2*cr*grain*1.15*uGlowK + uRim*pow(1. - nv2, 2.4)*0.6 + gc*0.08*uGlowK + (uKeyCol*pow(max(dot(R2, Lk), 0.), 36.)*0.35 + uRim*pow(max(dot(R2, Lr), 0.), 20.)*0.25)*ao2;
        colT += ic*(1. - 0.5*aT); aT = max(aT, 0.96);
      }
    }
    col = mix(col, colT, wT);
    aOpq = mix(1., aT, wT);
  }
  // fin membrane: see-through between the rays, rays and edge catch the light
  if (W[3] > 0.02){
    float lit3 = 0.25 + 0.75*(ty == 3 ? H : 0.5);
    aF = clamp(0.22 + 0.62*lit3 + 0.35*fres, 0., 0.95);
    col += uRim*(0.18 + 0.5*fres)*rimLit*uRimK*(ty == 3 ? (0.4 + 0.9*H) : 0.6)*W[3] + uAccent*0.0;
    aOpq *= mix(1., aF, W[3]);
  }
  col += emit;
  aOpq = max(aOpq, clamp(dot(emit, vec3(0.33)), 0., 1.));

  float aa2 = alpha*aOpq*clamp(uW, 0., 1.);
  gl_FragColor = vec4(col*uW*alpha, aa2);
  gl_FragDepth = depth;
}`;

export type AquaMaterial = THREE.ShaderMaterial;

export function createAquaMaterial(): AquaMaterial {
  const u: Record<string, THREE.IUniform> = {
    uN: { value: 0 }, uNF: { value: 0 },
    uA: { value: new Float32Array(MAXP * 4) }, uB: { value: new Float32Array(MAXP * 4) },
    uP: { value: new Float32Array(MAXP * 4) }, uQ: { value: new Float32Array(MAXP * 4) },
    uFA: { value: new Float32Array(MAXF * 4) }, uFB: { value: new Float32Array(MAXF * 4) },
    uBMin: { value: new THREE.Vector3() }, uBMax: { value: new THREE.Vector3() },
    uBase: { value: new THREE.Color() }, uBelly: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uShell: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() }, uGlowA: { value: new THREE.Color() }, uGlowB: { value: new THREE.Color() },
    uKeyCol: { value: new THREE.Color() }, uFilC: { value: new THREE.Color() },
    uW: { value: 1 }, uRimK: { value: 1 }, uRimPow: { value: 2.4 }, uKeyK: { value: 0.8 }, uAmb: { value: 0.3 }, uSss: { value: 0.5 }, uGloss: { value: 0.3 },
    uTrans: { value: 3 }, uGlowK: { value: 1.5 }, uGlowFall: { value: 9 }, uSheen: { value: 0.5 }, uFilK: { value: 1 }, uBump: { value: 1 }, uGroundAO: { value: 0 },
    uSee: { value: 0 }, uSig: { value: -1 }, uSigW: { value: 7 }, uSigK: { value: 3 }, uEyeK: { value: 0.4 }, uPixAng: { value: 0.001 }, uTime: { value: 0 },
    uNetO: { value: new THREE.Vector4(0, 1, 0, -1) },
    uSteps: { value: 64 },
    uL: { value: new THREE.Vector2(-0.62, 0.78) }, uKeyDir: { value: new THREE.Vector3(0.45, 0.6, 0.65) },
  };
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
    side: THREE.BackSide, transparent: true, depthWrite: true, depthTest: true, toneMapped: false, premultipliedAlpha: true,
  });
}

export function uploadAqua(m: AquaMaterial, ps: AquaSet, pad = 0.04) {
  const u = m.uniforms;
  (u.uA.value as Float32Array).set(ps.A); (u.uB.value as Float32Array).set(ps.B);
  (u.uP.value as Float32Array).set(ps.P); (u.uQ.value as Float32Array).set(ps.Q);
  (u.uFA.value as Float32Array).set(ps.FA); (u.uFB.value as Float32Array).set(ps.FB);
  u.uN.value = ps.n; u.uNF.value = ps.nf;
  (u.uBMin.value as THREE.Vector3).copy(ps.min).addScalar(-pad);
  (u.uBMax.value as THREE.Vector3).copy(ps.max).addScalar(pad);
}

export function applyAquaPalette(m: AquaMaterial, p: AquaPalette) {
  const u = m.uniforms;
  (u.uBase.value as THREE.Color).set(p.base); (u.uBelly.value as THREE.Color).set(p.belly); (u.uRim.value as THREE.Color).set(p.rim);
  (u.uShell.value as THREE.Color).set(p.shell); (u.uAccent.value as THREE.Color).set(p.accent); (u.uGlowA.value as THREE.Color).set(p.glowA);
  (u.uGlowB.value as THREE.Color).set(p.glowB); (u.uKeyCol.value as THREE.Color).set(p.key); (u.uFilC.value as THREE.Color).set(p.fil);
}

export function applyAquaLook(m: AquaMaterial, l: AquaLook) {
  const u = m.uniforms;
  u.uRimK.value = l.rimK; u.uRimPow.value = l.rimPow; u.uKeyK.value = l.keyK; u.uAmb.value = l.amb; u.uSss.value = l.sss; u.uGloss.value = l.gloss;
  u.uTrans.value = l.trans; u.uGlowK.value = l.glowK; u.uGlowFall.value = l.glowFall; u.uSheen.value = l.sheen; u.uFilK.value = l.filK; u.uBump.value = l.bump;
  u.uGroundAO.value = l.groundAO; u.uSigW.value = l.sigW; u.uSigK.value = l.sigK; u.uEyeK.value = l.eyeK; u.uSee.value = l.see;
  (u.uL.value as THREE.Vector2).set(l.rimDir[0], l.rimDir[1]).normalize();
  (u.uKeyDir.value as THREE.Vector3).set(...l.keyDir).normalize();
  u.uW.value = l.w;
}

export { createCompositeMaterial };

/* ------------------------------------------------------------------------------------------------------------------ rig state */

export type AquaKind =
  | 'lancelet' | 'lamprey' | 'ostracoderm' | 'fish' | 'tetrapod' | 'anomalocaris' | 'trilobite' | 'flatworm' | 'jellyfish' | 'sponge' | 'axon' | 'egg' | 'bacterium' | 'cell' | 'colony' | 'skull';

export interface AquaState {
  /** seconds (frozen when reduced motion) */ time: number;
  /** swim / pulse / gait phase in cycles; the scene or component advances it */ phase: number;
  /** swim amplitude 0..1 */ beat: number;
  /** steering bend -1..1 (curls the body) */ turn: number;
  /** 0..1 mouth open / appendage grasp */ mouth: number;
  /** tetrapod: 0 swimming .. 1 hauled out and walking */ land: number;
  /** flatworm: 0 radial disc .. 1 bilateral worm. cell kinds: morph */ morph: number;
  /** nerve-net strength 0..1 (flatworm radial net, jelly net) */ net: number;
  /** impulse position 0..1 along the body (-1 none) */ sig: number;
  /** 0..1 how developed / present (appendage grasp, fins, etc, per kind) */ grow: number;
  /** extra free parameter per kind (jelly: manual pulse 0..1 when >= 0) */ aux: number;
  /** outputs: head centre in local space */ headX: number; headY: number; headZ: number;
}
export const newAquaState = (): AquaState => ({
  time: 0, phase: 0, beat: 1, turn: 0, mouth: 0, land: 0, morph: 1, net: 1, sig: -1, grow: 1, aux: -1, headX: 0, headY: 0, headZ: 0,
});

/* ------------------------------------------------------------------------------------------------------------------ spine helper */

const NS = 16;
const SX = new Float32Array(NS), SY = new Float32Array(NS), SZ = new Float32Array(NS), SH = new Float32Array(NS), SR = new Float32Array(NS);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Travelling body wave. Head at +x. Heading angle theta(s) = amp * env(s) * cos(2pi (waves s - phase)); positions are
 * integrated so the body keeps its length. The wave moves head->tail (phase increasing = forward swimming).
 */
function spine(n: number, L: number, amp: number, waves: number, head: number, phase: number, bias: number, yBob = 0) {
  const ds = L / (n - 1);
  let x = L * 0.5, z = 0;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const env = head + (1 - head) * Math.pow(s, 1.4);
    const th = amp * env * Math.cos(TAU * (waves * s - phase)) + bias * (s - 0.25) * 1.6;
    SH[i] = th; SX[i] = x; SZ[i] = z; SY[i] = yBob * Math.sin(TAU * (waves * s - phase) + 1.2) * env;
    x -= ds * Math.cos(th); z += ds * Math.sin(th);
  }
  const ic = Math.round(0.3 * (n - 1)); const z0 = SZ[ic];
  for (let i = 0; i < n; i++) SZ[i] -= z0;
}

/* ------------------------------------------------------------------------------------------------------------------ params */

export type AquaParams = Record<string, number>;

export interface AquaPreset { palette: AquaPalette; look: Partial<AquaLook>; k: AquaParams }

const PRESET_BASE = DEFAULT_AQUA_PALETTE;
const pal = (o: Partial<AquaPalette>): AquaPalette => ({ ...PRESET_BASE, ...o });

export const AQUA_PRESETS: Record<AquaKind, AquaPreset> = {
  lancelet: {
    palette: pal({ base: '#56646c', belly: '#8798a0', rim: '#d8f2ff', glowA: '#fff0d4', glowB: '#19d8ff', key: '#a9b8c8', fil: '#d8f4ff', accent: '#5fe6ff' }),
    look: { rimK: 0.9, rimPow: 2.6, keyK: 0.4, amb: 0.22, trans: 3.6, glowK: 1.5, glowFall: 55, sss: 0.7, sigW: 8, sigK: 3.2, gloss: 0.4, bump: 1.2 },
    k: { len: 3.0, girth: 0.27, amp: 0.34, waves: 0.9, headAmp: 0.25 },
  },
  lamprey: {
    palette: pal({ base: '#6b747c', belly: '#c4ccd2', rim: '#cfe6ff', shell: '#d8d0bc', accent: '#ff8a5a', key: '#8d9bb4' }),
    look: { rimK: 1.7, rimPow: 2.5, keyK: 0.7, amb: 0.26, gloss: 0.6, sss: 0.4, bump: 0.8, glowK: 1.2 },
    k: { len: 3.2, girth: 0.2, amp: 0.38, waves: 1.15, headAmp: 0.2 },
  },
  ostracoderm: {
    palette: pal({ base: '#2d2f2c', belly: '#6e6d62', rim: '#dcecff', shell: '#a59f8a', accent: '#ffd98a', key: '#9aa0b0' }),
    look: { rimK: 1.6, rimPow: 2.5, keyK: 0.75, amb: 0.26, gloss: 0.5, sheen: 0.7, bump: 1.1 },
    k: { len: 2.2, girth: 0.24, amp: 0.28, waves: 0.8, headAmp: 0.2 },
  },
  fish: {
    palette: pal({ base: '#59656d', belly: '#c4ced4', rim: '#d4ecff', shell: '#b9b4a5', accent: '#9fe8ff', key: '#9fb0c8' }),
    look: { rimK: 1.4, rimPow: 2.6, keyK: 0.9, amb: 0.34, gloss: 0.5, sheen: 0.55, bump: 1.0, sss: 0.5 },
    k: { len: 2.4, girth: 0.3, amp: 0.34, waves: 0.75, headAmp: 0.16 },
  },
  tetrapod: {
    palette: pal({ base: '#4d5046', belly: '#9a9884', rim: '#e6efff', shell: '#cfc6ad', accent: '#ffd49a', key: '#b3b7bf' }),
    look: { rimK: 1.5, rimPow: 2.6, keyK: 0.8, amb: 0.28, gloss: 0.45, sheen: 0.4, bump: 1.2, sss: 0.5, groundAO: 0.55 },
    k: { len: 2.3, girth: 0.24, amp: 0.3, waves: 0.7, headAmp: 0.2, limb: 1 },
  },
  anomalocaris: {
    palette: pal({ base: '#2a2d33', belly: '#585d66', rim: '#cfe2ff', shell: '#9d9684', accent: '#4fe9ff', glowA: '#ffe6b8', glowB: '#38d8ff', key: '#8fa0bc', fil: '#d9e8ff' }),
    look: { rimK: 1.7, rimPow: 2.5, keyK: 0.75, amb: 0.26, gloss: 0.5, sheen: 0.2, bump: 1.2, eyeK: 0.5, sss: 0.4 },
    k: { len: 3.0, girth: 0.3, amp: 0.12, waves: 0.55, headAmp: 0.3 },
  },
  trilobite: {
    palette: pal({ base: '#2d2f31', belly: '#4e5052', rim: '#d0e0ff', shell: '#6c6a62', accent: '#9fe6ff', key: '#8d9ab2', fil: '#d9e6f2' }),
    look: { rimK: 1.7, rimPow: 2.7, keyK: 0.8, amb: 0.26, gloss: 0.6, sheen: 0, bump: 1.3, eyeK: 0.3, groundAO: 0.6, filK: 0.55 },
    k: { len: 1.0, girth: 0.3 },
  },
  flatworm: {
    palette: pal({ base: '#7f959d', belly: '#b4c6cc', rim: '#cfeeff', glowA: '#ffe8c4', glowB: '#33d6ff', key: '#a0b0c4', accent: '#ffcf8a' }),
    look: { rimK: 2.8, rimPow: 2.3, keyK: 0.45, amb: 0.34, trans: 4.5, glowK: 0.5, glowFall: 70, sss: 0.7, sigW: 6, sigK: 3.2, bump: 0.9 },
    k: { len: 2.8, girth: 0.34 },
  },
  jellyfish: {
    palette: pal({ base: '#8fa6c0', belly: '#c4d4e4', rim: '#cfe4ff', glowA: '#ffe2c0', glowB: '#38c8ff', key: '#9fb0d0', fil: '#b8d8ff', accent: '#4fd8ff' }),
    look: { rimK: 1.8, rimPow: 2.0, keyK: 0.4, amb: 0.3, trans: 5, glowK: 1.4, glowFall: 40, sss: 0.8, filK: 1.3, bump: 0.8 },
    k: { radius: 1.0, height: 0.78, tentacles: 12, tentLen: 1.9, arms: 4, net: 0 },
  },
  axon: {
    palette: pal({ base: '#b9ad94', belly: '#d7cdb6', rim: '#fff0d4', glowA: '#9fd4ff', glowB: '#2d9cff', key: '#c8c2b4', accent: '#7fc4ff' }),
    look: { rimK: 1.6, rimPow: 2.2, keyK: 0.6, amb: 0.3, trans: 5, glowK: 1.3, glowFall: 40, sss: 0.7, sigW: 9, sigK: 4.5, bump: 1.2 },
    k: { len: 10.8, nodes: 8, radius: 0.34, myelin: 1, bend: 0.12, seed: 1 },
  },
  egg: {
    palette: pal({ base: '#9fb0b8', belly: '#cfd8dc', rim: '#fff1dc', shell: '#d9d0bc', glowA: '#ffb224', glowB: '#ff3d2e', key: '#c8c0b4', accent: '#ff3d2e' }),
    look: { rimK: 1.5, rimPow: 2.3, keyK: 0.75, amb: 0.3, trans: 4, glowK: 1.1, glowFall: 22, sss: 0.7, sigW: 3, sigK: 0, bump: 1.4, gloss: 0.5 },
    k: { radius: 1.45, height: 1.95, seed: 2 },
  },
  bacterium: {
    palette: pal({ base: '#6f8f78', belly: '#a8c8b0', rim: '#e8fff0', glowA: '#e6ffd0', glowB: '#7dff8a', key: '#b0c8b8', fil: '#d8ffe0', accent: '#8cff9a' }),
    look: { rimK: 1.7, rimPow: 2.2, keyK: 0.5, amb: 0.3, trans: 5, glowK: 1.1, glowFall: 40, sss: 0.7, filK: 1.2, bump: 1 },
    k: { len: 1.5, radius: 0.22, flagella: 5, flen: 2.2 },
  },
  cell: {
    palette: pal({ base: '#6f7fb8', belly: '#a8b8e8', rim: '#cfdcff', glowA: '#ff9a2e', glowB: '#8fb8ff', key: '#a8b4d8', fil: '#cfdcff', accent: '#ffb347' }),
    look: { rimK: 1.3, rimPow: 2.2, keyK: 0.6, amb: 0.25, trans: 3, glowK: 1.0, glowFall: 30, sss: 0.8, bump: 1.4, see: 1 },
    k: { radius: 2.5 },
  },
  colony: {
    palette: pal({ base: '#5f9f86', belly: '#9fd8b8', rim: '#d8fff0', glowA: '#ffc24a', glowB: '#7dffc0', key: '#a8c8b8', fil: '#d8fff0', accent: '#a8ffd0' }),
    look: { rimK: 1.5, rimPow: 2.0, keyK: 0.45, amb: 0.28, trans: 3, glowK: 1.0, glowFall: 24, sss: 0.8, filK: 1.1, bump: 1, see: 1 },
    k: { radius: 2.3, cells: 7 },
  },
  skull: {
    palette: pal({ base: '#9a9484', belly: '#c8c0ac', rim: '#e8f0ff', shell: '#e8e0cc', key: '#d0ccc0' }),
    look: { rimK: 1.8, rimPow: 2.4, keyK: 1.1, amb: 0.45, gloss: 0.5, bump: 1.5, sss: 0.4 },
    k: { diapsid: 0, size: 1 },
  },
  sponge: {
    palette: pal({ base: '#9a9080', belly: '#c4b8a0', rim: '#e8f2ff', shell: '#c9bda4', glowB: '#38d8ff', key: '#b3b0a8' }),
    look: { rimK: 1.2, rimPow: 2.8, keyK: 1.2, amb: 0.42, gloss: 0.05, bump: 1.6, sss: 0.7, groundAO: 0.55 },
    k: { height: 2.4, radius: 0.5, pores: 14, seed: 3, tubes: 3 },
  },
};

export function aquaPreset(kind: AquaKind, over?: { palette?: Partial<AquaPalette>; look?: Partial<AquaLook>; k?: AquaParams }) {
  const base = AQUA_PRESETS[kind];
  return {
    palette: { ...base.palette, ...over?.palette } as AquaPalette,
    look: { ...DEFAULT_AQUA_LOOK, ...base.look, ...over?.look } as AquaLook,
    k: { ...base.k, ...over?.k } as AquaParams,
  };
}

/* ------------------------------------------------------------------------------------------------------------------ rigs */

const lerp = mix;

/** Lancelet / amphioxus: translucent lanceolate body with myomere chevrons, notochord, dorsal nerve cord, pharyngeal slits, oral cirri. */
function solveLancelet(S: AquaSet, K: AquaParams, st: AquaState) {
  const n = 11, L = K.len, R = K.girth;
  spine(n, L, K.amp * st.beat, K.waves, K.headAmp ?? 0.25, st.phase, st.turn * 0.5, 0.02);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    SR[i] = Math.max(R * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.92)), 0.7), R * 0.05);
  }
  const cyc = 34, dcy = cyc / (n - 1);
  for (let i = 0; i < n - 1; i++) {
    S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.12 * R, AM.trans, 0.6, 1);
    S.pat(PAT.chevron, i * dcy, dcy, 1);
  }
  // dorsal fin ridge + caudal fin
  for (let i = 2; i < n - 2; i += 2) {
    S.add(SX[i], SY[i] + SR[i] * 0.8, SZ[i], 0.075 * R, SX[i + 2], SY[i + 2] + SR[i + 2] * 0.8, SZ[i + 2], 0.07 * R, 0.08 * R, AM.fin, 0.16, 0.9);
  }
  const hx = Math.cos(SH[n - 1]), hz = Math.sin(SH[n - 1]);
  S.add(SX[n - 2], SY[n - 2], SZ[n - 2], 0.2 * R, SX[n - 1] - hx * 0.12 * L, SY[n - 1], SZ[n - 1] + hz * 0.12 * L, 0.025 * R, 0.06 * R, AM.fin, 0.12, 1);
  // internal organs (glow): notochord (warm white), nerve cord (cyan), brain vesicle
  for (let i = 0; i + 2 < n; i += 2) {
    const s0 = i / (n - 1), s1 = (i + 2) / (n - 1);
    const r0 = 0.13 * R * (1 - 0.7 * s0), r1 = 0.13 * R * (1 - 0.7 * s1);
    S.add(SX[i], SY[i] + 0.1 * R, SZ[i], r0, SX[i + 2], SY[i + 2] + 0.1 * R, SZ[i + 2], r1, 0.01, AM.glow, 0.9, 0.3);
    S.pat(PAT.glow, s0, s1 - s0, 0.0);
  }
  for (let i = 0; i + 2 < n; i += 2) {
    const s0 = i / (n - 1), s1 = (i + 2) / (n - 1);
    S.add(SX[i + 1 > 1 ? i : 1], SY[i] + SR[i] * 0.62, SZ[i], 0.07 * R * (1 - 0.5 * s0), SX[i + 2], SY[i + 2] + SR[i + 2] * 0.62, SZ[i + 2], 0.07 * R * (1 - 0.5 * s1), 0.01, AM.glow, 0.9, 1.0);
    S.pat(PAT.glow, s0, s1 - s0, 1.0);
  }
  S.add(SX[1], SY[1] + SR[1] * 0.62, SZ[1], 0.11 * R, SX[1] + 0.001, SY[1] + SR[1] * 0.62, SZ[1], 0.11 * R, 0.01, AM.glow, 0.9, 1.1);
  S.pat(PAT.glow, 0.08, 0.001, 1.0);
  // pharyngeal gill bars
  for (let j = 0; j < 6; j++) {
    const i = 1 + (j * 0.55);
    const ii = Math.floor(i), f = i - ii;
    const x = lerp(SX[ii], SX[ii + 1], f), z = lerp(SZ[ii], SZ[ii + 1], f), r = lerp(SR[ii], SR[ii + 1], f);
    const s = i / (n - 1);
    S.add(x + 0.05 * R, SY[ii] + 0.12 * r, z, 0.014 * R, x - 0.1 * R, SY[ii] - 0.58 * r, z, 0.02 * R, 0.01, AM.glow, 0.9, 0.5);
    S.pat(PAT.glow, s, 0.03, 0.15);
  }
  // gut and gonads
  S.add(SX[3], SY[3] - 0.22 * SR[3], SZ[3], 0.1 * R, SX[7], SY[7] - 0.3 * SR[7], SZ[7], 0.1 * R, 0.02, AM.glow, 0.9, 0.22);
  S.pat(PAT.glow, 0.3, 0.4, 0.15);
  S.add(SX[7], SY[7] - 0.3 * SR[7], SZ[7], 0.09 * R, SX[9], SY[9] - 0.2 * SR[9], SZ[9], 0.05 * R, 0.02, AM.glow, 0.9, 0.2);
  S.pat(PAT.glow, 0.7, 0.2, 0.15);
  for (let j = 0; j < 4; j++) {
    const i = 4 + j;
    S.add(SX[i], SY[i] - 0.5 * SR[i], SZ[i], 0.085 * R, SX[i] + 0.001, SY[i] - 0.5 * SR[i], SZ[i], 0.085 * R, 0.01, AM.glow, 0.9, 0.38);
    S.pat(PAT.glow, i / (n - 1), 0.01, 0.2);
  }
  // oral cirri
  const ph = st.time;
  for (let j = 0; j < 9; j++) {
    const u = j / 8 - 0.5;
    const rx = SX[0] - 0.015 * L, ry = -0.38 * R, rz = SZ[0] + u * 0.7 * R;
    const ln = 0.15 * L * (0.75 + 0.5 * (1 - Math.abs(u * 2)));
    const w1 = Math.sin(ph * 2.2 + j * 1.3) * 0.05 * R, w2 = Math.sin(ph * 2.2 + j * 1.3 - 1.1) * 0.09 * R;
    const mx = rx + ln * 0.55, my = ry - 0.2 * R, mz = rz + u * 1.1 * R + w1;
    S.fil(rx, ry, rz, 0.013 * R, mx, my, mz, 0.009 * R);
    S.fil(mx, my, mz, 0.009 * R, rx + ln, ry - 0.2 * R - 0.12 * R, rz + u * 1.9 * R + w2 + w1, 0.003 * R);
  }
  st.headX = SX[0]; st.headY = SY[0]; st.headZ = SZ[0];
}


const ease3 = (u: number) => u * u * (3 - 2 * u);
const pulseCurve = (u: number) => { u = u - Math.floor(u); return u < 0.26 ? ease3(u / 0.26) : Math.pow(1 - (u - 0.26) / 0.74, 2.2); };

/** half-width of a laterally compressed body (z squash) at joint i */
const FLANK = 0.66;

/** Jawed fish (also the jawless 'ostracoderm' when jawless=true): scale lattice with shimmer, jaw, operculum, fins with rays, forked caudal. */
function solveFish(S: AquaSet, K: AquaParams, st: AquaState, jawless = false) {
  const n = 10, L = K.len, R = K.girth;
  spine(n, L, K.amp * st.beat, K.waves, K.headAmp ?? 0.16, st.phase, st.turn * 0.45, 0.01);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const up = sstep(0, 0.32, s), dn = sstep(0.28, 0.92, s);
    SR[i] = R * (lerp(0.34, 1, up) * (1 - 0.84 * Math.pow(dn, 0.9)) + (i === 0 ? 0 : 0.02));
  }
  const flank = jawless ? 0.5 : FLANK;
  const cell = (K.cell ?? 0.085) * (R / 0.3);
  for (let i = 0; i < n - 1; i++) {
    S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.12 * R, AM.skin, flank, 1);
    S.pat(PAT.scales, i * L / (n - 1), cell, 1);
  }
  const mouth = st.mouth;
  if (!jawless) {
    S.add(SX[1] + 0.3 * R, SY[1] - 0.42 * R, SZ[1], 0.13 * R, SX[0] + 0.05 * R, SY[0] - 0.2 * R - mouth * 0.25 * R, SZ[0], 0.07 * R, 0.07 * R, AM.skin, 0.6, 0.92);
  } else {
    // head shield + cornual horns
    S.add(SX[0] + 0.1 * R, SY[0] + 0.1 * R, SZ[0], 0.9 * R, SX[2], SY[2] + 0.05 * R, SZ[2], 0.9 * R, 0.1 * R, AM.hard, -0.5, 0.95);
    S.pat(PAT.scales, 0, 4, 0.3);
    for (const sg of [-1, 1]) S.add(SX[2], SY[2], SZ[2] + sg * 0.5 * R, 0.22 * R, SX[3] - 0.1 * R, SY[3] + 0.02 * R, SZ[3] + sg * 1.5 * R, 0.02 * R, 0.04 * R, AM.hard, -0.5, 0.9);
  }
  for (const sg of [-1, 1]) {
    const ex = lerp(SX[0], SX[1], 0.72), ez = lerp(SZ[0], SZ[1], 0.72);
    const zz = ez + sg * SR[1] * flank * 0.92;
    const ey = SY[0] + (jawless ? 0.52 : 0.2) * R;
    S.add(ex, ey, jawless ? ez + sg * 0.34 * R : zz, 0.12 * R, ex + 0.001, ey, jawless ? ez + sg * 0.34 * R : zz, 0.12 * R, 0.01, AM.eye, 1, 1);
    if (!jawless) S.add(SX[2] + 0.05 * R, SY[2] + 0.38 * SR[2], SZ[2] + sg * SR[2] * flank * 0.7, 0.05 * R, SX[2] - 0.05 * R, SY[2] - 0.34 * SR[2], SZ[2] + sg * SR[2] * flank * 0.78, 0.07 * R, 0.05 * R, AM.skin, 0.3, 1.1);
  }
  const flap = Math.sin(TAU * st.phase + 1.0) * 0.12 * st.beat + Math.sin(st.time * 1.3) * 0.05;
  if (!jawless) for (const sg of [-1, 1]) {
    const bx = SX[3], by = SY[3] - 0.5 * SR[3], bz = SZ[3] + sg * SR[3] * 0.45;
    S.add(bx, by, bz, 0.02 * R, bx - 0.14 * L, by - 0.14 * R - flap * 0.5 * R, bz + sg * (0.62 * R + flap * 0.5 * R), 0.22 * R, 0.01, AM.fin, -0.12, 0.95);
    S.pat(PAT.rays, 10, 8, 1);
    const px = SX[5], py = SY[5] - 0.6 * SR[5], pz = SZ[5] + sg * SR[5] * 0.35;
    S.add(px, py, pz, 0.02 * R, px - 0.09 * L, py - 0.08 * R, pz + sg * 0.34 * R, 0.13 * R, 0.01, AM.fin, -0.12, 0.9);
    S.pat(PAT.rays, 10, 8, 1);
  }
  {
    const sx = lerp(SX[3], SX[4], 0.3), sy = SY[3] + SR[3] * 0.85, sz = SZ[3];
    S.add(sx, sy, sz, 0.03 * R, sx - 0.12 * L, sy + 0.8 * R, sz, 0.24 * R, 0.01, AM.fin, 0.1, 0.95);
    S.pat(PAT.rays, 9, 8, 1);
    const sx2 = SX[7], sy2 = SY[7] + SR[7] * 0.9, sz2 = SZ[7];
    S.add(sx2, sy2, sz2, 0.02 * R, sx2 - 0.07 * L, sy2 + 0.4 * R, sz2, 0.13 * R, 0.01, AM.fin, 0.1, 0.9);
    S.pat(PAT.rays, 9, 8, 1);
    const ax = SX[6], ay = SY[6] - SR[6] * 0.85, az = SZ[6];
    S.add(ax, ay, az, 0.02 * R, ax - 0.09 * L, ay - 0.5 * R, az, 0.15 * R, 0.01, AM.fin, 0.1, 0.9);
    S.pat(PAT.rays, 9, 8, 1);
  }
  {
    const ex = SX[n - 1], ey = SY[n - 1], ez = SZ[n - 1];
    const hxx = -Math.cos(SH[n - 1]), hzz = Math.sin(SH[n - 1]);
    const ln = 0.17 * L;
    const lag = Math.sin(TAU * (st.phase - 0.12)) * 0.05 * st.beat * L;
    const lowK = jawless ? 1.5 : 1;
    S.add(ex, ey, ez, 0.03 * R, ex + hxx * ln, ey + 0.95 * R * (jawless ? 0.6 : 1), ez + hzz * ln + lag, 0.26 * R, 0.01, AM.fin, 0.1, 1);
    S.pat(PAT.rays, 9, 8, 1);
    S.add(ex, ey, ez, 0.03 * R, ex + hxx * ln, ey - 0.95 * R * lowK, ez + hzz * ln + lag, 0.26 * R, 0.01, AM.fin, 0.1, 1);
    S.pat(PAT.rays, 9, 8, 1);
  }
  st.headX = SX[0]; st.headY = SY[0]; st.headZ = SZ[0];
}

/** Lamprey: eel body, oral disc ringed with horny teeth, seven gill pores, finfold. */
function solveLamprey(S: AquaSet, K: AquaParams, st: AquaState) {
  const n = 12, L = K.len, R = K.girth;
  spine(n, L, K.amp * st.beat, K.waves, K.headAmp ?? 0.2, st.phase, st.turn * 0.45, 0.01);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    SR[i] = R * (lerp(1.0, 0.75, sstep(0, 0.3, s)) * (1 - 0.8 * Math.pow(sstep(0.3, 1, s), 1.4)) + 0.04);
  }
  for (let i = 0; i < n - 1; i++) S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.1 * R, AM.skin, i > 6 ? 0.55 : 0.9, 1);
  // oral disc
  const hx = SX[0], hz = SZ[0];
  S.add(hx + 0.05 * R, SY[0], hz, 1.15 * R, hx - 0.5 * R, SY[0], hz, 0.95 * R, 0.1 * R, AM.skin, 1, 1.05);
  S.add(hx + 1.0 * R, SY[0], hz, 0.72 * R, hx + 1.0 * R + 0.001, SY[0], hz, 0.72 * R, 0.08 * R, AM.carve, 1, 1);
  const open = 0.15 * R * st.mouth;
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * TAU + 0.3;
    const cy = Math.cos(a) * (0.8 * R + open), cz = Math.sin(a) * (0.8 * R + open);
    S.add(hx + 0.7 * R, SY[0] + cy, hz + cz, 0.11 * R, hx + 0.3 * R, SY[0] + cy * 0.7, hz + cz * 0.7, 0.035 * R, 0.01, AM.hard, 1, 1.1);
  }
  S.add(hx + 0.2 * R, SY[0], hz, 0.28 * R, hx + 0.3 * R, SY[0], hz, 0.22 * R, 0.02, AM.hard, 1, 0.8);
  for (const sg of [-1, 1]) {
    S.add(SX[1], SY[1] + 0.3 * R, SZ[1] + sg * SR[1] * 0.78, 0.1 * R, SX[1] + 0.001, SY[1] + 0.3 * R, SZ[1] + sg * SR[1] * 0.78, 0.1 * R, 0.01, AM.eye, 1, 1);
    for (let g = 0; g < 5; g++) {
      const i = 2 + g * 0.5; const ii = Math.floor(i), f = i - ii;
      S.add(lerp(SX[ii], SX[ii + 1], f), SY[ii] + 0.08 * R, lerp(SZ[ii], SZ[ii + 1], f) + sg * SR[ii] * 0.92, 0.075 * R, lerp(SX[ii], SX[ii + 1], f) + 0.001, SY[ii] + 0.08 * R, lerp(SZ[ii], SZ[ii + 1], f) + sg * SR[ii] * 0.92, 0.075 * R, 0.03 * R, AM.carve, 1, 1);
    }
  }
  S.add(SX[5], SY[5] + SR[5] * 0.9, SZ[5], 0.06 * R, SX[7], SY[7] + SR[7] * 0.9, SZ[7], 0.09 * R, 0.05 * R, AM.fin, 0.12, 0.9);
  S.pat(PAT.rays, 8, 6, 0.8);
  S.add(SX[8], SY[8] + SR[8] * 0.8, SZ[8], 0.08 * R, SX[n - 1], SY[n - 1], SZ[n - 1], 0.04 * R, 0.05 * R, AM.fin, 0.12, 0.9);
  S.pat(PAT.rays, 8, 6, 0.8);
  st.headX = SX[0]; st.headY = SY[0]; st.headZ = SZ[0];
}

/** Flatworm: translucent flat body; nerve net (radial disc) turns into a cephalised ladder nervous system as morph 0 -> 1. */
function solveFlatworm(S: AquaSet, K: AquaParams, st: AquaState) {
  const n = 9, m = st.morph;
  const Rd = 1.2, L = lerp(2 * Rd * 0.9, K.len, m), Rw = K.girth;
  spine(n, L, 0.34 * m * st.beat, 0.85, 0.3, st.phase, st.turn * 0.4, 0);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const disc = Rd * Math.sqrt(Math.max(1 - Math.pow(2 * s - 1, 2), 0.01));
    const worm = Rw * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 0.55) * (0.85 + 0.15 * (1 - s));
    SR[i] = Math.max(lerp(disc, worm, m), 0.05);
  }
  for (let i = 0; i < n - 1; i++) {
    S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.2 * SR[i], AM.trans, -0.24, 1);
    S.pat(PAT.bands, i * 2.2, 2.2, 0.7);
  }
  const net = st.net;
  const ceph = sstep(0.35, 0.9, m);
  for (const sg of [-1, 1]) S.add(SX[1] + 0.02, SY[1], SZ[1] + sg * SR[1] * 0.85, 0.14 * Rw * ceph + 0.002, SX[0] - 0.03, SY[0], SZ[0] + sg * SR[1] * 1.0, 0.03 * ceph + 0.002, 0.05, AM.trans, -0.3, 1);
  // radial spokes (nerve net) fade as the ladder system appears
  const spk = (1 - sstep(0.3, 0.85, m)) * net;
  const cx = SX[4], cz = SZ[4];
  if (spk > 0.02) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    const rl = (0.8 * Rd) * (0.35 + 0.65 * spk);
    S.add(cx, 0, cz, 0.035, cx + Math.cos(a) * rl, 0, cz + Math.sin(a) * rl * lerp(1, 0.6, m), 0.02, 0.02, AM.glow, 1, spk * 0.9);
    S.pat(PAT.glow, 0, 0.5, 1);
  }
  const lad = sstep(0.25, 0.8, m) * net;
  if (lad > 0.02) {
    for (const sg of [-1, 1]) for (let i = 1; i + 2 < n; i += 2) {
      const s0 = i / (n - 1), s1 = (i + 2) / (n - 1);
      S.add(SX[i], SY[i], SZ[i] + sg * SR[i] * 0.45, 0.032, SX[i + 2], SY[i + 2], SZ[i + 2] + sg * SR[i + 2] * 0.45, 0.028, 0.01, AM.glow, -0.5, lad);
      S.pat(PAT.glow, s0, s1 - s0, 1);
    }
    for (let i = 1; i < n - 2; i += 2) {
      S.add(SX[i], SY[i], SZ[i] - SR[i] * 0.45, 0.016, SX[i], SY[i], SZ[i] + SR[i] * 0.45, 0.016, 0.01, AM.glow, -0.5, lad * 0.6);
      S.pat(PAT.glow, i / (n - 1), 0.02, 1);
    }
    const br = ceph;
    for (const sg of [-1, 1]) S.add(SX[1] + 0.05, SY[1], SZ[1] + sg * SR[1] * 0.28, 0.1 * br, SX[1] + 0.001 + 0.05, SY[1], SZ[1] + sg * SR[1] * 0.28, 0.1 * br, 0.01, AM.glow, -0.6, 1.5 * br);
    for (const sg of [-1, 1]) {
      S.pat(PAT.glow, 0.05, 0.01, 1);
      S.add(SX[1] + 0.2, SY[1], SZ[1] + sg * SR[1] * 0.5, 0.04 * br, SX[0], SY[0], SZ[0] + sg * SR[0] * 0.5, 0.025 * br, 0.01, AM.glow, -0.6, 1.1 * br);
      S.pat(PAT.glow, 0.05, 0.02, 0);
    }
  }
  S.add(SX[2], SY[2], SZ[2], 0.07 * lerp(1.4, 1, m), SX[6], SY[6], SZ[6], 0.05, 0.03, AM.glow, -0.6, 0.12);
  S.pat(PAT.glow, 0.4, 0.2, 0);
  if (m > 0.4) for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) {
    const i = 3 + k;
    S.add(SX[i], SY[i], SZ[i] + sg * SR[i] * 0.1, 0.028, SX[i] - 0.03, SY[i], SZ[i] + sg * SR[i] * 0.72, 0.012, 0.01, AM.glow, -0.5, 0.3 * sstep(0.4, 0.8, m));
    S.pat(PAT.glow, 0.4, 0.1, 0);
  }
  st.headX = SX[0]; st.headY = SY[0]; st.headZ = SZ[0];
}

/** Jellyfish: hollow translucent bell (outer ellipsoid minus subumbrella minus a cut plane), nerve ring, gonads, oral arms, trailing tentacles. */
function solveJelly(S: AquaSet, K: AquaParams, st: AquaState) {
  const Rb = K.radius, Hb = K.height;
  const c = st.aux >= 0 ? st.aux : pulseCurve(st.phase);
  const sx = 1 - 0.2 * c, sy = 1 + 0.1 * c;
  const R0 = Rb * sx, H0 = Hb * sy;
  S.add(0, 0, 0, R0, 0.001, 0, 0, R0, 0.06, AM.trans, -(H0 / R0), 1);
  if (K.net > 0) S.pat(PAT.net, 6.5, 1, 1); else S.pat(PAT.canals, 8, 1, 1);
  const Ri = R0 * 0.9;
  S.add(0, -0.12 * H0, 0, Ri, 0.001, -0.12 * H0, 0, Ri, 0.05, AM.carve, -(0.84 * H0 / Ri), 1);
  S.add(0, -0.36 * H0 - 30, 0, 30, 0.001, -0.36 * H0 - 30, 0, 30, 0.03, AM.carve, 1, 1);
  // nerve ring in the margin
  const rr = 0.9 * R0;
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
    S.add(Math.cos(a0) * rr, -0.31 * H0, Math.sin(a0) * rr, 0.022 * Rb, Math.cos(a1) * rr, -0.31 * H0, Math.sin(a1) * rr, 0.022 * Rb, 0.01, AM.glow, 1, 0.8);
    S.pat(PAT.glow, k / 8, 1 / 8, 1);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4;
    S.add(Math.cos(a) * 0.48 * R0, 0.7 * H0, Math.sin(a) * 0.48 * R0, 0.05 * Rb, Math.cos(a) * 0.48 * R0 + 0.001, 0.7 * H0, Math.sin(a) * 0.48 * R0, 0.05 * Rb, 0.02, AM.glow, 1, 0.4);
    S.pat(PAT.glow, 0.3, 0.2, 0);
  }
  // manubrium and oral arms
  const t = st.time;
  S.add(0, 0.2 * H0, 0, 0.1 * Rb, 0, -0.5 * H0, 0, 0.075 * Rb, 0.05, AM.trans, 1, 1.1);
  for (let k = 0; k < K.arms; k++) {
    const a = (k / K.arms) * TAU + 0.8;
    const dxz = (1 + 0.6 * c) * 0.2 * Rb;
    const x1 = Math.cos(a) * dxz + Math.sin(t * 0.8 + k) * 0.05 * Rb, z1 = Math.sin(a) * dxz + Math.cos(t * 0.7 + k) * 0.05 * Rb;
    const y1 = -0.5 * H0 - 0.55 * Rb;
    S.add(0, -0.5 * H0, 0, 0.07 * Rb, x1, y1, z1, 0.05 * Rb, 0.04, AM.trans, 1, 1);
    S.pat(PAT.bands, 0, 9, 0.8);
    S.add(x1, y1, z1, 0.05 * Rb, x1 * 1.3 + Math.sin(t * 0.9 + k * 2) * 0.1 * Rb, y1 - 0.6 * Rb, z1 * 1.3 + Math.cos(t + k) * 0.1 * Rb, 0.012 * Rb, 0.04, AM.trans, 1, 1);
    S.pat(PAT.bands, 0, 9, 0.8);
  }
  // tentacles: three bending segments, a travelling wave runs down each one, contraction splays them
  const nt = K.tentacles | 0, tl = K.tentLen * (1 - 0.14 * c) / 3;
  for (let k = 0; k < nt; k++) {
    const a = (k / nt) * TAU + 0.15;
    const ca = Math.cos(a), sa = Math.sin(a);
    let x = ca * rr * 1.03, z = sa * rr * 1.03, y = -0.33 * H0;
    const spread = (0.1 + 0.3 * c) * Rb;
    for (let j = 0; j < 3; j++) {
      const w1 = (j + 1) * 0.55;
      const ph = t * 0.8 - j * 0.9 + k * 1.7;
      const nx = x + ca * spread * 0.6 + Math.sin(ph) * 0.12 * Rb * w1 * 0.6;
      const nz = z + sa * spread * 0.6 + Math.cos(ph * 0.93 + 0.5) * 0.12 * Rb * w1 * 0.6;
      const ny = y - tl * (1 - 0.1 * j);
      S.fil(x, y, z, (0.013 - 0.003 * j) * Rb, nx, ny, nz, (0.01 - 0.0027 * j) * Rb);
      x = nx; y = ny; z = nz;
    }
    if (k % 2 === 0) {
      const a2 = a + (TAU / nt) * 0.5; const c2 = Math.cos(a2), s2 = Math.sin(a2);
      const px = c2 * rr, pz = s2 * rr;
      const ph = t * 0.9 + k * 1.1;
      S.fil(px, -0.33 * H0, pz, 0.009 * Rb, px + c2 * spread + Math.sin(ph) * 0.06 * Rb, -0.33 * H0 - tl * 1.3, pz + s2 * spread + Math.cos(ph) * 0.06 * Rb, 0.003 * Rb);
    }
  }
}

/** Sponge: a cluster of vase tubes (cones) minus their atria, with ostia (pores), osculum rims and a holdfast; surface pits give the reticulate look. */
const TUBES = [[0, 0, 1, 1], [-0.95, 0.5, 0.66, 0.62], [0.9, -0.62, 0.5, 0.52], [0.35, 1.05, 0.42, 0.44]];
function solveSponge(S: AquaSet, K: AquaParams, st: AquaState) {
  const H = K.height * (0.35 + 0.65 * st.grow), R = K.radius;
  const rho = (u: number, rs: number) => R * rs * (0.52 + 0.58 * Math.pow(u, 0.7) - 0.1 * Math.pow(u, 4));
  const sway = Math.sin(st.time * 0.35) * 0.015 * H;
  const nT = Math.min(TUBES.length, K.tubes ?? 3);
  S.add(0, 0.03, 0, 1.7 * R, 0.001, 0.03, 0, 1.7 * R, 0.1, AM.skin, -0.16, 0.9);
  S.pat(PAT.pits, 15, 1, 1);
  for (let t = 0; t < nT; t++) {
    const [tx, tz, hs, rs] = TUBES[t];
    const x0 = tx * R, z0 = tz * R, h = H * hs;
    for (let i = 0; i < 4; i++) {
      const u0 = i / 4, u1 = (i + 1) / 4;
      S.add(x0 + sway * u0 * u0, u0 * h, z0, rho(u0, rs), x0 + sway * u1 * u1, u1 * h, z0, rho(u1, rs), 0.2 * R, AM.skin, 1, 1);
      S.pat(PAT.pits, 15, 1, 1);
    }
  }
  for (let t = 0; t < nT; t++) {
    const [tx, tz, hs, rs] = TUBES[t];
    const x0 = tx * R, z0 = tz * R, h = H * hs;
    for (let i = 0; i < 2; i++) {
      const u0 = 0.2 + 0.8 * i / 2, u1 = 0.2 + 0.8 * (i + 1) / 2 + (i === 1 ? 0.25 : 0);
      S.add(x0 + sway * u0 * u0, u0 * h, z0, rho(u0, rs) * 0.66, x0 + sway * u1 * u1, u1 * h, z0, rho(Math.min(u1, 1), rs) * 0.66, 0.05 * R, AM.carve, 1, 1);
    }
  }
  let hh = K.seed;
  for (let p = 0; p < K.pores; p++) {
    hh = hash1(hh * 3.7 + p); const t = Math.min(nT - 1, Math.floor(hh * nT));
    const [tx, tz, hs, rs] = TUBES[t];
    hh = hash1(hh * 5.1 + p); const u = 0.12 + 0.76 * hh;
    hh = hash1(hh * 7.3 + p); const a = hh * TAU;
    const r = rho(u, rs) * 0.99;
    const x = tx * R + sway * u * u + Math.cos(a) * r, y = u * H * hs, z = tz * R + Math.sin(a) * r;
    S.add(x, y, z, 0.05 * R, x + 0.001, y, z, 0.05 * R, 0.03 * R, AM.carve, 1, 1);
  }
}

/** Anomalocaris: flattened trunk with metachronal swimming flaps, stalked compound eyes, oral cone, great appendages, tail fan. */
function solveAnomalocaris(S: AquaSet, K: AquaParams, st: AquaState) {
  const n = 7, L = K.len * 0.78, R = K.girth;
  spine(n, L, K.amp * st.beat, K.waves, K.headAmp ?? 0.3, st.phase * 0.5, st.turn * 0.4, 0.02 * R);
  for (let i = 0; i < n; i++) { const s = i / (n - 1); SR[i] = R * (0.55 + 0.45 * Math.sin(Math.PI * Math.pow(s, 0.8) * 0.9 + 0.35)) * (1 - 0.3 * s); }
  for (let i = 0; i < n - 1; i++) {
    S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.12 * R, AM.hard, -0.52, 0.9);
    S.pat(PAT.carapace, i * 1.0, 1.0, 0.8);
  }
  // swimming flaps, travelling wave of ventrolateral lobes
  for (let i = 0; i < n - 1; i++) {
    const s = i / (n - 1);
    const lob = 1.25 * R * (0.7 + 0.5 * Math.sin(Math.PI * (0.15 + 0.8 * s)));
    for (const sg of [-1, 1]) {
      const fl = Math.sin(TAU * (st.phase * 1.4 - i * 0.13) + (sg > 0 ? 0 : 0.0)) * 0.26 * R * (0.4 + 0.6 * st.beat);
      const rx = SX[i] - 0.05 * R, ry = SY[i] - 0.18 * R, rz = SZ[i] + sg * SR[i] * 0.78;
      S.add(rx, ry, rz, 0.04 * R, rx - 0.5 * lob * 0.6, ry + fl - 0.1 * R, rz + sg * lob, 0.3 * R * (0.7 + 0.5 * Math.sin(Math.PI * (0.15 + 0.8 * s))), 0.04 * R, AM.fin, -0.16, 0.85);
      S.pat(PAT.rays, 9, 5, 1);
    }
  }
  // head
  const hx = SX[0], hy = SY[0], hz = SZ[0];
  S.add(hx + 0.1 * R, hy + 0.1 * R, hz, 1.05 * R, hx + 0.3 * R, hy + 0.1 * R, hz, 0.95 * R, 0.1 * R, AM.hard, -0.55, 1);
  S.pat(PAT.carapace, 0, 1, 0.6);
  const eyeGlow = st.grow;
  for (const sg of [-1, 1]) {
    const sx0 = hx + 0.3 * R, sy0 = hy + 0.15 * R, sz0 = hz + sg * 0.5 * R;
    const ex = hx + 0.5 * R, ey = hy + 0.6 * R + Math.sin(st.time * 1.1 + sg) * 0.01 * R, ez = hz + sg * 1.35 * R;
    S.add(sx0, sy0, sz0, 0.07 * R, ex, ey, ez, 0.06 * R, 0.04 * R, AM.hard, 1, 0.8);
    S.add(ex + 0.1 * R, ey + 0.05 * R, ez + sg * 0.1 * R, 0.46 * R, ex + 0.1 * R + 0.001, ey + 0.05 * R, ez + sg * 0.1 * R, 0.46 * R, 0.01, AM.eye, 1, 1);
    S.pat(PAT.facets, 16, 1, 1);
  }
  void eyeGlow;
  // oral cone
  const mx = hx + 0.5 * R, my = hy - 0.38 * R;
  S.add(hx + 0.2 * R, my + 0.05 * R, hz, 0.46 * R, mx, my, hz, 0.34 * R, 0.1 * R, AM.hard, 1, 0.95);
  S.pat(PAT.bands, 0, 5, 0.7);
  S.add(mx + 0.14 * R, my, hz, 0.2 * R, mx + 0.14 * R + 0.001, my, hz, 0.2 * R, 0.04 * R, AM.carve, 1, 1);
  for (let j = 0; j < 4; j++) {
    const a = j / 4 * TAU + 0.8;
    S.add(mx + 0.1 * R, my + Math.cos(a) * 0.3 * R, hz + Math.sin(a) * 0.3 * R, 0.045 * R, mx + 0.2 * R, my + Math.cos(a) * 0.22 * R, hz + Math.sin(a) * 0.22 * R, 0.01 * R, 0.01, AM.hard, 1, 1.15);
  }
  // great appendages: grasp with st.mouth
  const gr = st.mouth * 0.9 + 0.1 * Math.sin(st.time * 0.9);
  for (const sg of [-1, 1]) {
    let x = hx + 0.4 * R, y = hy - 0.12 * R, z = hz + sg * 0.42 * R;
    let th = -0.35 - 0.1 * sg * Math.sin(st.time * 0.7);
    for (let j = 0; j < 4; j++) {
      const ln = 0.95 * R * (1 - 0.1 * j);
      th -= 0.3 + 0.55 * gr + 0.06 * j;
      const nx = x + Math.cos(th) * ln, ny = y + Math.sin(th) * ln, nz = z + sg * (0.02 + 0.06 * Math.sin(st.time * 0.8 + j)) * R;
      S.add(x, y, z, 0.27 * R * (1 - 0.14 * j), nx, ny, nz, 0.27 * R * (1 - 0.14 * (j + 1)), 0.04 * R, AM.hard, 1, 0.92);
      S.pat(PAT.bands, 0, 2.5, 0.6);
      if (j > 0) for (const q of [0.3, 0.75]) {
        const px = lerp(x, nx, q), py = lerp(y, ny, q), pz = lerp(z, nz, q);
        S.fil(px, py, pz, 0.016 * R, px + Math.cos(th - 1.5) * 0.3 * R, py + Math.sin(th - 1.5) * 0.3 * R, pz - sg * 0.04 * R, 0.004 * R);
      }
      x = nx; y = ny; z = nz;
    }
  }
  // tail fan
  const ex = SX[n - 1], ey = SY[n - 1], ez = SZ[n - 1];
  for (const a of [-0.45, 0, 0.45]) {
    const len = (a === 0 ? 0.95 : 0.75) * R * 1.8;
    S.add(ex, ey, ez, 0.05 * R, ex - Math.cos(a) * len, ey + Math.sin(st.phase * TAU * 0.7 + a) * 0.06 * R, ez + Math.sin(a) * len, 0.26 * R, 0.03 * R, AM.fin, -0.14, 0.9);
    S.pat(PAT.rays, 9, 5, 1);
  }
  st.headX = hx; st.headY = hy; st.headZ = hz;
}

/** Trilobite: domed cephalon with kidney eyes and genal spines, segmented thorax, pygidium, antennae and a rippling row of legs. Feet at y = 0. */
function solveTrilobite(S: AquaSet, K: AquaParams, st: AquaState) {
  const sc = K.len;
  const ph = st.phase;
  const wob = Math.sin(st.time * 0.4) * 0.01;
  S.add(0.42 * sc, 0.075 * sc, -0.1 * sc, 0.2 * sc, 0.42 * sc, 0.075 * sc, 0.1 * sc, 0.2 * sc, 0.05 * sc, AM.hard, -0.42, 1);
  S.pat(PAT.carapace, 0, 0, 0);
  S.add(0.3 * sc, 0.12 * sc, 0, 0.07 * sc, 0.55 * sc, 0.1 * sc, 0, 0.09 * sc, 0.04 * sc, AM.hard, -0.75, 1.1);
  for (const sg of [-1, 1]) {
    S.add(0.2 * sc, 0.05 * sc, sg * 0.27 * sc, 0.04 * sc, -0.16 * sc, 0.03 * sc, sg * 0.36 * sc, 0.006 * sc, 0.02 * sc, AM.hard, 1, 0.95);
    S.add(0.44 * sc, 0.155 * sc, sg * 0.14 * sc, 0.055 * sc, 0.42 * sc, 0.155 * sc, sg * 0.2 * sc, 0.045 * sc, 0.01, AM.eye, 1, 1);
    S.pat(PAT.facets, 11, 1, 1);
  }
  // axial lobe with transverse furrows + 8 pleural ribs
  S.add(0.17 * sc, 0.115 * sc, 0, 0.075 * sc, -0.4 * sc, 0.085 * sc, 0, 0.045 * sc, 0.04 * sc, AM.hard, -0.8, 1.05);
  S.pat(PAT.carapace, 0, 8, 1);
  for (let i = 0; i < 8; i++) {
    const x = (0.13 - i * 0.063) * sc, w = (0.27 - i * 0.012) * sc, y = (0.062 + wob * Math.sin(ph * TAU - i * 0.5)) * sc;
    S.add(x, y, -w, 0.032 * sc, x - 0.012 * sc, y + 0.01 * sc, w, 0.032 * sc, 0.014 * sc, AM.hard, -0.75, 0.95);
  }
  S.add(-0.42 * sc, 0.06 * sc, 0, 0.14 * sc, -0.5 * sc, 0.055 * sc, 0, 0.1 * sc, 0.04 * sc, AM.hard, -0.45, 1);
  S.pat(PAT.carapace, 0, 5, 0.7);
  // antennae
  const t = st.time;
  for (const sg of [-1, 1]) {
    const ax = 0.64 * sc, ay = 0.07 * sc, az = sg * 0.06 * sc;
    const x1 = ax + 0.3 * sc, y1 = ay + 0.1 * sc + Math.sin(t * 1.2 + sg) * 0.03 * sc, z1 = az + sg * 0.22 * sc + Math.sin(t * 0.9 + sg * 2) * 0.05 * sc;
    S.fil(ax, ay, az, 0.012 * sc, x1, y1, z1, 0.006 * sc);
    S.fil(x1, y1, z1, 0.006 * sc, x1 + 0.28 * sc, y1 - 0.08 * sc, z1 + sg * 0.3 * sc + Math.sin(t * 1.3) * 0.06 * sc, 0.002 * sc);
  }
  // legs
  for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = (0.3 - i * 0.075) * sc;
    const w = Math.sin(TAU * (ph * 2 - i * 0.11 + (sg > 0 ? 0 : 0.5)));
    S.fil(x, 0.035 * sc, sg * 0.15 * sc, 0.011 * sc, x + w * 0.05 * sc, 0.0, sg * (0.3 + 0.03 * Math.max(0, w)) * sc, 0.004 * sc);
  }
}

/** Tiktaalik-like tetrapodomorph: flat skull with dorsal eyes, lobed fin-limbs with IK that plant on the ground (land 0..1), body bends with the gait. Feet at y = 0. */
const _leg: Leg = { jx: 0, jy: 0, ex: 0, ey: 0 };
const _fc = { x: 0, lift: 0 };
function solveTetrapod(S: AquaSet, K: AquaParams, st: AquaState) {
  const n = 10, L = K.len, R = K.girth, land = st.land, lm = K.limb;
  const yb = (0.5 + 0.42 * land) * R;
  spine(n, L, K.amp * (0.25 + 0.75 * st.beat) * (0.5 + 0.5 * land + 0.5 * (1 - land)), K.waves, K.headAmp ?? 0.2, land > 0.4 ? st.phase : st.phase, st.turn * 0.4, 0);
  for (let i = 0; i < n; i++) SY[i] = yb + SY[i];
  const prof = [0.4, 1.08, 1.3, 1.0, 0.98, 1.0, 0.82, 0.5, 0.27, 0.08];
  for (let i = 0; i < n; i++) SR[i] = R * prof[i];
  const cell = 0.045 * (R / 0.24);
  for (let i = 0; i < n - 1; i++) {
    const tail = i >= 6;
    S.add(SX[i], SY[i], SZ[i], SR[i], SX[i + 1], SY[i + 1], SZ[i + 1], SR[i + 1], 0.1 * R, AM.skin, tail ? 0.5 : (i < 2 ? -0.4 : -0.56), 1);
    S.pat(PAT.scales, i * L / (n - 1), cell, 0.6);
  }
  const mouth = st.mouth;
  S.add(SX[1] + 0.2 * R, SY[1] - 0.2 * R, SZ[1], 0.4 * R, SX[0] + 0.15 * R, SY[0] - 0.12 * R - mouth * 0.25 * R, SZ[0], 0.22 * R, 0.06 * R, AM.skin, -0.45, 0.9);
  for (const sg of [-1, 1]) {
    const ex = lerp(SX[0], SX[1], 0.9), ez = SZ[0] + sg * 0.5 * R;
    S.add(ex, SY[0] + 0.3 * R, ez, 0.17 * R, ex + 0.001, SY[0] + 0.3 * R, ez, 0.17 * R, 0.02, AM.eye, 1, 1);
  }
  const ph = st.phase;
  const legs = [[3, 1, 0.0, 1], [3, -1, 0.5, 1], [7, 1, 0.5, 0.72], [7, -1, 0.0, 0.72]];
  for (const [ji, sg, off, sz] of legs) {
    const i = ji;
    const sxh = SX[i], syh = SY[i] - 0.15 * R, szh = SZ[i] + sg * SR[i] * 0.85;
    const l1 = 0.3 * lm * sz, l2 = 0.28 * lm * sz;
    footCycle(ph + off, 0.62, _fc);
    const stride = 0.28 * L * 0.5 * sz;
    const ftxL = sxh + _fc.x * stride + 0.04 * L, ftzL = szh + sg * 0.58 * lm * sz, ftyL = 0.02 * R + _fc.lift * 0.12 * R * 1.8;
    const ftxW = sxh - 0.18 * lm * sz, ftzW = szh + sg * 0.3 * lm * (1 + 0.15 * Math.sin(TAU * (ph + off))), ftyW = syh - 0.22 * lm * sz + Math.sin(TAU * (ph + off)) * 0.04;
    const fx = lerp(ftxW, ftxL, land), fy = lerp(ftyW, ftyL, land), fz = lerp(ftzW, ftzL, land);
    const hdx = fx - sxh, hdz = fz - szh;
    const hd = Math.max(Math.hypot(hdx, hdz), 1e-3);
    ik2(0, 0, hd, fy - syh, l1, l2, 1, _leg);
    const ux = hdx / hd, uz = hdz / hd;
    const jx = sxh + ux * _leg.jx, jy = syh + _leg.jy, jz = szh + uz * _leg.jx;
    const ex = sxh + ux * _leg.ex, ey = syh + _leg.ey, ez = szh + uz * _leg.ex;
    S.add(sxh, syh, szh, 0.26 * R * sz, jx, jy, jz, 0.19 * R * sz, 0.12 * R, AM.skin, 1, 0.95);
    S.pat(PAT.scales, 0, 0.03, 0.5);
    S.add(jx, jy, jz, 0.19 * R * sz, ex, ey, ez, 0.14 * R * sz, 0.1 * R, AM.skin, 1, 0.95);
    S.pat(PAT.scales, 0, 0.03, 0.5);
    // lobed fin / paddle foot with rays
    S.add(ex, ey + 0.02, ez, 0.07 * R * sz, ex + 0.26 * lm * sz, Math.max(ey, 0.03), ez + sg * 0.1 * lm * sz, 0.48 * R * sz, 0.04 * R, AM.fin, -0.2, 0.95);
    S.pat(PAT.rays, 8, 6, 1);
  }
  st.headX = SX[0]; st.headY = SY[0]; st.headZ = SZ[0];
}

/** Myelinated axon (or a bare one, myelin = 0): glowing core with a travelling impulse, myelin internodes wrapping with grow, nodes of Ranvier. */
function solveAxon(S: AquaSet, K: AquaParams, st: AquaState) {
  const N = K.nodes | 0, L = K.len, R = K.radius, my = K.myelin ?? 1;
  const dx = L / N, wrap = st.grow;
  const cy = (i: number) => K.bend * L * 0.1 * Math.sin(i * 0.55 + K.seed) + 0.03 * Math.sin(st.time * 0.4 + i);
  const cz = (i: number) => K.bend * L * 0.05 * Math.sin(i * 0.8 + K.seed * 2);
  const coreR = my > 0 ? 0.2 * R : 0.34 * R;
  for (let i = 0; i < N; i++) {
    const x0 = -L / 2 + i * dx, x1 = x0 + dx;
    if (my > 0) {
      const gap = 0.1 * dx;
      const rs = R * (0.38 + 0.62 * wrap);
      const e = Math.min(rs * 0.92, dx * 0.4);
      S.add(x0 + gap + e, cy(i), cz(i), rs, x1 - gap - e, cy(i + 1), cz(i + 1), rs, 0.012, AM.trans, 1, 1);
      S.pat(PAT.bands, i * 14, 14, 0.8);
    } else {
      S.add(x0, cy(i), cz(i), coreR * 1.5, x1, cy(i + 1), cz(i + 1), coreR * 1.5, 0.02, AM.trans, 1, 1);
    }
  }
  for (let i = 0; i < N; i++) {
    const x0 = -L / 2 + i * dx, x1 = x0 + dx;
    S.add(x0, cy(i), cz(i), coreR, x1, cy(i + 1), cz(i + 1), coreR, 0.02, AM.glow, 1, 0.45);
    S.pat(PAT.glow, i / N, 1 / N, 1);
  }
  if (my > 0) for (let i = 1; i < N; i++) {
    const x = -L / 2 + i * dx;
    S.add(x, cy(i), cz(i), coreR * 1.5, x + 0.001, cy(i), cz(i), coreR * 1.5, 0.02, AM.glow, 1, 0.6);
    S.pat(PAT.glow, i / N, 0.001, 1);
  }
}

/** Amniote egg: pitted shell with a sweeping cutaway, amnion, yolk, vascular allantois and a curled embryo with a red heartbeat. */
function solveEgg(S: AquaSet, K: AquaParams, st: AquaState) {
  const R = K.radius, H = K.height, ys = H / R;
  const cut = st.aux >= 0 ? 2.1 - st.aux * 2.4 : 3;
  S.add(0, 0, 0, R, 0.001, 0, 0, R, 0.05, AM.hard, -ys, 0.6);
  S.pat(PAT.speckle, 7, 1, 0.7);
  S.add(0, 0, 0, R - 0.07, 0.001, 0, 0, R - 0.07, 0.03, AM.carve, -ys, 1);
  const nx = 0.3, nz = 0.95; const nl = Math.hypot(nx, nz);
  S.add((nx / nl) * (cut + 30), 0, (nz / nl) * (cut + 30), 30, (nx / nl) * (cut + 30) + 0.001, 0, (nz / nl) * (cut + 30), 30, 0.02, AM.carve, 1, 1);
  // inner membranes and organs (added after the cut so they stay intact)
  S.add(0, 0.05, 0, 1.17, 0.001, 0.05, 0, 1.17, 0.03, AM.trans, -1.35, 1);
  S.add(0, 0.05, 0, 1.13, 0.001, 0.05, 0, 1.13, 0.02, AM.carve, -1.35, 1);
  const c2 = cut - 0.5;
  S.add((nx / nl) * (c2 + 30), 0, (nz / nl) * (c2 + 30), 30, (nx / nl) * (c2 + 30) + 0.001, 0, (nz / nl) * (c2 + 30), 30, 0.02, AM.carve, 1, 1);
  S.add(-0.1, -0.9, -0.1, 0.62, -0.099, -0.9, -0.1, 0.62, 0.02, AM.glow, 1, 1.2);
  S.pat(PAT.glow, 0.1, 0.1, 0);
  S.add(0.5, 0.2, -0.45, 0.62, 0.501, 0.2, -0.45, 0.62, 0.02, AM.trans, -0.85, 1);
  S.pat(PAT.net, 8, 1, 1);
  S.add(0.5, 0.2, -0.45, 0.58, 0.501, 0.2, -0.45, 0.58, 0.02, AM.carve, -0.85, 1);
  // curled embryo
  const g = 1.0 + 0.6 * st.grow;
  const px = [0.34, 0.18, -0.12, -0.34, -0.38, -0.2, 0.02, 0.18, 0.12];
  const py = [0.55, 0.64, 0.58, 0.38, 0.12, -0.04, -0.03, 0.1, 0.24];
  for (let i = 0; i + 1 < px.length; i++) {
    const r0 = 0.15 * g * (1 - i * 0.07), r1 = 0.15 * g * (1 - (i + 1) * 0.07);
    S.add(px[i] * g, 0.1 + py[i] * g * 0.8, 0.05, i === 0 ? 0.27 * g : r0, px[i + 1] * g, 0.1 + py[i + 1] * g * 0.8, 0.05, r1, 0.05, AM.glow, 1, 0.75);
    S.pat(PAT.glow, 0.5, 0.01, 0);
  }
  S.add(0.4 * g, 0.1 + 0.6 * g * 0.8, 0.19 * g, 0.035 * g, 0.401 * g, 0.1 + 0.6 * g * 0.8, 0.19 * g, 0.035 * g, 0.01, AM.eye, 1, 1);
  const beat = Math.pow(Math.max(0, Math.sin(st.time * 5.2 + st.phase * 6)), 6);
  S.add(0.08 * g, 0.1 + 0.5 * g * 0.8, 0.2 * g, 0.1 * g, 0.081 * g, 0.1 + 0.5 * g * 0.8, 0.2 * g, 0.1 * g, 0.01, AM.glow, 1, 1.0 + 1.5 * beat);
  S.pat(PAT.glow, 0.5, 0.01, 1);
  S.add(0.27 * g, 0.1 + 0.7 * g * 0.8, 0.0, 0.085 * g, 0.271 * g, 0.1 + 0.7 * g * 0.8, 0.0, 0.085 * g, 0.01, AM.glow, 1, 0.5);
  S.pat(PAT.glow, 0.5, 0.01, 0);
}

/** Bacterium (E. coli-like rod): translucent envelope, wavy nucleoid, pili and a helical flagellar bundle that flares apart when st.mouth (tumble) rises. */
function solveBacterium(S: AquaSet, K: AquaParams, st: AquaState) {
  const L = K.len, r = K.radius, tum = st.mouth, t = st.time;
  const bend = Math.sin(t * 1.7) * 0.03 * L;
  S.add(-L / 2 + r, 0, 0, r, L / 2 - r, bend, 0, r, 0.01, AM.trans, 1, 1);
  S.pat(PAT.pits, 9, 1, 0.6);
  for (let j = 0; j < 3; j++) {
    const x0 = -L * 0.32 + j * L * 0.3, w0 = Math.sin(t * 1.2 + j * 1.7) * 0.25 * r, w1 = Math.sin(t * 1.2 + j * 1.7 + 1.5) * 0.25 * r;
    S.add(x0, w0, 0.0, 0.1 * r, x0 + L * 0.28, w1, 0.0, 0.1 * r, 0.01, AM.glow, 1, 0.5);
    S.pat(PAT.glow, j / 3, 0.3, 0);
  }
  S.add(L * 0.38, 0, 0, 0.22 * r, L * 0.38 + 0.001, 0, 0, 0.22 * r, 0.01, AM.glow, 1, 0.4);
  S.pat(PAT.glow, 0.9, 0.001, 1);
  S.add(-L * 0.42, 0.1 * r, 0, 0.18 * r, -L * 0.42 + 0.001, 0.1 * r, 0, 0.18 * r, 0.01, AM.glow, 1, 0.4);
  S.pat(PAT.glow, 0.0, 0.001, 1);
  const nf = K.flagella | 0, Lf = K.flen, phase = st.phase;
  for (let k = 0; k < nf; k++) {
    const a = (k / nf) * TAU + 0.4;
    const ax = -L * 0.5 + r * 0.7 + (k % 3) * L * 0.1, ay = Math.cos(a) * r * 0.92, az = Math.sin(a) * r * 0.92;
    let px = ax, py = ay, pz = az;
    const flare = Math.cos(a * 2 + 1) ;
    const fdir = [-0.9 - 0.3 * Math.sin(a * 3), Math.cos(a + k) * 0.55, Math.sin(a * 1.7 + k) * 0.55];
    const fl = Math.hypot(fdir[0], fdir[1], fdir[2]);
    for (let j = 1; j <= 8; j++) {
      const s = j / 8, seg = Lf / 8;
      const bR = 0.09 * r * 2.2 * Math.min(1, s * 2.2);
      const wob = TAU * (2.4 * s - phase) + a;
      const bx = ax - s * Lf * (1 - 0.15 * Math.sin(a)), by = Math.cos(wob) * bR * 0.6, bz = Math.sin(wob) * bR * 0.6;
      const fx = ax + fdir[0] / fl * s * Lf * 0.75 + Math.sin(t * 5 + a * 3 + s * 6) * 0.03 * Lf * s, fy = ay + fdir[1] / fl * s * Lf * 0.7 + Math.cos(wob) * 0.05 * Lf * s, fz = az + fdir[2] / fl * s * Lf * 0.7 + Math.sin(wob) * 0.05 * Lf * s;
      const nx = lerp(bx, fx, tum * Math.min(1, 0.4 + s)), ny = lerp(by, fy, tum * Math.min(1, 0.4 + s)), nz = lerp(bz, fz, tum * Math.min(1, 0.4 + s));
      const fx0 = j === 1 ? ax : px;
      S.fil(fx0, j === 1 ? ay : py, j === 1 ? az : pz, 0.022 * r * (1 - 0.5 * (j - 1) / 8) * 1.6, nx, ny, nz, 0.022 * r * (1 - 0.5 * j / 8) * 1.6);
      px = nx; py = ny; pz = nz;
      void seg; void flare;
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = k * 2.4 + 0.3, x = lerp(-L * 0.35, L * 0.4, ((k * 0.37) % 1)), c = Math.cos(a), sn = Math.sin(a);
    S.fil(x, c * r * 0.97, sn * r * 0.97, 0.01 * r, x + 0.15 * L * Math.sin(k + t * 0.7), c * r * 1.7, sn * r * 1.7, 0.003 * r);
  }
}

/** Eukaryote host cell: translucent membrane that bulges and engulfs a bacterium (glow rod) which becomes a mitochondrion and multiplies; nucleus, ER, Golgi. */
function solveCell(S: AquaSet, K: AquaParams, st: AquaState) {
  const R = K.radius, t = st.time;
  const bulge = clamp(st.aux, 0, 1), dist = st.morph, becomes = st.grow, org = st.net, clones = st.beat;
  const dx = 0.82, dy = 0.18, dz = 0.2; const dl = Math.hypot(dx, dy, dz);
  const ux = dx / dl, uy = dy / dl, uz = dz / dl;
  const wob = 1 + 0.02 * Math.sin(t * 0.7);
  S.add(0, 0, 0, R * wob, 0.001, 0, 0, R * wob, 0.3, AM.trans, 1, 1);
  S.pat(PAT.pits, 5, 1, 0.5);
  if (bulge > 0.02) S.add(ux * R * 0.98, uy * R * 0.98, uz * R * 0.98, R * 0.42 * bulge, ux * R * 1.05, uy * R * 1.05, uz * R * 1.05, R * 0.42 * bulge, 0.5 * R, AM.trans, 1, 1);
  S.add(0, 0, 0, R * wob * 0.975, 0.001, 0, 0, R * wob * 0.975, 0.1, AM.carve, 1, 1);
  if (bulge > 0.02) S.add(ux * R * 0.98, uy * R * 0.98, uz * R * 0.98, R * 0.41 * bulge, ux * R * 1.05, uy * R * 1.05, uz * R * 1.05, R * 0.41 * bulge, 0.3 * R, AM.carve, 1, 1);
  // nucleus + nucleolus
  S.add(-0.28 * R, 0.08 * R, -0.12 * R, 0.36 * R * org, -0.279 * R, 0.08 * R, -0.12 * R, 0.36 * R * org, 0.02, AM.glow, 1, 0.8 * org);
  S.pat(PAT.glow, 0.5, 0.01, 1);
  S.add(-0.33 * R, 0.12 * R, -0.05 * R, 0.1 * R * org, -0.329 * R, 0.12 * R, -0.05 * R, 0.1 * R * org, 0.01, AM.glow, 1, 1.5 * org);
  S.pat(PAT.glow, 0.5, 0.01, 1);
  // ER sheets and Golgi stacks
  for (let k = 0; k < 4; k++) {
    const a = k * 1.1 + 0.4;
    S.add(-0.28 * R + Math.cos(a) * 0.46 * R, 0.08 * R + Math.sin(a) * 0.42 * R, -0.1 * R, 0.035 * R * org, -0.28 * R + Math.cos(a + 0.9) * 0.5 * R, 0.08 * R + Math.sin(a + 0.9) * 0.46 * R, -0.05 * R, 0.03 * R * org, 0.01, AM.glow, -0.6, 0.7 * org);
    S.pat(PAT.glow, 0.5, 0.01, 0.5);
  }
  for (let k = 0; k < 3; k++) S.add(0.12 * R + k * 0.06 * R, -0.5 * R + k * 0.04 * R, 0.28 * R, 0.17 * R * org, 0.12 * R + k * 0.06 * R, -0.5 * R + k * 0.04 * R + 0.001, 0.28 * R, 0.17 * R * org, 0.01, AM.glow, -0.2, 0.7 * org);
  // the bacterium / first mitochondrion
  const bx = ux * R * dist, by = uy * R * dist, bz = uz * R * dist;
  const rot = Math.atan2(uy, ux) + (1 - Math.min(1, bulge * 1.4)) * Math.sin(t * 1.5) * 0.15 + 0.5 * becomes;
  const bl = 0.3 * R * (1 - 0.2 * becomes), bw = 0.12 * R * (1 + 0.1 * becomes);
  S.add(bx - Math.cos(rot) * bl, by - Math.sin(rot) * bl, bz, bw, bx + Math.cos(rot) * bl, by + Math.sin(rot) * bl, bz, bw, 0.01, AM.glow, 1, 1.0);
  S.pat(PAT.cristae, 0, 7, 1 - becomes);
  // daughter mitochondria (clones)
  for (let k = 0; k < 6; k++) {
    const e = clamp(clones * 1.6 - k * 0.2, 0, 1);
    if (e < 0.02) continue;
    const a = k * 1.05 + 0.6, rr = (0.5 + 0.18 * ((k * 5) % 3)) * R;
    const cx = 0.1 * R + Math.cos(a) * rr * 0.9 + Math.sin(t * 0.3 + k) * 0.04 * R, cy = Math.sin(a) * rr * 0.8 + Math.cos(t * 0.27 + k) * 0.04 * R, cz = (((k * 7) % 5) / 5 - 0.4) * 0.5 * R;
    const ang = a + k, hl = 0.19 * R * e;
    S.add(cx - Math.cos(ang) * hl, cy - Math.sin(ang) * hl, cz, 0.09 * R * e, cx + Math.cos(ang) * hl, cy + Math.sin(ang) * hl, cz, 0.09 * R * e, 0.01, AM.glow, 1, 0.9);
    S.pat(PAT.cristae, 0, 7, 0);
  }
}

/** Volvox-like colony: translucent shell tiled with cells (voronoi), flagella hairs, and gold daughter colonies inside. */
function solveColony(S: AquaSet, K: AquaParams, st: AquaState) {
  const R = K.radius, t = st.time;
  S.add(0, 0, 0, R, 0.001, 0, 0, R, 0.1, AM.trans, 1, 1);
  S.pat(PAT.net, K.cells, 1, 1);
  const inner = 0.94 * R;
  S.add(0, 0, 0, inner, 0.001, 0, 0, inner, 0.05, AM.carve, 1, 1);
  const d = st.grow;
  const dpos = [[0.38, 0.2, 0.15, 0.3], [-0.42, -0.25, 0.2, 0.22], [0.1, -0.42, -0.35, 0.2]];
  for (let k = 0; k < 3; k++) {
    const [x, y, z, r] = dpos[k];
    const e = clamp(d * 1.5 - k * 0.25, 0, 1);
    S.add(x * R, y * R, z * R, r * R * e, x * R + 0.001, y * R, z * R, r * R * e, 0.01, AM.glow, 1, 0.65 * e);
    S.pat(PAT.glow, 0.5, 0.001, 0);
  }
  // flagella hairs spiralling over the surface
  for (let k = 0; k < 44; k++) {
    const yy = 1 - (k + 0.5) / 22, rad = Math.sqrt(Math.max(0, 1 - yy * yy)), th = k * 2.39996;
    const nx = Math.cos(th) * rad, ny = yy, nz = Math.sin(th) * rad;
    const sw = 0.12 * R, w = Math.sin(t * 6 + k * 3.1) * 0.5;
    S.fil(nx * R, ny * R, nz * R, 0.012 * R, nx * R * 1.0 + (nx + w * 0.4) * sw, ny * R + (ny + w * 0.3) * sw, nz * R + (nz - w * 0.4) * sw, 0.004 * R);
    if (k >= 47) break;
  }
}

/** Amniote skull in profile: one temporal fenestra (synapsid, diapsid = 0) or two (diapsid = 1), orbit, naris, teeth. */
function solveSkull(S: AquaSet, K: AquaParams, st: AquaState) {
  const z = K.size, open = st.mouth * 0.12 * z;
  S.add(-0.2 * z, 0.06 * z, 0, 0.3 * z, 0.08 * z, 0.1 * z, 0, 0.25 * z, 0.06 * z, AM.hard, 0.72, 1);
  S.pat(PAT.pits, 22, 1, 0.5);
  S.add(0.1 * z, 0.04 * z, 0, 0.22 * z, 0.66 * z, -0.01 * z, 0, 0.1 * z, 0.06 * z, AM.hard, 0.7, 1);
  S.pat(PAT.pits, 22, 1, 0.5);
  S.add(-0.16 * z, -0.2 * z - open, 0, 0.09 * z, 0.56 * z, -0.19 * z - open * 1.4, 0, 0.055 * z, 0.05 * z, AM.hard, 0.55, 0.95);
  S.add(-0.2 * z, -0.1 * z, 0, 0.1 * z, -0.34 * z, -0.02 * z, 0, 0.12 * z, 0.05 * z, AM.hard, 0.6, 0.95);
  // fenestrae: z-long carve capsules through the skull
  const hole = (x: number, y: number, r: number) => S.add(x * z, y * z, -0.5 * z, r * z, x * z, y * z, 0.5 * z, r * z, 0.025 * z, AM.carve, 1, 1);
  hole(0.27, 0.1, 0.095);                 // orbit
  hole(-0.12, -0.02, 0.075);              // lower temporal fenestra
  if (K.diapsid > 0.5) hole(-0.12, 0.17, 0.06); // upper temporal fenestra
  S.add(0.6 * z, 0.05 * z, -0.4 * z, 0.035 * z, 0.6 * z, 0.05 * z, 0.4 * z, 0.035 * z, 0.01, AM.carve, 1, 1);
  for (let i = 0; i < 7; i++) {
    const x = (0.22 + i * 0.065) * z;
    S.add(x, -0.06 * z - open * 0.1, 0.07 * z, 0.026 * z, x + 0.01 * z, -0.16 * z - open * 0.2, 0.07 * z, 0.004 * z, 0.01, AM.hard, 1, 1.15);
    S.add(x, -0.06 * z - open * 0.1, -0.07 * z, 0.026 * z, x + 0.01 * z, -0.16 * z - open * 0.2, -0.07 * z, 0.004 * z, 0.01, AM.hard, 1, 1.15);
  }
}

export function solveAqua(kind: AquaKind, S: AquaSet, K: AquaParams, st: AquaState) {
  S.reset();
  switch (kind) {
    case 'lancelet': solveLancelet(S, K, st); break;
    case 'fish': solveFish(S, K, st, false); break;
    case 'ostracoderm': solveFish(S, K, st, true); break;
    case 'lamprey': solveLamprey(S, K, st); break;
    case 'flatworm': solveFlatworm(S, K, st); break;
    case 'jellyfish': solveJelly(S, K, st); break;
    case 'sponge': solveSponge(S, K, st); break;
    case 'anomalocaris': solveAnomalocaris(S, K, st); break;
    case 'trilobite': solveTrilobite(S, K, st); break;
    case 'tetrapod': solveTetrapod(S, K, st); break;
    case 'axon': solveAxon(S, K, st); break;
    case 'egg': solveEgg(S, K, st); break;
    case 'bacterium': solveBacterium(S, K, st); break;
    case 'cell': solveCell(S, K, st); break;
    case 'colony': solveColony(S, K, st); break;
    case 'skull': solveSkull(S, K, st); break;
  }
}
