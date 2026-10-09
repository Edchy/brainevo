import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';

/** pixel scale for size-attenuated point shaders: size_px = aSize * uScale / -mv.z */
export function pointScale(s: RootState): number {
  const cam = s.camera as THREE.PerspectiveCamera;
  return (s.size.height * s.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
}

export const GLSL_NOISE = /* glsl */ `
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

export const POINT_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - .5; float r = length(d)*2.;
  float a = smoothstep(1., 0., r); a = a*a;
  if (a < .003) discard;
  gl_FragColor = vec4(vCol * a * vA, 1.);
}`;

/** soft additive point material factory. vertex must define vCol, vA and gl_PointSize. */
export function pointMaterial(vert: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: POINT_FRAG,
    uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uW: { value: 1 }, ...uniforms },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** thermal-vision colour ramp (0 cold .. 1+ white hot) */
export const GLSL_THERMAL = /* glsl */ `
vec3 thermal(float x){
  vec3 c = mix(vec3(0.01,0.02,0.16), vec3(0.32,0.04,0.42), smoothstep(0.,.28,x));
  c = mix(c, vec3(0.95,0.12,0.08), smoothstep(.28,.52,x));
  c = mix(c, vec3(1.,.62,0.04), smoothstep(.5,.78,x));
  c = mix(c, vec3(1.,.96,.72), smoothstep(.78,1.05,x));
  return c * (1. + 0.9*smoothstep(.8,1.2,x));
}`;

export function disposeOnUnmount(...items: Array<{ dispose(): void }>) {
  return () => items.forEach((i) => i.dispose());
}

/** fresnel-rim silhouette material with depth fog; weight via uW */
export function rimMaterial(base: string, rim: string, fog: string, fogNear = 8, fogFar = 40, rimPow = 2.5, rimK = 1) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uBase: { value: new THREE.Color(base) }, uRim: { value: new THREE.Color(rim) }, uFog: { value: new THREE.Color(fog) },
      uW: { value: 1 }, uNear: { value: fogNear }, uFar: { value: fogFar }, uPow: { value: rimPow }, uK: { value: rimK },
    },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        vec4 lp = vec4(position,1.); vec3 nn = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix*lp; nn = mat3(instanceMatrix)*nn;
        #endif
        vec4 mv = modelViewMatrix*lp; vN = normalize(normalMatrix*nn); vV = normalize(-mv.xyz); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uBase,uRim,uFog; uniform float uW,uNear,uFar,uPow,uK; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float fr = pow(1.-abs(dot(normalize(vN),normalize(vV))), uPow);
        vec3 c = uBase + uRim*fr*uK; c = mix(c, uFog, smoothstep(uNear,uFar,vD)); gl_FragColor = vec4(c*uW,1.); }`,
  });
}

/**
 * One-sided rim-lit silhouette: near-black body, a thin fresnel rim that only catches on the side facing a back light
 * (view-space direction `light`), plus a whisper of top fill. Weight via uW, rim strength via uK.
 */
export function silhouetteMaterial(rim = '#dfe8ff', base = '#010203', rimPow = 3.2, k = 1.4, light: [number, number] = [-0.62, 0.78]) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uBase: { value: new THREE.Color(base) }, uRim: { value: new THREE.Color(rim) },
      uW: { value: 1 }, uK: { value: k }, uPow: { value: rimPow }, uL: { value: new THREE.Vector2(light[0], light[1]).normalize() },
    },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 lp = vec4(position,1.); vec3 nn = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix*lp; nn = mat3(instanceMatrix)*nn;
        #endif
        vec4 mv = modelViewMatrix*lp; vN = normalize(normalMatrix*nn); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uBase,uRim; uniform float uW,uK,uPow; uniform vec2 uL; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN);
        float fr = pow(1.-abs(dot(n,normalize(vV))), uPow);
        float side = dot(normalize(n.xy+1e-4), uL);
        float lit = mix(.38, 1., smoothstep(-.35,.75,side));
        vec3 c = uBase*(.5+.5*n.y) + uRim*fr*uK*lit;
        gl_FragColor = vec4(c*uW,1.); }`,
  });
}

/** tube with a radius that tapers from r0 to r1 along `curve` (rounded, closed by shrinking radius) */
export function taperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs = 24, radial = 10) {
  const pos: number[] = [], idx: number[] = [];
  const fr = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs; const p = curve.getPoint(u);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(u, 0.85));
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + r * (c * fr.normals[i].x + s * fr.binormals[i].x), p.y + r * (c * fr.normals[i].y + s * fr.binormals[i].y), p.z + r * (c * fr.normals[i].z + s * fr.binormals[i].z));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** one continuous smooth body: keys are [x, radius, centreY] along +x; cross-section is an ellipse (z radius r, y radius r*flat) */
export function profileBody(keys: [number, number, number][], flat = 1, segs = 90, radial = 22) {
  const cr = new THREE.SplineCurve(keys.map(([x, r]) => new THREE.Vector2(x, r)));
  const cy = new THREE.SplineCurve(keys.map(([x, , y]) => new THREE.Vector2(x, y)));
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs; const a = cr.getPoint(u), b = cy.getPoint(u);
    const r = Math.max(0, a.y);
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      pos.push(a.x, b.y + Math.sin(ang) * r * flat, Math.cos(ang) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
