/* GLSL for the procedural brain. Coordinates: +x anterior, +y up, +z lateral. */

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/** shape uniforms + anatomy functions shared by every shader */
export const SHAPE = /* glsl */ `
uniform float uTime;
uniform float uTube,uTilt,uStemX,uStemY,uStemLen,uStemR,uPons;
uniform vec3 uCer, uCerOff;
uniform float uFold,uFF,uFiss,uHemi,uPrim,uTemporal,uFrontal,uGlob,uOcc,uFlat;
uniform float uOlfS,uOlfX;
uniform float uCbS,uCbFolia,uCbK,uCbAt; uniform vec2 uCb;
uniform float uTecS;

float foldAmp(float fold){ return smoothstep(0.03,0.3,fold); }
float profileW(float fold){ return mix(0.12,0.5,fold); }
// fold cross-section: a narrow sulcus floor rising into a domed gyral crown (not a flat plateau with cliff walls, which
// the mesh cannot resolve and renders as zipper-serrated edges)
float profile(float n1,float n2,float fold){
  float s=clamp(abs(n1)/profileW(fold),0.,1.);
  float h1=1.-pow(1.-s,1.8);
  float h2=smoothstep(0.,.4,abs(n2));
  return mix(1.,h1*(0.93+0.07*h2),foldAmp(fold));
}
float foldDepth(){ return 0.05*dot(uCer,vec3(.3333)); }

// Gyri follow regional grain, not isotropic noise (whose zero-sets close into brain-coral loops). On the unit direction d
// (+x front, +y up, |z| lateral) a smooth flow field says which way the folds run: frontal gyri front-to-back, the
// pre/postcentral gyri down the side leaning forward, temporal gyri horizontal, parietal/occipital looser and oblique.
// Noise is stretched along that direction, so its zero lines (the sulci) become long, roughly parallel, evenly spaced folds.
vec3 gyralFlow(vec3 d,out float aniso){
  vec3 a=vec3(d.x,d.y,abs(d.z));
  float wc=exp(-pow(dot(a,vec3(.93,.09,-.37))/.3,2.))*smoothstep(-.15,.25,d.y);
  float wt=smoothstep(.05,-.35,d.y)*smoothstep(.25,.6,a.z)*smoothstep(-.8,-.4,d.x);
  float wf=smoothstep(-.05,.35,d.x)*(1.-wc)*(1.-wt);
  float wp=smoothstep(.05,-.35,d.x)*(1.-wc)*(1.-wt);
  vec3 t=vec3(1.,.1,0.)*wf+vec3(.42,-.9,0.)*wc*sign(d.y+.5)+vec3(1.,.18,0.)*wt+vec3(.6,.75,0.)*wp+vec3(1.,0.,0.)*.05;
  aniso=clamp(wf*.85+wc*1.+wt*.6+wp*.4,0.,1.);
  return normalize(t);
}
float gyri(vec3 d,float f,out float n2){
  float an; vec3 t=gyralFlow(d,an);
  vec3 q=d*f;
  q-=t*dot(q,t)*(1.-1./mix(1.,2.,an));      // lower frequency along the grain = elongated folds
  vec3 w=vec3(snoise(q*.55+1.7),snoise(q*.55+8.3),snoise(q*.55+15.1));
  q+=.5*w;                                    // gentle meander only
  n2=snoise(q*2.1+4.);
  return snoise(q);
}

vec2 axisDir(){
  vec2 v=normalize(vec2(-.28,-1.));
  return normalize(mix(vec2(-1.,0.),v,uTilt));
}
vec3 axialC(float s){
  vec2 dr=axisDir();
  vec2 nr=vec2(dr.y,-dr.x);
  vec2 c=vec2(uStemX,uStemY)+dr*s*uStemLen;
  float bow=mix(0.22*sin(min(s*1.7,1.)*3.14159)*uTilt, 0.34*sin(s*6.2)*(1.-s), uTube);
  c+=nr*bow;
  return vec3(c,0.);
}
float axialR(float s){
  float st=uStemR*(0.8+0.55*uPons*exp(-pow((s-0.27)/0.11,2.)));
  st*=mix(1.,mix(.8,.46,uTilt),smoothstep(0.5,1.,s));
  float tb=0.16+0.46*exp(-pow((s-0.075)/0.07,2.))+0.34*exp(-pow((s-0.27)/0.075,2.))+0.4*exp(-pow((s-0.47)/0.1,2.));
  tb*=1.-0.5*smoothstep(0.62,1.,s);
  float r=mix(st,tb,uTube);
  r*=sqrt(max(0.,1.-pow(1.-clamp(s/0.04,0.,1.),2.)));
  r*=1.-smoothstep(0.965,1.,s);
  return r;
}

vec3 axialShape(vec3 a,out vec4 aux){
  float s=clamp(a.x,0.,1.);
  vec3 c=axialC(s); float r=axialR(s);
  vec2 dr=axisDir(); vec2 nr=vec2(dr.y,-dr.x);
  vec2 off=nr*a.y*r*mix(1.,0.85,1.-uTube)+vec2(0.);
  vec3 p=c+vec3(off,a.z*r*1.12);
  // brainstem: subtle longitudinal ridges
  float rid=0.012*sin(atan(a.z,a.y)*6.+s*9.)*(1.-uTube);
  p+=vec3(nr*rid*a.y,rid*a.z);
  aux=vec4(s,0.,0.,0.);
  return p;
}

vec3 cerebrumShape(vec3 d,out vec4 aux){
  vec3 a=vec3(d.x,d.y,abs(d.z));
  vec3 R=uCer;
  vec3 s=vec3(1.);
  float below=smoothstep(0.,-.7,d.y);
  s.y*=1.-uFlat*.16*below;
  s.z*=1.-uOcc*.22*smoothstep(-.1,-1.,d.x);
  s.z*=1.+(uFrontal-.5)*.26*smoothstep(.1,1.,d.x);
  s.y*=1.+uFrontal*.1*smoothstep(.2,1.,d.x)*smoothstep(-.4,.3,d.y);
  s.y*=1.+uGlob*.11*smoothstep(0.,-.7,d.x)*smoothstep(0.,.7,d.y);
  s.x*=1.-uGlob*.04;
  // temporal lobe bulge (ventrolateral), pole reaching forward
  vec3 tv=normalize(vec3(.3,-.62,.74));
  float tb=exp(-(1.-dot(normalize(a),tv))*6.5);
  s*=1.+uTemporal*.42*tb;
  vec3 p=d*R*s;
  // longitudinal fissure / hemisphere split
  float fw=mix(.05,.24,uHemi);
  float fmask=mix(smoothstep(.12,.55,d.y),1.,uHemi);
  float fis=uFiss*exp(-pow(a.z/fw,2.))*fmask;
  p*=1.-.5*fis;
  // Sylvian fissure
  float yl=-.22+.45*(.35-a.x);
  float sy=uPrim*smoothstep(.3,.62,a.z)*exp(-pow((d.y-yl)/.05,2.))*smoothstep(-.9,-.5,d.x)*smoothstep(.75,.45,d.x);
  p*=1.-.07*sy;
  // central sulcus
  float cs=uPrim*exp(-pow(dot(a,vec3(.93,.09,-.37))/.035,2.))*smoothstep(.05,.3,a.y)*smoothstep(.98,.85,a.y);
  p*=1.-.045*cs;
  // gyri / sulci: grain-aligned ridged noise on the sphere of directions
  float n2;
  float n1=gyri(d,uFF*1.15,n2);
  float H=profile(n1,n2,uFold);
  float fm=1.-.75*exp(-pow(a.z/.07,2.));
  float dr=-foldDepth()*uFold*fm*(1.-H);
  float wob=snoise(d*1.9+3.)*.028+snoise(d*4.1+9.)*.012;
  vec3 nn=normalize(d/max(R*s,vec3(.02)));
  // unfolded (fish..early mammal) pallium is a smooth, glossy lobe: keep only a whisper of irregularity there
  p+=nn*(dr+wob*mix(.3,.4,uFold));
  p+=vec3(uCerOff.xy,0.);
  aux=vec4(n1,n2,fm,clamp(fis*1.2+sy+cs*.7,0.,1.));
  return p;
}

vec3 cerebellumShape(vec3 d,out vec4 aux){
  vec3 A=vec3(.85,.5,1.05)*uCbS;
  vec3 s=vec3(1.);
  s.y*=1.-.3*smoothstep(0.,-.6,d.y);
  s.x*=1.+.12*smoothstep(0.,-1.,d.x);
  vec3 p=d*A*s;
  float az=abs(d.z);
  p*=1.-.1*exp(-pow(az/.07,2.))*uCbFolia;
  float ph=d.y*uCbK+1.4*snoise(d*2.1+5.)+.5*d.x*uCbK*.08;
  float crest=smoothstep(0.,.55,abs(sin(ph)));
  vec3 nn=normalize(d/max(A*s,vec3(.02)));
  p+=nn*(-.03*uCbFolia*(1.-crest)*uCbS);
  {
    vec2 dr2=axisDir(); vec2 nr2=vec2(dr2.y,-dr2.x);
    float rr=axialR(uCbAt);
    float ext=abs(nr2.x)*A.x+abs(nr2.y)*A.y;
    p+=axialC(uCbAt)+vec3(nr2*(rr+ext*mix(.28,.55,uTilt)),0.)+vec3(uCb,0.);
  }
  aux=vec4(ph,0.,uCbFolia,0.);
  return p;
}

vec3 tectumShape(vec3 d,float side,out vec4 aux){
  float sT=.14;
  vec3 c=axialC(sT); float r=axialR(sT);
  vec2 dr=axisDir(); vec2 nr=vec2(dr.y,-dr.x);
  vec3 ctr=c+vec3(nr*r*.75,side*.4*uTecS);
  vec3 A=vec3(.56,.42,.4)*uTecS;
  vec3 p=ctr+d*A;
  p+=normalize(d/max(A,vec3(.02)))*.01*snoise(d*3.+side);
  aux=vec4(0.);
  return p;
}

vec3 bulbShape(vec3 d,float side,out vec4 aux){
  vec3 A=vec3(.28+.5*uOlfX,.2,.22)*uOlfS;
  vec3 ctr=vec3(uCerOff.x+uCer.x*.84+A.x*.75,uCerOff.y-uCer.y*.22,side*uCer.z*.34);
  vec3 p=ctr+d*A;
  p+=normalize(d/max(A,vec3(.02)))*.012*snoise(d*3.+side*2.);
  aux=vec4(0.);
  return p;
}

vec3 brainShape(float part,vec3 a,float side,out vec4 aux){
  if(part<.5) return cerebrumShape(a,aux);
  if(part<1.5) return cerebellumShape(a,aux);
  if(part<2.5) return axialShape(a,aux);
  if(part<3.5) return bulbShape(a,side,aux);
  return tectumShape(a,side,aux);
}
`;

export const VERT = /* glsl */ `
${NOISE}
${SHAPE}
attribute float aSide;
uniform float uPart; uniform vec3 uOff;
varying vec3 vN; varying vec3 vVp; varying vec3 vObj; varying vec3 vDir; varying vec4 vAux; varying float vFade;
void main(){
  vec4 aux; vec3 P=brainShape(uPart,position,aSide,aux);
  vec3 a1,a2; float inv=1.;
  if(uPart>1.5&&uPart<2.5){
    float ph=atan(position.z,position.y);
    a1=vec3(position.x+.004,position.y,position.z);
    a2=vec3(position.x,cos(ph+.05),sin(ph+.05));
    inv=-1.;
  } else {
    vec3 up=abs(position.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.);
    vec3 t1=normalize(cross(position,up)); vec3 t2=cross(position,t1);
    a1=normalize(position+.0035*t1); a2=normalize(position+.0035*t2);
  }
  vec4 xx;
  vec3 P1=brainShape(uPart,a1,aSide,xx);
  vec3 P2=brainShape(uPart,a2,aSide,xx);
  vec3 n=normalize(cross(P1-P,P2-P))*inv;
  vObj=P; P+=uOff;
  vec4 mv=modelViewMatrix*vec4(P,1.);
  vVp=mv.xyz; vN=normalize(normalMatrix*n); vDir=position; vAux=aux;
  vFade=(uPart>1.5&&uPart<2.5)?1.-smoothstep(.8,.99,position.x):1.;
  gl_Position=projectionMatrix*mv;
}`;

export const FRAG = /* glsl */ `
${NOISE}
${SHAPE}
uniform float uPart; uniform vec3 uOff;
uniform float uOpacity,uGlass,uHolo,uSliceOn,uTintAmt,uCap;
uniform vec3 uCamObj; uniform vec4 uSlice; // xyz normal, w offset (kept: dot(p,n)<=w)
uniform mat4 uVP;
uniform vec3 uTint,uPartGlow,uTissue,uHoloCol;
uniform vec4 uRegA[8]; uniform vec4 uRegB[8]; uniform float uRegK[8];
varying vec3 vN; varying vec3 vVp; varying vec3 vObj; varying vec3 vDir; varying vec4 vAux; varying float vFade;

float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }

vec3 perturb(vec3 N,vec3 P,float h){
  vec3 dpdx=dFdx(P),dpdy=dFdy(P);
  float dhx=dFdx(h),dhy=dFdy(h);
  vec3 R1=cross(dpdy,N),R2=cross(N,dpdx);
  float det=dot(dpdx,R1);
  vec3 g=sign(det)*(dhx*R1+dhy*R2);
  return normalize(abs(det)*N-0.45*g);
}

vec3 regions(vec3 dir,float crown){
  vec3 acc=vec3(0.);
  vec3 sd=vec3(dir.x,dir.y,abs(dir.z));
  for(int i=0;i<8;i++){
    vec3 c=uRegB[i].rgb;
    if(dot(c,c)<1e-6) continue;
    vec4 A=uRegA[i]; float k=uRegK[i];
    bool sym=k>1.5; float kind=k-(sym?2.:0.);
    vec3 dd=sym?sd:dir;
    float m;
    if(kind<.5){
      float ang=acos(clamp(dot(dd,A.xyz),-1.,1.));
      m=1.-smoothstep(0.,A.w,ang); m*=m;
    } else {
      vec3 nr=normalize(cross(A.xyz,vec3(0.,0.,1.)));
      float e=dot(dd,nr);
      m=(1.-smoothstep(0.,A.w,abs(e)))*smoothstep(.05,.45,dot(normalize(dd.xy+1e-4),normalize(A.xy)))*smoothstep(.0,.3,dd.y);
      m*=smoothstep(.0,.25,dot(dd.xy,A.xy)+.35);
    }
    float pulse=.82+.18*sin(uTime*2.4+float(i)*1.9+dir.x*4.);
    acc+=c*m*pulse*(.35+.95*crown);
  }
  return acc;
}

vec3 regionsCap(vec3 u){
  vec3 acc=vec3(0.); vec3 su=vec3(u.x,u.y,abs(u.z));
  for(int i=0;i<8;i++){
    vec3 c=uRegB[i].rgb;
    if(dot(c,c)<1e-6) continue;
    vec4 A=uRegA[i]; float k=uRegK[i];
    bool sym=k>1.5; float kind=k-(sym?2.:0.);
    vec3 uu=sym?su:u;
    float d;
    if(kind<.5) d=length(uu-A.xyz*.78)/(A.w*.62);
    else { vec3 nr=normalize(cross(A.xyz,vec3(0.,0.,1.))); d=abs(dot(normalize(uu),nr))/A.w+(1.-smoothstep(-.1,.3,dot(uu.xy,A.xy)))*3.; }
    float m=exp(-d*d*2.2);
    acc+=c*m*(.85+.15*sin(uTime*2.4+float(i)*1.9));
  }
  return acc;
}

void main(){
  float op=uOpacity*vFade;
  if(op<.995&&ign(gl_FragCoord.xy)>op) discard;
  bool front=gl_FrontFacing;
  vec3 Pb=vObj;
  float depthOut=gl_FragCoord.z;
  bool cap=false; vec3 q=vec3(0.);
  if(uSliceOn>.5){
    float sd=dot(Pb,uSlice.xyz)-uSlice.w;
    if(sd>0.) discard;
    if(!front){
      vec3 rd=normalize(Pb-uCamObj);
      float cd=dot(uCamObj,uSlice.xyz)-uSlice.w;
      float tq=-cd/dot(rd,uSlice.xyz);
      if(cd>0.&&tq>0.&&tq<length(Pb-uCamObj)){ cap=true; q=uCamObj+rd*tq; } else discard;
    }
  } else if(!front&&uGlass<.01&&uHolo<.01) discard;

  if(cap){
    vec4 clip=uVP*vec4(q+uOff,1.);
    gl_FragDepth=clip.z/clip.w*.5+.5;
    vec3 u=(q-vec3(uCerOff.xy,0.))/max(uCer,vec3(.02));
    vec3 col; float rr=length(u);
    if(uPart<.5){
      float wob=.035*snoise(u*6.)+.02*snoise(u*13.);
      vec3 dr=normalize(u+1e-4);
      float c2; float c1=gyri(dr,uFF*1.15,c2);
      float Hc=profile(c1,c2,uFold);
      // grey/white boundary follows the folds, as on an MRI slice: white matter reaches up into each gyrus and dips
      // deep under each sulcus, so the cortical ribbon convolutes instead of being a uniform rim
      float rc=mix(.9,.76+.16*Hc,uFold)+wob*.6;
      // white matter: bright, with faint fibre tracts radiating toward the cortex; grey matter: a distinct darker ribbon
      float fib=snoise(vec3(dr*vec3(26.,26.,26.))+rr*1.5)*.5+snoise(u*9.)*.5;
      vec3 wm=vec3(.8,.77,.73)*(.9+.1*fib), gm=vec3(.3,.27,.29);
      col=mix(wm,gm,smoothstep(rc-.02,rc+.01,rr));
      col*=1.-.1*step(.5,fract((rr-rc)/(1.-rc+.001)*6.))*smoothstep(rc-.01,rc+.02,rr);
      // CSF-dark sulcus: a thin line along the fold's zero, running from the surface down to just under the ribbon
      float sulc=(1.-smoothstep(.02,.07,abs(c1)))*smoothstep(rc-.07,rc-.01,rr)*uFold;
      col=mix(col,vec3(.03),sulc);
      float ca=abs(u.z);
      float vent=length(vec3((u.x-.02)/.5,(u.y-.14)/.13,(ca-.2)/.1))*1.0;
      vent=min(vent,length(vec3((u.x-.42)/.17,(u.y-.12)/.15,(ca-.16)/.07)));
      col=mix(col,vec3(.02),1.-smoothstep(.85,1.,vent));
      float th=length(vec3((u.x+.1)/.17,(u.y+.02)/.15,(ca-.14)/.13));
      col=mix(col,gm*.95,1.-smoothstep(.9,1.05,th));
      float pu=length(vec3((u.x-.2)/.2,(u.y+.04)/.2,(ca-.42)/.11));
      col=mix(col,gm*1.05,1.-smoothstep(.9,1.05,pu));
      float cc=abs(length(vec2((u.x+.02)/.5,(u.y-.03)/.3))-1.)*(1.-smoothstep(.35,.5,ca));
      col+=vec3(.06)*(1.-smoothstep(0.,.05,cc))*step(.1,u.y);
      col*=1.-.55*smoothstep(.97,1.06,rr);
      col*=1.-.22*smoothstep(.35,.95,rr);                  // falls off toward the rim: the slice reads as a volume
      col+=regionsCap(u)*2.2;
    } else if(uPart<1.5){
      // cerebellum slice: grey folia around a branching white core (arbor vitae)
      float br=abs(sin(q.y*uCbK*.32+2.2*snoise(q*2.6)+q.x*3.));
      float core=smoothstep(.75,.0,length((q.xy-vec2(uCerOff.x-uCer.x*.55,uCerOff.y-uCer.y*.35))*vec2(1.,1.4)));
      col=mix(vec3(.3,.27,.29),vec3(.78,.75,.71),max(core*.85,smoothstep(.22,.05,br)*.75));
      col=mix(col,uPartGlow*.9+col*.5,clamp(dot(uPartGlow,vec3(1.)),0.,1.));
    } else {
      // stem / bulbs / tectum: long fibre bundles
      col=vec3(.66,.63,.6)*(.86+.14*snoise(q*vec3(4.,22.,22.)));
      col=mix(col,uPartGlow*.9+col*.5,clamp(dot(uPartGlow,vec3(1.)),0.,1.));
    }
    col=mix(col,col*uTint*1.5,uTintAmt*.7);
    gl_FragColor=vec4(col*uCap*(1.+0.0),1.);
    return;
  }

  vec3 N=normalize(vN); if(!front) N=-N;
  vec3 V=normalize(-vVp);
  float H=1.,crown=.6; float fm=1.;
  float lineM=0.; float h=0.;
  if(uPart<.5){
    H=profile(vAux.x,vAux.y,uFold); fm=vAux.z;
    float pxw=profileW(uFold)/(fwidth(vAux.x)+1e-4);
    float kd=smoothstep(.8,2.5,pxw)*foldAmp(uFold);
    H=mix(.78,H,kd);
    h=-foldDepth()*uFold*fm*(1.-H)*kd;
    // vAux.x is interpolated per triangle, so a pixel-thin line at its zero would trace triangle edges (jagged);
    // a band in fold units reads as the same sulcus but smoothly
    float w1=max(fwidth(vAux.x)*1.2,.07);
    lineM=(1.-smoothstep(0.,w1,abs(vAux.x)))*uFold;
    crown=H;
  } else if(uPart<1.5){
    float ph=vAux.x; float amp=vAux.z;
    float sn=abs(sin(ph));
    float kf=1.-smoothstep(.7,1.6,fwidth(ph));
    H=mix(.8,smoothstep(0.,.55,sn),kf);
    h=-.03*amp*uCbS*(1.-H)*kf;
    lineM=(1.-smoothstep(0.,fwidth(ph)*.7+1e-4,sn))*amp*kf;
    crown=H;
  } else if(uPart<2.5){
    crown=.6+.4*smoothstep(0.,.3,vDir.x);
  }
  N=perturb(N,vVp,h);

  float ao=mix(1.,mix(.18,1.,smoothstep(0.,.85,H)),clamp(uFold*1.5,0.,1.)*(uPart<.5?fm:1.));
  if(uPart>.5&&uPart<1.5) ao=mix(1.,mix(.15,1.,H),clamp(vAux.z*1.5,0.,1.));
  float cav=uPart<.5?vAux.w:0.;
  ao*=1.-.75*cav;

  vec3 base=uTissue*(.94+.06*snoise(vObj*17.))*(uPart>1.5&&uPart<2.5?.8:1.);
  base=mix(base,vec3(.5,.24,.22),(1.-H)*.5*(uPart<1.5?1.:0.));
  vec3 tintc=uTint;
  base=mix(base,tintc*(.45+.55*dot(base,vec3(.33))),uTintAmt);

  vec3 L1=normalize(vec3(-.5,.72,.55)), L2=normalize(vec3(.75,-.25,.45)), L3=normalize(vec3(.35,.35,-.85));
  float ndl=dot(N,L1);
  float wrap=clamp((ndl+.4)/1.4,0.,1.);
  float diff=pow(wrap,1.35);
  float term=smoothstep(.0,.3,wrap)*(1.-smoothstep(.3,.75,wrap));
  vec3 col=base*(.06+1.0*diff*ao);
  col+=vec3(.95,.3,.2)*base*term*.2*ao;
  col+=base*vec3(.6,.72,1.)*.2*max(dot(N,L2),0.)*ao;
  vec3 Hh=normalize(L1+V);
  float spec=pow(max(dot(N,Hh),0.),90.)*.55+pow(max(dot(N,Hh),0.),14.)*.07;
  col+=vec3(1.,.97,.95)*spec*pow(H,2.)*ao*(uPart<2.5?1.:.5);
  float fre=pow(1.-max(dot(N,V),0.),3.);
  vec3 rimC=mix(vec3(.68,.8,1.),tintc,uTintAmt*.8);
  col+=rimC*fre*(.2+.8*max(dot(N,L3)*.5+.5,0.))*.7*ao;

  // activity
  vec3 em=vec3(0.);
  if(uPart<.5) em=regions(vDir,crown);
  em+=uPartGlow*(.3+.9*crown)*(.85+.15*sin(uTime*2.+vObj.x*3.));
  col+=em*(1.+.3*fre);

  // glass: clear body, strong rims
  float aG=1.-uGlass*(1.-(.06+.8*fre));
  if(!front) col*=.6;
  col*=aG;

  // hologram line art
  float cy=vObj.y*6.;
  float cl=1.-smoothstep(0.,fwidth(cy)*1.4+1e-4,abs(fract(cy)-.5)*2.);
  cl*= .25;
  vec3 hc=uHoloCol*(.05+lineM*1.0+cl*.6+fre*1.0)*(front?1.:.45);
  hc+=em*1.3;
  hc*=1.+0.0;
  vec3 outc=mix(col,hc,uHolo);
  float outa=aG*(1.-uHolo);
  gl_FragColor=vec4(outc,outa);
  gl_FragDepth=depthOut;
}`;

/* ----------------------------------------------------------- constellation (stars + links) */
const STAR_COMMON = /* glsl */ `
${NOISE}
${SHAPE}
uniform float uDraw,uStarScale,uPx;
attribute vec4 aR;
varying float vB; varying vec3 vDirS;
`;
export const STAR_VERT = /* glsl */ `${STAR_COMMON}
void main(){
  vec4 aux; vec3 P=cerebrumShape(position,aux);
  vec3 nn=normalize(position/max(uCer,vec3(.02)));
  P+=nn*.012;
  float on=smoothstep(aR.x,aR.x+.06,uDraw);
  float tw=.6+.4*sin(uTime*(.6+aR.y)+aR.z*40.);
  vB=on*tw;
  vDirS=position;
  vec4 mv=modelViewMatrix*vec4(P,1.);
  gl_Position=projectionMatrix*mv;
#ifdef POINTS
  float big=step(.94,aR.w);
  gl_PointSize=clamp((1.1+aR.w*1.2+big*3.)*uStarScale*uPx*7./max(-mv.z,.5),1.,40.)*on;
#endif
}`;
export const STAR_FRAG = /* glsl */ `
uniform vec3 uStarCol; uniform float uOpacity;
uniform vec4 uRegA[8]; uniform vec4 uRegB[8]; uniform float uRegK[8];
varying float vB; varying vec3 vDirS;
void main(){
#ifdef POINTS
  float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard;
  float g=exp(-d*d*4.);
#else
  float g=.4;
#endif
  vec3 c=uStarCol;
  gl_FragColor=vec4(c*g*vB*uOpacity,g*vB*uOpacity);
}`;

/* ----------------------------------------------------------- inner nuclei (glass views) */
export const NUC_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.);
  vN=normalize(normalMatrix*normal); vV=-mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;
export const NUC_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAmt,uOpacity;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 N=normalize(vN),V=normalize(vV);
  float f=pow(1.-abs(dot(N,V)),2.);
  float l=.5+.5*dot(N,normalize(vec3(-.4,.7,.6)));
  vec3 c=uColor*(.05+.35*l+.9*f)*(.5+uAmt*1.8);
  gl_FragColor=vec4(c*uOpacity,.0);
}`;
