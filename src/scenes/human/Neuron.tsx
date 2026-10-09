import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU, type V3 } from './common';

// After Cajal's pen-and-ink pyramidal cell: a triangular soma, a tall apical dendrite with oblique branches and a terminal
// tuft, basal dendrites, thousands of fine spines, and a single axon with collaterals ending in boutons. Drawn in warm ink
// on dark parchment; the action potential is the one splash of colour (electric blue core, gold wake).
const PAPER_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW; varying vec2 vUv;
void main(){
  vec2 p=vUv-.5; float r=length(p*vec2(1.,1.15));
  float n=fbm(vec3(vUv*7.,3.))*.5+fbm(vec3(vUv*34.,9.))*.25;
  float fib=fbm(vec3(vUv.x*180.,vUv.y*12.,2.))*.5+fbm(vec3(vUv.x*12.,vUv.y*160.,5.))*.5;   // laid fibres
  float fox=smoothstep(.62,.8,fbm(vec3(vUv*4.5,11.)));                                       // foxing stains
  vec3 c=vec3(.55,.4,.2)*(.05+.06*n+.025*fib)*(1.-smoothstep(.1,.72,r));
  c+=vec3(.5,.28,.1)*fox*.03*(1.-smoothstep(.2,.7,r));
  gl_FragColor=vec4(c,uW);
}`;

const SOMA_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uPulse,uGrow; varying vec2 vUv;
float sdTri(vec2 p, vec2 a, vec2 b, vec2 c){
  vec2 e0=b-a,e1=c-b,e2=a-c; vec2 v0=p-a,v1=p-b,v2=p-c;
  vec2 pq0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.), pq1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.), pq2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.,1.);
  float s=sign(e0.x*e2.y-e0.y*e2.x);
  vec2 d=min(min(vec2(dot(pq0,pq0),s*(v0.x*e0.y-v0.y*e0.x)),vec2(dot(pq1,pq1),s*(v1.x*e1.y-v1.y*e1.x))),vec2(dot(pq2,pq2),s*(v2.x*e2.y-v2.y*e2.x)));
  return -sqrt(d.x)*sign(d.y);
}
void main(){
  vec2 p=(vUv-.5)*1.4;
  float d=sdTri(p,vec2(0.,.44),vec2(-.33,-.28),vec2(.33,-.28))-.0;
  d-=.1;
  d+=(fbm(vec3(p*6.,2.))-.5)*.02;
  float body=smoothstep(.006,-.006,d);
  float z=smoothstep(0.,-.22,d);
  float grain=fbm(vec3(p*34.,4.));
  vec3 ink=vec3(1.5,1.05,.55);
  // stippled cytoplasm, denser toward the membrane (as in a stippled engraving), with a darker nucleus
  float stip=step(.55,h21(floor(p*210.)))*(.35+.65*(1.-z));
  float nuc=smoothstep(.12,.1,length(p-vec2(0.,-.02)));
  float nucl=smoothstep(.03,.02,length(p-vec2(.02,.0)));
  vec3 c=ink*(.07+.16*(1.-z)+.2*stip*grain)*body;
  c*=1.-.6*nuc;
  c+=vec3(2.2,1.4,.4)*nucl*body*.35;
  c+=ink*exp(-pow(d/.014,2.))*.55;                         // membrane line
  // the impulse passes through the soma
  c+=vec3(.35,.75,3.)*(body*(1.-.5*nuc))*uPulse*.45 + vec3(2.4,1.5,.4)*body*uPulse*.12;
  gl_FragColor=vec4(c*smoothstep(.0,.15,uGrow),max(body,exp(-pow(d/.014,2.))*.8)*uW);
}`;

export function buildNeuron(rx: () => number) {
  type Seg = { a: V3; b: V3; g0: number; g1: number; w: number; kind: number; par: number };
  const segs: Seg[] = [];
  const heads: V3[] = [];          // spine heads / boutons
  const bout: V3[] = [];
  const step = 0.055;
  const grow = (p0: V3, ang: number, len: number, depth: number, g: number, w: number, kind: number, opts: { curl: number; tropism: number; branchP: number; maxDepth: number; spines: number; lenDecay: number; tuft?: boolean; arbor?: boolean }) => {
    let x = p0[0], y = p0[1], z = p0[2];
    let th = ang;                              // angle in the drawing plane (0 = +x, pi/2 = +y)
    const n = Math.max(3, Math.floor(len / step));
    let nextBranch = 6 + Math.floor(rx() * 6);
    for (let i = 0; i < n; i++) {
      th += (rx() - 0.5) * opts.curl;
      // tropism pulls toward a preferred angle
      const dth = Math.atan2(Math.sin(opts.tropism - th), Math.cos(opts.tropism - th));
      th += dth * 0.02;
      const nx = x + Math.cos(th) * step, ny = y + Math.sin(th) * step, nz = z + (rx() - 0.5) * 0.03;
      const wi = w * (1 - 0.5 * (i / n));
      segs.push({ a: [x, y, z], b: [nx, ny, nz], g0: g, g1: g + step, w: wi, kind, par: 0 });
      g += step;
      // spines along dendrites
      if (kind === 0 && rx() < opts.spines) {
        const side = rx() < 0.5 ? -1 : 1;
        const sa = th + side * (1.2 + rx() * 0.5);
        const L = 0.05 + rx() * 0.06;
        const sx = nx + Math.cos(sa) * L, sy = ny + Math.sin(sa) * L;
        segs.push({ a: [nx, ny, nz], b: [sx, sy, nz], g0: g, g1: g + 0.03, w: 0.25, kind: 2, par: 0 });
        heads.push([sx, sy, nz]);
      }
      x = nx; y = ny; z = nz;
      nextBranch--;
      if (nextBranch <= 0 && depth < opts.maxDepth && n - i > 6) {
        nextBranch = 5 + Math.floor(rx() * 9);
        const sp = (0.35 + rx() * 0.55) * (rx() < 0.5 ? -1 : 1);
        if (rx() < opts.branchP) grow([x, y, z], th + sp, (n - i) * step * opts.lenDecay * (0.5 + rx() * 0.4), depth + 1, g, w * 0.7, kind, opts);
        if (rx() < opts.branchP * 0.45) grow([x, y, z], th - sp * 0.8, (n - i) * step * opts.lenDecay * 0.45, depth + 1, g, w * 0.6, kind, opts);
      }
    }
    if (kind === 0 && depth === 0 && opts.tuft) {          // terminal tuft of the apical dendrite
      for (let k = 0; k < 6; k++) grow([x, y, z], Math.PI / 2 + (k - 2.5) * 0.42 + (rx() - 0.5) * 0.15, 0.55 + rx() * 0.4, 2, g, w * 0.5, 0, { ...opts, tuft: false, maxDepth: 4, curl: 0.4, tropism: Math.PI / 2 + (k - 2.5) * 0.3, lenDecay: 0.6 });
    }
    if (kind === 1 && depth === 1 && opts.arbor) {          // terminal arbor of the axon
      for (let k = 0; k < 5; k++) grow([x, y, z], -Math.PI / 2 + (k - 2) * 0.5, 0.5 + rx() * 0.4, 2, g, w * 0.5, 1, { ...opts, arbor: false, curl: 0.35, tropism: -Math.PI / 2 + (k - 2) * 0.35, branchP: 0.5, maxDepth: 3 });
    }
    if (kind === 0 && depth >= 1) heads.push([x, y, z]);
    if (kind === 1 && depth >= 1) bout.push([x, y, z]);
    return g;
  };
  const dopts = { curl: 0.5, tropism: Math.PI / 2, branchP: 0.8, maxDepth: 4, spines: 0.42, lenDecay: 0.65 };
  const S: V3 = [0, 0, 0];
  // apical dendrite: tall, slightly wandering, with oblique branches along its length, ending in a tuft
  grow([0, 0.34, 0], Math.PI / 2 + 0.06, 2.9, 0, 0, 1, 0, { ...dopts, curl: 0.2, tropism: Math.PI / 2, branchP: 1, maxDepth: 4, lenDecay: 0.75, tuft: true });
  // basal dendrites: radiating out and down from the soma's base
  const basal = [3.5, 3.95, 4.4, 4.85, 2.95, 5.3];
  basal.forEach((a, i) => {
    grow([Math.cos(a) * 0.2, -0.24 + Math.sin(a) * 0.05, 0], a + 0.1, 1.5 + rx() * 1.2, 1, 0, 0.8, 0, { ...dopts, tropism: a + (rx() - 0.5) * 0.4, curl: 0.4, maxDepth: 3, lenDecay: 0.75, branchP: 0.95 });
    void i;
  });
  // axon: smooth, thin, emerging from the base and descending with right-angled collaterals, ending in a terminal arbor
  const aopts = { curl: 0.1, tropism: -Math.PI / 2, branchP: 0.35, maxDepth: 2, spines: 0, lenDecay: 0.6, arbor: true };
  grow([0.0, -0.3, 0], -Math.PI / 2 + 0.04, 3.6, 1, 0, 0.55, 1, aopts);
  void S;
  return { segs, heads, bout };
}

export default function Neuron() {
  const scene = useScene();
  const { lgeo, lmat, sgeo, smat, hgeo, hmat, paper, soma, bgeo, bmat } = useMemo(() => {
    const lb = new LBuf(131);
    const r = lb.r;
    const { segs, heads, bout } = buildNeuron(r);
    // normalise growth by the longest path, and give every segment a position along the signal's route
    // (tips of dendrites -> soma -> along the axon to its terminals)
    let gD = 1e-3, gA = 1e-3, gAll = 1e-3;
    for (const s of segs) { gAll = Math.max(gAll, s.g1); if (s.kind === 1) gA = Math.max(gA, s.g1); else gD = Math.max(gD, s.g1); }
    // find per-kind max for signal timing, using the first (longest) dendrite lengths
    for (const s of segs) {
      const sig = s.kind === 1 ? 0.42 + (s.g0 / gA) * 0.58 : (1 - Math.min(1, s.g0 / gD)) * 0.42;
      const dim = 0.5 + s.w * 0.6;
      const ink: V3 = s.kind === 2 ? [1.5 * 0.6, 1.05 * 0.6, 0.55 * 0.6] : [1.55 * dim, 1.08 * dim, 0.52 * dim];
      lb.seg(s.a, s.b, s.g0 / gAll, s.g1 / gAll, ink, s.kind, { aW: [s.w], aT: [sig] });
    }
    const sb = new PBuf(132);
    // beads riding the impulse: sparse points on the route, large enough for the colour to read as a glowing pulse
    const bd = new PBuf(134);
    segs.forEach((sg, i) => {
      if (sg.kind === 2 || i % 3) return;
      const sig = sg.kind === 1 ? 0.42 + (sg.g0 / gA) * 0.58 : (1 - Math.min(1, sg.g0 / gD)) * 0.42;
      bd.add((sg.a[0] + sg.b[0]) / 2, (sg.a[1] + sg.b[1]) / 2, sg.a[2] + 0.01, [1, 1, 1], 0, { aT: [sig], aG: [sg.g0 / gAll] });
    });
    const hb = new PBuf(133);
    for (const h of heads) hb.add(h[0], h[1], h[2], [1.5, 1.05, .55], 0, { aG: [Math.min(1, 0.25 + r() * 0.7)] });
    for (const bt of bout) hb.add(bt[0], bt[1], bt[2], [2.2, 1.5, .5], 1, { aG: [0.9] });
    // stained speckle on the page
    for (let i = 0; i < 70 * world.quality; i++) sb.add((sb.r() - .5) * 16, (sb.r() - .5) * 8, -2 - sb.r() * 3, [1.2, .8, .3], 99);
    const lmat = lineMat({
      decl: 'attribute float aW; attribute float aT; uniform float uGrow,uPulse;',
      uniforms: { uGrow: { value: 0 }, uPulse: { value: 0 } },
      body: `
      float head = exp(-max(uGrow-aG,0.)*26.);
      float vis = step(aG, uGrow);
      float k = aSeed.w;
      float pp = fract(uTime*.16 + uT*1.2)*1.5-.25;       // the impulse sweeps tips -> soma -> axon
      float pulse = exp(-pow((aT - pp)*9.,2.))*uPulse;
      float wake = exp(-max(pp-aT,0.)*3.)*step(aT,pp)*uPulse;
      float spine = k > 1.5 ? .6 : 1.;
      a = vis*(.55 + 1.2*head)*spine*(.85+.15*sin(aSeed.x*40.)) + vis*pulse*aW*2.2 + vis*wake*.18;
      col = col*(1.+head*1.2) + vec3(.05,.3,1.7)*pulse*(.6+aW) + vec3(2.2,1.4,.3)*wake*.6;`,
    });
    const smat = pointMat({
      decl: 'uniform float uGrow;', uniforms: { uGrow: { value: 0 } }, size: 1.2,
      body: `
      if (aSeed.w > 90.) { a = .1*(.3+.7*pow(.5+.5*sin(uTime*.7+aSeed.x*60.),3.)); size=.4; }
      else { a = 0.; }`,
    });
    const hmat = pointMat({
      decl: 'attribute float aG; uniform float uGrow,uPulse;', uniforms: { uGrow: { value: 0 }, uPulse: { value: 0 } }, size: .5,
      body: `
      float vis = step(aG*.0+.0, uGrow)*smoothstep(aSeed.x*.9, aSeed.x*.9+.12, uGrow);
      float bout = aSeed.w > .5 ? 1. : 0.;
      float tw = .5+.5*sin(uTime*(1.+aSeed.y*2.)+aSeed.z*40.);
      a = vis*(.55+.25*tw)*(bout>.5?1.4:.85);
      size = bout>.5 ? .9 : .38 + .08*tw;
      col = col*(1.+uPulse*bout*.4) + vec3(.2,.5,2.4)*uPulse*bout*(.5+.5*tw)*.6;`,
    });
    const bmat = pointMat({
      decl: 'attribute float aT; attribute float aG; uniform float uGrow,uPulse;', uniforms: { uGrow: { value: 0 }, uPulse: { value: 0 } }, size: 1,
      body: `
      float pp = fract(uTime*.16 + uT*1.2)*1.5-.25;
      float core = exp(-pow((aT-pp)*14.,2.));
      float wake = exp(-max(pp-aT,0.)*5.)*step(aT,pp)*(1.-core);
      float vis = step(aG, uGrow);
      col = mix(vec3(2.4,1.5,.3), vec3(.02,.22,1.7), core);
      a = vis*uPulse*(core*1.1 + wake*.25);
      size = 1.5 + core*3.2 + wake*.8;`,
    });
    const paper = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uW: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: PAPER_FS,
    });
    const soma = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uGrow: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: SOMA_FS,
    });
    return { lgeo: lb.build(), lmat, sgeo: sb.build(), smat, hgeo: hb.build(), hmat, paper, soma, bgeo: bd.build(), bmat };
  }, []);
  useEffect(() => () => { bgeo.dispose(); bmat.dispose(); lgeo.dispose(); sgeo.dispose(); hgeo.dispose(); lmat.dispose(); smat.dispose(); hmat.dispose(); paper.dispose(); soma.dispose(); }, [bgeo, bmat, lgeo, sgeo, hgeo, lmat, smat, hmat, paper, soma]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('neuron-doctrine');
    const grow = range(e - 0.75, e + 0.2, f) * 1.15;
    const pulse = range(e - 0.2, e + 0.1, f) * (0.6 + 0.4 * near(e, 0.5));
    const pr = state.gl.getPixelRatio();
    tickU(lmat, scene);
    lmat.uniforms.uGrow.value = grow; lmat.uniforms.uPulse.value = pulse;
    tickU(smat, scene, pr); smat.uniforms.uGrow.value = grow;
    tickU(hmat, scene, pr); hmat.uniforms.uGrow.value = grow; hmat.uniforms.uPulse.value = pulse;
    tickU(bmat, scene, pr); bmat.uniforms.uGrow.value = grow; bmat.uniforms.uPulse.value = pulse;
    paper.uniforms.uW.value = scene.weight;
    const tm = world.reduced ? 0 : world.time;
    const pp = ((tm * 0.16 + scene.t * 1.2) % 1) * 1.5 - 0.25;
    soma.uniforms.uW.value = scene.weight; soma.uniforms.uTime.value = tm;
    soma.uniforms.uPulse.value = pulse * Math.exp(-Math.pow((0.42 - pp) * 9, 2));
    soma.uniforms.uGrow.value = grow;
  });
  return (
    <group position={[1.1, -0.05, 0]} scale={0.8}>
      <mesh position={[-0.5, 0.2, -6]} material={paper}><planeGeometry args={[40, 24]} /></mesh>
      <mesh position={[0, 0, 0.02]} material={soma}><planeGeometry args={[0.98, 0.98]} /></mesh>
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <points geometry={sgeo} material={smat} frustumCulled={false} />
      <points geometry={hgeo} material={hmat} frustumCulled={false} />
      <points geometry={bgeo} material={bmat} frustumCulled={false} />
    </group>
  );
}
