import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, genNeuron, lineMat, pointMat, tickU } from './common';

const PAPER_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW; varying vec2 vUv;
void main(){
  vec2 p=vUv-.5; float r=length(p*vec2(1.,1.1));
  float n=fbm(vec3(vUv*7.,3.))*.5+fbm(vec3(vUv*30.,9.))*.25;
  vec3 c=vec3(.55,.4,.18)*(.05+.07*n)*(1.-smoothstep(.1,.7,r));
  gl_FragColor=vec4(c,uW);
}`;

export default function Neuron() {
  const scene = useScene();
  const { lgeo, lmat, sgeo, smat, paper } = useMemo(() => {
    const lb = new LBuf(131);
    const sb = new PBuf(132);
    const r = lb.r;
    const placements: [number, number, number, number, number][] = [
      // x, y, z, scale, rotZ
      [-4.2, 0.4, -1.5, 0.75, 0.15], [-2.4, -0.2, 0.2, 0.95, -0.1], [-0.3, 0.3, -0.8, 0.85, 0.05],
      [1.6, -0.3, 0.6, 1.0, 0.12], [3.6, 0.4, -0.4, 0.8, -0.15], [5.2, -0.1, -1.8, 0.7, 0.1],
    ];
    placements.forEach(([x, y, z, sc, rz], ni) => {
      const { segs } = genNeuron(r, sc);
      const delay = ni * 0.09;
      const co = Math.cos(rz), si = Math.sin(rz);
      const tr = (v: [number, number, number]): [number, number, number] => [x + v[0] * co - v[1] * si, y + v[0] * si + v[1] * co, z + v[2]];
      for (const s of segs) {
        const g0 = delay + s.g0 * (1 - delay * 1.2), g1 = delay + s.g1 * (1 - delay * 1.2);
        const dim = 0.45 + s.w * 0.55;
        lb.seg(tr(s.a), tr(s.b), g0, g1, [1.9 * dim, 1.25 * dim, 0.45 * dim], ni, { aW: [s.w] });
      }
      sb.add(x, y, z, [2.5, 1.8, .7], ni);
      for (let k = 0; k < 14; k++) sb.add(x + (sb.r() - .5) * .12 * sc, y + (sb.r() - .5) * .12 * sc, z + (sb.r() - .5) * .1, [2.0, 1.4, .5], ni);
    });
    // stained speckle
    for (let i = 0; i < 700 * world.quality; i++) sb.add((sb.r() - .5) * 16, (sb.r() - .5) * 8, -2 - sb.r() * 3, [1.2, .8, .3], 99);
    const lmat = lineMat({
      decl: 'attribute float aW; uniform float uGrow,uPulse;',
      uniforms: { uGrow: { value: 0 }, uPulse: { value: 0 } },
      body: `
      float head = exp(-max(uGrow-aG,0.)*30.);
      float vis = step(aG, uGrow);
      float ni = aSeed.w;
      float pp = fract(uTime*.13 + ni*.37 + uT*1.5);
      float pulse = exp(-pow((aG - pp)*9.,2.))*uPulse;
      a = vis*(.5 + 1.4*head + 1.6*pulse*aW);
      col = col*(1.+head*1.2) + vec3(.6,.5,.9)*pulse;`,
    });
    const smat = pointMat({
      decl: 'uniform float uGrow;', uniforms: { uGrow: { value: 0 } }, size: 1.2,
      body: `
      float ni = aSeed.w;
      float k = smoothstep(ni*.09, ni*.09+.1, uGrow);
      if (ni > 90.) { a = .12*(.3+.7*pow(.5+.5*sin(uTime*.7+aSeed.x*60.),3.)); size=.4; }
      else { a = k*(.35+.3*sin(uTime*2.+ni)); size = .5+.6*k; }`,
    });
    const paper = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uW: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: PAPER_FS,
    });
    return { lgeo: lb.build(), lmat, sgeo: sb.build(), smat, paper };
  }, []);
  useEffect(() => () => { lgeo.dispose(); sgeo.dispose(); lmat.dispose(); smat.dispose(); paper.dispose(); }, [lgeo, sgeo, lmat, smat, paper]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('neuron-doctrine');
    const grow = range(e - 0.75, e + 0.2, f) * 1.15;
    tickU(lmat, scene);
    lmat.uniforms.uGrow.value = grow;
    lmat.uniforms.uPulse.value = range(e - 0.2, e + 0.1, f) * (0.6 + 0.4 * near(e, 0.5));
    tickU(smat, scene, state.gl.getPixelRatio());
    smat.uniforms.uGrow.value = grow;
    paper.uniforms.uW.value = scene.weight;
  });
  return (
    <group position={[-0.5, 0, 0]}>
      <mesh position={[0.5, 0, -6]} material={paper}><planeGeometry args={[40, 24]} /></mesh>
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <points geometry={sgeo} material={smat} frustumCulled={false} />
    </group>
  );
}
