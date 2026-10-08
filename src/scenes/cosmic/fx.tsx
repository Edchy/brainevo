import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';

export const NOISE = /* glsl */ `
float hash31(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+17.; a*=.5; } return s; }
`;

/** pixels per world unit at distance 1 (for gl_PointSize) */
export function pxScale(state: RootState) {
  const cam = state.camera as THREE.PerspectiveCamera;
  return (state.size.height * state.gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

export function makeGeo(n: number, attrs: Record<string, [Float32Array, number]>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (const k in attrs) g.setAttribute(k, new THREE.BufferAttribute(attrs[k][0], attrs[k][1]));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

export function useDispose(...objs: Array<{ dispose(): void }>) {
  useEffect(() => () => objs.forEach((o) => o.dispose()), []); // eslint-disable-line react-hooks/exhaustive-deps
}

export const gauss = (r: () => number) => {
  let s = 0;
  for (let i = 0; i < 4; i++) s += r();
  return (s - 2) * 1.7;
};

/* ---------- billboard glow ---------- */
const glowVert = /* glsl */ `
uniform float uScale; varying vec2 vUv;
void main(){ vUv=position.xy; vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy+=position.xy*uScale; gl_Position=projectionMatrix*mv; }`;
const glowFrag = /* glsl */ `
uniform vec3 uColor; uniform float uI; uniform float uSpike; varying vec2 vUv;
void main(){
  float r=length(vUv);
  float g=exp(-r*r*40.)*1.4+0.35*exp(-r*7.)+0.06*(1.-smoothstep(0.,1.,r));
  float sp=uSpike*(exp(-abs(vUv.x)*40.)*exp(-abs(vUv.y)*2.2)+exp(-abs(vUv.y)*40.)*exp(-abs(vUv.x)*2.2));
  float edge=smoothstep(1.,.75,abs(vUv.x))*smoothstep(1.,.75,abs(vUv.y));
  gl_FragColor=vec4(uColor*(g*smoothstep(1.,.6,r)+sp)*edge*uI,1.);
}`;

export function Glow({ meshRef }: { meshRef: RefObject<THREE.Mesh | null> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uI: { value: 0 }, uSpike: { value: 0.3 }, uColor: { value: new THREE.Color(1, 1, 1) } },
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  useDispose(mat, geo);
  return <mesh ref={meshRef} geometry={geo} material={mat} frustumCulled={false} visible={false} renderOrder={5} />;
}

export function setGlow(m: THREE.Mesh | null, scale: number, intensity: number, r = 1, g = 1, b = 1, spike = 0.3) {
  if (!m) return;
  const u = (m.material as THREE.ShaderMaterial).uniforms;
  m.visible = intensity > 0.004 && scale > 0;
  u.uScale.value = scale;
  u.uI.value = intensity;
  u.uSpike.value = spike;
  (u.uColor.value as THREE.Color).setRGB(r, g, b);
}

/** white-hot -> orange -> deep red -> ember colour ramp, k 0..1 (written into out) */
export function fireRamp(k: number, out: THREE.Color) {
  const a = [1, 0.95, 0.85], b = [1, 0.55, 0.15], c = [0.8, 0.12, 0.03], d = [0.12, 0.01, 0.01];
  const mix = (p: number[], q: number[], t: number) => out.setRGB(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
  if (k < 0.15) return mix(a, b, k / 0.15);
  if (k < 0.5) return mix(b, c, (k - 0.15) / 0.35);
  return mix(c, d, Math.min(1, (k - 0.5) / 0.5));
}

type U = Record<string, { value: unknown }>;
export function mkMat(vertexShader: string, fragmentShader: string, uniforms: U, opts: THREE.ShaderMaterialParameters = {}) {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...opts });
}
