import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU } from './common';

const SLICE_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uMix,uTime,uT,uPulse; varying vec2 vUv;
float blob(vec2 p, vec2 c, float r, float ph){
  float act = pow(.5+.5*sin(uTime*.9+ph*3.1+uT*14.), 2.);
  float rad = r*(.7+.5*act);
  return exp(-dot(p-c,p-c)/(rad*rad))*(.35+.65*act);
}
void main(){
  vec2 p=(vUv-.5)*2.; p.x*=1.18;
  float ang=atan(p.y,p.x);
  float rim=.8+.012*sin(ang*3.)+.025*fbm(vec3(p*2.,1.));
  vec2 q=p*vec2(.95,.98);
  float d=length(q*vec2(1.,.92))-rim;
  // slightly narrower toward the front
  d += .1*smoothstep(0.,1.,p.y)*abs(p.x);
  float inside=1.-smoothstep(-.015,.015,d);
  float ridge=abs(fbm(vec3(p*5.5,2.))-.5);
  float sulci=smoothstep(.0,.035,ridge);
  float fissure=smoothstep(.012,.03,abs(p.x))+ (1.-smoothstep(.55,.62,abs(p.y)))*0.;
  fissure=mix(1.,fissure,smoothstep(.62,.5,abs(p.y)));
  float shade=.35+.65*sulci;
  vec3 base=vec3(.16,.21,.34)*shade*fissure*(.7+.5*fbm(vec3(p*3.,5.)));
  // BOLD blobs
  float v=0.;
  v+=blob(p,vec2(-.32,.5),.2,0.)*.9;
  v+=blob(p,vec2(.3,.55),.18,1.)*.7;
  v+=blob(p,vec2(-.5,.08),.16,2.)*.8;
  v+=blob(p,vec2(.52,.02),.15,3.)*.6;
  v+=blob(p,vec2(0.,-.55),.28,4.)*1.1;
  v+=blob(p,vec2(-.62,-.3),.14,5.)*.7;
  v+=blob(p,vec2(.4,-.38),.16,6.)*.8;
  v*=uMix*(.4+.5*uPulse);
  v*=inside*fissure*(.4+.6*sulci);
  vec3 hot=vec3(min(1.,v*2.),max(0.,min(1.,v*2.-.7)),max(0.,v-1.1)*.4)*vec3(1.5,1.2,.9);
  vec3 c=base*inside+hot*smoothstep(.05,.3,v);
  float rimGlow=exp(-pow(d*20.,2.))*.5;
  c+=vec3(.25,.45,.9)*rimGlow*(.4+.3*uMix);
  // scan line
  float sy=fract(uT*3.+uTime*.1)*2.-1.;
  c+=vec3(.4,.8,1.6)*exp(-pow((p.y-sy)*18.,2.))*.25*inside;
  gl_FragColor=vec4(c,uW*(inside*.9+rimGlow));
}`;

export default function Imaging() {
  const scene = useScene();
  const { geo, mat, slice, lgeo, lmat } = useMemo(() => {
    const b = new PBuf(141);
    const CH = 9;
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
      p = vec3(mix(-5.2,5.2,s), (ch-4.)*.46*(1.-uMix*.5) + y + .2, ch*.04);
      float head = exp(-pow((fract(s*1.-uT*3.-uTime*.08)-.5)*5.,2.));
      col = mix(vec3(.3,1.5,2.2), vec3(1.6,.7,2.2), ch/8.);
      a = (.18+.7*head)*env*(1.-uMix);
      size = .35+.5*head;`,
    });
    const slice = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uT: { value: 0 }, uPulse: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: SLICE_FS,
    });
    const lb = new LBuf(142);
    const ring = (rad: number, z: number, c: [number, number, number]) => { const n = 90; for (let i = 0; i < n; i++) { const a0 = (i / n) * 6.283, a1 = ((i + 1) / n) * 6.283; lb.seg([Math.cos(a0) * rad, Math.sin(a0) * rad, z], [Math.cos(a1) * rad, Math.sin(a1) * rad, z], 0, 1, c); } };
    ring(2.9, -0.5, [.4, .8, 1.8]); ring(3.05, -0.5, [.3, .6, 1.4]); ring(3.6, -1.2, [.3, .5, 1.2]);
    const lmat = lineMat({ body: 'a=.5*uMix;', decl: 'uniform float uMix;', uniforms: { uMix: { value: 0 } } });
    return { geo: b.build(), mat, slice, lgeo: lb.build(), lmat };
  }, []);
  useEffect(() => () => { geo.dispose(); lgeo.dispose(); mat.dispose(); slice.dispose(); lmat.dispose(); }, [geo, lgeo, mat, slice, lmat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e79 = eventPos('eeg'), e80 = eventPos('fmri');
    const mix = range(e79 + 0.2, e80 - 0.1, f);
    tickU(mat, scene, state.gl.getPixelRatio()); mat.uniforms.uMix.value = mix;
    tickU(lmat, scene); lmat.uniforms.uMix.value = mix;
    const u = slice.uniforms;
    u.uW.value = scene.weight * mix; u.uMix.value = mix; u.uT.value = scene.t;
    u.uTime.value = world.reduced ? 0 : world.time; u.uPulse.value = near(e80, 0.5);
  });
  return (
    <group>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <lineSegments geometry={lgeo} material={lmat} frustumCulled={false} />
      <mesh position={[0, 0.1, 0]} rotation={[-0.25, 0.1, 0]} material={slice}><planeGeometry args={[4.6, 4.6]} /></mesh>
    </group>
  );
}
