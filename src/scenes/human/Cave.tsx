import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL } from './common';

export const caveX = (t: number) => -5.8 + t * 11.6;

// Two compositions on one long wall: a single hand stencil (cave art), then a single flute sounding (bone flutes).
const HAND_X = -1.1; // world x of the stencil (camera looks ~1.7 to the left of it at event 68)
const FLUTE_X = 4.6;
const HAND_Y = 0.15;

const FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uCam,uRip,uRipPh,uHand;
varying vec2 vP;
float sdSeg(vec2 p, vec2 a, vec2 b, float r){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r;}
float sdSeg2(vec2 p, vec2 a, vec2 b, float r0, float r1){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-mix(r0,r1,h);}
float sdEll(vec2 p, vec2 c, vec2 r){ vec2 q=(p-c)/r; return (length(q)-1.)*min(r.x,r.y); }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float sdHand(vec2 p){
  // palm + wrist with slight taper, four fingers + a splayed thumb, knuckle bumps
  float d = sdEll(p, vec2(0.,-.02), vec2(.44,.5));
  d = smin(d, sdSeg2(p, vec2(.0,-.3), vec2(.03,-1.6), .27, .24), .12);
  d = smin(d, sdSeg2(p, vec2(-.3,-.12), vec2(-.98,.36), .15, .085), .12);        // thumb
  d = smin(d, sdSeg2(p, vec2(-.3,.3), vec2(-.5,1.18), .115, .072), .06);         // index
  d = smin(d, sdSeg2(p, vec2(-.1,.4), vec2(-.12,1.38), .115, .074), .06);        // middle
  d = smin(d, sdSeg2(p, vec2(.12,.38), vec2(.24,1.2), .108, .068), .06);         // ring
  d = smin(d, sdSeg2(p, vec2(.3,.22), vec2(.58,.84), .1, .062), .06);            // little
  return d;
}
float sdBison(vec2 p){ // facing left
  float d = sdEll(p, vec2(.1,0.), vec2(.78,.46));
  d = smin(d, sdEll(p, vec2(-.3,.3), vec2(.5,.42)), .25);        // hump
  d = smin(d, sdEll(p, vec2(-.95,-.12), vec2(.3,.27)), .2);       // head
  d = smin(d, sdSeg2(p, vec2(-1.05,-.3), vec2(-.9,-.62), .08, .02), .08); // beard
  d = smin(d, sdSeg2(p, vec2(-.9,.1), vec2(-.82,.3), .035, .01), .02);   // horn
  d = smin(d, sdSeg2(p, vec2(.62,.15), vec2(.95,-.35), .05, .015), .04); // tail
  d = smin(d, sdSeg2(p, vec2(-.45,-.3), vec2(-.5,-.88), .1, .045), .08);
  d = smin(d, sdSeg2(p, vec2(-.1,-.35), vec2(-.05,-.9), .09, .045), .08);
  d = smin(d, sdSeg2(p, vec2(.45,-.3), vec2(.5,-.9), .1, .045), .08);
  d = smin(d, sdSeg2(p, vec2(.7,-.2), vec2(.78,-.86), .09, .045), .08);
  return d;
}
float sdHorse(vec2 p){ // facing right
  float d = sdEll(p, vec2(0.,0.), vec2(.7,.3));
  d = smin(d, sdSeg2(p, vec2(.55,.1), vec2(.95,.62), .2, .1), .15);   // neck
  d = smin(d, sdSeg2(p, vec2(.9,.62), vec2(1.3,.42), .1, .06), .08);  // head
  d = smin(d, sdSeg2(p, vec2(-.7,.1), vec2(-1.0,-.3), .06, .02), .06);
  d = smin(d, sdSeg2(p, vec2(.5,-.15), vec2(.55,-.9), .07, .035), .06);
  d = smin(d, sdSeg2(p, vec2(.3,-.2), vec2(.22,-.88), .07, .035), .06);
  d = smin(d, sdSeg2(p, vec2(-.4,-.15), vec2(-.5,-.9), .08, .035), .06);
  d = smin(d, sdSeg2(p, vec2(-.55,-.1), vec2(-.7,-.88), .08, .035), .06);
  d = smin(d, sdSeg2(p, vec2(.88,.7), vec2(.8,.84), .03, .01), .02);
  return d;
}
// rock relief: broad undulation + bedding strata + ridged cracks + fine pitting
float H(vec2 P){
  float h = fbm(vec3(P*1.1,1.))*.55 + fbm(vec3(P*4.5,4.))*.25;
  float strata = sin((P.y + fbm(vec3(P*.7,9.))*1.4)*7.)*.045;
  float cr = 1.-abs(2.*fbm(vec3(P*2.2,13.))-1.); cr = pow(cr,9.)*.22;
  float pit = vnoise(vec3(P*21.,2.))*.025;
  return h + strata - cr + pit;
}
void main(){
  vec2 P=vP;
  float e=.012;
  float h=H(P);
  float hx=H(P+vec2(e,0.)), hy=H(P+vec2(0.,e));
  vec3 n=normalize(vec3((h-hx)/e*.55,(h-hy)/e*.55,1.));
  float fl=.9+.1*sin(uTime*7.+sin(uTime*2.7)*3.)+.04*sin(uTime*13.);

  vec2 hc=vec2(${HAND_X.toFixed(2)}, ${(HAND_Y + 0.3).toFixed(2)});
  vec2 fc=vec2(${FLUTE_X.toFixed(2)}, .3);
  // a torch held low and to the right of the hand: warm, flickering, raking light
  vec2 tc=hc+vec2(1.9,-.9);
  vec3 TL=vec3(tc-P, 1.1);
  float td=length(TL); TL/=td;
  float torch=(1./(.45+td*td*.28))*fl;
  float tdif=max(dot(n,TL),0.);
  float pool = (exp(-dot(P-hc,P-hc)*.2)*uHand + exp(-dot(P-fc,P-fc)*.3)*uRip);
  float torchK = uHand*smoothstep(5.5,0.,td);
  vec3 L=normalize(vec3(.4,.5,.8));
  float dif=max(dot(n,L),0.);
  // stone: cool grey ambient + warm raking torch; pits and cracks go dark
  float cav = smoothstep(.0,.5,h)*.7+.3;
  vec3 rock = vec3(.9,.92,1.)*(.006+.05*dif)*pool*fl*cav;
  rock += vec3(1.5,.62,.17)*tdif*torch*.12*torchK*cav;
  rock += vec3(1.,.5,.15)*pow(tdif,6.)*torch*.07*torchK; // glints on the wet ridges

  // --- hand stencil: pigment blown around the hand, the hand itself left bare ---
  vec2 hp=(P-hc)/1.0 + vec2(0.,0.15);
  float wob=(fbm(vec3(P*9.,3.))-.5)*.035;
  float d=sdHand(hp) + wob;
  float reach=uHand*1.35;
  float spray = exp(-max(d,0.)*5.2);
  // two grain scales: fine mist + coarser blown flecks, both pooling in the low rock
  float g1 = h21(floor(P*420.)), g2 = h21(floor(P*190.)+7.);
  float body = fbm(vec3(P*3.2, 7.))*.55;
  float mist = step(1.-spray*.85, g1*.78+body*.5) * step(0.,d);
  float fleck = step(1.-spray*spray*.5, g2*.8+body*.4) * step(0.,d);
  float falloff = smoothstep(reach, reach-.35, d);
  float edge = exp(-d*d*8000.) * step(-.015, d) * falloff * .45;     // dense line where the paint meets the hand
  float haze = exp(-max(d,0.)*8.)*.16*step(0.,d)*falloff;
  float tooth = .45+.9*(1.-smoothstep(.1,.6,h));                       // paint sits in the hollows
  float paint = (mist*.7 + fleck*.55 + haze + edge)*tooth*uHand*falloff;
  vec3 ochre = mix(vec3(1.6,.22,.06), vec3(1.9,.45,.12), fbm(vec3(P*6.,5.)));
  // light also scatters in the wet pigment near the torch
  paint *= .75 + .5*torchK*tdif;

  // --- ghost animals, barely there: a bison and a horse in the same pigment ---
  float bis = sdBison((P-hc-vec2(-3.4,.55))/1.15)*1.15;
  float hor = sdHorse((P-hc-vec2(3.3,-.25))/1.0);
  float gd = min(bis, hor) + (fbm(vec3(P*12.,8.))-.5)*.05;
  float ghost = (smoothstep(.02,-.02,gd)*.018 + exp(-gd*gd*2600.)*.05)*uHand;
  ghost *= step(.45, h21(floor(P*260.))*.6 + fbm(vec3(P*6.,2.))*.7 + .3);
  ghost *= smoothstep(1.2,.2,td*.5)*0.0+1.;

  // --- bone flute: a vulture-bone tube with finger holes, lit cool, singing rings ---
  vec2 q=(P-fc);
  float ca=cos(.95), sa=sin(.95);
  vec2 fp = vec2(ca*q.x+sa*q.y, -sa*q.x+ca*q.y);  // flute axis along y
  fp = vec2(fp.y, -fp.x)*1.;                       // axis along x
  float tb = clamp((fp.x+1.15)/2.3,0.,1.);
  float fr = .075 - .016*tb;
  float fd = sdSeg(vec2(fp.x, fp.y+.004*sin(fp.x*6.)), vec2(-1.15,0.), vec2(1.15,0.), fr);
  float cyl = clamp(fp.y/fr,-1.,1.);
  float nrm = sqrt(max(1.-cyl*cyl,0.));
  float fib = fbm(vec3(fp.x*26.,fp.y*90.,3.));
  float bone = (.35+.65*nrm*nrm) * (.8+.4*fib) * (.72+.28*smoothstep(-1.,1.,cyl)); // lit from upper side
  float holes=0.;
  for(int i=0;i<5;i++){ float hx2=-.45+float(i)*.28+(i>2?.07:0.); vec2 hh=(fp-vec2(hx2,0.))/vec2(.03,.034); holes=max(holes, 1.-smoothstep(.85,1.05,length(hh))); }
  float rim=0.; for(int i=0;i<5;i++){ float hx2=-.45+float(i)*.28+(i>2?.07:0.); vec2 hh=(fp-vec2(hx2,0.))/vec2(.03,.034); rim=max(rim, exp(-pow((length(hh)-1.05)*8.,2.))); }
  float fm = (1.-smoothstep(-.004,.004,fd)) * uRip;
  vec3 fluteC = vec3(1.15,1.1,1.0)*bone*(1.-holes*.95) + vec3(.6,.7,.9)*rim*.6;
  fluteC *= .6+.5*torchK*0.;
  float fglow = exp(-max(fd,0.)*18.)*uRip*.25;

  // --- flute: thin rings of sound, ageing outward, clean and few ---
  vec2 qq=(P-fc)*vec2(1.,1.12);
  float rr=length(qq);
  float ring=0.;
  float ph=uRipPh*.07;
  for(int i=0;i<5;i++){
    float a=fract(ph+float(i)*.2);
    float R=.25+a*3.6;
    float w=.012+.03*a;
    ring += exp(-pow((rr-R)/w,2.))*pow(1.-a,1.6)*smoothstep(0.,.08,a);
  }
  ring *= uRip;
  // faint grain in the rings so they read as air, not a vector circle
  ring *= .7+.5*fbm(vec3(P*30.+uTime*.2,1.));

  vec3 c = rock + ochre*paint*.8 + ochre*ghost*.9
         + fluteC*fm*.42 + vec3(.55,.7,1.)*fglow*.5 + vec3(ring)*vec3(1.05,1.1,1.25)*.3;
  vec2 qe=abs(vec2(P.x-uCam,P.y)/vec2(9.,4.5));
  float edgeM=1.-smoothstep(.7,1.,max(qe.x,qe.y));
  gl_FragColor=vec4(c,uW*edgeM);
}`;

export default function Cave() {
  const scene = useScene();
  const { wall } = useMemo(() => {
    const wall = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uCam: { value: 0 }, uRip: { value: 0 }, uRipPh: { value: 0 }, uHand: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy+vec2(0.,.3); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: FS,
    });
    return { wall };
  }, []);
  useEffect(() => () => { wall.dispose(); }, [wall]);

  useFrame(() => {
    if (!scene.active) return;
    const f = world.stationF;
    const cx = caveX(scene.t);
    const e68 = eventPos('cave-art'), e69 = eventPos('bone-flutes-music');
    const rip = near(e69, 0.45);
    const u = wall.uniforms;
    u.uW.value = scene.weight; u.uTime.value = world.reduced ? 0 : world.time; u.uCam.value = cx;
    u.uHand.value = range(e68 - 0.55, e68 + 0.1, f) * (1 - range(e68 + 0.2, e68 + 0.6, f));
    u.uRip.value = rip; u.uRipPh.value = f * 14 + (world.reduced ? 0 : world.time * 2.2);
  });
  return (
    <group>
      <mesh position={[0, 0, 0]} material={wall}><planeGeometry args={[40, 12]} /></mesh>
    </group>
  );
}
