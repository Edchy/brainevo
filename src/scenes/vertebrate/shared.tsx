import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { rng } from '../../world/util';

export const TM = () => (world.reduced ? 0 : world.time);

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const BEND = /* glsl */ `
uniform float uPhase; uniform float uAmp;
vec3 bend(vec3 p){ float k=smoothstep(2.5,-3.0,p.x); p.y+=uAmp*sin(p.x*1.5+uPhase)*(0.15+0.85*k); return p; }
`;

const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

/** translucent fresnel body (additive) with optional swim bend + chevron stripes */
export function makeBodyMat(color: THREE.ColorRepresentation, o: { rim?: number; base?: number; stripe?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: col(color) }, uOpacity: { value: 1 }, uPhase: { value: 0 }, uAmp: { value: 0 },
      uRim: { value: o.rim ?? 1.6 }, uBase: { value: o.base ?? 0.06 }, uStripe: { value: o.stripe ?? 0 }, uBoost: { value: 1 },
    },
    vertexShader: /* glsl */ `${BEND}
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vP=position; vec3 p=bend(position); vec4 mv=modelViewMatrix*vec4(p,1.);
        vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity,uRim,uBase,uStripe,uBoost; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);
        float s=1.; if(uStripe>0.){ s=0.55+0.45*smoothstep(0.1,0.9,0.5+0.5*sin(vP.x*uStripe+abs(vP.y)*6.)); }
        vec3 c=uColor*(uBase+f*uRim)*s*uBoost; gl_FragColor=vec4(c*uOpacity,1.); }`,
  });
}

/** glowing tube with travelling comet pulses (uv.x along length), grow, thicken */
export function makeTubeMat(color: THREE.ColorRepresentation, o: { base?: number; count?: number; stripe?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: col(color) }, uOpacity: { value: 1 }, uPhase: { value: 0 }, uAmp: { value: 0 },
      uBase: { value: o.base ?? 0.5 }, uCount: { value: o.count ?? 1 }, uSig: { value: 0 }, uBoost: { value: 2 },
      uGrow: { value: 1 }, uRad: { value: 1 }, uR0: { value: 0.05 }, uStripe: { value: o.stripe ?? 0 }, uPulseAmt: { value: 1 },
    },
    vertexShader: /* glsl */ `${BEND}
      uniform float uRad,uR0; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec3 p=position+normal*(uRad-1.)*uR0; p=bend(p); vec4 mv=modelViewMatrix*vec4(p,1.);
        vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity,uBase,uCount,uSig,uBoost,uGrow,uStripe,uPulseAmt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ if(vUv.x>uGrow) discard;
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.5);
        float d=fract(uSig-vUv.x*uCount); float pulse=exp(-d*5.)*uPulseAmt;
        float s=1.; if(uStripe>0.) s=0.55+0.45*step(0.,sin(vUv.x*uStripe));
        float tip=smoothstep(uGrow-0.03,uGrow,vUv.x)*step(uGrow,0.999)*2.;
        vec3 c=uColor*(uBase*(0.4+f)*s+pulse*uBoost*(0.5+f))+vec3(1.,.9,.8)*(pulse*pulse*0.6+tip);
        gl_FragColor=vec4(c*uOpacity,1.); }`,
  });
}

/** soft glowing sprite points that drift in a wrapping box */
export function makePlanktonMat(color: THREE.ColorRepresentation, size: number, box: [number, number, number]) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: col(color) }, uOp: { value: 1 }, uSize: { value: size }, uTime: { value: 0 },
      uBox: { value: new THREE.Vector3(...box) }, uDrift: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform vec3 uBox,uDrift; uniform float uTime,uSize; varying float vA;
      void main(){ vec3 p=(aR.xyz-.5)*uBox+uDrift; p=mod(p+uBox*.5,uBox)-uBox*.5;
        p+=vec3(sin(uTime*.4+aR.w*20.),cos(uTime*.35+aR.w*13.),sin(uTime*.3+aR.w*7.))*.15;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=uSize*(0.5+aR.w)*480./max(0.3,-mv.z); vA=0.3+0.7*aR.w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOp; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(uColor*a*a*vA*uOp,1.); }`,
  });
}

/** drifting dust / plankton field, flows with scene.t so scrubbing moves it */
export function Plankton({ count, box, color, size = 0.05, flow = 0, drift = [0.05, 0.02, 0], center = [0, 0, 0] }: {
  count: number; box: [number, number, number]; color: THREE.ColorRepresentation; size?: number; flow?: number;
  drift?: [number, number, number]; center?: [number, number, number];
}) {
  const scene = useScene();
  const n = Math.floor(count * world.quality);
  const geo = useMemo(() => {
    const r = rng(11 + n);
    const a = new Float32Array(n * 4);
    for (let i = 0; i < a.length; i++) a[i] = r();
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    return g;
  }, [n]);
  const mat = useMemo(() => makePlanktonMat(color, size, box), [color, size, box]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(() => {
    if (!scene.active) return;
    const tm = TM();
    mat.uniforms.uTime.value = tm;
    mat.uniforms.uOp.value = scene.weight;
    (mat.uniforms.uDrift.value as THREE.Vector3).set(
      drift[0] * tm + flow * scene.t, drift[1] * tm, drift[2] * tm);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} position={center} />;
}

/** soft rays + gradient backdrop, locked to the camera as a billboard so it never reads as a floor */
export function Backdrop({ top, bottom, ray = 0.5, rays = true }: {
  top: THREE.ColorRepresentation; bottom: THREE.ColorRepresentation; ray?: number; z?: number; w?: number; h?: number; rays?: boolean;
}) {
  const scene = useScene();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uTop: { value: col(top) }, uBot: { value: col(bottom) }, uOp: { value: 1 }, uTime: { value: 0 }, uT: { value: 0 }, uRay: { value: rays ? ray : 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `${NOISE}
      uniform vec3 uTop,uBot; uniform float uOp,uTime,uT,uRay; varying vec2 vUv;
      void main(){ vec3 c=mix(uBot,uTop,smoothstep(0.,1.,vUv.y));
        float r=snoise(vec3(vUv.x*5.+vUv.y*1.4+uT*0.8,uTime*.06,1.))*.5+.5; r=pow(r,3.)*smoothstep(0.2,1.,vUv.y);
        gl_FragColor=vec4((c*(0.7+0.3*vUv.y)+uTop*r*uRay*1.5)*uOp,1.); }`,
  }), [top, bottom, ray, rays]);
  useEffect(() => () => mat.dispose(), [mat]);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    if (!scene.active) return;
    mat.uniforms.uOp.value = scene.weight; mat.uniforms.uTime.value = TM(); mat.uniforms.uT.value = rays ? scene.t : 0;
    const m = mesh.current; if (!m) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(dir);
    m.position.copy(cam.position).addScaledVector(dir, 60);
    m.quaternion.copy(cam.quaternion);
    const h = 2 * 60 * Math.tan((cam.fov * Math.PI) / 360) * 1.05;
    m.scale.set(h * cam.aspect, h, 1);
  });
  return <mesh ref={mesh} material={mat} renderOrder={-20} frustumCulled={false}><planeGeometry args={[1, 1]} /></mesh>;
}

/** lathe along +x with given radius profile; flatten squashes y */
export function latheX(profile: (x: number) => number, x0: number, x1: number, n = 80, seg = 40, flatten = 1) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push(new THREE.Vector2(Math.max(profile(x), 0.0008), x));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2);
  g.scale(1, flatten, 1);
  return g;
}

export function tubeBetween(pts: [number, number, number][], r: number, segs = 64, radial = 8, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(c, segs, r, radial, closed);
}

/* ------------------------------------------------------------------ brain tube */

export function makeBrainGeometry(nU = 200, nTh = 40) {
  const pos = new Float32Array((nU + 1) * (nTh + 1) * 3);
  const aU = new Float32Array((nU + 1) * (nTh + 1));
  const aTh = new Float32Array((nU + 1) * (nTh + 1));
  const idx: number[] = [];
  for (let i = 0; i <= nU; i++) {
    for (let j = 0; j <= nTh; j++) {
      const k = i * (nTh + 1) + j;
      aU[k] = i / nU; aTh[k] = (j / nTh) * Math.PI * 2;
      if (i < nU && j < nTh) {
        const a = k, b = k + 1, c = k + nTh + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setAttribute('aTh', new THREE.BufferAttribute(aTh, 1));
  g.setIndex(idx);
  return g;
}

/**
 * Neural tube whose swellings (fore/mid/hind vesicles) grow, fold and split into hemispheres, all in the vertex shader.
 * u=0 rostral (+x), u=1 caudal (-x).
 */
export function makeBrainMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 1 }, uSw: { value: 0 }, uFold: { value: 0 }, uHemi: { value: 0 }, uWr: { value: 0 }, uTime: { value: 0 },
      uSig: { value: 0 }, uBoost: { value: 1 }, uLen: { value: 5 }, uFore: { value: 1 }, uMid: { value: 1 }, uHind: { value: 1 },
      uForeC: { value: col('#ffb347') }, uMidC: { value: col('#42e8ff') }, uHindC: { value: col('#c06bff') },
      uRim: { value: 1.5 }, uBase: { value: 0.12 }, uR0: { value: 0.11 }, uSplit: { value: 0 },
    },
    vertexShader: /* glsl */ `${NOISE}
      attribute float aU; attribute float aTh; uniform float uSw,uFold,uHemi,uWr,uLen,uFore,uMid,uHind,uR0,uSplit,uTime;
      varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vTh;
      float gs(float u,float c,float w){ float d=(u-c)/w; return exp(-d*d); }
      void main(){
        float u=aU; float gF=gs(u,.14,.11)*.62*uFore, gM=gs(u,.38,.085)*.42*uMid, gH=gs(u,.62,.13)*.52*uHind;
        float taper=mix(1.,.8,smoothstep(.7,1.,u));
        float r=(uR0+uSw*(gF+gM+gH))*taper;
        float th=aTh; vec3 rd=vec3(0.,cos(th),sin(th));
        float foreW=gs(u,.14,.12);
        // dorsal midline cleft + width: forebrain splits into two hemispheres
        float cleft=pow(max(rd.y,0.),6.);
        r*=1.-uHemi*foreW*.34*cleft;
        float zf=1.+uHemi*foreW*.55+uSplit*foreW*.3;
        float x0=.5*uLen-uLen*u;
        float yc=-uFold*.95*pow(smoothstep(.5,0.,u),1.4)+uFold*.22*gs(u,.66,.12);
        float xc=x0+uFold*.35*smoothstep(.5,0.,u);
        vec3 p=vec3(xc,yc,0.)+vec3(0.,rd.y*r,rd.z*r*zf);
        float sw=(gF+gM+gH)*uSw;
        float n=snoise(p*3.2+vec3(0.,0.,uTime*.02))*.5+snoise(p*7.)*.25;
        p+=rd*n*uWr*.07*smoothstep(0.,.3,sw);
        vP=p; vU=u; vTh=th;
        vec3 nr=normalize(vec3(0.,rd.y,rd.z/zf)); vec4 mv=modelViewMatrix*vec4(p,1.);
        vN=normalize(normalMatrix*nr); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `${NOISE}
      uniform float uOpacity,uSig,uBoost,uRim,uBase,uWr,uTime; uniform vec3 uForeC,uMidC,uHindC;
      varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vTh;
      void main(){
        vec3 c=mix(uForeC,uMidC,smoothstep(.22,.3,vU)); c=mix(c,uHindC,smoothstep(.47,.54,vU));
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);
        float v=snoise(vP*5.+uTime*.05)*.5+.5; float web=smoothstep(.55,.95,v)*(.4+uWr);
        float d=fract(uSig-vU*3.); float pulse=exp(-d*6.);
        float spinal=1.-smoothstep(.7,.95,vU)*.55;
        vec3 col=c*(uBase+f*uRim+web*.5+pulse*.5*uBoost)*spinal+vec3(1.,.95,.85)*pulse*pulse*.25*uBoost;
        gl_FragColor=vec4(col*uOpacity,1.); }`,
  });
}

export function useBrain(nU = 200, nTh = 40) {
  const geo = useMemo(() => makeBrainGeometry(nU, nTh), [nU, nTh]);
  const mat = useMemo(() => makeBrainMat(), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return { geo, mat };
}

/** shared frame glue: set opacity uniform on many materials from scene weight */
export function setOpacity(mats: THREE.ShaderMaterial[], w: number) {
  for (const m of mats) m.uniforms.uOpacity.value = w;
}
