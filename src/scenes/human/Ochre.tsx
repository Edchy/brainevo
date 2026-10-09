import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, range } from '../../world/util';
import { GLSL_UTIL } from './common';

// One engraved piece of ochre (after the cross-hatched Blombos stones): a slab of iron-rich stone, then the pattern
// scratched in line by line. Fully shader-modelled: relief, bevelled edge, pale scratched grooves, ochre red body.
const HW = 2.3, HH = 1.45, PAD = 1.12;

const FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uRev,uTime;
varying vec2 vUv;
float sdRB(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
// slab outline: rounded rectangle, wavy, with a chipped corner
float slab(vec2 p){
  float d = sdRB(p, vec2(${HW.toFixed(2)},${HH.toFixed(2)}), .22);
  d += (fbm(vec3(p*1.7,3.))-.5)*.16 + (fbm(vec3(p*9.,5.))-.5)*.03;
  d = max(d, -(sdRB(p-vec2(${HW.toFixed(2)},${HH.toFixed(2)})*vec2(1.,1.), vec2(.0), .0) - .0)*0. + d);
  float chip = length(p-vec2(${(HW - 0.1).toFixed(2)},${(-HH + 0.05).toFixed(2)})) - .38;
  return max(d, -chip + .0) ;
}
// engraving: lattice of diagonal grooves within three bands. returns groove strength 0..1 and reveal mask via .y
vec2 engrave(vec2 p){
  float g=0., rv=0.;
  float xl=-${(HW - 0.3).toFixed(2)}, xr=${(HW - 0.3).toFixed(2)};
  for(int b=0;b<3;b++){
    float y0 = b==0?.62:(b==1?-.28:-1.18);
    float y1 = b==0?1.12:(b==1?.52:-.38);
    vec2 q=p;
    q.x += (fbm(vec3(p*3.5,float(b)))-.5)*.035; q.y += (fbm(vec3(p*3.5+9.,float(b)))-.5)*.035;
    float inB = step(y0,q.y)*step(q.y,y1)*step(xl,q.x)*step(q.x,xr);
    float sp=.4;
    float s1 = (q.x+q.y)/sp, s2=(q.x-q.y)/sp;
    float w = .045; // groove half width in lattice units
    float l1 = abs(fract(s1)-.5), l2 = abs(fract(s2)-.5);
    float gr = max(smoothstep(.5-w*1.6,.5,.5-l1*1.0+.0)*0., 0.);
    float c1 = 1.-smoothstep(.0,.055,.5-l1), c2 = 1.-smoothstep(.0,.055,.5-l2);
    // two-stage reveal: the line being scratched glows, then settles
    float order = .08 + float(b)*.0 + ((q.x-xl)/(xr-xl))*.78;
    float on = smoothstep(order, order+.03, uRev);
    float fr = (1.-smoothstep(.0,.03,abs(q.y-y0)-.006)) + (1.-smoothstep(.0,.03,abs(q.y-y1)-.006));
    float line = max(c1,c2)*inB + fr*step(xl,q.x)*step(q.x,xr);
    g = max(g, line*on);
    rv = max(rv, line*exp(-max(uRev-order,0.)*28.)*step(order,uRev));
  }
  return vec2(g, rv);
}
float Hh(vec2 p, float d){
  float h = fbm(vec3(p*1.4,2.))*.45 + fbm(vec3(p*6.,7.))*.11 + vnoise(vec3(p*30.,1.))*.015;
  h += smoothstep(-.09,0.,d)*-.35 ;                 // bevelled edge falls away
  h -= engrave(p).x*.3;
  return h;
}
void main(){
  vec2 p=(vUv-.5)*vec2(${(HW * 2 * PAD).toFixed(3)},${(HH * 2 * PAD).toFixed(3)});
  float d = slab(p);
  float inside = 1.-smoothstep(-.004,.006,d);
  float e=.012;
  float h0=Hh(p,d);
  float hx=Hh(p+vec2(e,0.),d), hy=Hh(p+vec2(0.,e),d);
  vec3 n=normalize(vec3((h0-hx)/e*.7,(h0-hy)/e*.7,1.));
  vec3 L=normalize(vec3(-.55,.6,.62));
  float dif=max(dot(n,L),0.);
  float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),22.);
  vec2 en=engrave(p);
  // stone body: oxidised red-brown with iron speckle, banded by the strata
  float band = fbm(vec3(p.x*.8,p.y*5.5,4.));
  vec3 base = mix(vec3(.46,.1,.035), vec3(.82,.24,.06), smoothstep(.3,.75,band));
  base *= .65+.6*fbm(vec3(p*5.,8.));
  float fleck = step(.93, h21(floor(p*95.)))*.5;
  base += vec3(.5,.45,.35)*fleck*.5;
  // the scratch exposes paler, drier ochre under the skin
  vec3 scratch = vec3(1.0,.55,.16);
  vec3 alb = mix(base, scratch, en.x*.8);
  float ao = .55+.45*smoothstep(-.4,.2,h0-.2);
  vec3 col = alb*(.12+.9*dif+en.x*.35)*ao + vec3(1.,.8,.55)*spec*.12*(1.-en.x*.5);
  // fresh scratch glows for a moment
  col += vec3(2.2,1.2,.4)*en.y*.8;
  // thin rim light along the bevelled rim
  float rim = exp(-pow((d+.012)/.014,2.));
  col += vec3(1.1,.55,.25)*rim*.35*smoothstep(-.4,.5,dot(normalize(vec2(-.5,.6)),normalize(p+1e-4)))*.0 + vec3(1.2,.7,.4)*rim*.25;
  // soft vignette within the slab so it sits in the dark
  col *= .55+.45*smoothstep(1.35,.1,length(p*vec2(.7,1.)));
  gl_FragColor=vec4(col, inside*uW);
}`;

export default function Ochre() {
  const scene = useScene();
  const root = useRef<THREE.Group>(null);
  const { mat, dust } = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uW: { value: 0 }, uRev: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: FS,
    });
    // fine ochre dust drifting off the stone (a few motes only)
    const n = Math.floor(70 * world.quality);
    const pos = new Float32Array(n * 3), sd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, rad = 0.6 + Math.random() * 0.9;
      pos[i * 3] = Math.cos(a) * rad * HW; pos[i * 3 + 1] = Math.sin(a) * rad * HH; pos[i * 3 + 2] = 0.05 + Math.random() * 0.3;
      sd[i * 3] = Math.random(); sd[i * 3 + 1] = Math.random(); sd[i * 3 + 2] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(sd, 3));
    const dm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uRev: { value: 0 }, uPx: { value: 1 } },
      vertexShader: `attribute vec3 aS; uniform float uTime,uW,uRev,uPx; varying float vA;
      void main(){ vec3 p=position; float ph=fract(uTime*.03+aS.x); p.y+=ph*1.0; p.x+=sin(uTime*.3+aS.y*20.)*.08;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((1.+aS.z*1.5)*uPx*60./max(-mv.z,.1)*.35,1.,5.);
        vA=uW*uRev*smoothstep(0.,.2,ph)*(1.-ph)*.5; }`,
      fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; gl_FragColor=vec4(vec3(1.7,.6,.15),exp(-d*d*3.)*vA); }',
    });
    return { mat, dust: { g, m: dm } };
  }, []);
  useEffect(() => () => { mat.dispose(); dust.g.dispose(); dust.m.dispose(); }, [mat, dust]);

  useFrame((state) => {
    if (!scene.active) return;
    const e = eventPos('ochre-symbolic-thought');
    const rev = range(e - 0.6, e - 0.05, world.stationF);
    const tm = world.reduced ? 0 : world.time;
    mat.uniforms.uW.value = scene.weight; mat.uniforms.uRev.value = rev; mat.uniforms.uTime.value = tm;
    dust.m.uniforms.uW.value = scene.weight; dust.m.uniforms.uRev.value = rev; dust.m.uniforms.uTime.value = tm;
    dust.m.uniforms.uPx.value = state.gl.getPixelRatio();
    if (root.current) {
      root.current.rotation.y = -0.34 + scene.t * 0.42;
      root.current.rotation.x = 0.1;
      root.current.rotation.z = 0.05;
      root.current.position.set(0.9, 0.35, 0);
    }
  });
  return (
    <group ref={root}>
      <mesh material={mat}><planeGeometry args={[HW * 2 * PAD, HH * 2 * PAD]} /></mesh>
      <points geometry={dust.g} material={dust.m} frustumCulled={false} />
    </group>
  );
}
