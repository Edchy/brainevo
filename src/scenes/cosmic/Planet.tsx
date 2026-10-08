import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { range, rng, smoothstep } from '../../world/util';
import { Glow, NOISE, gauss, mkMat, makeGeo, pxScale, setGlow, useDispose } from './fx';

const L = new THREE.Vector3(-0.8, 0.32, 0.5).normalize();

const planetVert = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

const planetFrag = /* glsl */ `
${NOISE}
uniform float uCrust, uOcean, uTime, uW, uHeat; uniform vec3 uL;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n=normalize(vN); vec3 V=normalize(cameraPosition-vW); vec3 d=normalize(vP);
  float f1=fbm(d*2.6+3.); float f2=fbm(d*8.+f1*2.);
  float diff=clamp(dot(n,uL),0.,1.);
  float ridge=abs(fbm(d*4.2+7.)-.5)*2.;
  float wc=mix(.9,.05,uCrust);
  float lava=1.-smoothstep(wc*.45,wc,ridge+f2*.04);
  float boil=.7+.6*fbm(d*14.+uTime*.15);
  float hotm=smoothstep(.3,.9,f2*boil+f1*.2);
  vec3 lavaC=mix(vec3(.55,.035,.0),vec3(2.4,.8,.12),hotm)*(.9+uHeat*.5)+vec3(2.5,1.4,.4)*pow(hotm,6.)*.5*(1.-uCrust);
  vec3 crustC=mix(vec3(.018,.012,.01),vec3(.1,.07,.055),f1)*(.25+.9*diff);
  vec3 land=mix(crustC,lavaC,lava);
  // ocean
  float o=smoothstep(0.,1.,uOcean*1.5-f1*.35+.05);
  vec3 H=normalize(uL+V);
  float fres=pow(1.-max(dot(n,V),0.),4.);
  vec3 water=vec3(.004,.03,.085)*(.3+diff*1.4)+vec3(.04,.12,.3)*fres*(.3+diff)+pow(max(dot(n,H),0.),90.)*vec3(1.3,1.6,2.)*diff*1.2;
  float island=smoothstep(.66,.7,f1+f2*.05)*step(.001,uOcean);
  vec3 islC=crustC*1.3;
  vec3 surf=mix(land,mix(water,islC,island),o);
  // terminator ember glow for lava on the night side stays (emissive)
  gl_FragColor=vec4(surf*uW,1.);
}`;

const cloudFrag = /* glsl */ `
${NOISE}
uniform float uCov, uTime, uW, uStorm, uCool; uniform vec3 uL; uniform float uF;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
float hh(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 n=normalize(vN); vec3 V=normalize(cameraPosition-vW); vec3 d=normalize(vP);
  float c=fbm(d*3.2+vec3(uF*.5,0.,uTime*.02))*.7+fbm(d*9.+uF*.3)*.3;
  float dens=smoothstep(1.02-uCov*.62,1.1-uCov*.55,c+uCov*.15);
  float diff=clamp(dot(n,uL),0.,1.);
  vec3 lit=mix(vec3(1.,.55,.3),vec3(.85,.9,1.),uCool);
  vec3 col=lit*(.04+.8*diff)+vec3(.55,.2,.06)*(1.-uCool)*.5;
  vec3 cell=floor(d*3.5);
  float tick=floor(uTime*5.);
  float fl=step(.985,hh(cell+tick))*uStorm*(1.-fract(uTime*5.));
  col+=vec3(.7,.8,1.)*fl*5.*smoothstep(.2,.9,c);
  float a=dens*uW;
  gl_FragColor=vec4(col*a,a);
}`;

const atmFrag = /* glsl */ `
uniform vec3 uC; uniform float uI; uniform vec3 uL; varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vec3 n=normalize(vN); vec3 V=normalize(cameraPosition-vW); float r=1.-max(dot(n,V),0.);
  float g=pow(r,3.2)*(.25+1.1*clamp(dot(n,uL)+.4,0.,1.)); gl_FragColor=vec4(uC*g*uI,1.); }`;

const dustVert = /* glsl */ `
${NOISE}
attribute vec4 aD;  // r, angle, height, rand
uniform float uF, uPx, uW, uRp;
varying vec3 vCol; varying float vA;
void main(){
  float flat_=mix(1.,.1,smoothstep(1.1,1.9,uF));
  float acc=smoothstep(1.3,2.5,uF);
  float r=aD.x*(1.-.55*acc*(1.-smoothstep(1.,9.,aD.x)));
  float ang=aD.y+uF*2.2/pow(max(r,.6),1.5);
  vec3 p=vec3(cos(ang)*r, aD.z*flat_*(1.+r*.15), sin(ang)*r);
  float hide=1.-smoothstep(2.0,2.7,uF);
  float nearp=smoothstep(uRp*1.05,uRp*1.6,length(p));
  float n=vnoise(vec3(p.x*.7,p.y*3.,p.z*.7));
  vCol=mix(vec3(.6,.32,.18),vec3(.35,.4,.6),n)*(.5+n);
  vA=uW*.9*hide*nearp*(.4+.8*n)*(1.-smoothstep(11.,14.,aD.x));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp((.07+.12*aD.w)*uPx/max(-mv.z,.1),1.,10.);
  gl_Position=projectionMatrix*mv;
}`;
const dotFrag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float a=1.-d; a*=a; gl_FragColor=vec4(vCol*a*vA,1.); }`;

const rockVert = /* glsl */ `
attribute vec4 aH;   // hitDir.xyz, hitTime
attribute vec4 aR;   // r0, spiral, size, rand
uniform float uF, uPx, uW, uRp;
varying vec3 vCol; varying float vA;
vec3 rotY(vec3 v,float a){ float c=cos(a), s=sin(a); return vec3(c*v.x+s*v.z, v.y, -s*v.x+c*v.z); }
void main(){
  float prog=clamp((uF-1.15)/(aH.w-1.15),0.,1.);
  float dt=uF-aH.w;
  vec3 start=rotY(aH.xyz*aR.x,(1.-prog)*aR.y*2.5);
  vec3 surf=aH.xyz*uRp*1.01;
  vec3 p=mix(start,surf,pow(prog,2.2));
  float flash=dt>0.?exp(-dt*28.):0.;
  float before=dt<0.?1.:0.;
  vCol=mix(vec3(1.4,.8,.5),vec3(5.,2.6,.9),flash);
  vA=uW*(before*(.35+.65*smoothstep(1.1,1.4,uF))+flash)*smoothstep(1.05,1.25,uF);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp((aR.z*(1.+flash*7.))*uPx/max(-mv.z,.1),1.,60.);
  gl_Position=projectionMatrix*mv;
}`;

const debrisVert = /* glsl */ `
attribute vec4 aV;   // dir*speed, rand
attribute vec4 aG;   // ring radius, ring angle, ring tilt, size
uniform float uF, uPx, uW, uRp; uniform vec3 uImp; uniform vec3 uMoon;
varying vec3 vCol; varying float vA;
void main(){
  float age=max(uF-2.07,0.);
  float on=step(2.07,uF);
  vec3 ball=uImp+aV.xyz*(1.-exp(-age*14.))*1.3;
  float ra=aG.y+uF*(2.8/pow(aG.x,1.5))*1.6;
  vec3 ring=vec3(cos(ra)*aG.x, sin(ra)*aG.x*aG.z+aV.w*.25, sin(ra)*aG.x*(1.-aG.z*aG.z)+cos(ra)*0.);
  ring=vec3(cos(ra)*aG.x, aV.w*.3*(1.-.5*smoothstep(2.3,2.7,uF)), sin(ra)*aG.x);
  vec3 p=mix(ball,ring,smoothstep(.04,.3,age));
  float acc=smoothstep(2.35,2.8,uF);
  p=mix(p,uMoon+(p-uMoon)*.04,acc);
  float cool=smoothstep(2.1,2.8,uF);
  vCol=mix(vec3(4.,1.8,.5),vec3(.9,.35,.12),cool);
  vA=uW*on*(1.-smoothstep(.93,1.,acc))*(.7+.3*aV.w);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp(aG.w*uPx/max(-mv.z,.1),1.,14.);
  gl_Position=projectionMatrix*mv;
}`;

export default function Planet() {
  const scene = useScene();
  const q = world.quality;
  const group = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const theia = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.Mesh>(null);
  const impact = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.DirectionalLight>(null);

  const pU = useMemo(() => ({ uCrust: { value: 0 }, uOcean: { value: 0 }, uTime: { value: 0 }, uW: { value: 1 }, uHeat: { value: 0 }, uL: { value: L } }), []);
  const cU = useMemo(() => ({ uCov: { value: 0 }, uTime: { value: 0 }, uW: { value: 1 }, uStorm: { value: 0 }, uCool: { value: 0 }, uL: { value: L }, uF: { value: 0 } }), []);
  const aU = useMemo(() => ({ uC: { value: new THREE.Color(1, 0.4, 0.1) }, uI: { value: 1 }, uL: { value: L } }), []);
  const dU = useMemo(() => ({ uF: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 }, uRp: { value: 1 } }), []);
  const rU = useMemo(() => ({ uF: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 }, uRp: { value: 1 } }), []);
  const bU = useMemo(() => ({ uF: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 }, uRp: { value: 1 }, uImp: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() } }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const impactDir = useMemo(() => new THREE.Vector3(-0.78, 0.18, 0.6).normalize(), []);

  const geos = useMemo(() => {
    const r = rng(404);
    const N = Math.floor(17000 * q);
    const D = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const rad = 1.4 + Math.pow(r(), 0.8) * 11;
      D.set([rad, r() * 6.2832, gauss(r) * 0.55, r()], i * 4);
    }
    const K = Math.floor(260 * q);
    const H = new Float32Array(K * 4), R = new Float32Array(K * 4);
    for (let i = 0; i < K; i++) {
      const th = r() * 6.2832, la = Math.asin(r() * 2 - 1);
      H.set([Math.cos(th) * Math.cos(la), Math.sin(la), Math.sin(th) * Math.cos(la), 1.45 + Math.pow(r(), 0.8) * 0.58], i * 4);
      R.set([3 + r() * 9, (r() - 0.3) * 2, 0.04 + r() * r() * 0.12, r()], i * 4);
    }
    const B = Math.floor(5000 * q);
    const V = new Float32Array(B * 4), G = new Float32Array(B * 4);
    for (let i = 0; i < B; i++) {
      const th = r() * 6.2832, z = r() * 2 - 1, s = Math.sqrt(1 - z * z);
      const sp = 1.5 + r() * 3.5;
      V.set([s * Math.cos(th) * sp, Math.abs(z) * sp * 0.5 + 0.3, s * Math.sin(th) * sp * 0.8, gauss(r)], i * 4);
      G.set([2.5 + r() * 2.6, r() * 6.2832, 0, 0.03 + r() * 0.07], i * 4);
    }
    return {
      dust: makeGeo(N, { aD: [D, 4] }),
      rocks: makeGeo(K, { aH: [H, 4], aR: [R, 4] }),
      debris: makeGeo(B, { aV: [V, 4], aG: [G, 4] }),
    };
  }, [q]);
  const mats = useMemo(() => ({
    dust: mkMat(dustVert, dotFrag, dU), rocks: mkMat(rockVert, dotFrag, rU), debris: mkMat(debrisVert, dotFrag, bU),
    planet: mkMat(planetVert, planetFrag, pU, { transparent: false, depthWrite: true, blending: THREE.NormalBlending }),
    cloud: mkMat(planetVert, cloudFrag, cU, { blending: THREE.NormalBlending }),
    atm: mkMat(planetVert, atmFrag, aU),
  }), [dU, rU, bU, pU, cU, aU]);
  useDispose(geos.dust, geos.rocks, geos.debris, mats.dust, mats.rocks, mats.debris, mats.planet, mats.cloud, mats.atm);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const w = scene.weight;
    const px = pxScale(state);
    const time = world.reduced ? 0 : world.time;
    const Rp = 0.25 + 1.35 * Math.pow(smoothstep(1.25, 2.05, f), 0.8);
    if (group.current) { group.current.scale.setScalar(Rp); group.current.rotation.y = f * 0.7; group.current.visible = f > 1.2; }
    const crust = smoothstep(2.2, 2.55, f);
    const ocean = smoothstep(2.4, 2.72, f);
    const cov = smoothstep(2.1, 2.35, f) * (1 - 0.68 * smoothstep(2.45, 2.75, f));
    const cool = smoothstep(2.2, 2.55, f);
    const storm = smoothstep(2.3, 2.45, f) * (1 - smoothstep(2.7, 2.85, f));
    const heat = smoothstep(1.4, 2.05, f);
    pU.uCrust.value = crust; pU.uOcean.value = ocean; pU.uTime.value = time; pU.uW.value = w; pU.uHeat.value = heat * (1 - crust);
    cU.uCov.value = cov * 0.9; cU.uTime.value = time; cU.uW.value = w * 0.92; cU.uStorm.value = storm; cU.uCool.value = cool; cU.uF.value = f;
    if (clouds.current) clouds.current.visible = f > 2.05;
    const ac = aU.uC.value as THREE.Color;
    ac.setRGB(1.3 - 1.15 * cool, 0.4 + 0.1 * cool, 0.1 + 1.1 * cool);
    aU.uI.value = w * (0.5 + 0.5 * smoothstep(1.4, 2, f));
    for (const u of [dU, rU, bU]) { u.uF.value = f; u.uPx.value = px; u.uW.value = w; u.uRp.value = Rp; }

    // proto-sun
    setGlow(sun.current, 7 + 2 * Math.sin(time * 0.5), 1.9 * w * smoothstep(1.2, 1.6, f), 1, 0.8, 0.55, 0.15);
    if (sun.current) sun.current.position.set(-15, 3.5, -7);

    // Theia, the Moon-forming impactor
    if (theia.current) {
      const a = range(1.86, 2.065, f);
      const p = a * a;
      impactDir.set(-0.78, 0.18, 0.6).normalize();
      const target = tmp.copy(impactDir).multiplyScalar(Rp * 0.95);
      theia.current.position.set(-9.5 + (target.x + 9.5) * p, 1.6 + (target.y - 1.6) * p, 3 + (target.z - 3) * p);
      theia.current.scale.setScalar(Math.max(0.01, 0.62 * (1 - 0.55 * p)));
      theia.current.visible = f > 1.86 && f < 2.07;
    }
    const im = Math.exp(-Math.abs(f - 2.07) * 11) * smoothstep(2.0, 2.07, f + 0.0) ;
    const flashI = f < 2.07 ? Math.exp(-(2.07 - f) * 60) * 1.5 : 7 * Math.exp(-(f - 2.07) * 14);
    if (impact.current) {
      impact.current.position.copy(impactDir).multiplyScalar(Rp * 1.05);
      setGlow(impact.current, 2.2 + 5 * range(2.07, 2.3, f), flashI * w * (im > -1 ? 1 : 0), 1, 0.7, 0.35, 0.6);
    }
    bU.uImp.value.copy(impactDir).multiplyScalar(Rp * 1.02);
    // the Moon
    const ma = 0.35 * smoothstep(2.4, 2.8, f);
    const mAng = 2.2 + f * 1.1;
    bU.uMoon.value.set(Math.cos(mAng) * 4.2, 0.35, Math.sin(mAng) * 4.2);
    if (moon.current) {
      moon.current.visible = ma > 0.01;
      moon.current.position.copy(bU.uMoon.value);
      moon.current.scale.setScalar(Math.max(ma, 0.001));
      const mat = moon.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.6 * (1 - smoothstep(2.6, 3.0, f));
    }
    if (light.current) light.current.intensity = 3.2 * w;
  });

  return (
    <group>
      <directionalLight ref={light} position={[-8, 3, 5]} intensity={3} />
      <ambientLight intensity={0.05} />
      <group rotation={[0.22, 0, 0.1]}>
        <points geometry={geos.dust} material={mats.dust} frustumCulled={false} />
      </group>
      <points geometry={geos.rocks} material={mats.rocks} frustumCulled={false} />
      <group ref={group} visible={false}>
        <mesh material={mats.planet}><sphereGeometry args={[1, 96, 64]} /></mesh>
        <mesh ref={clouds} scale={1.025} visible={false} material={mats.cloud}><sphereGeometry args={[1, 64, 48]} /></mesh>
        <mesh scale={1.14} material={mats.atm}><sphereGeometry args={[1, 64, 48]} /></mesh>
      </group>
      <mesh ref={theia} visible={false}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color={new THREE.Color(2.4, 1.0, 0.3)} toneMapped={false} />
      </mesh>
      <points geometry={geos.debris} material={mats.debris} frustumCulled={false} />
      <mesh ref={moon} visible={false}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshStandardMaterial color="#7d776f" roughness={0.95} emissive={new THREE.Color(1.6, 0.4, 0.1)} />
      </mesh>
      <Glow meshRef={sun} />
      <Glow meshRef={impact} />
    </group>
  );
}
