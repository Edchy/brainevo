import * as THREE from 'three';

/** Max primitives per creature (per-ray culling keeps the real per-pixel cost to a handful). */
// 88 x 5 vec4 arrays ~ 470 fragment uniform vectors (WebGL2 desktop limits are 1024). A loaded biped (face with lids,
// torch + carried infant) needs 85; per-pixel cost does not grow with this, rays only walk their culled shortlist.
export const MAXP = 88;
/** thin hair-like capsules (whiskers) kept outside the main primitive list: drawn as soft sub-pixel lines */
export const MAXW = 16;

/** Material ids a primitive can carry. */
export const MAT = { fur: 0, skin: 1, eye: 2, wet: 3, bone: 4, whisker: 5 } as const;

/**
 * A creature is a bag of smooth-unioned round cones (capsules with different end radii). The rig fills one of these
 * every frame; the shader raymarches it. Primitive endpoints live in the creature's local space (+x forward, +y up).
 */
export class PrimSet {
  n = 0;
  static warned = false;
  readonly A = new Float32Array(MAXP * 4); // xyz endpoint a (z pre-divided by zs), w radius a
  readonly B = new Float32Array(MAXP * 4); // xyz b - a (z pre-divided by zs), w radius b
  readonly P = new Float32Array(MAXP * 4); // x blend k, y material id, z 1/zs (lateral squash), w tone (albedo multiplier)
  readonly C = new Float32Array(MAXP * 4); // x 1/|ba|^2, y distance correction (taper * lateral squash)
  readonly S = new Float32Array(MAXP * 4); // bounding sphere (centre xyz, radius) for per-ray culling
  readonly WA = new Float32Array(MAXW * 4); // whisker root xyz + radius
  readonly WB = new Float32Array(MAXW * 4); // whisker tip xyz
  nw = 0;
  readonly ws = new THREE.Vector4(); // whisker bounding sphere
  readonly min = new THREE.Vector3();
  readonly max = new THREE.Vector3();

  reset() {
    this.n = 0; this.nw = 0;
    this.min.set(1e5, 1e5, 1e5); this.max.set(-1e5, -1e5, -1e5);
  }

  /** thin tapered hair from root to tip (radius at root r) */
  addWhisker(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
    if (this.nw >= MAXW) return;
    const o = this.nw++ * 4;
    this.WA[o] = ax; this.WA[o + 1] = ay; this.WA[o + 2] = az; this.WA[o + 3] = r;
    this.WB[o] = bx; this.WB[o + 1] = by; this.WB[o + 2] = bz; this.WB[o + 3] = 0;
    this.min.set(Math.min(this.min.x, ax, bx), Math.min(this.min.y, ay, by), Math.min(this.min.z, az, bz));
    this.max.set(Math.max(this.max.x, ax, bx), Math.max(this.max.y, ay, by), Math.max(this.max.z, az, bz));
  }

  /**
   * Add a round cone from a (radius ra) to b (radius rb). k = smooth-union radius with everything before it
   * (0 = hard edge), zs = lateral (z) scale (<1 flattens sideways: ears, shoulders, hooves), tone = albedo multiplier.
   */
  add(ax: number, ay: number, az: number, ra: number, bx: number, by: number, bz: number, rb: number,
    k = 0.05, mat = 0, zs = 1, tone = 1) {
    if (this.n >= MAXP) {
      // silently dropping prims loses whatever is built last (hands, props): make it loud in dev
      if (import.meta.env.DEV && !PrimSet.warned) { PrimSet.warned = true; console.warn(`[creatures] PrimSet full (${MAXP}): primitives dropped`); }
      return;
    }
    const i = this.n++;
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    let len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) { bx = ax + 1e-3; dx = 1e-3; dy = 0; dz = 0; len = 1e-3; }
    // keep the cone well formed: one end sphere may not swallow the other
    const maxDiff = len * 0.97;
    if (ra - rb > maxDiff) rb = ra - maxDiff; else if (rb - ra > maxDiff) ra = rb - maxDiff;
    const o = i * 4;
    this.A[o] = ax; this.A[o + 1] = ay; this.A[o + 2] = az / zs; this.A[o + 3] = ra;
    this.B[o] = bx - ax; this.B[o + 1] = by - ay; this.B[o + 2] = (bz - az) / zs; this.B[o + 3] = rb;
    const l2s = this.B[o] ** 2 + this.B[o + 1] ** 2 + this.B[o + 2] ** 2;
    const slope = (ra - rb) / Math.sqrt(l2s);
    this.C[o] = 1 / l2s; this.C[o + 1] = Math.min(1, zs) / Math.sqrt(1 + slope * slope);
    this.P[o] = Math.max(k, 0.002); this.P[o + 1] = mat; this.P[o + 2] = 1 / zs; this.P[o + 3] = tone;
    const R = len * 0.5 + Math.max(ra, rb) * Math.max(1, zs);
    this.S[o] = (ax + bx) / 2; this.S[o + 1] = (ay + by) / 2; this.S[o + 2] = (az + bz) / 2; this.S[o + 3] = R;
    const rz = Math.max(ra, rb) * zs, r = Math.max(ra, rb);
    this.min.set(Math.min(this.min.x, ax - ra, bx - rb), Math.min(this.min.y, ay - ra, by - rb), Math.min(this.min.z, az - rz, bz - rz));
    this.max.set(Math.max(this.max.x, ax + ra, bx + rb), Math.max(this.max.y, ay + ra, by + rb), Math.max(this.max.z, az + rz, bz + rz));
    void r;
  }
}

export interface Palette {
  /** main coat / skin colour */ base: string;
  /** belly / counter-shading colour */ belly: string;
  /** rim-light colour */ rim: string;
  /** ears, paws, inner skin */ skin: string;
  /** optional accent for eyes/embers ('splash'); only used when splashK > 0 */ splash: string;
  /** key (fill) light colour */ key: string;
  /** teeth / claws */ bone: string;
}

export const DEFAULT_PALETTE: Palette = {
  base: '#2a2c33', belly: '#4a4b52', rim: '#bcd0ff', skin: '#5a4a50', splash: '#ffb060', key: '#8a96b8', bone: '#d8d2c4',
};

export interface Look {
  /** rim light strength */ rimK: number;
  /** rim falloff exponent (higher = thinner rim) */ rimPow: number;
  /** key light strength */ keyK: number;
  /** ambient/hemisphere strength */ amb: number;
  /** fur amount 0..1 (strand normal noise + fuzzy silhouette); 0 = smooth skin */ fur: number;
  /** strand density multiplier */ furScale: number;
  /** wrap lighting / subsurface 0..1 */ sss: number;
  /** accent strength on eyes */ splashK: number;
  /** floor contact occlusion 0..1 */ groundAO: number;
  /** skin-style specular 0..1 (humans) */ gloss: number;
  /** rim light direction in view space (xy) */ rimDir: [number, number];
  /** key light direction in view space */ keyDir: [number, number, number];
  /** global brightness/opacity weight (scene fade) */ w: number;
}

export const DEFAULT_LOOK: Look = {
  rimK: 1.6, rimPow: 2.6, keyK: 0.8, amb: 0.28, fur: 0.8, furScale: 1, sss: 0.5, splashK: 0, groundAO: 0.6, gloss: 0,
  rimDir: [-0.62, 0.78], keyDir: [0.45, 0.6, 0.65], w: 1,
};

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
#define STEPS 44
#define MARGIN 0.2
uniform mat4 modelMatrix; uniform mat4 projectionMatrix;
uniform int uN; uniform int uNW;
uniform vec4 uWA[16]; uniform vec4 uWB[16]; uniform vec4 uWS;
uniform vec4 uA[MAXP]; uniform vec4 uB[MAXP]; uniform vec4 uP[MAXP]; uniform vec4 uS[MAXP]; uniform vec4 uC[MAXP];
uniform vec3 uBMin, uBMax;
uniform vec3 uBase, uBelly, uRim, uSkin, uSplash, uKeyCol, uBone;
uniform float uW, uRimK, uRimPow, uKeyK, uAmb, uFur, uFurScale, uSss, uSplashK, uGroundAO, uGloss, uPixAng, uTime;
uniform vec2 uL; uniform vec3 uKeyDir; uniform int uSteps; uniform int uDbg;
varying vec3 vOP; varying vec3 vRO;

float hash3(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}

int gIds[MAXP]; int gCnt = 0;
float dot2(vec3 v){ return dot(v,v); }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba,ba); float rr = r1 - r2; float a2 = l2 - rr*rr; float il2 = 1.0/l2;
  vec3 pa = p - a; float y = dot(pa,ba); float z = y - l2; float x2 = dot2(pa*l2 - ba*y); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}
float smin(float a, float b, float k){ float h = max(k - abs(a-b), 0.)/k; return min(a,b) - h*h*k*0.25; }

float mapW(vec3 p){
  float d = 1e5;
  for (int i = 0; i < 16; i++){
    if (i >= uNW) break;
    vec3 a = uWA[i].xyz; vec3 ba = uWB[i].xyz - a; vec3 pa = p - a;
    float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
    d = min(d, length(pa - ba*h) - uWA[i].w*(1. - 0.8*h));
  }
  return d;
}
float prim(int i, vec3 p){
  vec4 a = uA[i]; vec4 b = uB[i];
  vec3 pa = vec3(p.xy, p.z*uP[i].z) - a.xyz;
  float h = clamp(dot(pa, b.xyz)*uC[i].x, 0., 1.);
  return (length(pa - b.xyz*h) - mix(a.w, b.w, h))*uC[i].y;
}
float map(vec3 p, uint mask){
  float d = 1e5;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j];
    d = smin(d, prim(i, p), uP[i].x);
  }
  return d;
}
vec3 calcNormal(vec3 p, uint mask, float h){
  const vec2 e = vec2(1., -1.)*0.5773;
  return normalize(e.xyy*map(p + e.xyy*h, mask) + e.yyx*map(p + e.yyx*h, mask) + e.yxy*map(p + e.yxy*h, mask) + e.xxx*map(p + e.xxx*h, mask));
}

void main(){
  vec3 ro = vRO; vec3 rd = normalize(vOP - ro);
  vec3 inv = 1./rd;
  vec3 t0 = (uBMin - ro)*inv, t1 = (uBMax - ro)*inv;
  vec3 tmn = min(t0,t1), tmx = max(t0,t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.)), tf = min(min(tmx.x, tmx.y), tmx.z);
  if (tf <= tn) discard;

  uint mask = 0u; float sn = 1e5, sf = -1e5;
  for (int i = 0; i < MAXP; i++){
    if (i >= uN) break;
    vec3 oc = uS[i].xyz - ro; float tc = dot(oc, rd); vec3 cr = oc - rd*tc;
    float rr = uS[i].w + MARGIN; float c2 = dot(cr,cr);
    if (c2 < rr*rr){
      // tighter test: closest approach of the ray to the primitive's axis segment
      float zk = 1./uP[i].z; vec3 a = vec3(uA[i].xy, uA[i].z*zk); vec3 u = vec3(uB[i].xy, uB[i].z*zk); vec3 w0 = ro - a;
      float aa = dot(u,u), bb = dot(u,rd), dd = dot(u,w0), ee = dot(rd,w0);
      float den = aa - bb*bb;
      float sP = den > 1e-7 ? clamp((dd - bb*ee)/den, 0., 1.) : 0.;
      float tP = sP*bb - ee;
      vec3 dv = w0 + rd*tP - u*sP;
      float rp = max(uA[i].w, uB[i].w)*max(1., 1./uP[i].z) + uP[i].x + 0.05;
      if (dot(dv,dv) < rp*rp){
        mask = 1u; gIds[gCnt++] = i;
        float r2 = uS[i].w + 0.05; float h2 = r2*r2 - c2;
        if (h2 > 0.){ float h = sqrt(h2); sn = min(sn, tc - h); sf = max(sf, tc + h); }
      }
    }
  }
  if (sf > sn){ tn = max(tn, sn); tf = min(tf, sf); }
  bool useW = false;
  if (uNW > 0){ vec3 oc = uWS.xyz - ro; float tc = dot(oc, rd); vec3 cr = oc - rd*tc; useW = dot(cr,cr) < uWS.w*uWS.w; }
  if (mask == 0u && !useW) discard;

  float t = tn, dmin = 1e5, tmin = tn; bool hit = false; bool isW = false;
  for (int i = 0; i < STEPS; i++){
    if (i >= uSteps) break;
    vec3 pp = ro + rd*t;
    float d = map(pp, mask);
    float dw = useW ? mapW(pp) : 1e5;
    bool wn = dw < d; d = min(d, dw);
    float eps = 0.0007 + t*uPixAng*0.45;
    if (d < dmin){ dmin = d; tmin = t; isW = wn; }
    if (d < eps){ hit = true; break; }
    t += max(d*0.88, eps*0.6);
    if (t > tf) break;
  }
  float ts = hit ? t : tmin;
  vec3 p = ro + rd*ts;
  float pix = ts*uPixAng;
  float alpha = 1.;
  if (!hit){
    float fw = max(uFur*0.008*(0.35 + 1.3*vn(p*45.)), pix*1.1);
    if (dmin > fw) discard;
    alpha = 1. - smoothstep(0., fw, dmin);
    alpha *= alpha*(3.-2.*alpha);
  }
  if (isW){
    // whisker: a pale hair catching the rim light
    float fade = hit ? 1. : 0.8;
    vec3 wc = mix(uRim, uBone, 0.35)*(0.55 + 0.45*uRimK*0.5);
    gl_FragColor = vec4(wc*uW*0.8*alpha*fade, alpha*fade);
    vec4 cw = projectionMatrix*viewMatrix*modelMatrix*vec4(p, 1.);
    gl_FragDepth = clamp(cw.z/cw.w*0.5 + 0.5, 0., 1.);
    return;
  }

  if (uDbg == 1){ gl_FragColor = vec4(vec3(float(mask)/4096.)*alpha, alpha); return; }
  vec3 N = calcNormal(p, mask, 0.0015 + pix*0.5);

  // nearest primitive decides the surface material; nearby primitives of other materials blend softly (no hard seams)
  float bd = 1e5; float mat = 0.; int bi = 0;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j];
    float di = prim(i, p);
    if (di < bd){ bd = di; mat = uP[i].y; bi = i; }
  }
  vec4 wm = vec4(0.); float wBone = 0., tone = 0., wsum = 0.;
  for (int j = 0; j < MAXP; j++){
    if (j >= gCnt) break;
    int i = gIds[j];
    float m = uP[i].y;
    float w = exp(-(prim(i, p) - bd)*(m > 1.5 && m < 2.5 ? 400. : 55.));
    wm += w*vec4(m < 0.5 ? 1. : 0., (m > 0.5 && m < 1.5) ? 1. : 0., (m > 1.5 && m < 2.5) ? 1. : 0., (m > 2.5 && m < 3.5) ? 1. : 0.);
    wBone += w*(m > 3.5 ? 1. : 0.); tone += w*uP[i].w; wsum += w;
  }
  tone /= wsum; wm /= wsum; wBone /= wsum;
  if (mat > 1.5 && mat < 2.5){ wm = vec4(0., 0., 1., 0.); wBone = 0.; }

  // ambient occlusion from the field + floor contact
  float occ = 0., sc = 1.;
  for (int i = 1; i <= 3; i++){ float h = 0.0075*float(i*i); occ += (h - map(p + N*h, mask))*sc; sc *= 0.6; }
  float ao = clamp(1. - 1.5*occ, 0.35, 1.);
  ao *= 1. - uGroundAO*exp(-max(p.y, 0.)*9.)*(0.35 + 0.65*clamp(0.5 - 0.5*N.y, 0., 1.));

  // fur: stretched strand noise perturbs the normal; clumps modulate albedo; both fade out with pixel footprint
  float furAmt = uFur * (mat < 0.5 ? 1. : (mat < 1.5 ? 0.5 : 0.));
  furAmt = uFur * clamp(wm.x + 0.5*wm.y, 0., 1.);
  vec3 q = p*vec3(24., 120., 120.)*uFurScale;
  float lod1 = 1. - smoothstep(0.22, 0.6, pix*120.*uFurScale);
  float lod2 = 1. - smoothstep(0.3, 0.9, pix*26.*uFurScale);
  float s0 = vn(q)*0.65 + vn(q*2.07 + 7.3)*0.35;
  float sa = vn(q + vec3(0., 0.41, 0.)), sb = vn(q + vec3(0., 0., 0.41));
  float strand = mix(0.5, s0, lod1);
  float clump = mix(0.5, vn(p*vec3(9., 40., 40.)*uFurScale), lod2);
  vec3 Nf = normalize(N + vec3(0., sa - s0, sb - s0)*0.75*furAmt*lod1);

  vec3 Nw = normalize(mat3(modelMatrix)*Nf);
  vec3 Nv = normalize(mat3(viewMatrix)*Nw);
  vec3 pw = (modelMatrix*vec4(p,1.)).xyz;
  vec3 V = normalize((viewMatrix*vec4(cameraPosition - pw, 0.)).xyz);
  float nv = clamp(dot(Nv, V), 0., 1.);

  float belly = smoothstep(0.15, -0.75, N.y);
  vec3 furA = mix(uBase, uBelly, belly) * (1. + (clump - 0.5)*0.22*furAmt);
  vec3 alb = (furA*wm.x + mix(uSkin, uBase, 0.25)*wm.y + vec3(0.012, 0.011, 0.014)*wm.z + uSkin*0.32*wm.w + uBone*wBone) * tone;

  vec3 Lk = normalize(uKeyDir);
  float ndl = dot(Nv, Lk);
  float wrap = clamp((ndl + uSss)/(1. + uSss), 0., 1.);
  float term = exp(-pow((ndl - 0.05)*2.8, 2.));
  vec3 col = alb*(uKeyK*wrap*uKeyCol + uAmb*(0.5 + 0.5*Nw.y)*uKeyCol*0.8)*ao;
  col += alb*uRim*term*uSss*0.22*ao;
  col += alb*uKeyCol*0.4*clamp(-Nw.y, 0., 1.)*(0.5 + 0.5*ao);                         // floor bounce                      // warm scatter at the terminator

  // rim light from behind: fresnel gated to the lit side, brightened by hair-line sparkle
  float fres = pow(1. - nv, uRimPow);
  float side = dot(normalize(Nv.xy + 1e-4), uL);
  float rimLit = mix(0.22, 1., smoothstep(-0.45, 0.7, side));
  float sparkle = mix(1., 0.45 + 1.3*strand, furAmt);
  vec3 rimc = uRim*fres*rimLit*uRimK*sparkle*(0.6 + 0.4*ao);
  // anisotropic (Kajiya-Kay) hair sheen along the flow direction
  vec3 Lr = normalize(vec3(uL*0.9, -0.5));
  vec3 Tv = normalize(mat3(viewMatrix)*mat3(modelMatrix)*normalize(vec3(-1., -0.28, 0.)));
  Tv = normalize(Tv - Nv*dot(Tv, Nv));
  vec3 Hh = normalize(Lr + V);
  float tdh = dot(Tv, Hh);
  float kk = pow(sqrt(max(1. - tdh*tdh, 0.)), 36.)*smoothstep(-0.2, 0.5, dot(Nv, Lr));
  col += rimc*(mat < 2.5 ? 1. : 0.4) + uRim*kk*uRimK*0.28*furAmt*(0.5 + strand);
  if (mat > 0.5 && mat < 1.5) col += uSkin*uRim*pow(1. - nv, 1.6)*rimLit*0.35;     // thin ears glow when backlit

  float gl = uGloss*(mat < 2.5 ? 1. : 0.);
  if (gl > 0.) col += uKeyCol*pow(max(dot(reflect(-V, Nv), Lk), 0.), 40.)*0.25*gl*ao + uRim*pow(max(dot(reflect(-V, Nv), Lr), 0.), 24.)*0.15*gl;

  if (mat > 1.5 && mat < 2.5){
    // moist eye. Rigs whose eye capsule axis is >= 2mm (biped, primate: it runs along the gaze) get anatomy: a shaded
    // sclera (brightness = the prim's tone: pale for humans, dark for apes), a dark iris with a darker limbal ring and a
    // black pupil. Shorter axes (small mammals) keep the all-dark lens.
    vec3 R = reflect(-V, Nv);
    float ring = smoothstep(0.25, 0.6, nv)*smoothstep(0.995, 0.8, nv);
    vec3 gz = uB[bi].xyz;
    if (dot(gz, gz) > 4e-6){
      // angle from the eyeball's centre (not the surface normal, which the smooth blend with the lids bends into swirls)
      vec3 ec = vec3(uA[bi].xy, uA[bi].z/uP[bi].z);
      float c = dot(normalize(p - ec), normalize(gz));
      vec3 sclera = mix(vec3(0.16, 0.1, 0.07), vec3(0.29, 0.27, 0.25), uP[bi].w)*(0.5 + 0.5*wrap)*mix(0.75, 1., ao);
      sclera *= 1. - 0.5*smoothstep(-0.15, 0.55, (p.y - ec.y)/uA[bi].w);     // the upper lid's shadow on the eyeball
      // iris ~29 degrees half-angle (cos 0.875) like a real eye: an even dark disc (a lighter centre reads as a cartoon
      // target), the pupil only a shade darker, as it looks at conversational distance
      float irisM = smoothstep(0.855, 0.88, c), pup = smoothstep(0.962, 0.972, c);
      col = mix(mix(sclera, vec3(0.05, 0.034, 0.024), irisM), vec3(0.012), pup);
    } else col = alb;
    col += uSplash*uSplashK*(0.15 + 0.85*ring)*smoothstep(0.1, 0.5, nv);
    col += vec3(1.)*pow(max(dot(R, Lk), 0.), 200.)*1.4 + uRim*pow(max(dot(R, Lr), 0.), 120.)*0.5;
    col += uRim*pow(1. - nv, 3.)*0.12;
  } else if (mat > 2.5 && mat < 3.5){
    vec3 R = reflect(-V, Nv);
    col += vec3(1.)*pow(max(dot(R, Lk), 0.), 55.)*0.9 + uRim*pow(max(dot(R, Lr), 0.), 30.)*0.6;
  }

  gl_FragColor = vec4(col*uW*alpha, alpha);
  vec4 cp = projectionMatrix*viewMatrix*modelMatrix*vec4(p, 1.);
  gl_FragDepth = clamp(cp.z/cp.w*0.5 + 0.5, 0., 1.);
}`;

export type CreatureMaterial = THREE.ShaderMaterial;

export function createCreatureMaterial(): CreatureMaterial {
  const u: Record<string, THREE.IUniform> = {
    uN: { value: 0 }, uNW: { value: 0 }, uWA: { value: new Float32Array(MAXW * 4) }, uWB: { value: new Float32Array(MAXW * 4) }, uWS: { value: new THREE.Vector4() },
    uA: { value: new Float32Array(MAXP * 4) }, uB: { value: new Float32Array(MAXP * 4) },
    uP: { value: new Float32Array(MAXP * 4) }, uS: { value: new Float32Array(MAXP * 4) }, uC: { value: new Float32Array(MAXP * 4) },
    uBMin: { value: new THREE.Vector3() }, uBMax: { value: new THREE.Vector3() },
    uBase: { value: new THREE.Color() }, uBelly: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
    uSkin: { value: new THREE.Color() }, uSplash: { value: new THREE.Color() }, uKeyCol: { value: new THREE.Color() }, uBone: { value: new THREE.Color() },
    uW: { value: 1 }, uRimK: { value: 1 }, uRimPow: { value: 2.6 }, uKeyK: { value: 0.5 }, uAmb: { value: 0.3 }, uFur: { value: 0.8 },
    uFurScale: { value: 1 }, uSss: { value: 0.5 }, uSplashK: { value: 0 }, uGroundAO: { value: 0.5 }, uGloss: { value: 0 },
    uPixAng: { value: 0.001 }, uSteps: { value: 44 }, uDbg: { value: 0 }, uTime: { value: 0 },
    uL: { value: new THREE.Vector2(-0.62, 0.78) }, uKeyDir: { value: new THREE.Vector3(0.35, 0.55, 0.75) },
  };
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
    side: THREE.BackSide, transparent: true, depthWrite: true, depthTest: true, toneMapped: false, premultipliedAlpha: true,
  });
}

/** copy a PrimSet into the material's uniforms and set the bounding box */
export function uploadPrims(m: CreatureMaterial, ps: PrimSet, pad = 0.03) {
  const u = m.uniforms;
  (u.uWA.value as Float32Array).set(ps.WA); (u.uWB.value as Float32Array).set(ps.WB);
  u.uNW.value = ps.nw;
  if (ps.nw > 0) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < ps.nw; i++) { cx += ps.WA[i * 4] + ps.WB[i * 4]; cy += ps.WA[i * 4 + 1] + ps.WB[i * 4 + 1]; cz += ps.WA[i * 4 + 2] + ps.WB[i * 4 + 2]; }
    cx /= ps.nw * 2; cy /= ps.nw * 2; cz /= ps.nw * 2;
    let R = 0;
    for (let i = 0; i < ps.nw; i++) for (const a of [ps.WA, ps.WB]) R = Math.max(R, Math.hypot(a[i * 4] - cx, a[i * 4 + 1] - cy, a[i * 4 + 2] - cz));
    (u.uWS.value as THREE.Vector4).set(cx, cy, cz, R + 0.02);
  }
  (u.uA.value as Float32Array).set(ps.A); (u.uB.value as Float32Array).set(ps.B);
  (u.uP.value as Float32Array).set(ps.P); (u.uS.value as Float32Array).set(ps.S); (u.uC.value as Float32Array).set(ps.C);
  u.uN.value = ps.n;
  (u.uBMin.value as THREE.Vector3).copy(ps.min).addScalar(-pad);
  (u.uBMax.value as THREE.Vector3).copy(ps.max).addScalar(pad);
}

const _c = new THREE.Color();
export function applyPalette(m: CreatureMaterial, p: Palette) {
  const u = m.uniforms;
  (u.uBase.value as THREE.Color).copy(_c.set(p.base)); (u.uBelly.value as THREE.Color).set(p.belly); (u.uRim.value as THREE.Color).set(p.rim);
  (u.uSkin.value as THREE.Color).set(p.skin); (u.uSplash.value as THREE.Color).set(p.splash); (u.uKeyCol.value as THREE.Color).set(p.key);
  (u.uBone.value as THREE.Color).set(p.bone);
}

export function applyLook(m: CreatureMaterial, l: Look) {
  const u = m.uniforms;
  u.uRimK.value = l.rimK; u.uRimPow.value = l.rimPow; u.uKeyK.value = l.keyK; u.uAmb.value = l.amb; u.uFur.value = l.fur;
  u.uFurScale.value = l.furScale; u.uSss.value = l.sss; u.uSplashK.value = l.splashK; u.uGroundAO.value = l.groundAO; u.uGloss.value = l.gloss;
  (u.uL.value as THREE.Vector2).set(l.rimDir[0], l.rimDir[1]).normalize();
  (u.uKeyDir.value as THREE.Vector3).set(...l.keyDir).normalize();
  u.uW.value = l.w;
}


/** cheap screen-space blit of a low-resolution creature render (colour + depth) back into the main scene */
export function createCompositeMaterial(shared: CreatureMaterial): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec4 c = texture2D(tColor, uv);
        if (c.a < 0.003) discard;
        gl_FragColor = c;
        gl_FragDepth = texture2D(tDepth, uv).r;
      }`,
    uniforms: { uBMin: shared.uniforms.uBMin, uBMax: shared.uniforms.uBMax, tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
    side: THREE.BackSide, transparent: true, depthWrite: true, depthTest: true, toneMapped: false, premultipliedAlpha: true,
  });
}
