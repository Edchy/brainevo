import * as THREE from 'three';

/**
 * "Drawn in light" primitives for the primordial soup: anti-aliased hairline segments (screen-space ribbons with a
 * gaussian profile and round caps) and soft atom discs, both instanced, additive, CPU-filled each frame (tens of items).
 */

const segVert = /* glsl */ `
attribute vec3 aA; attribute vec3 aB; attribute vec4 aD;
uniform vec2 uRes;
varying vec2 vP; varying float vHalfL; varying float vI; varying float vSig; varying float vGlow;
void main(){
  vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.);
  vec4 cb = projectionMatrix * viewMatrix * vec4(aB, 1.);
  vec2 sa = ca.xy / ca.w * uRes * .5, sb = cb.xy / cb.w * uRes * .5;
  vec2 d = sb - sa; float L = length(d);
  vec2 dir = L > 1e-4 ? d / L : vec2(1., 0.); vec2 nrm = vec2(-dir.y, dir.x);
  float sig = aD.x, w = sig * 5. + 1.;
  float u = position.x;
  vec2 s = mix(sa, sb, u) + dir * w * (u * 2. - 1.) + nrm * w * position.y;
  vec4 c = mix(ca, cb, u);
  gl_Position = vec4(s / (uRes * .5) * c.w, c.z, c.w);
  vP = vec2((u * 2. - 1.) * (L * .5 + w), position.y * w);
  vHalfL = L * .5; vI = aD.y; vSig = sig; vGlow = aD.z;
}`;
const segFrag = /* glsl */ `
uniform vec3 uColor;
varying vec2 vP; varying float vHalfL; varying float vI; varying float vSig; varying float vGlow;
void main(){
  float ex = max(abs(vP.x) - vHalfL, 0.);
  float d = length(vec2(ex, vP.y));
  float core = exp(-d * d / (2. * vSig * vSig));
  float halo = vGlow * exp(-d * d / (2. * vSig * vSig * 12.));
  float edge = 1. - smoothstep(vSig * 3.6, vSig * 5., d);
  gl_FragColor = vec4(uColor * (core + halo) * edge * vI, 1.);
}`;

export class Segs {
  geo = new THREE.InstancedBufferGeometry();
  mat: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  n = 0;
  private a: Float32Array; private b: Float32Array; private d: Float32Array;
  private aA: THREE.InstancedBufferAttribute; private aB: THREE.InstancedBufferAttribute; private aD: THREE.InstancedBufferAttribute;
  max: number;
  constructor(max: number, color: [number, number, number] = [1, 1, 1]) {
    this.max = max;
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    this.a = new Float32Array(max * 3); this.b = new Float32Array(max * 3); this.d = new Float32Array(max * 4);
    this.aA = new THREE.InstancedBufferAttribute(this.a, 3).setUsage(THREE.DynamicDrawUsage);
    this.aB = new THREE.InstancedBufferAttribute(this.b, 3).setUsage(THREE.DynamicDrawUsage);
    this.aD = new THREE.InstancedBufferAttribute(this.d, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aA', this.aA); g.setAttribute('aB', this.aB); g.setAttribute('aD', this.aD);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: segVert, fragmentShader: segFrag, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uRes: { value: new THREE.Vector2(1280, 720) }, uColor: { value: new THREE.Color(...color) } },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
  }
  begin(res: THREE.Vector2) { this.n = 0; (this.mat.uniforms.uRes.value as THREE.Vector2).copy(res); }
  /** sigma/glow in px at 900px viewport height; k scales to the real drawing buffer */
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, inten: number, sigma: number, glow = 0) {
    if (this.n >= this.max || inten < 0.004) return;
    const i = this.n++;
    this.a[i * 3] = ax; this.a[i * 3 + 1] = ay; this.a[i * 3 + 2] = az;
    this.b[i * 3] = bx; this.b[i * 3 + 1] = by; this.b[i * 3 + 2] = bz;
    this.d[i * 4] = sigma; this.d[i * 4 + 1] = inten; this.d[i * 4 + 2] = glow;
  }
  end() {
    this.geo.instanceCount = this.n;
    this.aA.needsUpdate = true; this.aB.needsUpdate = true; this.aD.needsUpdate = true;
    this.mesh.visible = this.n > 0;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

const discVert = /* glsl */ `
attribute vec3 aC; attribute vec4 aD; attribute vec3 aCol;
varying vec2 vUv; varying vec4 vD; varying vec3 vCol;
void main(){
  vec4 mv = viewMatrix * vec4(aC, 1.);
  float R = aD.x * 5.;
  mv.xy += position.xy * R;
  vUv = position.xy * 5.; vD = aD; vCol = aCol;
  gl_Position = projectionMatrix * mv;
}`;
const discFrag = /* glsl */ `
varying vec2 vUv; varying vec4 vD; varying vec3 vCol;
void main(){
  float r = length(vUv);               // in atom radii
  float disc = (1. - smoothstep(.86, 1.0, r)) * (.72 + .28 * (1. - r * r));
  float rim = exp(-pow((r - .93) * 7., 2.)) * .35;
  float halo = .5 * exp(-r * 1.55) * (1. - smoothstep(2.2, 5., r));
  float ring = 0.;
  if (vD.z >= 0.) { float rr = 1.15 + vD.z * 2.6; ring = exp(-pow((r - rr) * 5.5, 2.)) * pow(1. - vD.z, 1.6) * .9; }
  float v = (disc + rim + halo + ring) * vD.y;
  gl_FragColor = vec4(vCol * v, 1.);
}`;

export class Discs {
  geo = new THREE.InstancedBufferGeometry();
  mat: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  n = 0;
  private c: Float32Array; private d: Float32Array; private col: Float32Array;
  private aC: THREE.InstancedBufferAttribute; private aD: THREE.InstancedBufferAttribute; private aCol: THREE.InstancedBufferAttribute;
  max: number;
  constructor(max: number) {
    this.max = max;
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    this.c = new Float32Array(max * 3); this.d = new Float32Array(max * 4); this.col = new Float32Array(max * 3);
    this.aC = new THREE.InstancedBufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    this.aD = new THREE.InstancedBufferAttribute(this.d, 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aC', this.aC); g.setAttribute('aD', this.aD); g.setAttribute('aCol', this.aCol);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: discVert, fragmentShader: discFrag, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 21;
  }
  begin() { this.n = 0; }
  /** pulse < 0 = no ring, otherwise 0..1 ring age */
  add(x: number, y: number, z: number, radius: number, inten: number, pulse: number, r: number, g: number, b: number) {
    if (this.n >= this.max || (inten < 0.004 && pulse < 0)) return;
    const i = this.n++;
    this.c[i * 3] = x; this.c[i * 3 + 1] = y; this.c[i * 3 + 2] = z;
    this.d[i * 4] = radius; this.d[i * 4 + 1] = inten; this.d[i * 4 + 2] = pulse;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  end() {
    this.geo.instanceCount = this.n;
    this.aC.needsUpdate = true; this.aD.needsUpdate = true; this.aCol.needsUpdate = true;
    this.mesh.visible = this.n > 0;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
