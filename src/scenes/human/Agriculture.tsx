import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { PBuf, pointMat, tickU } from './common';

// A field of wheat: every stalk is a tapered ribbon with a bearded ear of paired grains, bent by a travelling gust.
// The field greens, then ripens to gold as the event arrives.
const FW = 3.1, FD = 1.7;

function buildStalk() {
  // attributes: aK kind (0 stem / 1 grain / 2 awn), aP = (s along stalk, side, v), aC = (corner x, corner y along element)
  const pos: number[] = [], ak: number[] = [], ap: number[] = [], ac: number[] = [], idx: number[] = [];
  const push = (k: number, s: number, side: number, cx: number, cy: number) => { pos.push(0, 0, 0); ak.push(k); ap.push(s, side, cy); ac.push(cx, cy); return ak.length - 1; };
  const SEG = 12;
  for (let i = 0; i <= SEG; i++) {
    const s = (i / SEG) * 0.9;
    push(0, s, 0, -1, i / SEG); push(0, s, 0, 1, i / SEG);
    if (i < SEG) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const NG = 11;
  const grain = (s: number, side: number) => {
    const b = push(1, s, side, 0, 0); push(1, s, side, -1, 0.42); push(1, s, side, 1, 0.42); push(1, s, side, 0, 1);
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    const a0 = push(2, s, side, -1, 0); push(2, s, side, 1, 0); push(2, s, side, -1, 1); push(2, s, side, 1, 1);
    idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
  };
  for (let n = 0; n < NG; n++) {
    const s = 0.66 + (n / (NG - 1)) * 0.27;
    grain(s, -1); grain(s, 1);
  }
  grain(0.95, 0);
  return { pos, ak, ap, ac, idx };
}

const VS = /* glsl */ `
attribute vec3 aP; attribute float aK; attribute vec2 aC;
attribute vec4 aI;   // x, z, height, seed
attribute vec2 aR;   // order (sprout delay), rotation
uniform float uTime, uSeason, uT, uW;
varying float vK; varying float vS; varying float vSh; varying float vRip; varying float vV; varying float vFog; varying float vSd;
vec3 centre(float s, float H, float wind, float lean, float droop){
  float bend=(wind+lean)*s*s*H*.8;
  float x=bend+droop*H*.3*smoothstep(.6,1.,s)*(s-.6)*2.;
  float z=lean*.5*s*s*H;
  float y=H*s*(1.-.1*wind*s)-droop*H*.12*smoothstep(.7,1.,s)*(s-.7);
  return vec3(x,y,z);
}
void main(){
  float s=aP.x, side=aP.y;
  float seed=aI.w;
  float sprout=smoothstep(aR.x, aR.x+.12, uT*1.4);
  float season=clamp(uSeason+(seed-.5)*.06,0.,1.);
  float grow=smoothstep(.0,.55,season)*sprout;
  float ripe=smoothstep(.45,.9,season);
  float rr=length(vec2(aI.x/${FW.toFixed(2)},aI.y/${FD.toFixed(2)}));
  float edge=1.-smoothstep(.82,1.08,rr);               // a level stand that only thins at its rim (no mound)
  float H=aI.z*(.12+.88*grow)*(.3+.7*edge);
  float ca=cos(aR.y), sa=sin(aR.y);
  float gust=sin(aI.x*.7+aI.y*.35-uTime*1.1)*.5+.5;
  float gust2=sin(aI.x*1.9-aI.y*.8-uTime*2.6+seed*6.)*.5+.5;
  float wind=(.05+.16*gust*gust)+(.03*gust2);
  float droop=.05+.3*ripe;
  float lean=(seed-.5)*.3;
  vec3 C=centre(s,H,wind,lean,droop);
  vec3 C2=centre(min(s+.02,1.),H,wind,lean,droop);
  vec3 T=normalize(C2-C+vec3(0.,1e-4,0.));
  vec3 face=vec3(ca,0.,sa);
  vec3 N=normalize(cross(T,vec3(-sa,0.,ca)));
  vec3 off=vec3(0.);
  if(aK<.5){
    off=face*aC.x*.0095*(1.-s*.55);
  } else {
    vec3 outD=normalize(face*side*.9+vec3(0.,.45,0.)+N*.08*side);
    vec3 gUp=normalize(T*.8+outD*.5);
    vec3 sd=normalize(cross(gUp,N));
    if(aK<1.5){
      float L=.085, W=.034;
      off=gUp*aC.y*L + sd*aC.x*W*.5*(1.-abs(aC.y-.42)*.4);
    } else {
      vec3 dir=normalize(T*.9+outD*.28);
      float len=.14*(.8+.4*seed);
      off=gUp*.085 + dir*len*aC.y + sd*aC.x*.0016*(1.-.7*aC.y);
      off.x+=sin(uTime*3.+seed*9.+s*5.)*.006*aC.y;
    }
  }
  vec3 W=vec3(aI.x,0.,aI.y)+C+off;
  vec4 mv=modelViewMatrix*vec4(W,1.);
  gl_Position=projectionMatrix*mv;
  vK=aK; vS=s; vV=aC.y; vRip=ripe; vSd=seed;
  vSh=dot(normalize(N+vec3(0.,.25,0.)),normalize(vec3(-.5,.6,.6)))*.5+.5;
  vSh=mix(vSh, side*.5+.5, aK>.5?.35:0.);
  vFog=clamp(-mv.z/14.,0.,1.);
}`;

const FS = /* glsl */ `
uniform float uW;
varying float vK; varying float vS; varying float vSh; varying float vRip; varying float vV; varying float vFog; varying float vSd;
void main(){
  float ao=smoothstep(.0,.55,vS);                      // dark at the foot of the stand
  // ripe straw is pale (the mono grade keeps it near-neutral); real gold only where the low sun shines through the ears
  vec3 young=vec3(.4,.55,.45), gold=vec3(1.5,.82,.1), straw=vec3(.82,.72,.55);
  vec3 stem=mix(young, straw, vRip);
  vec3 grain=mix(vec3(.55,.75,.55), vec3(.95,.84,.62), vRip);
  vec3 awn=mix(vec3(.5,.7,.5), vec3(1.0,.9,.7), vRip);
  vec3 c = vK<.5 ? stem : (vK<1.5 ? grain*(.75+.5*vV) : awn);
  float sh = .35+.8*vSh;
  // translucent backlight: the ears glow where the sun comes through them
  float back = pow(max(vSh,0.),3.)*(vK>.5?.55:.25);
  c = c*sh*(.15+.9*ao) + gold*back*vRip*.6;
  c *= mix(1.,.45+.55*(.7+.6*vSd),.4);
  float a = vK>1.5 ? .65 : 1.;
  c *= (1.-vFog*.55)*.62;
  gl_FragColor=vec4(c*uW,a*uW);
}`;

export default function Agriculture() {
  const scene = useScene();
  const { geo, mat, pgeo, pmat, gmat, sun } = useMemo(() => {
    const st = buildStalk();
    const q = world.quality;
    const NS = Math.floor(3400 * Math.min(1, q + 0.25));
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(st.pos, 3));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(st.ak, 1));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(st.ap, 3));
    g.setAttribute('aC', new THREE.Float32BufferAttribute(st.ac, 2));
    g.setIndex(st.idx);
    const ai = new Float32Array(NS * 4), ar = new Float32Array(NS * 2);
    const rr = new PBuf(83).r;
    const rows = 26;
    for (let i = 0; i < NS; i++) {
      const row = i % rows;
      const rz = (row / (rows - 1) - 0.5) * 2 * FD;
      const x = (rr() - 0.5) * 2 * FW;
      const z = rz + (rr() - 0.5) * 0.08;
      ai[i * 4] = x; ai[i * 4 + 1] = z; ai[i * 4 + 2] = 0.95 + rr() * 0.4 + (1 - Math.abs(z) / FD) * 0.0; ai[i * 4 + 3] = rr();
      ar[i * 2] = ((x + FW) / (2 * FW)) * 0.35 + rr() * 0.04 + ((z + FD) / (2 * FD)) * 0.1;
      ar[i * 2 + 1] = rr() * 6.283;
    }
    g.setAttribute('aI', new THREE.InstancedBufferAttribute(ai, 4));
    g.setAttribute('aR', new THREE.InstancedBufferAttribute(ar, 2));
    g.instanceCount = NS;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uSeason: { value: 0 }, uT: { value: 0 }, uW: { value: 0 } },
      vertexShader: VS, fragmentShader: FS,
    });
    // pollen / chaff drifting downwind
    const pb = new PBuf(84);
    for (let i = 0; i < 160 * q; i++) pb.add((pb.r() - 0.5) * 8, 0.3 + pb.r() * 1.4, (pb.r() - 0.5) * 4, [2.0, 1.4, .5], 0);
    const pmat = pointMat({
      size: 0.6,
      body: `
      float ph=fract(uTime*.05+aSeed.x);
      p.x = mod(p.x+4.+ph*8., 8.)-4.; p.y += sin(uTime*.6+aSeed.y*30.)*.1; p.z += sin(uTime*.4+aSeed.z*20.)*.1;
      col=vec3(2.0,1.45,.5); a=.35*uT*smoothstep(0.,.1,ph)*(1.-ph); size=.35+aSeed.y*.4;`,
    });
    // soil: a faint warm horizon of the field, so the stalks stand on something
    const gmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uSeason: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uW,uSeason; varying vec2 vP;
      void main(){ float r=length(vP*vec2(.5,.9)); float c=exp(-r*r*.9); float rows=.5+.5*sin(vP.y*30.);
        vec3 col=vec3(.03,.022,.014)*c*(.7+.3*rows)+vec3(1.0,.5,.06)*exp(-r*r*1.6)*.16*smoothstep(.3,.9,uSeason); gl_FragColor=vec4(col, c*uW*.9); }`,
    });
    // a low sun behind the stand: the ears read as backlit silhouettes against it
    const sun = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uW: { value: 0 }, uSeason: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uW,uSeason; varying vec2 vP;
      void main(){ vec2 d=vP-vec2(1.2,.9); float r=length(d*vec2(.55,1.));
        vec3 c=vec3(1.4,.75,.2)*(exp(-r*r*.35)*.22+exp(-r*r*6.)*.5)+vec3(2.2,1.7,1.)*exp(-r*r*120.)*.9;
        c*=smoothstep(-.2,.4,vP.y)*(.35+.65*uSeason); gl_FragColor=vec4(c*uW,1.); }`,
    });
    return { geo: g, mat, pgeo: pb.build(), pmat, gmat, sun };
  }, []);
  useEffect(() => () => { geo.dispose(); pgeo.dispose(); mat.dispose(); pmat.dispose(); gmat.dispose(); sun.dispose(); }, [geo, pgeo, mat, pmat, gmat, sun]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('agriculture');
    const tm = world.reduced ? 0 : world.time;
    const season = 0.12 + 0.8 * range(e - 0.95, e - 0.05, world.stationF);
    const u = mat.uniforms;
    u.uTime.value = tm; u.uSeason.value = season; u.uT.value = scene.t; u.uW.value = scene.weight;
    tickU(pmat, scene, state.gl.getPixelRatio());
    gmat.uniforms.uW.value = scene.weight; gmat.uniforms.uSeason.value = season;
    sun.uniforms.uW.value = scene.weight; sun.uniforms.uSeason.value = season;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} material={gmat}><planeGeometry args={[12, 7]} /></mesh>
      <mesh position={[0, 0, -5]} material={sun}><planeGeometry args={[16, 6]} /></mesh>
      <mesh geometry={geo} material={mat} frustumCulled={false} />
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
    </group>
  );
}
