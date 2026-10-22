import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL } from './common';

// Two minds in profile, drawn as luminous engraved contour shells; speech crosses between them as a braid of fine
// gold strands; at FOXP2 the braid resolves into a double helix.
const HC = 3.05, HY = 0.35, HS = 1.3;

const FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uT,uGhost,uHelix;
varying vec2 vP;
float sdSeg2(vec2 p, vec2 a, vec2 b, float r0, float r1){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-mix(r0,r1,h);}
float sdEll(vec2 p, vec2 c, vec2 r){ vec2 q=(p-c)/r; return (length(q)-1.)*min(r.x,r.y); }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
// head in profile, facing +x, local units ~ 1 = skull half-height
float sdHead(vec2 p){
  float d = sdEll(p, vec2(-.1,.24), vec2(.7,.66));                      // cranium
  d = smin(d, sdEll(p, vec2(.2,-.18), vec2(.42,.46)), .28);              // face
  d = smin(d, sdEll(p, vec2(.5,.36), vec2(.2,.12)), .12);                // brow ridge
  d = smin(d, sdSeg2(p, vec2(.56,.08), vec2(.86,-.17), .07, .035), .07); // nose
  d = smin(d, sdEll(p, vec2(.56,-.42), vec2(.08,.06)), .05);             // lips
  d = smin(d, sdEll(p, vec2(.42,-.64), vec2(.17,.14)), .1);              // chin
  d = smin(d, sdSeg2(p, vec2(-.08,-.5), vec2(-.12,-1.3), .22, .27), .2); // neck
  d = smin(d, sdEll(p, vec2(-.55,-.1), vec2(.2,.3)), .2);                // occiput
  return d;
}
vec3 mind(vec2 u, float side, float act, out float rimA){
  float d = sdHead(u);
  // well outside the head every term below is zero: skip its four noise fields (most of the frame, for each head)
  if(d>.2){ rimA=0.; return vec3(0.,0.,-d); }
  float warp = (fbm(vec3(u*2.4, side*3.+uTime*.05))-.5)*.05;
  float depth = -d + warp;
  float inside = smoothstep(0.,.012,depth)*smoothstep(-1.3,-.85,u.y);
  float per = .045;
  float v = abs(fract(depth/per)-.5)*2.;
  float ln = smoothstep(.72,.97,v) * inside;
  // activity flows along the shells, like thought moving through the head
  float flow = fbm(vec3(u*2.1 + vec2(uTime*.12*side, -uTime*.07), uTime*.15+side*5.));
  float bright = (.18 + 1.1*pow(flow,2.4)*(1.+act*1.8)) * (.25+.75*exp(-depth*2.6));
  // fine neural filaments inside the cranium
  vec2 f = u*vec2(7.,7.) + fbm(vec3(u*3.,2.+side))*2.;
  float fil = pow(1.-abs(2.*fbm(vec3(f*.6,4.+side*3.))-1.), 18.) * smoothstep(.1,.4,depth);
  rimA = (exp(-pow(depth/.015,2.)) + exp(-pow(max(d,0.)/.04,2.))*.35)*smoothstep(-1.3,-.85,u.y);
  return vec3(ln*bright + fil*.6*(.3+act), inside, depth);
}
float strandY(float i, float s, float ph, float ym, float amp){
  float fr = 2.2 + i*.55, sp = 1.4 + i*.22;
  float env = pow(sin(3.14159*clamp(s,0.,1.)), .8);
  return ym + env*amp*(sin(s*fr*6.28318 - ph*sp + i*1.7) * (1.-i*.05) + .35*sin(s*fr*2.1*6.28318 - ph*.6*sp + i));
}
void main(){
  vec2 P=vP;
  float talk = smoothstep(.35,1.,.5+.5*sin(uT*30.));
  float hear = smoothstep(.35,1.,.5+.5*sin(uT*30.-1.7));
  vec3 col = vec3(0.);

  // listener (left, speaking) and (right) -- each a shell of contour lines + a soft aura
  vec2 uL = (P-vec2(-${HC.toFixed(2)},${HY.toFixed(2)}))/${HS.toFixed(2)};
  vec2 uR = (P-vec2(${HC.toFixed(2)},${HY.toFixed(2)}))/${HS.toFixed(2)}; uR.x=-uR.x;
  float rA, rB;
  vec3 mL = mind(uL, -1., talk, rA);
  vec3 mR = mind(uR, 1., hear, rB);
  vec3 coolW = vec3(.92,.97,1.1), warmW=vec3(1.05,.98,.92);
  col += coolW*(mL.x*1.05 + rA*.32);
  col += coolW*(mR.x*1.05 + rB*.32);
  col += vec3(.5,.62,.9)*(exp(-max(sdHead(uL),0.)*3.)*.025 + exp(-max(sdHead(uR),0.)*3.)*.025);

  // the shared simulation: a small constellation lights in BOTH heads
  if(uGhost>0.001){
    for(int k=0;k<2;k++){
      vec2 u = k==0 ? uL : uR;
      float pulse=.7+.3*sin(uTime*1.7+float(k)*2.);
      for(int j=0;j<7;j++){
        float fj=float(j);
        vec2 q = vec2(.08+.18*sin(fj*2.1), .38+.17*cos(fj*1.7+1.));
        float on = smoothstep(fj/9., fj/9.+.15, uGhost);
        float dd = length(u-q);
        col += vec3(2.0,1.45,.55)*on*(exp(-dd*dd*1800.)*1.2 + exp(-dd*dd*90.)*.12)*pulse;
        vec2 q2 = vec2(.08+.18*sin((fj+1.)*2.1), .38+.17*cos((fj+1.)*1.7+1.));
        vec2 pa=u-q, ba=q2-q; float hh=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
        float ld=length(pa-ba*hh);
        col += vec3(1.6,1.1,.45)*on*exp(-ld*ld*9000.)*.4*step(fj,5.5);
      }
    }
  }

  // --- speech braid between the two faces ---
  vec2 mouthL = vec2(-${HC.toFixed(2)}+.56*${HS.toFixed(2)}, ${HY.toFixed(2)}-.42*${HS.toFixed(2)});
  float x0=mouthL.x+.15, x1=${HC.toFixed(2)}-.56*${HS.toFixed(2)}-.1;
  float s=(P.x-x0)/(x1-x0);
  float ym=mouthL.y;
  float waveOn=(1.-uHelix);
  if(s>0.&&s<1.){
    float amp=.08+.34*talk*.7+.1;
    float w=.0065;
    for(int i=0;i<9;i++){
      float fi=float(i);
      float yy=strandY(fi,s,uT*26.+uTime*.8,ym,amp);
      float dy=P.y-yy;
      float pk=fract(s*.5 - uT*3.2 - uTime*.1 + fi*.13);
      float pack=exp(-pow((pk-.5)*6.,2.));
      float l=exp(-dy*dy/(w*w))*(.25+1.1*pack) + exp(-dy*dy/(w*w*40.))*.07*pack;
      col += vec3(2.0,1.35,.42)*l*waveOn*pow(sin(3.14159*s),.6)*.9;
    }
    // helix
    float ang=s*6.28318*3.4 + uT*8. + uTime*.35;
    float env=smoothstep(0.,.1,s)*smoothstep(1.,.9,s);
    float hy1=ym+sin(ang)*.5*env, hy2=ym+sin(ang+3.14159)*.5*env;
    float z1=cos(ang)*.5+.5, z2=1.-z1;
    float h1=exp(-pow((P.y-hy1)/(.008+.006*z1),2.))*(.4+.9*z1);
    float h2=exp(-pow((P.y-hy2)/(.008+.006*z2),2.))*(.4+.9*z2);
    // base pairs
    float rung=pow(abs(sin(ang*1.)),30.);
    float ylo=min(hy1,hy2), yhi=max(hy1,hy2);
    float inR=step(ylo,P.y)*step(P.y,yhi);
    float rungs=inR*exp(-pow((fract(s*34.)-.5)*14.,2.))*.5*env;
    col += vec3(2.0,1.3,.4)*(h1+h2+rungs)*uHelix;
    col += vec3(1.6,1.0,.3)*(exp(-pow((P.y-hy1)/.05,2.))*.08+exp(-pow((P.y-hy2)/.05,2.))*.08)*uHelix*env;
  }
  // soft fade at the plane's border
  vec2 qe=abs(P/vec2(7.4,3.6));
  col*=1.-smoothstep(.8,1.,max(qe.x,qe.y));
  gl_FragColor=vec4(col*uW,1.);
}`;

export default function Language() {
  const scene = useScene();
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uT: { value: 0 }, uGhost: { value: 0 }, uHelix: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: FS,
  }), []);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(() => {
    if (!scene.active) return;
    const f = world.stationF;
    const e65 = eventPos('language-shares-simulations'), e66 = eventPos('language-foxp2');
    const u = mat.uniforms;
    u.uW.value = scene.weight; u.uT.value = scene.t; u.uTime.value = world.reduced ? 0 : world.time;
    u.uGhost.value = range(e65 - 0.5, e65 + 0.4, f);
    u.uHelix.value = near(e66, 0.8);
  });
  return <mesh material={mat} position={[0, 0.2, 0]}><planeGeometry args={[15, 7.4]} /></mesh>;
}
