import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { LBuf, PBuf, lineMat, pointMat, tickU } from './common';

const PAGE_VS = /* glsl */ `
attribute vec4 aI; uniform float uFlood,uTime,uW; varying vec2 vUv; varying float vA; varying float vSh;
mat3 rotAxis(vec3 ax, float an){ ax=normalize(ax); float s=sin(an),c=cos(an),o=1.-c;
  return mat3(o*ax.x*ax.x+c, o*ax.x*ax.y+ax.z*s, o*ax.z*ax.x-ax.y*s,
              o*ax.x*ax.y-ax.z*s, o*ax.y*ax.y+c, o*ax.y*ax.z+ax.x*s,
              o*ax.z*ax.x+ax.y*s, o*ax.y*ax.z-ax.x*s, o*ax.z*ax.z+c); }
void main(){
  vUv=uv;
  float ts=aI.x*.85;
  float age=uFlood-ts;
  float alive=step(0.,age);
  float k=max(age,0.);
  float an=aI.y*6.283;
  float spread=.35+aI.z*1.4;
  vec3 dir=normalize(vec3(cos(an)*spread, .15+aI.w*.9, 1.1-aI.z*.4+sin(an)*.2*spread));
  float dist=pow(k*7.,1.25)*(.5+aI.w*.9);
  vec3 origin=vec3(0.,-.1,.5);
  vec3 pos=origin+dir*dist;
  pos.y+=sin(uTime*.6+aI.x*30.)*.04*k*10.;
  pos.y-=k*k*8.*aI.z;
  float spin=k*10.*(aI.y-.5)*3.+uTime*.3*(aI.z-.5);
  vec3 lp=rotAxis(vec3(aI.w-.5,aI.y,aI.z-.5+.1),spin+aI.x*6.)*position;
  float sc=smoothstep(0.,.03,k)*alive;
  vec4 mv=modelViewMatrix*vec4(pos+lp*sc,1.);
  gl_Position=projectionMatrix*mv;
  vA=alive*smoothstep(0.,.05,k)*smoothstep(.3,3.,dist)*(1.-smoothstep(9.,14.,dist))*uW;
  vSh=.5+.5*dot(normalize(rotAxis(vec3(aI.w-.5,aI.y,aI.z-.5+.1),spin+aI.x*6.)*vec3(0.,0.,1.)),vec3(.3,.5,.8));
}`;
const PAGE_FS = /* glsl */ `varying vec2 vUv; varying float vA; varying float vSh;
void main(){
  float line=step(.35,fract(vUv.y*22.));
  float m=step(.08,vUv.x)*step(vUv.x,.92)*step(.06,vUv.y)*step(vUv.y,.94);
  float brk=step(.15,fract(sin(floor(vUv.y*22.)*12.9898+floor(vUv.x*9.)*78.233)*43758.5453));
  float ink=m*(1.-line)*brk;
  vec3 c=vec3(1.7,1.45,.95)*(.08+ink*.4)*(.5+vSh);
  gl_FragColor=vec4(c,vA*.9);
}`;

export default function Enlightenment() {
  const scene = useScene();
  const solids = useRef<(THREE.Group | null)[]>([]);
  const { lgeos, lmat, pgeo, pmat, pageGeo, pageMat, rgeo, ringMat, frame } = useMemo(() => {
    const kinds = [new THREE.TetrahedronGeometry(0.55), new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.OctahedronGeometry(0.6), new THREE.DodecahedronGeometry(0.6), new THREE.IcosahedronGeometry(0.6)];
    const lgeos = kinds.map((k, i) => {
      const e = new THREE.EdgesGeometry(k);
      const pa = e.getAttribute('position');
      const lb = new LBuf(100 + i);
      for (let j = 0; j < pa.count; j += 2) {
        lb.seg([pa.getX(j), pa.getY(j), pa.getZ(j)], [pa.getX(j + 1), pa.getY(j + 1), pa.getZ(j + 1)], 0, 1, [2.0, 1.5, .6]);
      }
      k.dispose(); e.dispose();
      return lb.build();
    });
    const lmat = lineMat({ body: 'a=.75;' });
    // the mind: glowing orb of points
    const pb = new PBuf(110);
    const r = pb.r;
    for (let i = 0; i < 2600 * world.quality; i++) {
      const v = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(Math.cbrt(r()) * .55);
      pb.add(v.x, v.y, v.z, [1, 1, 1], 0);
    }
    const pmat = pointMat({
      decl: 'uniform float uPulse;', uniforms: { uPulse: { value: 0 } }, size: .8,
      body: `
      float tw=pow(.5+.5*sin(uTime*(1.+aSeed.y*3.)+aSeed.z*50.),4.);
      p*=1.+.06*sin(uTime*1.2+length(position)*8.);
      col=mix(vec3(1.9,1.3,.55),vec3(.8,1.3,2.),length(position)*1.6);
      a=.14*(.5+tw)*(1.+uPulse*.8); size=.5+tw*.6;`,
    });
    // thought ripples
    const rb = new PBuf(111);
    for (let k = 0; k < 6; k++) for (let i = 0; i < 160; i++) rb.add(Math.cos((i / 160) * 6.283), 0, Math.sin((i / 160) * 6.283), [1, 1, 1], k);
    const ringMat = pointMat({
      size: .6,
      body: `
      float ph=fract(aSeed.w/6.+uTime*.07+uT*1.3);
      p=position*(.8+ph*5.5); p.y=sin(position.x*3.+uTime)*.05;
      col=vec3(1.5,1.2,.7); a=.5*sin(ph*3.14159)*(1.-ph);`,
    });
    // pages
    const NP = Math.floor(650 * world.quality);
    const base = new THREE.PlaneGeometry(0.42, 0.58);
    const pageGeo = new THREE.InstancedBufferGeometry();
    pageGeo.index = base.index;
    pageGeo.setAttribute('position', base.getAttribute('position'));
    pageGeo.setAttribute('uv', base.getAttribute('uv'));
    const rr = new PBuf(112).r;
    const ai = new Float32Array(NP * 4);
    for (let i = 0; i < NP; i++) { ai[i * 4] = (i + rr() * 0.5) / NP; ai[i * 4 + 1] = rr(); ai[i * 4 + 2] = rr(); ai[i * 4 + 3] = rr(); }
    pageGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(ai, 4));
    pageGeo.instanceCount = NP;
    pageGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const pageMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uFlood: { value: 0 }, uTime: { value: 0 }, uW: { value: 0 } },
      vertexShader: PAGE_VS, fragmentShader: PAGE_FS,
    });
    // press frame
    const fb = new LBuf(113);
    const box = (cx: number, cy: number, w: number, h: number, d: number, c: [number, number, number]) => {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = -d / 2, z1 = d / 2;
      const P: [number, number, number][] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (const [a, b] of E) fb.seg(P[a], P[b], 0, 1, c);
    };
    box(0, -0.9, 1.6, 0.2, 1.1, [1.5, 1.0, .4]);
    fb.seg([-0.65, -0.8, 0], [-0.65, 0.9, 0], 0, 1, [1.5, 1.0, .4]); fb.seg([0.65, -0.8, 0], [0.65, 0.9, 0], 0, 1, [1.5, 1.0, .4]);
    fb.seg([-0.65, 0.9, 0], [0.65, 0.9, 0], 0, 1, [1.5, 1.0, .4]);
    box(0, 0.1, 1.0, 0.1, 0.9, [2.0, 1.4, .6]);
    const frame = fb.build();
    return { lgeos, lmat, pgeo: pb.build(), pmat, pageGeo, pageMat, rgeo: rb.build(), ringMat, frame };
  }, []);
  const pressMat = useMemo(() => lineMat({ body: 'a=.7;' }), []);
  const platen = useRef<THREE.Group>(null);
  useEffect(() => () => { lgeos.forEach((g) => g.dispose()); pgeo.dispose(); pageGeo.dispose(); rgeo.dispose(); frame.dispose(); lmat.dispose(); pmat.dispose(); pageMat.dispose(); ringMat.dispose(); pressMat.dispose(); }, [lgeos, pgeo, pageGeo, rgeo, frame, lmat, pmat, pageMat, ringMat, pressMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e75 = eventPos('philosophy-of-mind'), e76 = eventPos('printing-press');
    const A = 1 - range(e76 - 0.9, e76 - 0.35, f);
    const B = range(e76 - 0.9, e76 - 0.4, f);
    const pr = state.gl.getPixelRatio();
    for (const m of [lmat, pmat, ringMat]) { tickU(m, scene, pr); m.uniforms.uW.value = scene.weight * A; }
    pmat.uniforms.uPulse.value = near(e75, 0.5);
    tickU(pressMat, scene); pressMat.uniforms.uW.value = scene.weight * B;
    pageMat.uniforms.uW.value = scene.weight * B;
    pageMat.uniforms.uTime.value = world.reduced ? 0 : world.time;
    pageMat.uniforms.uFlood.value = range(e76 - 0.45, e76 + 0.65, f);
    const tm = world.reduced ? 0 : world.time;
    solids.current.forEach((g, i) => {
      if (!g) return;
      const a = scene.t * 9 + tm * 0.15 + (i / 5) * 6.283;
      const rad = 2.1 + (i % 2) * 0.5;
      g.position.set(Math.cos(a) * rad * 1.3, Math.sin(a * 0.7 + i) * 0.7, Math.sin(a) * rad * 0.6);
      g.rotation.set(a * 0.8, a * 0.5, 0.2 * i);
    });
    if (platen.current) platen.current.position.y = -0.05 - 0.45 * (0.5 + 0.5 * Math.sin(f * 40));
  });
  return (
    <group position={[0, 0.2, 0]}>
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
      <points geometry={rgeo} material={ringMat} frustumCulled={false} />
      {lgeos.map((g, i) => (
        <group key={i} ref={(el) => { solids.current[i] = el; }}>
          <lineSegments geometry={g} material={lmat} frustumCulled={false} />
        </group>
      ))}
      <group position={[0, -0.2, 0]}>
        <lineSegments geometry={frame} material={pressMat} frustumCulled={false} />
        <group ref={platen} />
      </group>
      <mesh geometry={pageGeo} material={pageMat} frustumCulled={false} />
    </group>
  );
}
