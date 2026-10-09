import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { GLSL_UTIL, PBuf, pointMat, tickU } from './common';

type P2 = [number, number];
const GLYPHS: P2[][][] = [
  [[[-.4, -.5], [0, .5], [.4, -.5]], [[-.2, -.1], [.2, -.1]]],
  [[[.3, .5], [-.3, .5], [-.3, -.5], [.3, -.5]], [[-.3, 0], [.2, 0]]],
  [Array.from({ length: 13 }, (_, i) => [Math.cos((i / 12) * 6.283) * 0.4, Math.sin((i / 12) * 6.283) * 0.5] as P2)],
  [[[-.3, .5], [-.3, -.5]], [[-.3, 0], [.3, .5]], [[-.3, 0], [.3, -.5]]],
  [[[-.4, -.5], [-.4, .5], [0, 0], [.4, .5], [.4, -.5]]],
  [[[-.4, .5], [.4, .5]], [[0, .5], [0, -.5]]],
  [[[-.3, .5], [-.3, -.5], [.3, -.5]]],
  [[[-.35, .5], [0, 0], [.35, .5]], [[0, 0], [0, -.5]]],
  [[[-.3, .5], [-.3, -.5]], [[-.3, .5], [.25, .3], [-.3, 0], [.3, -.25], [-.3, -.5]]],
];
function sampleGlyph(g: P2[][], u: number): P2 {
  let total = 0;
  const lens: number[] = [];
  for (const s of g) { let l = 0; for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); lens.push(l); total += l; }
  let d = u * total;
  for (let k = 0; k < g.length; k++) {
    if (d <= lens[k] || k === g.length - 1) {
      const s = g[k];
      let acc = d;
      for (let i = 1; i < s.length; i++) {
        const l = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        if (acc <= l || i === s.length - 1) { const f = Math.min(1, acc / (l || 1)); return [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f]; }
        acc -= l;
      }
    }
    d -= lens[k];
  }
  return [0, 0];
}

const TABLET_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uFade; varying vec2 vUv;
float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
void main(){
  vec2 p=(vUv-.5)*vec2(3.9,3.0);
  float d=rbox(p,vec2(1.85,1.4),.25);
  float body=1.-smoothstep(-.01,.01,d);
  float n=fbm(vec3(p*3.,2.));
  vec3 c=vec3(.5,.28,.15)*(.08+.12*n)*(1.-smoothstep(-.4,0.,d)*.4);
  c+=vec3(1.,.8,.6)*exp(-pow(d+.015,2.)*2500.)*.9;
  gl_FragColor=vec4(c,body*uW*uFade);
}`;

export default function Writing() {
  const scene = useScene();
  const { geo, mat, tab } = useMemo(() => {
    const b = new PBuf(91);
    const r = b.r;
    const q = world.quality;
    const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, 0.22, 0.03));
    const v = new THREE.Vector3();
    const rows = 5, cols = 7, M = rows * cols, per = Math.max(10, Math.floor(80 * q));
    for (let m = 0; m < M; m++) {
      const row = Math.floor(m / cols), col = m % cols;
      const hx = (col - (cols - 1) / 2) * 0.46 + (r() - 0.5) * 0.04, hy = ((rows - 1) / 2 - row) * 0.42 + (r() - 0.5) * 0.03;
      const nw = 1 + Math.floor(r() * 2.2);
      const angs = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
      const g = GLYPHS[m % GLYPHS.length];
      for (let k = 0; k < per; k++) {
        const w = k % nw;
        const ang = angs[(m + w * 2) % 4] + (r() - 0.5) * 0.15;
        const u = ((k / nw) | 0) / Math.ceil(per / nw);
        const L = 0.26;
        const ox = (w - (nw - 1) / 2) * 0.06;
        const lx = hx + ox + Math.cos(ang) * u * L, ly = hy + Math.sin(ang) * u * L;
        v.set(lx, ly, 0.02 + (1 - u) * 0.03).applyMatrix4(rot);
        const [gx, gy] = sampleGlyph(g, (k + 0.5) / per);
        b.add(v.x, v.y + 0.3, v.z, [2.0, 1.2, 0.5], m / M, { aL: [gx, gy, m / M], aU: [u] });
      }
    }
    const mat = pointMat({
      decl: 'attribute vec3 aL; attribute float aU; uniform float uE1,uE2;',
      uniforms: { uE1: { value: 0 }, uE2: { value: 0 } },
      size: 0.8,
      body: `
      // scattered glyph-dust: slowly swirling cloud
      float an = aSeed.x*6.283 + uTime*.12*(.5+aSeed.y);
      float rad = 1.5 + 3.8*pow(aSeed.y,.7);
      vec3 S = vec3(cos(an)*rad*1.5, (aSeed.z-.5)*4.5, sin(an)*rad*.8 - 1.);
      S.y += sin(uTime*.4+aSeed.x*20.)*.15;
      float e1 = smoothstep(aSeed.z*.5, aSeed.z*.5+.5, uE1);
      float e2 = smoothstep(aSeed.x*.5, aSeed.x*.5+.5, uE2);
      // ribbon of letters
      float gi = aL.z;
      float s = fract(gi*1.0 + uE2*.35 + uTime*.015) ;
      float fx = -6. + 12.*s;
      vec3 R = vec3(fx, 1.5 + sin(s*8.+uE2*5.)*.55, cos(s*6.+uE2*3.)*.9 - .5);
      R.xy += aL.xy*.38;
      R.y += sin(uTime*1.3+gi*30.+aSeed.x)*.015;
      float ribbonA = smoothstep(0.,.12,s)*(1.-smoothstep(.88,1.,s));
      vec3 W = p;
      p = mix(S, W, e1);
      p = mix(p, R, e2);
      float press = exp(-pow((e1-.92)*9.,2.))*(1.-e2);
      float tw = pow(.5+.5*sin(uTime*2.+aSeed.x*40.),4.);
      col = mix(vec3(1.2,.9,1.8), vec3(2.0,1.15,.45), e1);
      col = mix(col, vec3(.7,1.5,2.0), e2);
      a = (.03 + .55*e1*(1.-e2)) * (1.+press*2.) * (.8+.5*tw);
      a = mix(a, .8*ribbonA*(.8+.4*tw), e2);
      size = mix(.4, .3+.35*(1.-aU)*e1, e1) + press*.3;
      `,
    });
    const tab = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uFade: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: TABLET_FS,
    });
    return { geo: b.build(), mat, tab };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); tab.dispose(); }, [geo, mat, tab]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e73 = eventPos('writing'), e74 = eventPos('alphabet');
    tickU(mat, scene, state.gl.getPixelRatio());
    const e2 = range(e73 + 0.5, e74 - 0.08, f);
    mat.uniforms.uE1.value = range(e73 - 0.65, e73 + 0.15, f);
    mat.uniforms.uE2.value = e2;
    tab.uniforms.uW.value = scene.weight * range(e73 - 0.3, e73 - 0.05, f);
    tab.uniforms.uFade.value = 1 - Math.min(1, e2 * 1.6);
  });
  return (
    <group>
      <mesh position={[0, 0.3, -0.02]} rotation={[-0.18, 0.22, 0.03]} material={tab}><planeGeometry args={[3.9, 3.0]} /></mesh>
      <points geometry={geo} material={mat} frustumCulled={false} />
    </group>
  );
}
