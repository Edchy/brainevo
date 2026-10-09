import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { smoothstep } from '../../world/util';
import { NOISE, Plankton, TM, latheX, useBrain } from './shared';

const SLOPE = 0.24;
const TH = Math.atan(SLOPE);
const rampY = (x: number) => -1 + SLOPE * x;
const SHORE_X = 1 / SLOPE;
const BOX: [number, number, number] = [18, 8, 8];

export const shoreSun = new THREE.Vector3(0.35, 0.05, -1);

function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunI: { value: 0 }, uOp: { value: 1 }, uStars: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uTop,uHor,uSun; uniform float uSunI,uOp,uStars; varying vec3 vD;
      void main(){ vec3 d=normalize(vD); float h=clamp(d.y,0.,1.);
        vec3 c=mix(uHor,uTop,pow(h,.5)); float sd=max(dot(d,normalize(uSun)),0.);
        c+=vec3(1.,.55,.25)*pow(sd,6.)*.35*uSunI+vec3(1.,.9,.7)*pow(sd,700.)*2.2*uSunI+vec3(1.,.5,.2)*pow(sd,2.)*.12*uSunI;
        vec3 q=floor(d*160.); float hs=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);
        c+=step(.9984,hs)*uStars*smoothstep(.15,.6,d.y)*1.5;
        if(d.y<0.) c=mix(uHor,uHor*.35,clamp(-d.y*3.,0.,1.));
        gl_FragColor=vec4(c,uOp); }`,
  });
}

function waterMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uDeep: { value: new THREE.Color('#05303a') }, uSun: { value: new THREE.Vector3() }, uSunI: { value: 0 }, uOp: { value: 1 }, uTime: { value: 0 }, uShore: { value: SHORE_X } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */ `${NOISE}
      uniform vec3 uTop,uHor,uDeep,uSun; uniform float uSunI,uOp,uTime,uShore; varying vec3 vW;
      void main(){
        float sh=uShore+.1*sin(uTime*.7+vW.z*.8)+.05*snoise(vec3(vW.z*1.5,uTime*.3,0.));
        float dist=sh-vW.x; if(dist<0.) discard;
        vec3 p=vec3(vW.x*1.3,vW.z*1.3,uTime*.25);
        float e=.05; float n0=snoise(p),nx=snoise(p+vec3(e,0.,0.)),nz=snoise(p+vec3(0.,e,0.));
        vec3 N=normalize(vec3(-(nx-n0)/e*.06,1.,-(nz-n0)/e*.06));
        vec3 V=normalize(cameraPosition-vW); float ndv=abs(dot(N,V)); float fres=pow(1.-ndv,3.);
        vec3 col; float a;
        if(cameraPosition.y>0.){
          vec3 sky=mix(uHor,uTop,.35); vec3 R=reflect(-V,N); float sd=max(dot(R,normalize(uSun)),0.);
          col=mix(uDeep*.8,sky,fres*.85+.08)+vec3(1.,.8,.55)*pow(sd,120.)*3.*uSunI+vec3(1.,.6,.3)*pow(sd,12.)*.25*uSunI;
          a=mix(.62,.97,fres);
        } else {
          float c1=snoise(vec3(vW.xz*2.2,uTime*.3)); col=mix(uDeep*1.2,uHor*.9,pow(1.-ndv,1.5)*.6)+vec3(.4,.9,.9)*smoothstep(.55,1.,c1)*.25; a=.5; }
        float foam=smoothstep(.35,0.,dist)*(.55+.45*snoise(vec3(vW.xz*4.,uTime*.5))); col+=vec3(1.,.97,.9)*foam*(.5+uSunI*.6); a=max(a,foam*.9);
        gl_FragColor=vec4(col,a*uOp); }`,
  });
}

function sandMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunI: { value: 0 }, uOp: { value: 1 }, uTime: { value: 0 }, uSunC: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */ `${NOISE}
      uniform vec3 uHor,uSun,uSunC; uniform float uSunI,uOp,uTime; varying vec3 vW;
      void main(){ float g=snoise(vec3(vW.xz*9.,vW.x*3.))*.5+.5; float b=snoise(vec3(vW.xz*.9,2.))*.5+.5;
        float dry=smoothstep(${(1/0.24-0.2).toFixed(2)},${(1/0.24+0.8).toFixed(2)},vW.x); vec3 wet=vec3(.17,.14,.1), dr=vec3(.34,.28,.2);
        vec3 col=mix(wet,dr,dry)*(.7+.3*g)*(.8+.4*b);
        vec3 N=normalize(vec3(-sin(${TH.toFixed(4)}),cos(${TH.toFixed(4)}),0.)+vec3(0.,0.,(g-.5)*.2));
        float dif=max(dot(N,normalize(uSun)),0.)*.7+.25;
        vec3 lit=col*(uHor*.55+uSunC*dif*(.4+uSunI*.8));
        if(vW.y<0.){ float c1=snoise(vec3(vW.xz*3.,uTime*.3+vW.y)); float depth=clamp(-vW.y/2.5,0.,1.);
          lit=lit*vec3(.35,.7,.8)+vec3(.2,.6,.65)*smoothstep(.4,1.,c1)*.25*(1.-depth);
          lit=mix(lit,vec3(.01,.08,.1),depth*.8); }
        gl_FragColor=vec4(lit,uOp); }`,
  });
}

function toonMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uCol: { value: new THREE.Color('#6d8f4a') }, uCol2: { value: new THREE.Color('#d4b36a') }, uSun: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uOp: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uCol,uCol2,uSun,uSunC,uAmb; uniform float uOp; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 N=normalize(vN); float d=dot(N,normalize(uSun))*.5+.5; d=smoothstep(.25,.9,d);
        float spots=smoothstep(.5,.9,sin(vP.x*9.)*sin(vP.z*13.)*.5+.5);
        vec3 base=mix(uCol,uCol2,smoothstep(0.,-.25,vP.y)*.8+spots*.2);
        vec3 c=base*(uAmb*.9+uSunC*d*.9)+uSunC*pow(1.-abs(N.y),3.)*.12; gl_FragColor=vec4(c,uOp); }`,
  });
}

/** dawn over a shoreline: camera rises out of the water while a tetrapod hauls itself onto the sand */
export default function Shore() {
  const scene = useScene();
  const animal = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const limbs = useRef<(THREE.Group | null)[]>([]);
  const brainG = useRef<THREE.Group>(null);
  const { geo: bGeo, mat: bMat } = useBrain(120, 28);
  const S = useMemo(() => {
    const sky = skyMat(), water = waterMat(), sand = sandMat(), toon = toonMat();
    const body = latheX((x) => 0.36 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((x - 0.1) / 1.25), x > 0.1 ? 2.4 : 2.0)), 0.55), -1.15, 1.35, 60, 24, 0.55);
    const tailG = latheX((x) => 0.26 * Math.pow(Math.max(0, 1 - Math.abs(x) / 1.3), 0.9), -1.3, 0, 40, 16, 0.65);
    const upper = new THREE.CylinderGeometry(0.075, 0.06, 0.5, 10); upper.translate(0, -0.25, 0);
    const lower = new THREE.CylinderGeometry(0.055, 0.04, 0.5, 10); lower.translate(0, -0.25, 0);
    const foot = new THREE.SphereGeometry(0.09, 12, 8); foot.scale(1.7, 0.45, 1);
    const eye = new THREE.SphereGeometry(0.07, 12, 10);
    const rampG = new THREE.PlaneGeometry(40, 30, 2, 2); rampG.rotateX(-Math.PI / 2);
    const waterG = new THREE.PlaneGeometry(50, 30, 1, 1); waterG.rotateX(-Math.PI / 2);
    return { sky, water, sand, toon, body, tailG, upper, lower, foot, eye, rampG, waterG, skyG: new THREE.SphereGeometry(80, 32, 20) };
  }, []);
  useEffect(() => () => {
    Object.values(S).forEach((o) => (o as { dispose: () => void }).dispose());
    bGeo.dispose(); bMat.dispose();
  }, [S, bGeo, bMat]);

  const cTop = useMemo(() => ({ a: new THREE.Color('#04060f'), b: new THREE.Color('#0d1530'), c: new THREE.Color('#1b2d52'), o: new THREE.Color() }), []);
  const cHor = useMemo(() => ({ a: new THREE.Color('#150c20'), b: new THREE.Color('#8a4a34'), c: new THREE.Color('#5f7589'), o: new THREE.Color() }), []);
  const cSun = useMemo(() => ({ a: new THREE.Color('#ff7a4a'), b: new THREE.Color('#ffd9a8'), o: new THREE.Color() }), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tm = TM();
    const s = smoothstep(0.1, 0.75, t);
    const s2 = smoothstep(0.55, 1, t);
    cTop.o.copy(cTop.a).lerp(cTop.b, s).lerp(cTop.c, s2);
    cHor.o.copy(cHor.a).lerp(cHor.b, smoothstep(0, 0.55, t)).lerp(cHor.c, s2 * 0.8);
    cSun.o.copy(cSun.a).lerp(cSun.b, s2);
    sunDir.set(0.35, -0.02 + 0.45 * s, -1);
    const sunI = 0.25 + s * 0.6;
    for (const m of [S.sky, S.water]) {
      m.uniforms.uTop.value.copy(cTop.o); m.uniforms.uHor.value.copy(cHor.o); m.uniforms.uSun.value.copy(sunDir); m.uniforms.uSunI.value = sunI; m.uniforms.uOp.value = w;
    }
    S.sky.uniforms.uStars.value = 1 - smoothstep(0.1, 0.5, t);
    S.water.uniforms.uTime.value = tm + t * 6;
    S.sand.uniforms.uHor.value.copy(cHor.o); S.sand.uniforms.uSun.value.copy(sunDir); S.sand.uniforms.uSunI.value = sunI;
    S.sand.uniforms.uSunC.value.copy(cSun.o); S.sand.uniforms.uOp.value = w; S.sand.uniforms.uTime.value = tm + t * 6;
    S.toon.uniforms.uSun.value.copy(sunDir); S.toon.uniforms.uSunC.value.copy(cSun.o).multiplyScalar(0.5 + sunI * 0.6);
    S.toon.uniforms.uAmb.value.copy(cHor.o).multiplyScalar(0.9).add(cTop.o).addScalar(0.1); S.toon.uniforms.uOp.value = w;
    // animal crawling out
    const ax = -1.8 + 8.0 * smoothstep(0.08, 0.93, t);
    const phase = ax * 4.2;
    const out = smoothstep(3.4, 4.4, ax); // body leaving the water -> gait changes
    if (animal.current) {
      animal.current.position.set(ax, rampY(ax) + 0.42 + 0.08 * out, 0);
      animal.current.rotation.set(0, Math.sin(phase) * 0.09, TH + (out * 0.03));
    }
    if (tail.current) tail.current.rotation.y = Math.sin(phase + 1.2) * 0.45;
    limbs.current.forEach((g, i) => {
      if (!g) return;
      const side = i % 2 === 0 ? 1 : -1, front = i < 2 ? 1 : 0;
      const ph = phase + (i === 1 || i === 2 ? Math.PI : 0);
      g.rotation.z = 0.35 + Math.sin(ph) * 0.45;
      g.rotation.x = side * (0.9 - Math.max(0, Math.cos(ph)) * 0.35);
      void front;
    });
    // tiny glowing brain inside the head
    bMat.uniforms.uSw.value = 1; bMat.uniforms.uFold.value = 0.8; bMat.uniforms.uHemi.value = 0.7; bMat.uniforms.uWr.value = 0.5;
    bMat.uniforms.uOpacity.value = w * smoothstep(0.2, 0.55, t); bMat.uniforms.uTime.value = tm; bMat.uniforms.uSig.value = t * 6; bMat.uniforms.uRim.value = 1.2;
    bMat.uniforms.uBase.value = 0.15; bMat.uniforms.uBoost.value = 1.5;
    void world;
  });

  const limbPos: [number, number, number][] = [[0.8, -0.05, 0.28], [0.8, -0.05, -0.28], [-0.55, -0.05, 0.27], [-0.55, -0.05, -0.27]];
  return (
    <group>
      <mesh geometry={S.skyG} material={S.sky} renderOrder={-10} frustumCulled={false} />
      <mesh geometry={S.rampG} material={S.sand} position={[-2, -1 - SLOPE * 2, 0]} rotation={[0, 0, TH]} />
      <mesh geometry={S.waterG} material={S.water} position={[-8, 0, 0]} renderOrder={2} />
      <group ref={animal} scale={1.6}>
        <mesh geometry={S.body} material={S.toon} />
        <group ref={tail} position={[-1.1, 0, 0]}><mesh geometry={S.tailG} material={S.toon} position={[0, 0, 0]} /></group>
        <mesh geometry={S.eye} material={S.toon} position={[0.95, 0.18, 0.14]} />
        <mesh geometry={S.eye} material={S.toon} position={[0.95, 0.18, -0.14]} />
        <group ref={brainG} position={[0.95, 0.05, 0]} scale={0.14}>
          <mesh geometry={bGeo} material={bMat} frustumCulled={false} rotation={[0, 0, 0]} position={[-1.8, 0, 0]} />
        </group>
        {limbPos.map((p, i) => (
          <group key={i} position={p} ref={(g) => { limbs.current[i] = g; }}>
            <mesh geometry={S.upper} material={S.toon} />
            <group position={[0, -0.5, 0]} rotation={[0, 0, -0.5]}>
              <mesh geometry={S.lower} material={S.toon} />
              <mesh geometry={S.foot} material={S.toon} position={[0.08, -0.5, 0]} />
            </group>
          </group>
        ))}
      </group>
      <Plankton count={500} box={BOX} color="#bfe8ff" size={0.03} flow={-1} drift={[0.02, 0.03, 0]} center={[1, -0.5, 1]} />
    </group>
  );
}
