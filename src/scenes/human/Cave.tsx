import { useEffect, useMemo, useRef } from 'react';
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
float sdHand(vec2 p){
  float d = sdSeg(p, vec2(0.,-.12), vec2(0.,-.18), .43);
  d = min(d, sdSeg(p, vec2(0.,-.4), vec2(.02,-1.5), .22));
  d = min(d, sdSeg(p, vec2(-.38,-.05), vec2(-1.0,.42), .095));
  d = min(d, sdSeg(p, vec2(-.3,.3), vec2(-.5,1.2), .082));
  d = min(d, sdSeg(p, vec2(-.1,.4), vec2(-.12,1.38), .086));
  d = min(d, sdSeg(p, vec2(.12,.36), vec2(.24,1.22), .08));
  d = min(d, sdSeg(p, vec2(.3,.22), vec2(.56,.86), .072));
  return d;
}
void main(){
  vec2 P=vP;
  // rock: very quiet relief, lit by one soft pool around the hero of the moment
  float h=fbm(vec3(P*1.3,1.))*.7+fbm(vec3(P*5.,4.))*.3;
  float e=.03;
  float hx=fbm(vec3((P+vec2(e,0.))*1.3,1.))*.7+fbm(vec3((P+vec2(e,0.))*5.,4.))*.3;
  float hy=fbm(vec3((P+vec2(0.,e))*1.3,1.))*.7+fbm(vec3((P+vec2(0.,e))*5.,4.))*.3;
  vec3 n=normalize(vec3((h-hx)/e*.5,(h-hy)/e*.5,1.));
  float fl=.94+.06*sin(uTime*7.+sin(uTime*2.7)*3.);

  vec2 hc=vec2(${HAND_X.toFixed(2)}, ${(HAND_Y + 0.3).toFixed(2)});
  vec2 fc=vec2(${FLUTE_X.toFixed(2)}, .3);
  float pool = exp(-dot(P-hc,P-hc)*.22)*uHand + exp(-dot(P-fc,P-fc)*.3)*uRip;
  vec3 L=normalize(vec3(.4,.5,.8));
  float dif=max(dot(n,L),0.);
  float rock=(.01+.075*dif)*pool*fl;

  // --- hand stencil: pigment blown around the hand, the hand itself left dark ---
  vec2 hp=(P-hc)/1.0 + vec2(0.,0.15);
  float d=sdHand(hp) + (fbm(vec3(P*7.,3.))-.5)*.05;
  float reach=uHand*1.25;
  float spray = exp(-max(d,0.)*5.5);
  float cell = 170.;
  vec2 g = floor(P*cell);
  float nz = h21(g) * .75 + fbm(vec3(P*3.2, 7.)) * .6;
  float dust = step(1. - spray*.78, nz) * step(0., d) * smoothstep(reach, reach-.25, d+.0);
  // fine soft edge so the stencil reads as clean line work where the paint stops
  float edge = exp(-d*d*9000.) * step(-.02, d) * smoothstep(reach, reach-.3, d) * .5;
  float haze = exp(-max(d,0.)*9.)*.1*step(0.,d)*smoothstep(reach, reach-.3, d);
  float hand = (dust*(.55+.6*h) + edge + haze) * uHand;

  // --- flute: thin rings of sound, ageing outward, clean and few ---
  vec2 q=(P-fc)*vec2(1.,1.12);
  float rr=length(q);
  float ring=0.;
  float ph=uRipPh*.07;
  for(int i=0;i<5;i++){
    float a=fract(ph+float(i)*.2);
    float R=.25+a*3.6;
    float w=.006+.012*a;
    ring += exp(-pow((rr-R)/w,2.))*pow(1.-a,1.6)*smoothstep(0.,.08,a);
  }
  ring *= uRip;

  vec3 c = vec3(rock) * vec3(1.,.9,.8) + vec3(hand) * vec3(1.15,.98,.82) + vec3(ring)*vec3(1.1,1.1,1.2)*.9;
  vec2 qe=abs(vec2(P.x-uCam,P.y)/vec2(9.,4.5));
  float edgeM=1.-smoothstep(.7,1.,max(qe.x,qe.y));
  gl_FragColor=vec4(c,uW*edgeM);
}`;

export default function Cave() {
  const scene = useScene();
  const fluteGroup = useRef<THREE.Group>(null);
  const { wall, flute } = useMemo(() => {
    const wall = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uCam: { value: 0 }, uRip: { value: 0 }, uRipPh: { value: 0 }, uHand: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy+vec2(0.,.3); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: FS,
    });
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.7), toneMapped: false, transparent: true });
    const h = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true });
    return { wall, flute: { m, h } };
  }, []);
  useEffect(() => () => { wall.dispose(); flute.m.dispose(); flute.h.dispose(); }, [wall, flute]);

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
    flute.m.opacity = scene.weight * range(e69 - 0.35, e69 - 0.05, f) * (1 - range(e69 + 0.1, e69 + 0.4, f)); flute.h.opacity = flute.m.opacity;
    if (fluteGroup.current) {
      fluteGroup.current.position.set(FLUTE_X, 0, 1.0);
      fluteGroup.current.rotation.z = 0.95 + Math.sin(f * 6) * 0.02;
    }
  });
  return (
    <group>
      <mesh position={[0, 0, 0]} material={wall}><planeGeometry args={[40, 12]} /></mesh>
      <group ref={fluteGroup}>
        <mesh material={flute.m}><cylinderGeometry args={[0.028, 0.032, 2.3, 12]} /></mesh>
        {[-0.5, -0.3, -0.1, 0.1, 0.3].map((y) => (
          <mesh key={y} position={[0, y, 0.03]} material={flute.h}><sphereGeometry args={[0.02, 8, 8]} /></mesh>
        ))}
      </group>
    </group>
  );
}
