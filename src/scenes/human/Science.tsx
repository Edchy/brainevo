import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range, smoothstep } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU } from './common';
import * as THREE from 'three';

// [semi-major, eccentricity, hue]
const BODIES: [number, number, [number, number, number]][] = [
  [0, 0, [2.5, 1.7, .6]], // Sun (seen from Earth in the geocentric view)
  [0.8, 0.2, [1.4, 1.2, 1.0]],
  [1.2, 0.02, [2.0, 1.5, .7]],
  [1.8, 0.05, [.5, 1.2, 2.2]],
  [2.7, 0.09, [2.2, .7, .4]],
  [4.0, 0.05, [2.0, 1.5, 1.0]],
  [5.2, 0.06, [1.8, 1.6, .9]],
];

const FNS = /* glsl */ `
vec2 helio(float a, float e, float tau){
  float P = pow(a/1.8, 1.5);
  float M = 6.28318*tau/P;
  float th = M + 2.*e*sin(M) + 1.25*e*e*sin(2.*M);
  float r = a*(1.-e*e)/(1.+e*cos(th));
  return r*vec2(cos(th), sin(th));
}`;

export default function Science() {
  const scene = useScene();
  const { pgeo, pmat, lgeo, lmat, sgeo, smat, bgeo, bmat, ageo, amat } = useMemo(() => {
    const pb = new PBuf(121);
    const N = Math.floor(520 * world.quality);
    BODIES.forEach((bd, bi) => {
      for (let i = 0; i < N; i++) pb.add(i / N, bi, 0, bd[2], bi, { aB: [bd[0], bd[1], 0] });
    });
    // comet tail
    for (let i = 0; i < 160; i++) pb.add(i / 160, 9, 0, [.8, 1.4, 2.0], 9, { aB: [6.5, .88, 0] });
    // Jupiter moons (Galileo)
    for (let m = 0; m < 4; m++) pb.add(0, 10 + m, 0, [2.0, 1.8, 1.4], 10 + m, { aB: [0, 0, 0] });
    const pmat = pointMat({
      decl: 'attribute vec3 aB; uniform float uGeo,uNow,uComet,uMoons;' + FNS,
      uniforms: { uGeo: { value: 1 }, uNow: { value: 0 }, uComet: { value: 0 }, uMoons: { value: 0 } },
      size: 1,
      body: `
      float k = aSeed.w;
      if (k < 8.) {
        float s = position.x;
        float len = k < .5 ? 3.0 : 2.6;
        float tau = uNow - s*len;
        vec2 H = k < .5 ? vec2(0.) : helio(aB.x, aB.y, tau);
        vec2 E = helio(1.8, .05, tau);
        vec2 q = H - uGeo*E;
        // Earth keeps its own orbit once the Sun is the centre
        float isEarth = step(2.5,k)*step(k,3.5);
        a = (1.-isEarth*uGeo) * (.04 + .5*pow(1.-s,3.) + .25*exp(-s*60.));
        if (k < .5) a *= .0;
        p = vec3(q.x, 0., q.y);
        size = .4 + .3*exp(-s*70.) + .2*(1.-s);
        col = col*(.55+.8*exp(-s*40.));
        if (k < .5) a *= (1.-.8*(1.-uGeo));
      } else if (k < 9.5) {
        float s = position.x;
        float tau = uNow*.35 + .5;
        float P = pow(6.5/1.8,1.5)*3.;
        float M = 6.28318*tau/P*2.;
        float th = M + 2.*aB.y*sin(M);
        float r = aB.x*(1.-aB.y*aB.y)/(1.+aB.y*cos(th));
        vec2 hd = r*vec2(cos(th),sin(th));
        vec2 away = normalize(hd+1e-4);
        vec2 q = hd + away*s*(1.5+1.5/ (r*.3+.4)) + (vec2(aSeed.x,aSeed.y)-.5)*.05*s*3.;
        p = vec3(q.x, 0., q.y);
        a = uComet*(1.-s)*(1.-s)*(.15+.5/(r*.3+.5));
        size = .4+1.8*exp(-s*30.);
      } else {
        float j = k-10.;
        float tau = uNow;
        vec2 J = helio(4.0, .05, tau) - uGeo*helio(1.8,.05,tau);
        float an = tau*(9.+j*4.5) + j*1.7;
        float rad = .22 + j*.1;
        p = vec3(J.x + cos(an)*rad*1.6, 0., J.y + sin(an)*rad*.3);
        a = 0.; size = .1;
      }
      `,
    });

    // lit bodies: Sun (gold, granulated), planets as shaded spheres terminated by the Sun's light, Jupiter banded, its four moons
    const bb = new PBuf(124);
    for (let i = 0; i < 7; i++) bb.add(0, 0, 0, [1, 1, 1], i, { aB: [BODIES[i][0], BODIES[i][1], 0] });
    for (let m = 0; m < 4; m++) bb.add(0, 0, 0, [1, 1, 1], 10 + m, { aB: [0, 0, 0] });
    const bmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uGeo: { value: 1 }, uNow: { value: 0 }, uMoons: { value: 0 }, uW: { value: 0 }, uTime: { value: 0 }, uH: { value: 800 } },
      vertexShader: `${GLSL_UTIL}
attribute vec4 aSeed; attribute vec3 aB; uniform float uGeo,uNow,uMoons,uW,uTime,uH;
varying float vK; varying vec3 vL; varying float vA; varying float vSz;
${FNS}
void main(){
  float k=aSeed.w; vK=k;
  float tau=uNow;
  vec2 E=helio(1.8,.05,tau);
  vec2 q; float rad=.1; float al=1.;
  vec2 sunQ = -uGeo*E;                    // where the Sun sits in this frame
  if(k<7.){
    vec2 H = k<.5 ? vec2(0.) : helio(aB.x,aB.y,tau);
    q = H-uGeo*E;
    rad = k<.5 ? .55 : (k<1.5 ? .11 : (k<2.5 ? .16 : (k<3.5 ? .17 : (k<4.5 ? .13 : (k<5.5 ? .34 : .29)))));
    if(k>2.5&&k<3.5) al=1.;
  } else {
    float j=k-10.;
    vec2 J=helio(4.0,.05,tau)-uGeo*E;
    float an=tau*(9.+j*4.5)+j*1.7;
    float rr=.36+j*.12;
    q=J+vec2(cos(an)*rr*1.6, sin(an)*rr*.5);
    rad=.06; al=uMoons;
  }
  vec3 wp=vec3(q.x,0.,q.y);
  vec3 sw=vec3(sunQ.x,0.,sunQ.y);
  vec3 L=normalize(sw-wp+vec3(1e-4));
  vL=normalize((viewMatrix*vec4(L,0.)).xyz);
  vec4 mv=modelViewMatrix*vec4(wp,1.);
  gl_Position=projectionMatrix*mv;
  float px=rad*projectionMatrix[1][1]*uH*.5/max(-mv.z,.1);
  float glow=(k<.5)?3.2:1.;
  gl_PointSize=clamp(px*2.*glow,1.,420.);
  vSz=glow;
  vA=uW*al;
}`,
      fragmentShader: `${GLSL_UTIL}
uniform float uTime; varying float vK; varying vec3 vL; varying float vA; varying float vSz;
void main(){
  vec2 c=(gl_PointCoord-.5)*2.*vSz;     // sphere radius = 1 in c
  float r=length(c);
  vec3 col=vec3(0.); float a=0.;
  if(vK<.5){
    // the Sun: granulated gold disc, limb-darkened, soft corona
    float disc=smoothstep(1.,.97,r);
    float z=sqrt(max(1.-r*r,0.));
    float gran=fbm(vec3(c*5.,uTime*.12))*.6+fbm(vec3(c*14.,uTime*.2))*.4;
    float limb=.55+.45*z;
    vec3 body=mix(vec3(2.6,1.0,.12),vec3(3.0,2.0,.5),gran)*limb;
    col=body*disc + vec3(2.2,1.0,.18)*(exp(-pow(max(r-1.,0.)*2.4,2.))*.55*step(1.,r)) + vec3(1.8,.7,.1)*exp(-r*r*.45)*.14;
    a=1.;
  } else {
    float disc=smoothstep(1.,.93,r);
    float z=sqrt(max(1.-r*r,0.));
    vec3 n=vec3(c,z);
    float lam=dot(n,vL);
    float term=smoothstep(-.12,.35,lam);
    float lit=max(lam,0.);
    vec3 base=vec3(.78,.78,.8);
    float spec=0.;
    if(vK>4.5&&vK<5.5){ // Jupiter bands
      float band=sin(n.y*16.+fbm(vec3(n.xy*4.,3.))*2.4)*.5+.5;
      base=mix(vec3(.55,.46,.36),vec3(.95,.82,.65),band);
    } else if(vK>5.5&&vK<6.5){ base=vec3(.9,.82,.62)*(.8+.2*sin(n.y*10.)); }
    else if(vK>2.5&&vK<3.5){ // Earth: oceans, a bright cap
      float cont=fbm(vec3(n.xy*3.5+1.,2.)); base=mix(vec3(.18,.3,.5),vec3(.45,.55,.38),smoothstep(.5,.62,cont)); base+=vec3(.5)*smoothstep(.82,.95,abs(n.y)); }
    else if(vK>3.5&&vK<4.5){ base=vec3(.75,.3,.14)*(.75+.5*fbm(vec3(n.xy*6.,5.))); }
    else if(vK>9.5){ base=vec3(.95,.92,.85); }
    else { base*=.7+.5*fbm(vec3(n.xy*5.,vK)); }
    col=base*(.03+1.2*lit*term);
    col+=vec3(.5,.6,.9)*pow(1.-z,3.)*.08*term;     // thin atmospheric rim on the lit side
    a=disc;
  }
  if(a<.01 && vK<.5 && r>2.5) discard;
  if(vK>.5) col*=a;
  gl_FragColor=vec4(col*vA,(vK<.5?min(1.,dot(col,vec3(.5))):a)*vA);
}`,
    });
    // armillary: fine graduated rings framing the system (zodiac band, tilted ecliptic, meridian)
    const ab = new LBuf(125);
    const ringC: [number, number, number] = [.85, .88, 1.0];
    const tick = (R: number, n: number, major: number, tilt: number, phase: number) => {
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const P = (a: number, rr: number): [number, number, number] => { const x = Math.cos(a) * rr, z = Math.sin(a) * rr; return [x, -z * st, z * ct]; };
      const N = 180;
      for (let i = 0; i < N; i++) { const a0 = (i / N) * Math.PI * 2 + phase, a1 = ((i + 1) / N) * Math.PI * 2 + phase; ab.seg(P(a0, R), P(a1, R), 0, 1, ringC); }
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + phase; const L = i % major === 0 ? 0.16 : 0.07; ab.seg(P(a, R - L * 0.5), P(a, R + L * 0.5), 0, 1, ringC); }
    };
    tick(6.1, 72, 6, 0, 0); tick(6.45, 60, 5, 0, 0.1);
    tick(5.6, 48, 4, 0.409, 0.3);                // the ecliptic, inclined 23.4 degrees
    const alb = new LBuf(126); void alb;
    const amat = lineMat({ body: 'a=.1;' });
    // telescope
    const lb = new LBuf(122);
    const c: [number, number, number] = [1.7, 1.2, .5];
    const ring = (z: number, rad: number) => { for (let i = 0; i < 16; i++) { const a0 = (i / 16) * 6.283, a1 = ((i + 1) / 16) * 6.283; lb.seg([Math.cos(a0) * rad, Math.sin(a0) * rad, z], [Math.cos(a1) * rad, Math.sin(a1) * rad, z], 0, 1, c); } };
    ring(0, 0.16); ring(1.3, 0.2); ring(2.0, 0.22);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; lb.seg([Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0], [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 2.0], 0, 1, c); }
    lb.seg([0.1, -0.2, 0.9], [0.5, -1.4, 1.2], 0, 1, c); lb.seg([-0.1, -0.2, 0.9], [-0.4, -1.4, 1.4], 0, 1, c); lb.seg([0, -0.2, 0.9], [0.0, -1.4, 0.2], 0, 1, c);
    const lmat = lineMat({ body: 'a=.8;' });
    // starfield
    const sb = new PBuf(123);
    for (let i = 0; i < 160 * world.quality; i++) {
      const v = [sb.r() - .5, sb.r() - .5, sb.r() - .5]; const l = Math.hypot(v[0], v[1], v[2]) || 1; const R = 14 + sb.r() * 20;
      sb.add(v[0] / l * R, v[1] / l * R * .6, v[2] / l * R - 8, [.8, .9, 1.4], 0);
    }
    const smat = pointMat({ size: .7, body: 'a=.35*(.3+.7*pow(.5+.5*sin(uTime*(.5+aSeed.y)+aSeed.z*60.),3.)); size=.4+aSeed.x*.6;' });
    return { pgeo: pb.build(), pmat, lgeo: lb.build(), lmat, sgeo: sb.build(), smat, bgeo: bb.build(), bmat, ageo: ab.build(), amat };
  }, []);
  useEffect(() => () => { pgeo.dispose(); lgeo.dispose(); sgeo.dispose(); bgeo.dispose(); ageo.dispose(); pmat.dispose(); lmat.dispose(); smat.dispose(); bmat.dispose(); amat.dispose(); }, [pgeo, lgeo, sgeo, bgeo, ageo, pmat, lmat, smat, bmat, amat]);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const e = eventPos('scientific-revolution');
    const pr = state.gl.getPixelRatio();
    for (const m of [pmat, smat]) tickU(m, scene, pr);
    tickU(lmat, scene);
    const u = pmat.uniforms;
    u.uGeo.value = 1 - smoothstep(e - 0.55, e + 0.15, f);
    u.uNow.value = 3 + scene.t * 14 + (world.reduced ? 0 : world.time * 0.12);
    u.uComet.value = range(e - 0.1, e + 0.3, f);
    u.uMoons.value = range(e - 0.9, e - 0.5, f) * (1 - range(e - 0.2, e + 0.1, f));
    const bu = bmat.uniforms;
    bu.uGeo.value = u.uGeo.value; bu.uNow.value = u.uNow.value; bu.uMoons.value = u.uMoons.value; bu.uW.value = scene.weight; bu.uTime.value = world.reduced ? 0 : world.time; bu.uH.value = state.size.height * pr;
    tickU(amat, scene);
  });
  return (
    <group>
      <points geometry={sgeo} material={smat} frustumCulled={false} />
      <lineSegments geometry={ageo} material={amat} frustumCulled={false} />
      <points geometry={pgeo} material={pmat} frustumCulled={false} />
      <points geometry={bgeo} material={bmat} frustumCulled={false} />
    </group>
  );
}
