import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { GLSL_UTIL } from './common';

// A clay tablet in raking light. First wedges are pressed into it row by row (cuneiform), then the same clay carries a
// handful of simple strokes: the first letters. Everything is one shader: relief height-field -> normals -> light.
const TW = 2.1, TH = 1.62;

const FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uE1,uE2,uAng;
varying vec2 vUv;
float sdRB(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float sdSeg(vec2 p, vec2 a, vec2 b){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

// one wedge: broad head at o, tapering to a point along angle a; returns pressed depth 0..1
float wedge(vec2 p, vec2 o, float a, float len, float w){
  vec2 q = rot(a)*(p-o);
  float t = q.x/len;
  float m = step(0.,t)*step(t,1.);
  float hw = w*.5*(1.-t*.92);
  float d = abs(q.y)-hw;
  float prof = smoothstep(.012,-.012,d);                // sharp-walled impression
  float deep = (1.-t*.55)*smoothstep(0.,.14,t+.1);
  return prof*m*deep; 
}
float cuneiform(vec2 p, out float fresh){
  float cols=7., rows=7.;
  vec2 g=(p+vec2(${(TW - 0.28).toFixed(2)},${(TH - 0.3).toFixed(2)}))/vec2(${(2 * (TW - 0.28)).toFixed(2)},${(2 * (TH - 0.3)).toFixed(2)})*vec2(cols,rows);
  fresh=0.;
  if(g.x<0.||g.x>=cols||g.y<0.||g.y>=rows) return 0.;
  vec2 id=floor(g), f=fract(g)-.5;
  float row=rows-1.-id.y;                                   // read top to bottom
  float hs=h21(id+3.7);
  if(hs<.16 || (row>=rows-1. && id.x>3.)) return 0.;         // gaps, short last line
  float order=(row*cols+id.x)/(rows*cols);
  float on=smoothstep(order*.95, order*.95+.05, uE1);
  float cell=.48; vec2 pc=f*cell*1.0;
  float n=1.+floor(h21(id+11.3)*3.99);
  float acc=0.;
  for(int k=0;k<4;k++){
    if(float(k)>=n) break;
    float fk=float(k);
    float r1=h21(id+fk*7.1+1.), r2=h21(id+fk*3.3+5.), r3=h21(id+fk*5.9+9.);
    bool hz = r3<.55, vt = r3>=.55 && r3<.85;
    float ang = hz ? 0. : (vt ? -1.5708 : (r3<.93 ? -.7854 : .7854));
    ang += (h21(id+fk+20.)-.5)*.05;
    vec2 o = hz ? vec2(-.2+r1*.05, (mod(fk,3.)-1.)*.12 + (r2-.5)*.02)
           : (vt ? vec2(-.13+fk*.09+r1*.02, .17+(r2-.5)*.02)
                 : vec2(-.12+fk*.07, .06-fk*.06));
    float L=.3+.05*r2, W=.1;
    acc=max(acc, wedge(pc,o,ang,L,W));
  }
  // freshly pressed: a moment of warm shine
  fresh = on*exp(-max(uE1-order*.95-.05,0.)*30.)*step(order*.95,uE1)*smoothstep(0.,.3,acc);
  return acc*on;
}
float glyph(int id, vec2 p){   // letters on [-.5,.5]^2, stroke distance
  float d=1e3;
  if(id==0){ d=min(sdSeg(p,vec2(-.38,-.45),vec2(0.,.45)),sdSeg(p,vec2(0.,.45),vec2(.38,-.45))); d=min(d,sdSeg(p,vec2(-.18,-.05),vec2(.2,-.05))); }
  else if(id==1){ d=min(sdSeg(p,vec2(-.3,.45),vec2(-.3,-.45)),sdSeg(p,vec2(-.3,.45),vec2(.25,.28))); d=min(d,sdSeg(p,vec2(.25,.28),vec2(-.3,.0))); d=min(d,sdSeg(p,vec2(-.3,.0),vec2(.3,-.2))); d=min(d,sdSeg(p,vec2(.3,-.2),vec2(-.3,-.45))); }
  else if(id==2){ d=abs(length(p*vec2(1.,.9))-.38); }
  else if(id==3){ d=min(sdSeg(p,vec2(-.32,.45),vec2(-.32,-.45)),sdSeg(p,vec2(-.32,.0),vec2(.32,.45))); d=min(d,sdSeg(p,vec2(-.32,.0),vec2(.32,-.45))); }
  else if(id==4){ d=min(sdSeg(p,vec2(-.4,-.4),vec2(-.4,.4)),sdSeg(p,vec2(-.4,.4),vec2(0.,-.1))); d=min(d,sdSeg(p,vec2(0.,-.1),vec2(.4,.4))); d=min(d,sdSeg(p,vec2(.4,.4),vec2(.4,-.4))); }
  else if(id==5){ d=min(sdSeg(p,vec2(-.42,.4),vec2(.42,.4)),sdSeg(p,vec2(0.,.4),vec2(0.,-.45))); d=min(d,sdSeg(p,vec2(-.28,-.1),vec2(.28,.1))); }
  else if(id==6){ d=min(sdSeg(p,vec2(-.3,.45),vec2(-.3,-.4)),sdSeg(p,vec2(-.3,-.4),vec2(.32,-.4))); d=min(d,sdSeg(p,vec2(-.3,.1),vec2(.2,.1))); }
  else if(id==7){ d=min(sdSeg(p,vec2(-.38,.45),vec2(0.,.0)),sdSeg(p,vec2(.38,.45),vec2(0.,.0))); d=min(d,sdSeg(p,vec2(0.,.0),vec2(0.,-.45))); }
  else { d=min(sdSeg(p,vec2(-.3,.45),vec2(-.3,-.45)),sdSeg(p,vec2(-.3,.45),vec2(.22,.3))); d=min(d,sdSeg(p,vec2(.22,.3),vec2(-.3,.05))); d=min(d,sdSeg(p,vec2(-.3,.05),vec2(.32,-.45))); }
  return d;
}
float letters(vec2 p, out float fresh){
  // two rows of five, centred
  fresh=0.;
  vec2 g=(p-vec2(-.0,.0))/vec2(.62,.7);
  vec2 id=floor(g+vec2(2.5,1.));
  if(id.x<0.||id.x>4.||id.y<0.||id.y>1.) return 0.;
  vec2 f=fract(g+vec2(2.5,1.))-.5;
  int gi=int(mod(id.x*2.+id.y*5.+id.y*3.,9.));
  float d=glyph(gi,f*1.15);
  float order=(id.y>.5?0.:.5)+id.x*.1;
  float on=smoothstep(order*.8, order*.8+.08, uE2);
  float w=.065;
  float prof=smoothstep(w,w-.035,d);
  fresh=on*exp(-max(uE2-order*.8-.08,0.)*25.)*step(order*.8,uE2)*prof;
  return prof*on*(1.-.25*h21(id));
}
float H(vec2 p, float d, out float fresh, out float fresh2){
  float cu=cuneiform(p,fresh);
  float le=letters(p,fresh2);
  float cuA=1.-uE2;                   // wedges soften away as letters appear
  float h = fbm(vec3(p*1.4,2.))*.2 + fbm(vec3(p*9.,6.))*.06 + vnoise(vec3(p*55.,3.))*.012;
  h += (1.-smoothstep(.0,.7,-d))*-.06;                   // pillow: crowned centre, falling to the edge
  h -= .05*exp(-pow((fract((p.y+${(TH-0.3).toFixed(2)})/${(2*(TH-0.3)/7).toFixed(4)})-.0)*7.,2.))*step(abs(p.x),${(TW-0.25).toFixed(2)})*step(abs(p.y),${(TH-0.25).toFixed(2)})*cuA*.0;
  h -= cu*.22*cuA + le*.2*uE2;
  // ruled guide lines between rows, barely there
  float rule=exp(-pow((fract((p.y+${TH.toFixed(2)})*(7./(2.*${(TH - 0.3).toFixed(2)}))+.5)-.5)*40.,2.))*.0;
  return h-rule;
}
void main(){
  vec2 p=(vUv-.5)*vec2(${(TW * 2 * 1.1).toFixed(3)},${(TH * 2 * 1.1).toFixed(3)});
  float d=sdRB(p,vec2(${TW.toFixed(2)},${TH.toFixed(2)}),.38);
  d+=(fbm(vec3(p*2.,1.))-.5)*.07;
  float inside=1.-smoothstep(-.004,.006,d);
  float e=.01; float f0,f1,f2,f3,f4,f5;
  float h0=H(p,d,f0,f1);
  float hx=H(p+vec2(e,0.),d,f2,f3), hy=H(p+vec2(0.,e),d,f4,f5);
  vec3 n=normalize(vec3((h0-hx)/e*.75,(h0-hy)/e*.75,1.));
  // pillow normal tilt toward the rim
  vec2 gd=vec2(sdRB(p+vec2(.02,0.),vec2(${TW.toFixed(2)},${TH.toFixed(2)}),.38)-sdRB(p-vec2(.02,0.),vec2(${TW.toFixed(2)},${TH.toFixed(2)}),.38), sdRB(p+vec2(0.,.02),vec2(${TW.toFixed(2)},${TH.toFixed(2)}),.38)-sdRB(p-vec2(0.,.02),vec2(${TW.toFixed(2)},${TH.toFixed(2)}),.38));
  n=normalize(n+vec3(-gd*.6*smoothstep(-.45,0.,d)*1.5,0.));
  vec3 L=normalize(vec3(cos(uAng)*.8,sin(uAng)*.75,.55));
  float dif=max(dot(n,L),0.);
  float sp=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),30.);
  // sun-dried clay: warm, uneven, flecked with grit
  float tone=fbm(vec3(p*2.4,9.));
  vec3 clay=mix(vec3(.62,.27,.09), vec3(.95,.5,.2), tone);
  clay*=.75+.5*fbm(vec3(p*14.,4.));
  float grit=step(.965,h21(floor(p*140.)))*.4;
  clay+=vec3(.6,.55,.5)*grit*.3;
  // wedge floors are a touch darker and cooler (compressed clay)
  float pressed=smoothstep(-.03,-.14,h0-.0);
  float ao=.55+.45*smoothstep(-.35,.0,h0-.02);
  vec3 col=clay*(.07+1.0*dif)*ao + vec3(1.,.8,.6)*sp*.06;
  col+=vec3(2.4,1.1,.35)*(max(f0,f1))*.5;
  col*=.5+.5*smoothstep(1.9,.3,length(p*vec2(.8,1.)));
  // rim light on the crown of the edge
  col+=vec3(1.1,.62,.3)*exp(-pow((d+.015)/.02,2.))*.2;
  gl_FragColor=vec4(col,inside*uW);
}`;

export default function Writing() {
  const scene = useScene();
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uE1: { value: 0 }, uE2: { value: 0 }, uAng: { value: 2.2 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: FS,
  }), []);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(() => {
    if (!scene.active) return;
    const f = world.stationF;
    const e73 = eventPos('writing'), e74 = eventPos('alphabet');
    const u = mat.uniforms;
    u.uW.value = scene.weight * range(e73 - 0.7, e73 - 0.35, f);
    u.uTime.value = world.reduced ? 0 : world.time;
    u.uE1.value = range(e73 - 0.55, e73 + 0.15, f);
    u.uE2.value = range(e73 + 0.55, e74 - 0.05, f);
    u.uAng.value = 2.1 + Math.sin(scene.t * 3.0) * 0.18 + (world.reduced ? 0 : Math.sin(world.time * 0.15) * 0.03);
  });
  return (
    <mesh material={mat} position={[1.3, 0.3, 0]} rotation={[-0.1, 0.16, 0.025]}>
      <planeGeometry args={[TW * 2 * 1.1, TH * 2 * 1.1]} />
    </mesh>
  );
}
