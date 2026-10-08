import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, PBuf, pointMat, tickU } from './common';

export const caveX = (t: number) => -5.8 + t * 11.6;

const FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uCam,uRip,uRipPh,uT; varying vec2 vP;
float sdSeg(vec2 p, vec2 a, vec2 b, float r){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r;}
float sdEll(vec2 p, vec2 r){ return (length(p/r)-1.)*min(r.x,r.y); }
float quad(vec2 p, float ph, float hump, float neck, float legL, float amp){
  float d = sdEll(p, vec2(.55,.26));
  d = min(d, sdEll(p-vec2(.28,.12+hump*.12), vec2(.28,.2+hump*.14)));
  vec2 hb = vec2(.58+neck*.08, .02 - hump*.12 + neck*.04);
  d = min(d, sdSeg(p, vec2(.4,.1), hb, .13));
  d = min(d, sdSeg(p, hb, hb+vec2(.2,-.16-.05*hump), .085));
  d = min(d, sdSeg(p, hb+vec2(-.02,.08), hb+vec2(.04,.22+neck*.05), .02));
  d = min(d, sdSeg(p, vec2(-.52,.12), vec2(-.66,-.14), .025));
  float s1=sin(ph), s2=sin(ph+3.14159), s3=sin(ph+1.4), s4=sin(ph+4.5);
  float sw=.16*amp;
  d = min(d, sdSeg(p, vec2(.38,-.15), vec2(.38+s1*sw,-.15-legL), .042));
  d = min(d, sdSeg(p, vec2(.26,-.15), vec2(.26+s2*sw,-.15-legL), .042));
  d = min(d, sdSeg(p, vec2(-.38,-.15), vec2(-.38+s3*sw,-.15-legL), .048));
  d = min(d, sdSeg(p, vec2(-.26,-.15), vec2(-.26+s4*sw,-.15-legL), .048));
  return d;
}
// returns vec2(fill, outline)
vec2 animal(vec2 P, vec3 cs, float fl, float hump, float neck, float legL, float id, float amp){
  vec2 lp=(P-cs.xy)/cs.z; lp.x*=fl;
  if(abs(lp.x)>1.05||abs(lp.y)>.95) return vec2(0.);
  float base=uCam*2.2+id*1.7;
  vec2 m=vec2(0.);
  for(int k=0;k<3;k++){
    float w = k==0?1.:(k==1?.28:.14);
    float d=quad(lp,base-float(k)*.6,hump,neck,legL,amp)*cs.z;
    float f=1.-smoothstep(-.01,.012,d);
    float o=exp(-d*d*9000.)*step(0.,d+.02);
    m.x=max(m.x,f*w); m.y=max(m.y,o*w);
  }
  return m;
}
void main(){
  vec2 P=vP;
  float h=fbm(vec3(P*1.1,1.))*.7+fbm(vec3(P*4.5,4.))*.3;
  float e=.03;
  float hx=fbm(vec3((P+vec2(e,0.))*1.1,1.))*.7+fbm(vec3((P+vec2(e,0.))*4.5,4.))*.3;
  float hy=fbm(vec3((P+vec2(0.,e))*1.1,1.))*.7+fbm(vec3((P+vec2(0.,e))*4.5,4.))*.3;
  vec3 n=normalize(vec3((h-hx)/e*.5,(h-hy)/e*.5,1.));
  float fl=.88+.12*sin(uTime*8.+sin(uTime*2.7)*3.)+.05*sin(uTime*17.);
  vec3 Lp=vec3(uCam+.9,-.5,2.4);
  vec3 Ld=Lp-vec3(P,0.);
  float dist=length(Ld);
  float dif=max(dot(n,normalize(Ld)),0.);
  float lit=fl*1.9/(1.+dist*dist*.55);
  vec3 rock=vec3(.62,.4,.3)*(.012+dif*lit*.38)+vec3(.006,.006,.012);
  // paintings
  float amp=.35+.65*uRip;
  vec2 a=vec2(0.);
  a=max(a,animal(P,vec3(-8.3,-.5,1.4),1.,0.,.6,.5,0.,amp));
  a=max(a,animal(P,vec3(-5.5,.4,1.3),-1.,1.,.2,.45,1.,amp));
  a=max(a,animal(P,vec3(-2.3,.0,2.0),1.,.35,.4,.6,2.,amp));
  a=max(a,animal(P,vec3(.9,-.7,1.2),-1.,0.,1.,.5,3.,amp));
  a=max(a,animal(P,vec3(3.2,.15,1.5),1.,.2,.8,.7,4.,amp));
  a=max(a,animal(P,vec3(6.0,-.5,1.3),-1.,1.,.2,.45,5.,amp));
  a=max(a,animal(P,vec3(8.6,.4,1.4),1.,0.,.6,.5,6.,amp));
  float pig=.55+.45*fbm(vec3(P*9.,2.));
  vec3 paint=vec3(.5,.07,.03)*pig*a.x+vec3(.9,.3,.08)*a.y*.7;
  float vis=smoothstep(.0,1.,lit*.5); vis*=vis;
  vec3 c=rock+paint*(.05+vis*1.3);
  // flute ripples
  float rr=length((P-vec2(uCam+.5,-.2))*vec2(1.,1.2));
  float ring=pow(.5+.5*sin(rr*6.-uRipPh),10.)*exp(-rr*.28)*uRip;
  c+=vec3(.9,.75,.45)*ring*.32*(.4+dif);
  c+=paint*ring*3.;
  vec2 q=abs(vec2(P.x-uCam,P.y)/vec2(9.,4.5));
  float edge=1.-smoothstep(.7,1.,max(q.x,q.y));
  gl_FragColor=vec4(c,uW*edge);
}`;

export default function Cave() {
  const scene = useScene();
  const noteGroup = useRef<THREE.Group>(null);
  const fluteGroup = useRef<THREE.Group>(null);
  const { wall, notes } = useMemo(() => {
    const wall = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uCam: { value: 0 }, uRip: { value: 0 }, uRipPh: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy+vec2(0.,.3); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: FS,
    });
    const b = new PBuf(61);
    const N = Math.floor(500 * world.quality);
    for (let i = 0; i < N; i++) b.add(i / N, 0, 0, [1, 1, 1], 0);
    const notes = pointMat({
      decl: 'uniform float uRip;', uniforms: { uRip: { value: 0 } }, size: 0.9,
      body: `
      float s=position.x; float ph=fract(s*3.+aSeed.x*.2 - uTime*.25 - uT*2.);
      float rad=ph*3.2;
      float ang=aSeed.y*6.283+ph*5.;
      p=vec3(rad*(1.+.2*sin(ang*2.)), .2+sin(ang)*rad*.5*(aSeed.z+.2), (aSeed.z-.5)*.6);
      p+= vec3(0.,0.,0.);
      float fade=sin(ph*3.14159);
      col=mix(vec3(1.8,1.3,.6),vec3(1.2,1.6,2.),ph);
      a=uRip*fade*.7*(.4+.8*pow(.5+.5*sin(uTime*4.+aSeed.x*30.),3.));
      size=.25+fade*.45;`,
    });
    return { wall, notes };
  }, []);
  useEffect(() => () => { wall.dispose(); notes.dispose(); }, [wall, notes]);
  const flute = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.7, 1.2), toneMapped: false, transparent: true });
    const h = new THREE.MeshBasicMaterial({ color: '#150a05', transparent: true });
    return { m, h };
  }, []);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const cx = caveX(scene.t);
    const e69 = eventPos('bone-flutes-music');
    const rip = near(e69, 0.55);
    const u = wall.uniforms;
    u.uW.value = scene.weight; u.uTime.value = world.reduced ? 0 : world.time; u.uCam.value = cx;
    u.uRip.value = rip; u.uRipPh.value = f * 14 + (world.reduced ? 0 : world.time * 2.5);
    tickU(notes, scene, state.gl.getPixelRatio());
    notes.uniforms.uRip.value = rip;
    flute.m.opacity = scene.weight * range(e69 - 0.7, e69 - 0.25, f) * (1 - range(e69 + 0.3, e69 + 0.8, f)); flute.h.opacity = flute.m.opacity;
    if (noteGroup.current) noteGroup.current.position.set(cx + 0.5, -0.4, 1.4);
    if (fluteGroup.current) {
      fluteGroup.current.position.set(cx + 0.55, -0.55, 1.5);
      fluteGroup.current.rotation.z = 0.5 + Math.sin(f * 6) * 0.05;
    }
  });
  return (
    <group>
      <mesh position={[0, 0, 0]} material={wall}><planeGeometry args={[40, 12]} /></mesh>
      <group ref={noteGroup}><points geometry={useMemo(() => { const b = new PBuf(62); const N = Math.floor(500 * world.quality); for (let i = 0; i < N; i++) b.add(i / N, 0, 0, [1, 1, 1], 0); return b.build(); }, [])} material={notes} frustumCulled={false} /></group>
      <group ref={fluteGroup}>
        <mesh material={flute.m}><cylinderGeometry args={[0.04, 0.045, 1.5, 12]} /></mesh>
        {[-0.45, -0.2, 0.0, 0.2, 0.4].map((y) => (
          <mesh key={y} position={[0, y, 0.04]} material={flute.h}><sphereGeometry args={[0.028, 8, 8]} /></mesh>
        ))}
      </group>
    </group>
  );
}
