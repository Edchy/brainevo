import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

export default function Agriculture() {
  const scene = useScene();
  const { lgeo, lmat, pgeo, pmat } = useMemo(() => {
    const lb = new LBuf(81);
    const pb = new PBuf(82);
    const r = lb.r;
    const q = world.quality;
    // one field: ordered furrows, stalks that sprout, ripen and are cut, a few hearths at its edge
    const w = 3.3, d = 1.8, rot = -0.1;
    const nx = Math.floor(((w * 2) / 0.06) * Math.min(1, q + 0.3)), nz = Math.floor((d * 2) / 0.22);
    for (let c = 0; c < nz; c++) {
      for (let a = 0; a < nx; a++) {
        const lx = (a / nx - 0.5) * 2 * w + (r() - 0.5) * 0.02, lz = (c / nz - 0.5) * 2 * d + (r() - 0.5) * 0.015;
        const x = lx * Math.cos(rot) - lz * Math.sin(rot), z = lx * Math.sin(rot) + lz * Math.cos(rot) + 0.2;
        const order = (a / nx) * 0.35 + (c / nz) * 0.1 + r() * 0.02;
        lb.seg([x, 0, z], [x, 1, z], 0, 1, [1, 1, 1], 1, { aF: [order, r(), 0.8 + r() * 0.4] });
      }
    }
    for (let k = 0; k < 14; k++) {
      pb.add(w + 0.7 + (r() - 0.5) * 0.5, 0.05 + r() * 0.05, -0.2 + (r() - 0.5) * 0.5, [2.4, 1.8, 1.0], 0, { aO: [0.5 + r() * 0.2] });
    }
    const lmat = lineMat({
      decl: 'attribute vec3 aF; uniform float uSeason;',
      uniforms: { uSeason: { value: 0 } },
      body: `
      float order = aF.x;
      float on = smoothstep(order, order+.08, uT*1.6);
      float season = fract(uSeason + aF.y*.03);
      float grow = smoothstep(0.02,.6,season)*(1.-smoothstep(.93,.99,season));
      float ripe = smoothstep(.5,.85,season);
      float h = grow*aF.z*.55*aG;
      p.y = h;
      p.x += sin(uTime*1.5 + p.z*3. + aSeed.x*6.)*.03*aG*grow;
      vec3 green = vec3(.15,1.0,.35), gold = vec3(2.0,1.3,.25);
      col = mix(green, gold, ripe) * (.35+1.1*aG);
      a = on*(.3+.7*aG)*step(.02,grow);`,
    });
    const pmat = pointMat({
      decl: 'attribute float aO;', size: 1.1,
      body: `
      float on = smoothstep(aO, aO+.04, uT*1.2);
      a = on*(.7+.3*sin(uTime*2.+aSeed.x*40.));
      size = .5+.4*on;`,
    });
    return { lgeo: lb.build(), lmat, pgeo: pb.build(), pmat };
  }, []);
  useEffect(() => () => { lgeo.dispose(); pgeo.dispose(); lmat.dispose(); pmat.dispose(); }, [lgeo, pgeo, lmat, pmat]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('agriculture');
    tickU(lmat, scene);
    lmat.uniforms.uSeason.value = 0.1 + 0.8 * range(e - 0.5, e + 0.5, world.stationF) + (world.reduced ? 0 : Math.sin(world.time * 0.1) * 0.01);
    tickU(pmat, scene, state.gl.getPixelRatio());
  });
  return (
    <group>
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
    </group>
  );
}
