import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { LBuf, PBuf, genNeuron, lineMat, pointMat, tickU } from './common';

const LAYERS = [3, 5, 5, 3];

export default function AiMirror() {
  const scene = useScene();
  const { nGeo, nMat, aGeo, aMat, eGeo, eMat, mGeo, mMat } = useMemo(() => {
    // biological neuron (left)
    const lb = new LBuf(161);
    const r = lb.r;
    const { segs } = genNeuron(r, 1.05);
    for (const s of segs) {
      const dim = 0.45 + s.w * 0.55;
      lb.seg([s.a[0] - 3.6, s.a[1] + 0.2, s.a[2]], [s.b[0] - 3.6, s.b[1] + 0.2, s.b[2]], s.g0, s.g1, [1.9 * dim, 1.25 * dim, .45 * dim], 0, { aW: [s.w] });
    }
    const nMat = lineMat({
      decl: 'attribute float aW; uniform float uShow,uPulse;', uniforms: { uShow: { value: 0 }, uPulse: { value: 0 } },
      body: `
      float vis = step(aG, uShow*1.1);
      float head = exp(-max(uShow*1.1-aG,0.)*30.);
      float pp = fract(uTime*.16 + uT*1.5);
      float pulse = exp(-pow((aG-pp)*8.,2.))*uPulse;
      a = vis*(.9+1.4*head+2.2*pulse*aW);`,
    });
    // artificial network (right), mirrored positions
    const net: [number, number, number][][] = [];
    const pb = new PBuf(162);
    LAYERS.forEach((n, li) => {
      const layer: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * 0.7 + 0.2;
        const x = 1.3 + li * 1.25;
        const z = (r() - 0.5) * 1.2;
        layer.push([x, y, z]);
        pb.add(x, y, z, [.5, 1.3, 2.3], li, { aL: [li, i / n] });
      }
      net.push(layer);
    });
    const eb = new LBuf(163);
    for (let li = 0; li < LAYERS.length - 1; li++) for (const a of net[li]) for (const b of net[li + 1]) {
      eb.seg(a, b, li, li + 1, [.4, 1.1, 2.0], 0);
    }
    const aMat = pointMat({
      decl: 'attribute vec2 aL; uniform float uFront,uShow;', uniforms: { uFront: { value: 0 }, uShow: { value: 0 } }, size: 2.2,
      body: `
      float lit = exp(-pow((uFront-aL.x)*1.5,2.));
      float on = smoothstep(aL.x/4., aL.x/4.+.2, uShow);
      col = mix(vec3(1.2,1.3,1.6),vec3(2.2,2.3,2.6),lit);
      a = on*(.6+.8*lit); size = 1.1+lit*1.0;`,
    });
    const eMat = lineMat({
      decl: 'uniform float uFront,uShow;', uniforms: { uFront: { value: 0 }, uShow: { value: 0 } },
      body: `
      float l = aG;  // 0..5 : layer index at this vertex
      float mid = floor(l+.5)<l ? l : l;
      float lit = exp(-pow((uFront-(l+.0))*1.6,2.));
      float on = smoothstep(floor(l)/4., floor(l)/4.+.2, uShow);
      col = mix(vec3(.2,.7,1.4), vec3(1.2,1.9,2.6), lit);
      a = on*(.17 + .8*lit*(.4+.6*aSeed.x));`,
    });
    // mirror line
    const mb = new PBuf(164);
    for (let i = 0; i < 140 * world.quality; i++) mb.add(0, (mb.r() - 0.5) * 7, (mb.r() - 0.5) * 1.2, [1, 1, 1], 0);
    const mMat = pointMat({
      size: 0.8,
      body: `
      float tw=pow(.5+.5*sin(uTime*(.8+aSeed.x*2.)+aSeed.y*50.),3.);
      p.x += sin(uTime*.5+p.y*2.)*.03;
      col=vec3(1.3,1.5,2.0); a=.5*(.2+tw)*(1.-abs(p.y)/3.8); size=.4+tw*.6;`,
    });
    return { nGeo: lb.build(), nMat, aGeo: pb.build(), aMat, eGeo: eb.build(), eMat, mGeo: mb.build(), mMat };
  }, []);
  useEffect(() => () => { nGeo.dispose(); aGeo.dispose(); eGeo.dispose(); mGeo.dispose(); nMat.dispose(); aMat.dispose(); eMat.dispose(); mMat.dispose(); }, [nGeo, aGeo, eGeo, mGeo, nMat, aMat, eMat, mMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('ai-mirror');
    const pr = state.gl.getPixelRatio();
    const show = range(e - 0.7, e + 0.1, f);
    const tm = world.reduced ? 0 : world.time;
    const front = ((tm * 0.35 + scene.t * 3.2) % 6) - 1;
    tickU(nMat, scene); nMat.uniforms.uShow.value = show; nMat.uniforms.uPulse.value = 0.4 + 0.6 * near(e, 0.7);
    tickU(aMat, scene, pr); aMat.uniforms.uShow.value = show * 1.2; aMat.uniforms.uFront.value = front;
    tickU(eMat, scene); eMat.uniforms.uShow.value = show * 1.2; eMat.uniforms.uFront.value = front;
    tickU(mMat, scene, pr);
  });
  return (
    <group position={[0.2, 0, 0]}>
      <lineSegments geometry={nGeo} material={nMat} frustumCulled={false} />
      <lineSegments geometry={eGeo} material={eMat} frustumCulled={false} />
      <points geometry={aGeo} material={aMat} frustumCulled={false} />
      <points geometry={mGeo} material={mMat} frustumCulled={false} />
    </group>
  );
}
