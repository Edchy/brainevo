import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL } from './common';

// 75: "I think": a single orb of luminous filaments inside a thin engraved shell.
// 76: a wooden screw press, raymarched; its sheets fly off into the dark, set in two columns of type.

const BB_VS = 'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';

// ---------------- the mind ----------------
const ORB_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uPulse; varying vec3 vWorld;
void main(){
  vec3 ro=cameraPosition, rd=normalize(vWorld-cameraPosition);
  vec3 c0=vec3(0.,.1,0.); float R=1.05;
  vec3 oc=ro-c0; float b=dot(oc,rd), cc=dot(oc,oc)-R*R, h=b*b-cc;
  vec3 col=vec3(0.);
  float t=uTime*.12;
  // glow halo around the sphere
  float dMin=length(cross(rd,c0-ro));
  col+=vec3(.55,.62,.9)*exp(-pow(max(dMin-R,0.)*2.6,2.))*.035*(1.+uPulse*.5);
  if(h>0.){
    float s=sqrt(h); float t0=-b-s, t1=-b+s;
    vec3 pF=ro+rd*t0; vec3 nF=normalize(pF-c0);
    // inside: filaments, ridged noise integrated along the chord
    float acc=0.; vec3 tint=vec3(0.);
    for(int i=0;i<10;i++){
      float u=(float(i)+.5)/10.; vec3 q=ro+rd*mix(t0,t1,u)-c0;
      float rr=length(q)/R;
      vec3 w=q*2.1; w.xz*=mat2(cos(t),-sin(t),sin(t),cos(t));
      float f1=1.-abs(2.*fbm(w+vec3(0.,t*.6,0.))-1.);
      float f2=1.-abs(2.*fbm(w*2.3+7.+vec3(t*.4))-1.);
      float fil=pow(f1,28.)*2.4+pow(f2,32.)*1.8;
      acc+=fil*(.35+.65*rr)*(1.-smoothstep(.96,1.,rr));
    }
    acc/=10.;
    col+=vec3(1.1,1.12,1.3)*acc*1.5*(1.+uPulse*.8);
    // a hotter nucleus
    col+=vec3(1.5,1.25,.8)*exp(-dMin*dMin*9.)*.05*(1.+uPulse);
    // engraved shell: meridians and parallels in thin lines, rotating slowly
    vec3 ns=nF; ns.xz*=mat2(cos(t*1.5),-sin(t*1.5),sin(t*1.5),cos(t*1.5));
    float lat=asin(clamp(ns.y,-1.,1.)), lon=atan(ns.z,ns.x);
    float gl=exp(-pow((fract(lat/.2618+.5)-.5)*20.,2.)) + exp(-pow((fract(lon/.3927)-.5)*20.*max(.2,cos(lat)),2.))*step(abs(lat),1.3);
    float fres=pow(1.-max(dot(nF,-rd),0.),2.4);
    col+=vec3(.8,.9,1.2)*(gl*(.1+.45*fres) + fres*.55);
    // specular glint, as on glass
    vec3 L=normalize(vec3(-.5,.7,.6)); col+=vec3(1.)*pow(max(dot(reflect(-L,nF),-rd),0.),60.)*.9;
  }
  // thought rings in the dark, thin and few
  float ry=(vWorld.y-c0.y);
  vec2 pr=vec2(length(vWorld.xz-c0.xz), ry*3.2);
  for(int k=0;k<3;k++){
    float ph=fract(uTime*.05+float(k)/3.);
    float rad=1.45+ph*3.2; float d2=abs(length(pr)-rad);
    col+=vec3(.7,.8,1.)*exp(-pow(d2/.012,2.))*(1.-ph)*(1.-ph)*smoothstep(0.,.15,ph)*.22*step(abs(ry),.001+3.);
  }
  gl_FragColor=vec4(col*uW*.4,1.);
}`;

// ---------------- the press ----------------
const PRESS_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uTurn,uDown,uPage; varying vec3 vWorld;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p,b-r)-r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
// material ids: 1 wood, 2 iron, 3 forme/paper, 4 brass
vec2 map(vec3 p){
  vec2 r=vec2(1e3,0.);
  float down=uDown;
  float platY=-.18-down*.46;
  // frame: two posts, head beam, base bed (soft chamfers)
  float posts=min(sdRBox(p-vec3(-.66,0.,0.),vec3(.085,1.,.13),.025), sdRBox(p-vec3(.66,0.,0.),vec3(.085,1.,.13),.025));
  float beam=sdRBox(p-vec3(0.,.98,0.),vec3(.8,.11,.2),.03);
  float foot=min(sdRBox(p-vec3(-.66,-1.05,0.),vec3(.2,.07,.3),.03), sdRBox(p-vec3(.66,-1.05,0.),vec3(.2,.07,.3),.03));
  float bed=sdRBox(p-vec3(0.,-.86,0.),vec3(.82,.07,.34),.025);
  float wood=min(min(posts,beam),min(foot,bed));
  // a brace under the head
  wood=min(wood, sdCap(p,vec3(-.6,.8,0.),vec3(-.3,.9,0.),.035));
  wood=min(wood, sdCap(p,vec3(.6,.8,0.),vec3(.3,.9,0.),.035));
  r=vec2(wood,1.);
  // screw with a true helical thread
  vec3 q=p-vec3(0.,0.,0.);
  float ang=atan(q.z,q.x);
  float ph=q.y*2.*3.14159/.15 - ang + uTurn*1.;
  float th=.5+.5*sin(ph);
  float rr=length(q.xz);
  float sTop=1.55-down*.46, sBot=platY+.05;
  float screw=(rr-(.115+.024*th))*.7;
  screw=max(screw, max(q.y-sTop, sBot-q.y));
  // collar where it passes the beam
  float collar=max(rr-.17,abs(p.y-.98)-.14);
  collar=max(collar, -(rr-.115));
  float iron=min(screw,collar);
  // lever bar through the screw head, swinging with the turn
  float ly=1.3-down*.46;
  vec3 dir=vec3(cos(uTurn*.62),0.,sin(uTurn*.62));
  float bar=sdCap(p,vec3(0.,ly,0.)-dir*1.12,vec3(0.,ly,0.)+dir*1.12,.042);
  float knobs=min(length(p-vec3(0.,ly,0.)-dir*1.14)-.1, length(p-vec3(0.,ly,0.)+dir*1.14)-.1);
  float hub=sdCap(p,vec3(0.,ly-.08,0.),vec3(0.,ly+.08,0.),.13);
  float lever=min(bar,min(knobs,hub));
  // platen (iron-bound plank)
  float platen=sdRBox(p-vec3(0.,platY,0.),vec3(.48,.055,.3),.02);
  if(iron<r.x) r=vec2(iron,2.);
  if(lever<r.x) r=vec2(lever,4.);
  if(platen<r.x) r=vec2(platen,2.);
  // the forme: a bed of type on the carriage, with a printed sheet when pressed
  float forme=sdRBox(p-vec3(0.,-.755,0.),vec3(.44,.03,.26),.01);
  if(forme<r.x) r=vec2(forme,3.);
  return r;
}
vec3 nrm(vec3 p){ vec2 e=vec2(.0015,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float ao(vec3 p, vec3 n){ float o=0.,s=1.; for(int i=1;i<=4;i++){ float d=float(i)*.07; o+=(d-map(p+n*d).x)*s; s*=.6; } return clamp(1.-o*2.2,0.,1.); }
void main(){
  vec3 rd=normalize(vWorld-cameraPosition);
  vec3 ro=(cameraPosition-vec3(0.,.3,0.))/1.5;
  vec3 c0=vec3(0.,.0,0.); float RB=1.75; vec3 o2=ro-c0; float b2=dot(o2,rd), h2=b2*b2-(dot(o2,o2)-RB*RB);
  vec3 col=vec3(0.);
  float tN=-b2-sqrt(max(h2,0.));
  if(h2>0.){
    float t=max(tN,0.), tm=-b2+sqrt(h2);
    float mid=0.; bool hit=false; vec2 m;
    for(int i=0;i<70;i++){
      vec3 p=ro+rd*t; m=map(p);
      if(m.x<.0012){ hit=true; break; }
      t+=m.x*.9; if(t>tm) break;
    }
    if(hit){
      vec3 p=ro+rd*t; vec3 n=nrm(p);
      float oc2=ao(p,n);
      vec3 Lk=normalize(vec3(-.9,1.1,1.2)); vec3 Lr=normalize(vec3(.9,.5,-.8));
      float dk=max(dot(n,Lk),0.), dr=max(dot(n,Lr),0.);
      float fres=pow(1.-max(dot(n,-rd),0.),3.);
      vec3 alb; float spec=0.; float sp=20.;
      if(m.y<1.5){ // wood: warm, grain along the member's long axis
        float grain=fbm(vec3(p.x*9.,p.y*2.2,p.z*9.));
        float g2=fbm(vec3(p.x*40.,p.y*6.,p.z*40.));
        alb=mix(vec3(.26,.12,.045),vec3(.55,.3,.12),grain)*(.8+.4*g2);
        spec=.06; sp=14.;
      } else if(m.y<2.5){ alb=vec3(.42,.42,.48)*(.7+.5*fbm(p*18.)); spec=.9; sp=36.; }
      else if(m.y<3.5){ // type and paper
        float ty=step(.5,fract(p.x*60.))*step(.5,fract(p.z*60.));
        alb=mix(vec3(.12,.1,.09),vec3(1.0,.95,.85),mix(uPage,ty,.35*(1.-uPage)+0.0)); spec=.1; }
      else { alb=vec3(.95,.62,.2); spec=1.; sp=40.; }
      col=alb*(.045 + dk*vec3(1.55,1.0,.55)*.8 + dr*vec3(.35,.45,.7)*.45)*oc2;
      col+=vec3(1.,.95,.9)*spec*pow(max(dot(reflect(-Lk,n),-rd),0.),sp)*dk;
      col+=vec3(.5,.6,.9)*fres*.18*oc2;
      // soft warm bounce on the underside of the head
      col+=vec3(.9,.45,.15)*.07*max(-n.y,0.)*oc2;
    }
  }
  // lantern haze behind the press
  float dd=length(cross(rd,c0-ro));
  col+=vec3(2.2,1.1,.4)*exp(-dd*dd*.9)*.06;
  gl_FragColor=vec4(col*uW,1.);
}`;

// ---------------- the sheets ----------------
const PAGE_VS = /* glsl */ `
attribute vec4 aI; uniform float uFlood,uTime,uW; varying vec2 vUv; varying float vA; varying float vSh; varying float vId;
mat3 rotAxis(vec3 ax, float an){ ax=normalize(ax); float s=sin(an),c=cos(an),o=1.-c;
  return mat3(o*ax.x*ax.x+c, o*ax.x*ax.y+ax.z*s, o*ax.z*ax.x-ax.y*s,
              o*ax.x*ax.y-ax.z*s, o*ax.y*ax.y+c, o*ax.y*ax.z+ax.x*s,
              o*ax.z*ax.x+ax.y*s, o*ax.y*ax.z-ax.x*s, o*ax.z*ax.z+c); }
void main(){
  vUv=uv; vId=aI.x;
  float ts=aI.x*.85;
  float age=uFlood-ts;
  float alive=step(0.,age);
  float k=max(age,0.);
  float an=aI.y*6.283;
  float spread=.35+aI.z*1.4;
  vec3 dir=normalize(vec3((cos(an)>0.?1.:-1.)*(.8+spread*1.3), .1+aI.w*.9, .1+sin(an)*.35));
  float dist=.3+pow(k*6.,1.15)*(.5+aI.w*.9);
  vec3 origin=vec3(0.,-.5,.5);
  vec3 pos=origin+dir*dist;
  pos.y+=sin(uTime*.6+aI.x*30.)*.04*k*10.;
  pos.y-=k*k*8.*aI.z;
  float spin=k*10.*(aI.y-.5)*3.+uTime*.3*(aI.z-.5);
  mat3 R=rotAxis(vec3(aI.w-.5,aI.y,aI.z-.5+.1),spin+aI.x*6.);
  float sc=smoothstep(0.,.03,k)*alive;
  vec4 mv=modelViewMatrix*vec4(pos+R*position*sc,1.);
  gl_Position=projectionMatrix*mv;
  vA=alive*smoothstep(0.,.08,k)*smoothstep(.0,.8,dist)*(1.-smoothstep(5.,8.,dist))*uW;
  vSh=.5+.5*dot(normalize(R*vec3(0.,0.,1.)),normalize(vec3(-.3,.5,.8)));
}`;
const PAGE_FS = /* glsl */ `${GLSL_UTIL}
varying vec2 vUv; varying float vA; varying float vSh; varying float vId;
float letter(vec2 cell, vec2 f){        // a little black-letter: stems, a bowl or a bar, per cell hash
  float h=h21(cell); float h2=h21(cell+9.1);
  float stem=smoothstep(.2,.14,abs(f.x-(.3+.2*h2)))*step(.12,f.y)*step(f.y,.88);
  float bar=smoothstep(.12,.08,abs(f.y-(.3+.35*h)))*step(.2,f.x)*step(f.x,.8)*step(.35,h2);
  float stem2=smoothstep(.2,.14,abs(f.x-.75))*step(.12,f.y)*step(f.y,.7)*step(.55,h);
  float dot_=smoothstep(.14,.1,length(f-vec2(.5,.95)))*step(.78,h2);
  return max(max(stem,bar),max(stem2,dot_));
}
void main(){
  vec2 uv=vUv;
  float inP=step(.07,uv.x)*step(uv.x,.93)*step(.06,uv.y)*step(uv.y,.94);
  float ink=0.;
  // two columns, each with ruled lines of "words"
  float col=step(.5,uv.x); float cx=fract(uv.x*2.);
  float colM=step(.08,cx)*step(cx,.92);
  float rows=34.;
  float ry=(1.-uv.y)*rows; float rid=floor(ry); float rf=fract(ry);
  float rowOn=step(.08,rf)*step(rf,.95)*step(2.,rid)*step(rid,rows-3.);
  float cols=16.; float gx=(cx-.08)/.84*cols; float gid=floor(gx); float gf=fract(gx);
  // word breaks and short last lines
  float wb=step(.18,h21(vec2(floor(gid/3.)+rid*7.,col+11.)));
  float short_=step(gid/cols, .35+.65*h21(vec2(rid,col+3.)));
  float g=letter(vec2(gid,rid+col*50.),vec2(gf,(rf-.08)/.87));
  ink=g*wb*short_*rowOn*colM;
  // headline line and a drop cap
  float head=step(.88,uv.y)*step(uv.y,.92)*step(.12,uv.x)*step(uv.x,.88)*step(.35,fract(uv.x*40.));
  float dcap=step(.1,cx)*step(cx,.2)*step(.67,uv.y)*step(uv.y,.8)*(1.-col)*(.55+.45*step(.5,fract(uv.x*60.+uv.y*20.)));
  ink=max(max(ink,head*.9),dcap);
  // paper with faint laid lines and a deckled edge
  float paper=.78+.18*fbm(vec3(uv*18.,2.))-.1*smoothstep(.0,.08,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)))*0.;
  float bd=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
  paper*=.6+.4*smoothstep(0.,.06,bd);
  float inkAmt=ink*inP;
  vec3 c=vec3(1.0,.92,.78)*paper*(.18+.55*vSh)*(1.-.88*inkAmt);
  // gold edge light
  c+=vec3(1.5,.9,.3)*(1.-smoothstep(0.,.015,bd))*.2*vSh;
  gl_FragColor=vec4(c*vA*1.3,1.);
}`;

export default function Enlightenment() {
  const scene = useScene();
  const { orb, press, pageGeo, pageMat } = useMemo(() => {
    const mk = (fs: string, uni: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: uni, vertexShader: BB_VS, fragmentShader: fs,
    });
    const orb = mk(ORB_FS, { uW: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 } });
    const press = mk(PRESS_FS, { uW: { value: 0 }, uTime: { value: 0 }, uTurn: { value: 0 }, uDown: { value: 0 }, uPage: { value: 0 } });
    // sheets
    const NP = Math.floor(44 * Math.max(0.6, world.quality));
    const base = new THREE.PlaneGeometry(0.8, 1.1);
    const pageGeo = new THREE.InstancedBufferGeometry();
    pageGeo.index = base.index;
    pageGeo.setAttribute('position', base.getAttribute('position'));
    pageGeo.setAttribute('uv', base.getAttribute('uv'));
    const ai = new Float32Array(NP * 4);
    let sd = 112;
    const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < NP; i++) { ai[i * 4] = (i + rr() * 0.5) / NP; ai[i * 4 + 1] = rr(); ai[i * 4 + 2] = rr(); ai[i * 4 + 3] = rr(); }
    pageGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(ai, 4));
    pageGeo.instanceCount = NP;
    pageGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const pageMat = new THREE.ShaderMaterial({
      transparent: false, depthWrite: true, side: THREE.DoubleSide,
      uniforms: { uFlood: { value: 0 }, uTime: { value: 0 }, uW: { value: 0 } },
      vertexShader: PAGE_VS, fragmentShader: PAGE_FS,
    });
    return { orb, press, pageGeo, pageMat };
  }, []);
  useEffect(() => () => { orb.dispose(); press.dispose(); pageGeo.dispose(); pageMat.dispose(); }, [orb, press, pageGeo, pageMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e75 = eventPos('philosophy-of-mind'), e76 = eventPos('printing-press');
    const A = 1 - range(e76 - 0.5, e76 - 0.12, f);
    const B = range(e76 - 0.5, e76 - 0.2, f);
    const tm = world.reduced ? 0 : world.time;
    orb.uniforms.uW.value = scene.weight * A; orb.uniforms.uTime.value = tm; orb.uniforms.uPulse.value = near(e75, 0.5);
    press.uniforms.uW.value = scene.weight * B; press.uniforms.uTime.value = tm;
    // the screw turns with the scroll; a stroke every ~0.5 station, eased
    const stroke = (range(e76 - 0.35, e76 + 0.95, f)) * 3.0;
    const cyc = stroke - Math.floor(stroke);
    const pressDown = Math.sin(Math.min(1, cyc * 1.6) * Math.PI) * 0.5 + 0.5 * 0;
    press.uniforms.uDown.value = pressDown * range(e76 - 0.5, e76 - 0.2, f);
    press.uniforms.uTurn.value = (range(e76 - 0.5, e76 + 0.95, f)) * 14 + pressDown * 3;
    press.uniforms.uPage.value = stroke > 0.6 ? 1 : 0;
    pageMat.uniforms.uW.value = scene.weight * B;
    pageMat.uniforms.uTime.value = tm;
    pageMat.uniforms.uFlood.value = range(e76 - 0.35, e76 + 0.95, f);
    // keep the billboards facing the camera about y
    const yaw = Math.atan2(state.camera.position.x, state.camera.position.z);
    for (const m of group.current?.children ?? []) if (m.userData.bb) m.rotation.y = yaw;
  });
  const group = { current: null as THREE.Group | null };
  return (
    <group ref={(g) => { group.current = g; }} position={[0, 0.2, 0]}>
      <mesh userData={{ bb: true }} material={orb} position={[0, 0.1, 0]} frustumCulled={false}><planeGeometry args={[6.5, 5]} /></mesh>
      <mesh userData={{ bb: true }} material={press} position={[0, 0.1, 0]} frustumCulled={false}><planeGeometry args={[6.8, 6.8]} /></mesh>
      <mesh geometry={pageGeo} material={pageMat} frustumCulled={false} />
    </group>
  );
}
