import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU, type V3 } from './common';
import { buildNeuron } from './Neuron';

// A biological neuron on the left, drawn in warm ink, and an artificial network on the right, drawn in cool light, with a
// mirror of light between them. One signal (electric blue core, gold wake) runs through the cell, crosses the mirror,
// and fires through the network.
const NEU_S = 0.7, NEU_X = -3.3, NEU_Y = 0.0;
const MIRROR_X = 0.1;
const LAYERS = [4, 6, 6, 3];
const NET_X0 = 1.5, NET_DX = 1.45;

const MIRROR_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uHit; varying vec2 vP;
void main(){
  vec2 p=vP;
  float ax=abs(p.x);
  float fade=smoothstep(3.9,.0,abs(p.y));
  float wob=(fbm(vec3(p.y*1.6,uTime*.2,1.))-.5)*.05;
  float core=exp(-pow((p.x-wob)/.01,2.));
  float glow=exp(-ax*ax*9.)*.06 + exp(-ax*ax*90.)*.12;
  // faint silvering: vertical streaks
  float streak=fbm(vec3(p.x*40.,p.y*1.5,3.))*exp(-ax*ax*30.);
  // ripple from the impact point when the signal hits
  vec2 q=p-vec2(0.,.0);
  float rr=length(q*vec2(1.6,1.));
  float rip=exp(-pow((rr-uHit*2.8)/.06,2.))*uHit*(1.-uHit)*4.*exp(-ax*2.);
  vec3 c=vec3(.85,.92,1.2)*(core*.7+glow+streak*.1)*fade;
  c+=vec3(.1,.35,1.5)*rip*.4;
  gl_FragColor=vec4(c*uW,1.);
}`;

const NODE_VS = /* glsl */ `
attribute vec4 aS; attribute float aT; uniform float uPh,uPx,uW,uTime,uH; varying float vL; varying float vA; varying float vO;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.);
  gl_Position=projectionMatrix*mv;
  float lit=exp(-pow((uPh-aT)*9.,2.))+.35*exp(-max(uPh-aT,0.)*5.)*step(aT,uPh);
  vL=lit; vO=aS.w;
  float rad=.2*(aS.w>.5?1.5:1.)*(1.+.25*lit);
  gl_PointSize=clamp(rad*projectionMatrix[1][1]*uH*.5/max(-mv.z,.1)*2.4,2.,160.);
  vA=uW;
}`;
const NODE_FS = /* glsl */ `varying float vL; varying float vA; varying float vO;
void main(){
  vec2 c=(gl_PointCoord-.5)*2.4; float r=length(c);
  float disc=smoothstep(1.,.92,r);
  float z=sqrt(max(1.-r*r,0.));
  float rim=exp(-pow((r-.92)/.05,2.));
  vec3 base=vec3(.5,.62,.9);
  vec3 hot=mix(vec3(.04,.22,1.0),vec3(1.2,.75,.15),vO*.85);
  vec3 col=base*(.02+.16*z*z)*disc + base*rim*.5 + hot*vL*(.4+.8*z)*disc + hot*exp(-r*r*3.)*vL*.5;
  float a=max(disc*.9,exp(-r*r*3.)*vL*.6);
  gl_FragColor=vec4(col*vA,a*vA);
}`;

export default function AiMirror() {
  const scene = useScene();
  const { nGeo, nMat, hGeo, hMat, bGeo, bMat, eGeo, eMat, gGeo, gMat, mirror, nodeGeo, nodeMat } = useMemo(() => {
    const lb = new LBuf(161);
    const hb = new PBuf(162);
    const bb = new PBuf(163);
    const { segs, heads, bout } = buildNeuron(lb.r);
    let gD = 1e-3, gA = 1e-3, gAll = 1e-3;
    for (const s of segs) { gAll = Math.max(gAll, s.g1); if (s.kind === 1) gA = Math.max(gA, s.g1); else gD = Math.max(gD, s.g1); }
    // rotate so the axon points toward the mirror (+x), then scale/translate
    const T = (v: V3): V3 => [NEU_X + -v[1] * NEU_S, NEU_Y + v[0] * NEU_S, v[2] * NEU_S];
    // global signal time: neuron occupies 0..0.5 (tips -> soma 0.2, soma -> axon end 0.5)
    const gt = (kind: number, g0: number) => (kind === 1 ? 0.2 + (g0 / gA) * 0.3 : (1 - Math.min(1, g0 / gD)) * 0.2);
    segs.forEach((s, i) => {
      const dim = 0.5 + s.w * 0.6;
      const ink: V3 = s.kind === 2 ? [0.95, 0.65, 0.33] : [1.55 * dim, 1.08 * dim, 0.52 * dim];
      lb.seg(T(s.a), T(s.b), s.g0 / gAll, s.g1 / gAll, ink, s.kind, { aW: [s.w], aT: [gt(s.kind, s.g0)] });
      if (s.kind !== 2 && i % 3 === 0) {
        const m = T([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, s.a[2] + 0.01]);
        bb.add(m[0], m[1], m[2], [1, 1, 1], 0, { aT: [gt(s.kind, s.g0)], aG: [s.g0 / gAll] });
      }
    });
    for (const h of heads) { const p = T(h); hb.add(p[0], p[1], p[2], [1.5, 1.05, .55], 0); }
    for (const bt of bout) { const p = T(bt); hb.add(p[0], p[1], p[2], [2.2, 1.5, .5], 1); }
    const nMat = lineMat({
      decl: 'attribute float aW; attribute float aT; uniform float uShow,uPh,uPulse;', uniforms: { uShow: { value: 0 }, uPh: { value: 0 }, uPulse: { value: 0 } },
      body: `
      float head = exp(-max(uShow*1.15-aG,0.)*26.);
      float vis = step(aG, uShow*1.15);
      float pulse = exp(-pow((aT-uPh)*14.,2.))*uPulse;
      float wake = exp(-max(uPh-aT,0.)*5.)*step(aT,uPh)*uPulse;
      float spine = aSeed.w > 1.5 ? .6 : 1.;
      a = vis*(.5+1.1*head)*spine + vis*pulse*aW*2.2 + vis*wake*.15;
      col = col*(1.+head) + vec3(.05,.3,1.7)*pulse*(.6+aW) + vec3(2.2,1.4,.3)*wake*.5;`,
    });
    const hMat = pointMat({
      decl: 'uniform float uShow;', uniforms: { uShow: { value: 0 } }, size: .45,
      body: `
      float vis = smoothstep(aSeed.x*.9, aSeed.x*.9+.12, uShow*1.15);
      float tw=.5+.5*sin(uTime*(1.+aSeed.y*2.)+aSeed.z*40.);
      float b = aSeed.w>.5?1.:0.;
      a = vis*(.5+.25*tw)*(1.+b*.5); size = b>.5 ? .8 : .36+.07*tw;`,
    });
    const bMat = pointMat({
      decl: 'attribute float aT; attribute float aG; uniform float uShow,uPh,uPulse;', uniforms: { uShow: { value: 0 }, uPh: { value: 0 }, uPulse: { value: 0 } }, size: 1,
      body: `
      float core = exp(-pow((aT-uPh)*16.,2.));
      float wake = exp(-max(uPh-aT,0.)*6.)*step(aT,uPh)*(1.-core);
      float vis = step(aG, uShow*1.15);
      col = mix(vec3(2.4,1.5,.3), vec3(.02,.22,1.7), core);
      a = vis*uPulse*(core*1.1 + wake*.22);
      size = 1.3 + core*2.8 + wake*.7;`,
    });
    // network
    const net: V3[][] = [];
    const nb = new PBuf(164);
    LAYERS.forEach((n, li) => {
      const layer: V3[] = [];
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * (n > 5 ? 0.78 : 1.0) + NEU_Y;
        layer.push([NET_X0 + li * NET_DX + (nb.r() - 0.5) * 0.06, y + (nb.r() - 0.5) * 0.08, (nb.r() - 0.5) * 0.3]);
      }
      net.push(layer);
    });
    const tLayer = (li: number) => 0.58 + li * 0.1;
    net.forEach((layer, li) => layer.forEach((p) => nb.add(p[0], p[1], p[2], [1, 1, 1], li === LAYERS.length - 1 ? 1 : 0, { aT: [tLayer(li)] })));
    const eb = new LBuf(165);
    for (let li = 0; li < LAYERS.length - 1; li++) for (const a of net[li]) for (const b of net[li + 1]) {
      const w = 0.25 + eb.r() * 0.75;
      const N = 12;
      let prev: V3 = a;
      for (let k = 1; k <= N; k++) {
        const u = k / N, e = u * u * (3 - 2 * u);
        const cur: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * u];
        eb.seg(prev, cur, (k - 1) / N, k / N, [0.35, 0.55, 1.0], 0, { aW: [w], aT: [tLayer(li)], aB: [tLayer(li + 1)] });
        prev = cur;
      }
    }
    const eMat = lineMat({
      decl: 'attribute float aW; attribute float aT; attribute float aB; uniform float uShow,uPh,uPulse;', uniforms: { uShow: { value: 0 }, uPh: { value: 0 }, uPulse: { value: 0 } },
      body: `
      float gtt = mix(aT, aB, aG);
      float on = smoothstep(aT-.1, aT, uShow);
      float pulse = exp(-pow((gtt-uPh)*16.,2.))*uPulse;
      float wake = exp(-max(uPh-gtt,0.)*7.)*step(gtt,uPh)*uPulse;
      a = on*(.1+.28*aW + pulse*(.8+aW*1.8) + wake*.1*aW);
      col = col + vec3(.1,.5,2.8)*pulse*aW + vec3(1.8,1.1,.25)*wake*aW*.4;`,
    });
    // glow beads on edges so the signal reads as coloured light, not a hairline
    const gb = new PBuf(166);
    for (let li = 0; li < LAYERS.length - 1; li++) for (const a of net[li]) for (const b of net[li + 1]) {
      if (gb.r() < 0.45) continue;
      const u = 0.15 + gb.r() * 0.7, e = u * u * (3 - 2 * u);
      gb.add(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * u, [1, 1, 1], 0, { aT: [tLayer(li) + (tLayer(li + 1) - tLayer(li)) * u], aG: [0] });
    }
    const gMat = pointMat({
      decl: 'attribute float aT; attribute float aG; uniform float uPh,uPulse,uShow;', uniforms: { uPh: { value: 0 }, uPulse: { value: 0 }, uShow: { value: 0 } }, size: 1,
      body: `
      float core = exp(-pow((aT-uPh)*16.,2.));
      float on = smoothstep(aT-.12, aT-.04, uShow);
      col = vec3(.02,.22,1.7);
      a = on*uPulse*core*.9; size = .6+core*2.0;`,
    });
    const mirror = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uHit: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: MIRROR_FS,
    });
    const nodeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uPh: { value: 0 }, uW: { value: 0 }, uTime: { value: 0 }, uH: { value: 800 }, uPx: { value: 1 } },
      vertexShader: NODE_VS, fragmentShader: NODE_FS,
    });
    return { nGeo: lb.build(), nMat, hGeo: hb.build(), hMat, bGeo: bb.build(), bMat, eGeo: eb.build(), eMat, gGeo: gb.build(), gMat, mirror, nodeGeo: nb.build(), nodeMat };
  }, []);
  useEffect(() => () => { for (const g of [nGeo, hGeo, bGeo, eGeo, gGeo, nodeGeo]) g.dispose(); for (const m of [nMat, hMat, bMat, eMat, gMat, mirror, nodeMat]) m.dispose(); }, [nGeo, hGeo, bGeo, eGeo, gGeo, nodeGeo, nMat, hMat, bMat, eMat, gMat, mirror, nodeMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('ai-mirror');
    const pr = state.gl.getPixelRatio();
    const show = range(e - 0.7, e + 0.1, f);
    const tm = world.reduced ? 0 : world.time;
    const ph = ((tm * 0.12 + scene.t * 1.1) % 1) * 1.3 - 0.1;   // 0..1 is the journey; some rest at both ends
    const pulse = 0.35 + 0.65 * near(e, 0.7);
    tickU(nMat, scene); nMat.uniforms.uShow.value = show; nMat.uniforms.uPh.value = ph; nMat.uniforms.uPulse.value = pulse;
    tickU(hMat, scene, pr); hMat.uniforms.uShow.value = show;
    tickU(bMat, scene, pr); bMat.uniforms.uShow.value = show; bMat.uniforms.uPh.value = ph; bMat.uniforms.uPulse.value = pulse;
    const nshow = range(0.0, 0.45, show) * 1.0 + 0.0;
    const netShow = range(0.35, 1.0, show) * 0.9 + show * 0.2;
    tickU(eMat, scene); eMat.uniforms.uShow.value = netShow; eMat.uniforms.uPh.value = ph; eMat.uniforms.uPulse.value = pulse;
    tickU(gMat, scene, pr); gMat.uniforms.uShow.value = netShow; gMat.uniforms.uPh.value = ph; gMat.uniforms.uPulse.value = pulse;
    void nshow;
    const hit = Math.max(0, Math.min(1, (ph - 0.5) / 0.3));
    mirror.uniforms.uW.value = scene.weight * range(0, 0.4, show); mirror.uniforms.uTime.value = tm; mirror.uniforms.uHit.value = ph > 0.5 && ph < 0.8 ? hit : 0;
    nodeMat.uniforms.uW.value = scene.weight * range(0.3, 0.8, show); nodeMat.uniforms.uPh.value = ph; nodeMat.uniforms.uTime.value = tm;
    nodeMat.uniforms.uH.value = state.size.height * pr;
  });
  return (
    <group position={[0.2, 0, 0]}>
      <mesh position={[MIRROR_X, 0, -0.05]} material={mirror}><planeGeometry args={[3, 9]} /></mesh>
      <lineSegments geometry={nGeo} material={nMat} frustumCulled={false} />
      <points geometry={hGeo} material={hMat} frustumCulled={false} />
      <points geometry={bGeo} material={bMat} frustumCulled={false} />
      <lineSegments geometry={eGeo} material={eMat} frustumCulled={false} />
      <points geometry={gGeo} material={gMat} frustumCulled={false} />
      <points geometry={nodeGeo} material={nodeMat} frustumCulled={false} />
    </group>
  );
}
