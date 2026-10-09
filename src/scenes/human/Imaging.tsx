import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';
import { Brain, useBrainCtl } from '../shared/brain';

export default function Imaging() {
  const scene = useScene();
  const brain = useBrainCtl({ grow: 1, holo: 1, holoColor: '#8fc4ff', tissue: '#cfc8c6' });
  const hot = useMemo(() => [
    { at: [0.55, 0.5, 0.3] as [number, number, number], r: 0.6, color: '#ff3a10', i: 0, sym: true },
    { at: [-0.35, 0.85, 0.25] as [number, number, number], r: 0.55, color: '#ff8a10', i: 0, sym: true },
    { at: [-0.85, 0.25, 0.2] as [number, number, number], r: 0.5, color: '#ffd020', i: 0, sym: true },
    { at: [0.2, -0.1, 0.35] as [number, number, number], r: 0.45, color: '#ff5a10', i: 0, sym: true },
  ], []);
  brain.regions = hot;
  const root = useRef<THREE.Group>(null);
  const { geo, mat, lgeo, lmat } = useMemo(() => {
    const b = new PBuf(141);
    const CH = 5;
    const N = Math.floor(900 * world.quality);
    for (let c = 0; c < CH; c++) for (let i = 0; i < N; i++) b.add(i / N, c, 0, [1, 1, 1], c);
    const mat = pointMat({
      decl: 'uniform float uMix;', uniforms: { uMix: { value: 0 } }, size: 0.8,
      body: `
      float s=position.x; float ch=position.y;
      float ph = s*(16.+ch*.7) - uT*22. - uTime*1.6 + ch*1.3;
      float alpha = sin(ph*1.0)*.5, beta = sin(ph*2.7+ch)*.22, theta = sin(ph*.5+ch*2.)*.35;
      float spike = pow(max(0.,sin(s*7.+ch*2.4-uT*10.)),24.)*sin(ph*6.)*.6;
      float env = pow(sin(3.14159*s),.6);
      float y = (alpha+beta+theta+spike)*.33*env*(1.-uMix*.85);
      p = vec3(mix(-5.2,5.2,s), (ch-2.)*.78*(1.-uMix*.5) + y*(ch==2.?1.4:1.) + .2, ch*.04);
      float head = exp(-pow((fract(s*1.-uT*3.-uTime*.08)-.5)*5.,2.));
      col = vec3(1.6,1.6,1.7);
      float hero = ch==2. ? 1. : .35;
      a = (.16+.7*head)*hero*env*(1.-uMix);
      size = .35+.5*head;`,
    });
    const lb = new LBuf(142);
    const ring = (rad: number, z: number, c: [number, number, number]) => { const n = 90; for (let i = 0; i < n; i++) { const a0 = (i / n) * 6.283, a1 = ((i + 1) / n) * 6.283; lb.seg([Math.cos(a0) * rad, Math.sin(a0) * rad, z], [Math.cos(a1) * rad, Math.sin(a1) * rad, z], 0, 1, c); } };
    ring(2.9, -0.5, [.4, .8, 1.8]); ring(3.05, -0.5, [.3, .6, 1.4]); ring(3.6, -1.2, [.3, .5, 1.2]);
    const lmat = lineMat({ body: 'a=.5*uMix;', decl: 'uniform float uMix;', uniforms: { uMix: { value: 0 } } });
    return { geo: b.build(), mat, lgeo: lb.build(), lmat };
  }, []);
  useEffect(() => () => { geo.dispose(); lgeo.dispose(); mat.dispose(); lmat.dispose(); }, [geo, lgeo, mat, lmat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e79 = eventPos('eeg'), e80 = eventPos('fmri');
    const mix = range(e79 + 0.2, e80 - 0.1, f);
    tickU(mat, scene, state.gl.getPixelRatio()); mat.uniforms.uMix.value = mix;
    tickU(lmat, scene); lmat.uniforms.uMix.value = mix;
    const tm = world.reduced ? 0 : world.time;
    const pulse = near(e80, 0.5);
    brain.alpha = scene.weight * Math.min(1, 0.25 + mix * 1.2);
    brain.holo = 1 - 0.55 * mix;
    brain.cut = mix > 0.15 ? 1 : 0; brain.cutAxis = 'sagittal'; brain.cutPos = 0.3 + 0.08 * Math.sin(scene.t * 6) * mix;
    hot.forEach((h, i) => {
      const act = Math.pow(0.5 + 0.5 * Math.sin(tm * 0.9 + i * 3.1 + scene.t * 14), 2);
      h.i = mix * (0.35 + 0.9 * act) * (0.7 + 0.5 * pulse) * 1.1;
    });
    if (root.current) { root.current.rotation.y = -0.15 + 0.1 * Math.sin(tm * 0.2); }
  });
  return (
    <group>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <group ref={root} position={[0, 0.15, 0]} rotation={[0.05, -0.15, 0]} scale={1.15}><Brain ctl={brain} /></group>
    </group>
  );
}
