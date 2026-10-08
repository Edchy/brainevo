import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

export default function Burial() {
  const scene = useScene();
  const { geo, mat, lgeo, lmat, ground } = useMemo(() => {
    const b = new PBuf(71);
    const r = b.r;
    const q = world.quality;
    // 0 flame
    for (let i = 0; i < 900 * q; i++) b.add(0, 0, 0, [1, 1, 1], 0);
    // 5 halo
    for (let i = 0; i < 14; i++) b.add(0, 0, 0, [1, 1, 1], 5);
    // 1 motes
    for (let i = 0; i < 1400 * q; i++) {
      const a = r() * 6.283, rad = Math.sqrt(r()) * 7;
      b.add(Math.cos(a) * rad, 0, Math.sin(a) * rad - 1, [1, 1, 1], 1);
    }
    // 2 flowers (around the grave)
    const fcols: [number, number, number][] = [[1.7, 1.7, 1.9], [1.8, 1.5, .5], [.8, 1.1, 2.0], [1.9, .8, 1.1]];
    for (let f = 0; f < 11; f++) {
      const a = (f / 11) * 6.283 + r() * 0.5, rad = 1.5 + r() * 0.9;
      const cx = Math.cos(a) * rad * 1.2, cz = Math.sin(a) * rad * 0.8;
      const col = fcols[f % 4];
      const stem = 0.14 + r() * 0.12;
      for (let p = 0; p < 7; p++) {
        const pa = (p / 7) * 6.283;
        for (let k = 0; k < 4; k++) b.add(cx + Math.cos(pa) * 0.045 * (k + 1) * 0.6, stem + 0.01 * k, cz + Math.sin(pa) * 0.045 * (k + 1) * 0.6, col, 2);
      }
      b.add(cx, stem, cz, [2, 1.7, .6], 2);
      for (let k = 0; k < 6; k++) b.add(cx, stem * (k / 6), cz, [.3, .9, .4], 2);
    }
    // 3 grave outline + ochre scatter
    for (let i = 0; i < 260 * q; i++) {
      const a = (i / (260 * q)) * 6.283;
      b.add(Math.cos(a) * 1.0, 0.0, Math.sin(a) * 0.55, [1.3, .9, .6], 3);
    }
    for (let i = 0; i < 700 * q; i++) {
      const a = r() * 6.283, rad = Math.sqrt(r());
      b.add(Math.cos(a) * rad * 0.95, 0.0, Math.sin(a) * rad * 0.5, [1.6, .35, .12], 3);
    }
    // 4 distant fires
    const fires: [number, number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.283, rad = 3.2 + Math.pow(r(), 0.8) * 13;
      fires.push([Math.cos(a) * rad, 0, Math.sin(a) * rad * 0.9 - 2.5]);
    }
    fires.forEach((fp, i) => {
      const when = 0.12 + (Math.hypot(fp[0], fp[2] + 2.5) / 16) * 0.8;
      for (let k = 0; k < 8; k++) b.add(fp[0], 0, fp[2], [1, 1, 1], 4, { aW: [when] });
      void i;
    });
    // flame/others: aW default 0
    const total = b.count;
    const aw = new Array(total).fill(0);
    // fill aW for first (total - fires*8) with 0 and the fires with their value
    const nf = fires.length * 8;
    for (let i = 0; i < nf; i++) aw[total - nf + i] = b.ex.aW[i];
    b.ex.aW = aw;
    const mat = pointMat({
      decl: 'attribute float aW; uniform float uNet; uniform float uFlick;',
      uniforms: { uNet: { value: 0 }, uFlick: { value: 0 } },
      size: 0.9,
      body: `
      float k = aSeed.w;
      float fl = .85+.15*sin(uTime*9.+sin(uTime*4.)*2.);
      if (k < .5) {
        float ph = fract(aSeed.x + uTime*.6 + uT*3.);
        float h = ph*.75;
        float rad = (1.-ph)*.13*(.3+aSeed.z);
        float an = aSeed.y*6.283 + uTime*3.;
        p = vec3(cos(an)*rad + sin(uTime*5.+ph*7.)*.03*ph, .07+h, sin(an)*rad);
        col = mix(vec3(2.4,1.4,.45), vec3(1.7,.4,.1), ph);
        a = pow(1.-ph,1.4)*.9*fl; size = .9*(1.-ph)+.25;
      } else if (k < 1.5) {
        float y = fract(aSeed.y + uTime*.02 + uT*.35)*5.;
        p = vec3(position.x + sin(uTime*.3+aSeed.x*30.)*.4, y-.2, position.z + cos(uTime*.25+aSeed.z*20.)*.4);
        col = vec3(1.5,.55,.25);
        float d = length(p.xz*vec2(.6,.6));
        a = .35*(.3+.7*exp(-d*.3))*sin(3.14159*y/5.)*(.6+.6*sin(uTime*2.+aSeed.x*40.)); size = .35;
      } else if (k < 2.5) {
        a = .8*(.75+.25*sin(uTime*1.5+aSeed.x*20.)); size = .5; col = aCol*1.1;
        p.y += .01*sin(uTime+aSeed.x*10.);
      } else if (k < 3.5) {
        a = .5; size=.4; col = aCol*(.7+.4*sin(uTime*1.2+aSeed.x*30.));
        p.y += .005;
      } else if (k < 4.5) {
        float on = smoothstep(aW, aW+.08, uNet);
        float ph = fract(aSeed.x + uTime*.7);
        float h = ph*.28;
        float rad = (1.-ph)*.05*(.4+aSeed.z);
        p = vec3(position.x+cos(aSeed.y*6.28)*rad, .03+h, position.z+sin(aSeed.y*6.28)*rad);
        col = mix(vec3(2.2,1.2,.4), vec3(1.5,.35,.1), ph);
        a = on*pow(1.-ph,1.3)*1.5*(.8+.2*sin(uTime*8.+aSeed.z*30.)); size = 1.0*(1.-ph)+.3;
        a += on*.0;
      } else {
        float s = .9+.15*sin(uTime*3.+aSeed.x*6.);
        p = vec3(0., .25, 0.);
        col = vec3(1.7,.8,.3);
        a = (.05+.015*float(int(aSeed.x*14.)))*s*(.6+uFlick*.6); size = 4. + aSeed.x*14.;
      }
      `,
    });
    // network lines between fires
    const lb = new LBuf(72);
    fires.forEach((fp, i) => {
      const dists = fires.map((g, j) => [j, Math.hypot(g[0] - fp[0], g[2] - fp[2])] as const).filter(([j]) => j !== i).sort((a, c) => a[1] - c[1]).slice(0, 2);
      for (const [j] of dists) {
        if (j < i && dists.length) continue;
        const gp = fires[j];
        const wi = 0.12 + (Math.hypot(fp[0], fp[2] + 2.5) / 16) * 0.8, wj = 0.12 + (Math.hypot(gp[0], gp[2] + 2.5) / 16) * 0.8;
        const w = Math.max(wi, wj) + 0.06;
        // arc between fires, as a few segments
        const n = 8;
        let prev: [number, number, number] = [fp[0], 0.18, fp[2]];
        for (let s = 1; s <= n; s++) {
          const u = s / n;
          const cur: [number, number, number] = [fp[0] + (gp[0] - fp[0]) * u, 0.18 + Math.sin(u * Math.PI) * 0.35, fp[2] + (gp[2] - fp[2]) * u];
          lb.seg(prev, cur, w, w, [1.3, .8, .35], 0);
          prev = cur;
        }
      }
    });
    const lmat = lineMat({
      decl: 'uniform float uNet;',
      uniforms: { uNet: { value: 0 } },
      body: 'a = smoothstep(aG, aG+.1, uNet)*.35;',
    });
    const ground = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uW,uTime; varying vec2 vP;
      void main(){ float r=length(vP); float fl=.9+.1*sin(uTime*9.+sin(uTime*4.)*2.);
        vec3 c=vec3(.7,.3,.1)*exp(-r*r*.35)*fl*.35+vec3(.012,.01,.016);
        float edge=1.-smoothstep(10.,24.,r);
        gl_FragColor=vec4(c,uW*edge); }`,
    });
    return { geo: b.build(), mat, lgeo: lb.build(), lmat, ground };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); lgeo.dispose(); lmat.dispose(); ground.dispose(); }, [geo, mat, lgeo, lmat, ground]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e71 = eventPos('behavioural-modernity');
    const net = range(e71 - 0.9, e71 + 0.4, f);
    tickU(mat, scene, state.gl.getPixelRatio());
    mat.uniforms.uNet.value = net;
    mat.uniforms.uFlick.value = near(eventPos('burial-ritual'), 0.5);
    tickU(lmat, scene);
    lmat.uniforms.uNet.value = net;
    ground.uniforms.uW.value = scene.weight; ground.uniforms.uTime.value = world.reduced ? 0 : world.time;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={ground}><planeGeometry args={[60, 60]} /></mesh>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
    </group>
  );
}
