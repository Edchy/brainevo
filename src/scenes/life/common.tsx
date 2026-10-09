import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RootState } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { rng } from '../../world/util';

export const NOISE = /* glsl */ `
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p*=2.03;a*=.5;}return s;}
`;

/** pixel scale for gl_PointSize = worldSize * uPx / -viewZ */
export function pxScale(state: RootState) {
  const cam = state.camera as THREE.PerspectiveCamera;
  return (state.size.height * state.gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
}

export const timeNow = () => (world.reduced ? 0 : world.time);

/** dispose helper for geometries / materials created in useMemo */
export function useDispose(...items: Array<{ dispose(): void }>) {
  useEffect(() => () => items.forEach((i) => i.dispose()), []); // eslint-disable-line react-hooks/exhaustive-deps
}

export const POINT_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main(){ vec2 d=gl_PointCoord-.5; float r=length(d)*2.; if(r>1.) discard;
 float a=pow(1.-r,2.2); gl_FragColor=vec4(vC*(a+.35*step(r,.35))*vA,1.); }
`;

/** Drifting particulate in the water: GPU animated, wraps inside a box. */
export function Plankton({
  count = 1200, box = [16, 10, 10], color = '#7fd8ff', size = 0.05, speed = 1, dir = [0.05, 0.08, 0], scroll = 1, intensity = 1,
}: { count?: number; box?: [number, number, number]; color?: string; size?: number; speed?: number; dir?: [number, number, number]; scroll?: number; intensity?: number }) {
  const scene = useScene();
  const n = Math.floor(count * 0.45 * world.quality);
  const geo = useMemo(() => {
    const r = rng(11 + n);
    const p = new Float32Array(n * 3), a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      p[i * 3] = r() - 0.5; p[i * 3 + 1] = r() - 0.5; p[i * 3 + 2] = r() - 0.5;
      a[i * 4] = r(); a[i * 4 + 1] = r(); a[i * 4 + 2] = r(); a[i * 4 + 3] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    return g;
  }, [n]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 500 }, uSize: { value: size }, uW: { value: 0 }, uScroll: { value: 0 },
      uBox: { value: new THREE.Vector3(...box) }, uDir: { value: new THREE.Vector3(...dir).multiplyScalar(speed) }, uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uSize,uW,uScroll; uniform vec3 uBox,uDir,uColor; attribute vec4 aR;
      varying vec3 vC; varying float vA;
      void main(){
        vec3 p=position*uBox; p+=uDir*uTime*(.3+aR.x); p.x+=uScroll*(.4+aR.y);
        p=mod(p+uBox*.5,uBox)-uBox*.5;
        p.x+=sin(uTime*.5+aR.z*20.)*.15; p.y+=cos(uTime*.4+aR.w*20.)*.15;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,uSize*(.4+aR.y)*uPx/max(.1,-mv.z));
        vC=uColor; vA=uW*(.6+.4*sin(uTime*1.5+aR.w*30.))*(.25+.75*aR.x);
      }`,
    fragmentShader: POINT_FRAG,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useDispose(geo, mat);
  useFrame((state) => {
    if (!scene.active) return;
    const u = mat.uniforms;
    u.uTime.value = timeNow(); u.uPx.value = pxScale(state); u.uW.value = scene.weight * intensity;
    u.uScroll.value = -world.stationF * 1.2 * scroll;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** Big far plane: depth haze, caustic web and slanted light shafts. */
export function Backdrop({
  color = '#2a8fb0', z = -14, caustics = 0.5, shafts = 0.4, haze = 0.15, w = 90, h = 54, uLight,
}: { color?: string; z?: number; caustics?: number; shafts?: number; haze?: number; w?: number; h?: number; uLight?: () => number }) {
  const scene = useScene();
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uScroll: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uCaus: { value: caustics }, uShaft: { value: shafts }, uHaze: { value: haze } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uTime,uW,uScroll,uCaus,uShaft,uHaze; uniform vec3 uColor;
      ${NOISE}
      void main(){
        vec2 p=(vUv-.5)*vec2(4.,2.4); p.x+=uScroll*.02;
        float g=smoothstep(-.1,1.,vUv.y);
        float ang=p.x+(1.-vUv.y)*.7;
        float s=vnoise(vec3(ang*3.2,uTime*.12,1.))*.65+vnoise(vec3(ang*7.,uTime*.2,5.))*.35;
        s=smoothstep(.42,.85,s)*pow(g,1.4);
        vec3 q=vec3(p*2.4,uTime*.18);
        float r1=1.-abs(vnoise(q+vec3(vnoise(q*1.7)*1.5))*2.-1.);
        float r2=1.-abs(vnoise(q*1.9+7.+vec3(vnoise(q*2.3)*1.5))*2.-1.);
        float c=pow(r1,9.)+pow(r2,9.);
        float fall=smoothstep(.0,.9,vUv.y);
        vec3 col=uColor*(s*uShaft+c*uCaus*fall*.4+uHaze*(.3+.7*g));
        gl_FragColor=vec4(col*uW*.4,1.);
      }`,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useDispose(mat);
  useFrame(() => {
    if (!scene.active) return;
    const u = mat.uniforms;
    u.uTime.value = timeNow() + world.stationF * 0.6; u.uScroll.value = -world.stationF * 3;
    u.uW.value = scene.weight * (uLight ? uLight() : 1);
  });
  return (
    <mesh position={[0, 0, z]} material={mat} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** fresnel glass material factory (supports InstancedMesh). */
export function makeGlass(color: string, opts: { rim?: number; fill?: number; power?: number; noise?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uRim: { value: opts.rim ?? 1.6 }, uFill: { value: opts.fill ?? 0.12 }, uPow: { value: opts.power ?? 2.5 }, uNoise: { value: opts.noise ?? 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vO;
      void main(){ vO=position; vec3 n=normal;
        #ifdef USE_INSTANCING
          mat4 im=instanceMatrix; vec4 wp=modelMatrix*im*vec4(position,1.); n=mat3(modelMatrix*im)*normal;
        #else
          vec4 wp=modelMatrix*vec4(position,1.); n=mat3(modelMatrix)*normal;
        #endif
        vN=normalize(n); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uW,uTime,uGlow,uRim,uFill,uPow,uNoise; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vO;
      ${NOISE}
      void main(){
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),uPow);
        float n=uNoise>0.?fbm(vO*uNoise+uTime*.15):.5;
        vec3 c=uColor*(f*uRim*(.6+.8*n)+uFill*(.5+n))*(1.+uGlow*2.);
        gl_FragColor=vec4(c*uW,1.); }`,
  });
}

/** lit, depth-writing bead material (instancing aware): diffuse + specular + rim + optional noise, for molecules that should feel solid */
export function makeBead(color: string, opts: { emis?: number; spec?: number; rim?: number; noise?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uEmis: { value: opts.emis ?? 0.12 }, uSpec: { value: opts.spec ?? 0.6 }, uRim: { value: opts.rim ?? 1 }, uNoise: { value: opts.noise ?? 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vO;
      void main(){ vO=position; vec3 n=normal;
        #ifdef USE_INSTANCING
          mat4 im=instanceMatrix; vec4 wp=modelMatrix*im*vec4(position,1.); n=mat3(modelMatrix*im)*normal;
        #else
          vec4 wp=modelMatrix*vec4(position,1.); n=mat3(modelMatrix)*normal;
        #endif
        vN=normalize(n); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uW,uTime,uGlow,uEmis,uSpec,uRim,uNoise; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vO;
      ${NOISE}
      void main(){
        vec3 N=normalize(vN), V=normalize(vV); vec3 L=normalize(vec3(-.45,.75,.55));
        float n=uNoise>0.?fbm(vO*uNoise+uTime*.08):.5;
        vec3 base=uColor*(.62+.76*n);
        float wrap=clamp((dot(N,L)+.45)/1.45,0.,1.);
        vec3 c=base*(.08+.92*wrap)+base*uEmis*(1.+uGlow*2.5);
        c+=vec3(1.)*pow(max(dot(reflect(-L,N),V),0.),48.)*uSpec;
        c+=uColor*pow(1.-max(dot(N,V),0.),2.6)*uRim*.9;
        c+=uColor*pow(max(dot(N,normalize(vec3(.5,-.6,.4))),0.),2.)*.12;
        gl_FragColor=vec4(c,uW); }`,
  });
}
