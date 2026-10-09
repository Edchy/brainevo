import * as THREE from 'three';
import type { SceneState } from '../../world/types';
import { world } from '../../world/store';
import { rng } from '../../world/util';

export const GLSL_UTIL = /* glsl */ `
float h11(float x){return fract(sin(x*127.1+311.7)*43758.5453);}
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1.,0.,0.)),f.x), mix(h31(i+vec3(0.,1.,0.)),h31(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(h31(i+vec3(0.,0.,1.)),h31(i+vec3(1.,0.,1.)),f.x), mix(h31(i+vec3(0.,1.,1.)),h31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+17.;a*=.5;}return s;}
`;

export type Uniforms = Record<string, THREE.IUniform>;
const baseU = (): Uniforms => ({
  uT: { value: 0 }, uW: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uSize: { value: 1 },
});

interface MatOpts { decl?: string; body: string; uniforms?: Uniforms; size?: number }

/** additive glow points. In `body` you may set: p (vec3), size, col (vec3), a. attributes: aSeed(vec4), aCol(vec3) */
export function pointMat(o: MatOpts) {
  const u = { ...baseU(), ...(o.uniforms ?? {}) };
  u.uSize.value = o.size ?? 1;
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `${GLSL_UTIL}
uniform float uT,uW,uTime,uPx,uSize; attribute vec4 aSeed; attribute vec3 aCol; ${o.decl ?? ''}
varying vec3 vCol; varying float vA;
void main(){
  vec3 p=position; float size=1.; vec3 col=aCol; float a=1.;
  ${o.body}
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(size*uSize*uPx*60./max(-mv.z,.1),0.,96.);
  vCol=col; vA=a*uW;
}`,
    fragmentShader: /* glsl */ `varying vec3 vCol; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; float g=exp(-d*d*3.2); gl_FragColor=vec4(vCol, g*vA); }`,
  });
}

/** additive line segments. `body` may set p, col, a; attributes aG (float), aSeed, aCol */
export function lineMat(o: MatOpts) {
  const u = { ...baseU(), ...(o.uniforms ?? {}) };
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `${GLSL_UTIL}
uniform float uT,uW,uTime,uPx,uSize; attribute float aG; attribute vec4 aSeed; attribute vec3 aCol; ${o.decl ?? ''}
varying vec3 vCol; varying float vA;
void main(){
  vec3 p=position; vec3 col=aCol; float a=1.;
  ${o.body}
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  vCol=col; vA=a*uW;
}`,
    fragmentShader: /* glsl */ `varying vec3 vCol; varying float vA; void main(){ gl_FragColor=vec4(vCol, vA); }`,
  });
}

export function tickU(m: THREE.ShaderMaterial, s: SceneState, pixelRatio = 1) {
  const u = m.uniforms;
  u.uT.value = s.t; u.uW.value = s.weight;
  u.uTime.value = world.reduced ? 0 : world.time;
  u.uPx.value = pixelRatio;
}

export type V3 = [number, number, number];

/** builder for point geometry. aSeed = (rand,rand,rand,s3) */
export class PBuf {
  pos: number[] = []; seed: number[] = []; col: number[] = []; ex: Record<string, number[]> = {};
  r: () => number;
  constructor(seed: number) { this.r = rng(seed); }
  add(x: number, y: number, z: number, c: V3, s3 = 0, extra?: Record<string, number[]>) {
    this.pos.push(x, y, z); this.seed.push(this.r(), this.r(), this.r(), s3); this.col.push(c[0], c[1], c[2]);
    if (extra) for (const k in extra) (this.ex[k] ??= []).push(...extra[k]);
  }
  get count() { return this.pos.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.seed), 4));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    for (const k in this.ex) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(this.ex[k]), this.ex[k].length / this.count));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }
}

/** builder for line-segment geometry */
export class LBuf {
  pos: number[] = []; g: number[] = []; seed: number[] = []; col: number[] = []; ex: Record<string, number[]> = {};
  r: () => number;
  constructor(seed: number) { this.r = rng(seed); }
  seg(a: V3, b: V3, g0: number, g1: number, c: V3, s3 = 0, extra?: Record<string, number[]>) {
    const s0 = this.r(), s1 = this.r(), s2 = this.r();
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.g.push(g0, g1);
    this.seed.push(s0, s1, s2, s3, s0, s1, s2, s3);
    this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    if (extra) for (const k in extra) (this.ex[k] ??= []).push(...extra[k], ...extra[k]);
  }
  get count() { return this.pos.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aG', new THREE.BufferAttribute(new Float32Array(this.g), 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.seed), 4));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    for (const k in this.ex) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(this.ex[k]), this.ex[k].length / this.count));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }
}

/** Cajal-style neuron arbor. Returns segments with growth parameter g in 0..1 (path distance from soma). */
export interface NSeg { a: V3; b: V3; g0: number; g1: number; w: number }
export function genNeuron(r: () => number, scale = 1): { segs: NSeg[]; soma: V3 } {
  const segs: NSeg[] = [];
  let gmax = 0;
  const step = 0.07 * scale;
  const grow = (p: THREE.Vector3, d: THREE.Vector3, len: number, depth: number, g: number, w: number, tropism: THREE.Vector3, branchP: number) => {
    let n = Math.max(2, Math.floor(len / step));
    const pos = p.clone(), dir = d.clone().normalize();
    for (let i = 0; i < n; i++) {
      const a: V3 = [pos.x, pos.y, pos.z];
      dir.x += (r() - 0.5) * 0.5; dir.y += (r() - 0.5) * 0.5; dir.z += (r() - 0.5) * 0.5;
      dir.addScaledVector(tropism, 0.08).normalize();
      pos.addScaledVector(dir, step);
      segs.push({ a, b: [pos.x, pos.y, pos.z], g0: g, g1: g + step, w });
      g += step; gmax = Math.max(gmax, g);
      if (depth < 5 && r() < branchP && n - i > 4) {
        const nd = dir.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6)).normalize();
        grow(pos.clone(), nd, (n - i) * step * (0.55 + r() * 0.3), depth + 1, g, w * 0.8, tropism, branchP * 1.05);
      }
    }
  };
  const O = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  // apical dendrite
  grow(O, new THREE.Vector3(0.1, 1, 0.05), 2.3 * scale, 0, 0, 1, up.clone().multiplyScalar(0.6), 0.1);
  // basal dendrites
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    grow(O, new THREE.Vector3(Math.cos(a), -0.35 - r() * 0.3, Math.sin(a)), (0.9 + r() * 0.5) * scale, 1, 0, 0.8, new THREE.Vector3(0, -0.15, 0), 0.09);
  }
  // axon
  grow(O, new THREE.Vector3(0.05, -1, 0), 3.2 * scale, 2, 0, 0.55, new THREE.Vector3(0.1, -0.5, 0), 0.03);
  for (const s of segs) { s.g0 /= gmax; s.g1 /= gmax; }
  return { segs, soma: [0, 0, 0] };
}

/** Smooth closed lateral brain outline (frontal lobe to the +x side), roughly x:[-2,2], y:[-2,1.5] */
export const BRAIN_OUTLINE: [number, number][] = [
  [1.95, 0.0], [1.7, 0.85], [1.0, 1.4], [0.1, 1.55], [-0.9, 1.4], [-1.65, 0.9], [-1.95, 0.1], [-1.8, -0.6],
  [-1.35, -0.95], [-0.7, -0.9], [-0.28, -1.05], [-0.14, -1.85], [0.14, -1.9], [0.3, -1.05], [0.8, -0.8], [1.45, -0.55],
];
export function brainCurve(n: number): [number, number][] {
  const c = new THREE.CatmullRomCurve3(BRAIN_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return c.getSpacedPoints(n).slice(0, n).map((v) => [v.x, v.y]);
}
export function inPoly(poly: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
