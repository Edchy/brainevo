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
