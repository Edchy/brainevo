import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const R = 2.3, HH = 2.5, NN = 300, NT = 30, TSEG = 24, TL = 3.8;
const NP = 6;

const BELL = /* glsl */ `
uniform float uB,uFront,uTime,uPx,uW,uNet,uSig; uniform vec3 uOrigin;
vec3 bellPos(vec3 u){ float fl=smoothstep(.5,-.15,u.y); float c=1.+.2*uB;
  return vec3(u.x*(1.+.32*fl)*c*${R.toFixed(2)}, u.y*${HH.toFixed(2)}*(1.-.18*uB), u.z*(1.+.32*fl)*c*${R.toFixed(2)}); }
float sigAt(vec3 u){ float ang=acos(clamp(dot(normalize(u),uOrigin),-1.,1.)); ang+=(vnoise(u*4.+3.)-.5)*.55;
  return exp(-pow((ang-uFront)*2.6,2.)) * uSig; }
`;

interface Jelly { pos: [number, number, number]; scale: number; phase: number; main: boolean; tilt: number }
const JELLIES: Jelly[] = [
  { pos: [0, 0.9, 0], scale: 1, phase: 0, main: true, tilt: 0 },
  { pos: [-6.2, 2.4, -5], scale: 0.7, phase: 0.33, main: false, tilt: 0.25 },
  { pos: [6.8, -0.4, -7], scale: 0.85, phase: 0.61, main: false, tilt: -0.3 },
];

function build() {
  const r = rng(555);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < NN; i++) {
    const y = 1 - (i + 0.5) / NN * 1.15, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963 + (r() - 0.5) * 0.25;
    pts.push(new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).normalize());
  }
  const edges: number[] = [];
  const seen = new Set<string>();
  pts.forEach((p, i) => {
    const ds = pts.map((q, j) => ({ j, d: p.distanceToSquared(q) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
    ds.forEach(({ j }) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(k)) { seen.add(k); edges.push(i, j); } });
  });
  const ep = new Float32Array(edges.length * 3);
  edges.forEach((id, k) => ep.set([pts[id].x, pts[id].y, pts[id].z], k * 3));
  const net = new THREE.BufferGeometry(); net.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const np = new Float32Array(NN * 3); pts.forEach((p, i) => np.set([p.x, p.y, p.z], i * 3));
  const nodes = new THREE.BufferGeometry(); nodes.setAttribute('position', new THREE.BufferAttribute(np, 3));
  // tentacles
  const tp = new Float32Array(NT * TSEG * 2 * 3), ta = new Float32Array(NT * TSEG * 2 * 3);
  for (let i = 0; i < NT; i++) {
    const a = (i / NT) * Math.PI * 2, rr = 0.2 + r() * 0.25;
    for (let s = 0; s < TSEG; s++) for (let e = 0; e < 2; e++) {
      const k = (i * TSEG + s) * 2 + e, ss = (s + e) / TSEG;
      tp.set([Math.cos(a), -0.05, Math.sin(a)], k * 3);
      ta.set([a, ss, rr], k * 3);
    }
  }
  const tent = new THREE.BufferGeometry();
  tent.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tent.setAttribute('aT', new THREE.BufferAttribute(ta, 3));
  const bell = new THREE.SphereGeometry(1, 72, 28, 0, Math.PI * 2, 0, Math.PI * 0.56);
  return { net, nodes, tent, bell };
}

function makeMats(U: Record<string, THREE.IUniform>, main: boolean) {
  const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U };
  const bell = new THREE.ShaderMaterial({
    ...base, side: THREE.DoubleSide,
    vertexShader: `${NOISE}${BELL} varying vec3 vU; varying vec3 vN; varying vec3 vV;
      void main(){ vU=position; vec3 p=bellPos(position); vec3 n=normalize(vec3(position.x*${HH.toFixed(2)},position.y*${R.toFixed(2)},position.z*${HH.toFixed(2)}));
        vec4 wp=modelMatrix*vec4(p,1.); vN=normalize(mat3(modelMatrix)*n); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${NOISE}${BELL} varying vec3 vU; varying vec3 vN; varying vec3 vV;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);
        float n=fbm(vU*3.+uTime*.1); float rim=smoothstep(.3,-.1,vU.y);
        float s=sigAt(vU)*uNet;
        vec3 c=vec3(.2,.55,1.)*(f*1.2+.03+.08*n)+vec3(.9,.3,1.)*rim*.35*(f+.2)+vec3(1.4,.6,1.6)*s*.5*(.4+f);
        c*=${main ? '1.' : '.55'};
        gl_FragColor=vec4(c*uW,1.); }`,
  });
  const net = new THREE.ShaderMaterial({
    ...base,
    vertexShader: `${NOISE}${BELL} varying float vS; varying float vA;
      void main(){ vec3 p=bellPos(position)*1.01; vS=sigAt(position); vA=uNet; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: 'varying float vS; varying float vA; void main(){ vec3 c=mix(vec3(.15,.4,.9)*.55,vec3(1.7,.9,2.)*1.4,clamp(vS,0.,1.)); gl_FragColor=vec4(c*vA*(.35+vS)*' + 'uWf' + ',1.); }'.replace('uWf', '1.0'),
  });
  net.fragmentShader = `uniform float uW; varying float vS; varying float vA; void main(){ vec3 c=mix(vec3(.2,.55,1.2)*.9,vec3(1.8,1.,2.2),clamp(vS,0.,1.)); gl_FragColor=vec4(c*vA*(.7+vS*1.6)*uW,1.); }`;
  const nodes = new THREE.ShaderMaterial({
    ...base,
    vertexShader: `${NOISE}${BELL} varying vec3 vC; varying float vA;
      void main(){ vec3 p=bellPos(position)*1.01; float s=sigAt(position); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.07+.12*s)*uPx/-mv.z); vC=mix(vec3(.4,.7,1.4),vec3(2.,1.2,2.4),clamp(s,0.,1.)); vA=uW*uNet*(.5+s); }`,
    fragmentShader: POINT_FRAG,
  });
  const tent = new THREE.ShaderMaterial({
    ...base,
    vertexShader: `${NOISE}${BELL} attribute vec3 aT; varying float vS; varying float vA;
      void main(){ vec3 u=vec3(cos(aT.x),-.05,sin(aT.x)); vec3 b=bellPos(u)*vec3(1.,1.,1.); float s=aT.y;
        float sway=sin(s*5.-uTime*1.6+aT.x*3.)*.35*s+sin(s*9.-uTime*2.3+aT.x*7.)*.08*s;
        vec3 p=b+vec3(sway*cos(aT.x+1.57),-s*${TL.toFixed(1)}*(1.-.12*uB)*(.55+aT.z*1.4),sway*sin(aT.x+1.57))+vec3(-u.x,0.,-u.z)*s*.35*(1.+uB);
        float front=uFront-1.55; vS=exp(-pow((s-front*.55)*4.5,2.))*uSig*step(0.,front)*uNet;
        vA=(1.-s*.75); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: 'uniform float uW; varying float vS; varying float vA; void main(){ vec3 c=mix(vec3(.5,.25,1.1)*.5,vec3(1.8,1.,2.2),clamp(vS,0.,1.)); gl_FragColor=vec4(c*vA*(.45+vS*1.6)*uW,1.); }',
  });
  return { bell, net, nodes, tent };
}

/** a diffuse nerve net lighting up a jellyfish: signals ripple outward from a random point and ring the rim */
export default function NerveNet() {
  const scene = useScene();
  const g = useMemo(build, []);
  const origins = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: NP }, () => new THREE.Vector3(r() * 2 - 1, 0.4 + r() * 0.6, r() * 2 - 1).normalize());
  }, []);
  const rigs = useMemo(() => JELLIES.map((j) => {
    const U = {
      uB: { value: 0 }, uFront: { value: 0 }, uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uNet: { value: 0 }, uSig: { value: 1 },
      uOrigin: { value: new THREE.Vector3(0, 1, 0) },
    };
    return { U, mats: makeMats(U, j.main), grp: { current: null as THREE.Group | null } };
  }), []);
  useDispose(g.net, g.nodes, g.tent, g.bell);
  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const net = smoothstep(0.1, 0.55, t);
    const pulse = near(eventPos('first-neurons-nerve-net'), 0.6);
    rigs.forEach((rg, i) => {
      const j = JELLIES[i];
      const q = t * NP + j.phase * 3;
      const k = Math.floor(q) % NP, fr = q - Math.floor(q);
      const front = fr * 4.6 - 0.4;
      const U = rg.U;
      U.uFront.value = front; U.uOrigin.value.copy(origins[(k + i * 2) % NP]);
      U.uB.value = Math.exp(-Math.pow((front - 1.85) * 1.1, 2)) * 1.0 - 0.15;
      U.uTime.value = time; U.uPx.value = px; U.uW.value = w * (j.main ? 1 : 0.65);
      U.uNet.value = j.main ? net : net * 0.8;
      U.uSig.value = (j.main ? 1 + pulse * 0.8 : 0.8);
      const gr = rg.grp.current;
      if (gr) {
        gr.position.set(j.pos[0], j.pos[1] + U.uB.value * 0.25 + Math.sin(t * 6 + j.phase * 9) * 0.1, j.pos[2]);
        gr.scale.setScalar(j.scale); gr.rotation.set(j.tilt, time * 0.04 + t * 0.6, 0);
      }
    });
  });
  return (
    <group>
      <Backdrop color="#2a5fd0" caustics={0.22} shafts={0.22} haze={0.12} />
      <Plankton count={1000} box={[24, 14, 12]} color="#8fb8ff" size={0.04} dir={[0.0, 0.05, 0]} />
      {JELLIES.map((j, i) => (
        <group key={i} ref={(gr) => { rigs[i].grp.current = gr; }}>
          <mesh geometry={g.bell} material={rigs[i].mats.bell} frustumCulled={false} />
          <lineSegments geometry={g.tent} material={rigs[i].mats.tent} frustumCulled={false} />
          {j.main && (
            <>
              <lineSegments geometry={g.net} material={rigs[i].mats.net} frustumCulled={false} />
              <points geometry={g.nodes} material={rigs[i].mats.nodes} frustumCulled={false} />
            </>
          )}
        </group>
      ))}
    </group>
  );
}
void world;
