import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { easeOutExpo, range, rng, smoothstep } from '../../world/util';
import { Glow, NOISE, mkMat, fireRamp, makeGeo, pxScale, setGlow, useDispose } from './fx';

const shellVert = /* glsl */ `
attribute vec3 aDir; attribute vec4 aRand; attribute float aEnd;
uniform float uTb, uW;
varying vec3 vCol; varying float vA;
float front(float t){ return 6.2*(1.-exp(-3.2*t)); }
void main(){
  float sp=aRand.x;
  float tb=clamp(uTb-aRand.w*0.03,0.,1.);
  float R=front(tb);
  float vel=6.2*3.2*exp(-3.2*tb);                    // radial speed of the front
  float len=sp*(0.05+0.22*aRand.y)*vel*0.16*(1.-smoothstep(.35,.8,tb)) + 0.012;
  float r=max(R*sp-aEnd*len, 0.);
  vec3 p=aDir*r;
  float age=clamp(tb+(1.-sp)*0.12,0.,1.);
  vec3 white=vec3(4.2,4.0,3.8), warm=vec3(2.6,1.5,.7), ember=vec3(.9,.45,.25);
  vec3 c=mix(white,warm,smoothstep(.0,.2,age));
  c=mix(c,ember,smoothstep(.4,1.,age));
  float lead=smoothstep(.55,1.,sp);                 // the shell edge is the brightest, the interior stays dark
  float head=1.-aEnd;
  vCol=c*(0.012+0.2*lead*lead*lead)*mix(.15,1.,head)*(0.6+aRand.z);
  vA=smoothstep(0.,.012,tb)*(1.-smoothstep(.45,.95,tb))*uW;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const lineFrag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ gl_FragColor=vec4(vCol*vA,1.); }`;
const dotFrag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float a=1.-d; a*=a; gl_FragColor=vec4(vCol*a*vA,1.); }`;

const shimVert = /* glsl */ `
attribute vec3 aDir; attribute vec4 aRand;
uniform float uPx, uTime, uPre, uW;
varying vec3 vCol; varying float vA;
void main(){
  float wide=step(.55,aRand.z);
  float rad=mix(.04+.55*aRand.x*aRand.x, 1.2+5.*aRand.x, wide);
  vec3 j=vec3(sin(uTime*(14.+aRand.y*20.)+aRand.x*40.),cos(uTime*(11.+aRand.x*17.)+aRand.y*30.),sin(uTime*(17.+aRand.w*19.)+aRand.z*50.));
  vec3 p=aDir*rad+j*mix(.035,.12,wide)*(.4+uPre);
  float tw=pow(.5+.5*sin(uTime*(3.+aRand.y*9.)+aRand.w*60.),mix(2.,10.,wide));
  vCol=mix(vec3(1.4,1.5,2.4),vec3(2.2,1.6,1.2),aRand.y)*(0.5+tw);
  vA=uW*mix(.35,.35*tw,wide)*(0.15+.6*uPre);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp((.012+.01*aRand.y)*uPx/max(-mv.z,.1),1.,3.);
  gl_Position=projectionMatrix*mv;
}`;

const cmbFrag = /* glsl */ `
${NOISE}
uniform float uI; varying vec3 vD;
void main(){
  vec3 d=normalize(vD);
  float n=fbm(d*3.2)*.55+fbm(d*8.+4.)*.3+fbm(d*20.+9.)*.15;
  n=smoothstep(.25,.75,n);
  vec3 cold=vec3(.03,.1,1.), mid=vec3(.7,.35,.25), hot=vec3(1.,.12,.03);
  vec3 c=n<.5?mix(cold,mid,n*2.):mix(mid,hot,(n-.5)*2.);
  gl_FragColor=vec4(c*uI*(.35+.9*n),1.);
}`;

const ringFrag = /* glsl */ `
uniform float uI; varying vec3 vN; varying vec3 vV;
void main(){ float f=1.-abs(dot(normalize(vN),normalize(vV))); float g=pow(f,22.)+.015*pow(f,6.); gl_FragColor=vec4(vec3(2.6,2.3,2.0)*g*uI,1.); }`;

export default function BigBang() {
  const scene = useScene();
  const core = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const col = useMemo(() => new THREE.Color(), []);
  const q = world.quality;

  const { shellGeo, shimGeo, shellU, shimU } = useMemo(() => {
    const r = rng(1313);
    const n = Math.floor(22000 * q);
    const dir = new Float32Array(n * 6), rnd = new Float32Array(n * 8), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, z = r() * 2 - 1, s = Math.sqrt(1 - z * z);
      const d = [s * Math.cos(th), s * Math.sin(th), z];
      // a crisp leading shell, a thin trailing spray, almost nothing in between
      const sp = r() < 0.5 ? 1 - Math.pow(r(), 4) * 0.12 : r() < 0.55 ? 1 - Math.pow(r(), 1.4) * 0.45 : Math.pow(r(), 0.6) * 0.45;
      const v = [sp, r(), r(), r()];
      for (let k = 0; k < 2; k++) { dir.set(d, (i * 2 + k) * 3); rnd.set(v, (i * 2 + k) * 4); end[i * 2 + k] = k; }
    }
    const m = Math.floor(1800 * q);
    const d2 = new Float32Array(m * 3), r2 = new Float32Array(m * 4);
    for (let i = 0; i < m; i++) {
      const th = r() * Math.PI * 2, z = r() * 2 - 1, s = Math.sqrt(1 - z * z);
      d2.set([s * Math.cos(th), s * Math.sin(th), z], i * 3);
      r2.set([r(), r(), r(), r()], i * 4);
    }
    return {
      shellGeo: makeGeo(n * 2, { aDir: [dir, 3], aRand: [rnd, 4], aEnd: [end, 1] }),
      shimGeo: makeGeo(m, { aDir: [d2, 3], aRand: [r2, 4] }),
      shellU: { uTb: { value: 0 }, uPx: { value: 800 }, uW: { value: 1 } },
      shimU: { uPx: { value: 800 }, uTime: { value: 0 }, uPre: { value: 0 }, uW: { value: 1 } },
    };
  }, [q]);
  const cmbU = useMemo(() => ({ uI: { value: 0 } }), []);
  const ringU = useMemo(() => ({ uI: { value: 0 } }), []);
  const ringMesh = useRef<THREE.Mesh>(null);
  const cmbMesh = useRef<THREE.Mesh>(null);
  const shellPts = useRef<THREE.LineSegments>(null);
  const shimPts = useRef<THREE.Points>(null);
  const mats = useMemo(() => ({
    shim: mkMat(shimVert, dotFrag, shimU),
    shell: mkMat(shellVert, lineFrag, shellU),
    ring: mkMat(`varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`, ringFrag, ringU, { side: THREE.DoubleSide }),
    cmb: mkMat(`varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, cmbFrag, cmbU, { side: THREE.BackSide }),
  }), [shimU, shellU, ringU, cmbU]);
  useDispose(shellGeo, shimGeo, mats.shim, mats.shell, mats.ring, mats.cmb);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const w = scene.weight;
    const px = pxScale(state);
    const tb = range(-0.08, 0.75, f);
    const pre = range(-2, -0.1, f);
    const bang = smoothstep(-0.1, -0.02, f);
    shellU.uTb.value = tb; shellU.uPx.value = px; shellU.uW.value = w;
    shimU.uPx.value = px; shimU.uTime.value = world.reduced ? 0 : world.time; shimU.uPre.value = pre * (1 - bang * 0.9); shimU.uW.value = w * (1 - smoothstep(-0.02, 0.15, f));
    if (shimPts.current) shimPts.current.visible = f < 0.2;
    if (shellPts.current) shellPts.current.visible = f > -0.12;

    // the singularity: tense, pulsing, ominous
    const pulse = 1 + 0.12 * Math.sin(world.time * (3 + pre * 6)) * pre * (world.reduced ? 0 : 1);
    const coreScale = (0.2 + 0.28 * pre * pre) * pulse;
    const coreI = (1.2 + 2.6 * pre * pre) * (1 - bang) * w;
    setGlow(core.current, coreScale, coreI, 1, 0.97, 0.92, 0.9);

    // detonation flash
    const df = Math.max(f + 0.03, 0);
    const I = bang * (14 * Math.exp(-df * 26) + 0.55 * Math.exp(-df * 6) * (1 - range(0.05, 0.4, f)));
    const sc = 0.9 + 2.2 * easeOutExpo(range(-0.1, 0.3, f)) + 30 * Math.exp(-df * 30) * bang;
    fireRamp(range(-0.05, 0.6, f) * 0.7, col);
    setGlow(flash.current, sc, I * w, col.r, col.g, col.b, 0.3 * (1 - range(0, 0.3, f)));

    // inflation shock shell (rim only)
    if (ringMesh.current) {
      const rr = 0.05 + 6.2 * (1 - Math.exp(-3.2 * tb));
      ringMesh.current.scale.setScalar(rr);
      ringMesh.current.visible = f > -0.1 && f < 0.45;
      ringU.uI.value = w * 0.9 * (1 - range(0.0, 0.4, f)) * smoothstep(-0.1, -0.05, f);
    }
    // cosmic microwave background glow
    cmbU.uI.value = w * smoothstep(0.3, 0.6, f) * (1 - smoothstep(0.6, 0.95, f)) * 0.03;
    if (cmbMesh.current) cmbMesh.current.visible = cmbU.uI.value > 0.002;
  });

  return (
    <group>
      <points ref={shimPts} geometry={shimGeo} material={mats.shim} frustumCulled={false} />
      <lineSegments ref={shellPts} geometry={shellGeo} material={mats.shell} frustumCulled={false} />
      <mesh ref={ringMesh} visible={false} material={mats.ring}><sphereGeometry args={[1, 64, 40]} /></mesh>
      <mesh ref={cmbMesh} visible={false} material={mats.cmb}><sphereGeometry args={[70, 48, 32]} /></mesh>
      <Glow meshRef={flash} />
      <Glow meshRef={core} />
    </group>
  );
}
