import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

export default function Agriculture() {
  const scene = useScene();
  const { lgeo, lmat, pgeo, pmat } = useMemo(() => {
    const lb = new LBuf(81);
    const pb = new PBuf(82);
    const r = lb.r;
    const q = world.quality;
    const cells = 3 * 3;
    const centres: [number, number][] = [];
    for (let i = 0; i < cells; i++) {
      const gx = i % 3, gz = Math.floor(i / 3);
      const cx = (gx - 1) * 4.6 + (r() - 0.5) * 1.2, cz = (gz - 1) * 2.8 - 0.4 + (r() - 0.5) * 0.6;
      const w = 1.5 + r() * 0.8, d = 0.9 + r() * 0.6, rot = (r() - 0.5) * 0.7;
      centres.push([cx, cz]);
      const nx = Math.floor((w / 0.1) * q * 1.0), nz = Math.floor(d / 0.075);
      const order = (i * 0.1) + r() * 0.04;
      for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
        const lx = (a / nx - 0.5) * 2 * w + (r() - 0.5) * 0.04, lz = (c / nz - 0.5) * 2 * d + (r() - 0.5) * 0.04;
        const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot), z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
        const pr = r();
        lb.seg([x, 0, z], [x, 1, z], 0, 1, [1, 1, 1], i, { aF: [order, pr, 0.7 + r() * 0.6] });
      }
      // settlement nearby
      const sa = r() * 6.283;
      const sx = cx + Math.cos(sa) * (w + 0.5), sz = cz + Math.sin(sa) * (d + 0.4);
      for (let k = 0; k < 45; k++) {
        const hx = sx + (r() - 0.5) * 0.7, hz = sz + (r() - 0.5) * 0.5;
        pb.add(hx, 0.04 + r() * 0.04, hz, [2.0, 1.2, 0.5], i, { aO: [order + 0.05 + r() * 0.12] });
      }
    }
    const lmat = lineMat({
      decl: 'attribute vec3 aF; uniform float uSeason;',
      uniforms: { uSeason: { value: 0 } },
      body: `
      float order = aF.x;
      float on = smoothstep(order, order+.06, uT*1.2);
      float season = fract(uSeason + aSeed.w*.11 + aF.y*.04);
      float grow = smoothstep(0.02,.6,season)*(1.-smoothstep(.93,.99,season));
      float ripe = smoothstep(.5,.85,season);
      float h = grow*aF.z*.3*aG;
      p.y = h;
      p.x += sin(uTime*1.5 + p.z*3. + aSeed.x*6.)*.03*aG*grow;
      vec3 green = vec3(.15,1.0,.35), gold = vec3(2.0,1.3,.25);
      col = mix(green, gold, ripe) * (.25+.9*aG);
      a = on*(.25+.55*aG)*step(.02,grow);`,
    });
    const pmat = pointMat({
      decl: 'attribute float aO;', size: 1.1,
      body: `
      float on = smoothstep(aO, aO+.04, uT*1.2);
      a = on*(.7+.3*sin(uTime*2.+aSeed.x*40.));
      size = .5+.4*on;`,
    });
    void centres;
    return { lgeo: lb.build(), lmat, pgeo: pb.build(), pmat };
  }, []);
  useEffect(() => () => { lgeo.dispose(); pgeo.dispose(); lmat.dispose(); pmat.dispose(); }, [lgeo, pgeo, lmat, pmat]);

  useFrame((state) => {
    if (!scene.active) return;
    tickU(lmat, scene);
    lmat.uniforms.uSeason.value = scene.t * 3.2 + (world.reduced ? 0 : world.time * 0.03);
    tickU(pmat, scene, state.gl.getPixelRatio());
  });
  return (
    <group>
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
    </group>
  );
}
