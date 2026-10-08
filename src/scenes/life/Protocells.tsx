import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const NV = 16; // vesicles
const PER = 110; // lipids per vesicle

/** hydrothermal vent + lipids self-assembling into vesicles */
export default function Protocells() {
  const scene = useScene();
  const { geo, centers } = useMemo(() => {
    const r = rng(404);
    const centers: THREE.Vector4[] = [];
    for (let i = 0; i < NV; i++) {
      const x = (r() - 0.5) * 11, y = -0.8 + r() * 4.6, z = -3 + r() * 4;
      centers.push(new THREE.Vector4(x, y, z, 0.28 + r() * 0.42));
    }
    const n = NV * PER;
    const pos = new Float32Array(n * 3), cen = new Float32Array(n * 4), dir = new Float32Array(n * 3), sc = new Float32Array(n * 4);
    for (let v = 0; v < NV; v++) for (let k = 0; k < PER; k++) {
      const i = v * PER + k;
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      dir.set([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], i * 3);
      cen.set([centers[v].x, centers[v].y, centers[v].z, centers[v].w], i * 4);
      sc.set([(r() - 0.5) * 9, (r() - 0.5) * 5 - 1, (r() - 0.5) * 6, r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCen', new THREE.BufferAttribute(cen, 4));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aScat', new THREE.BufferAttribute(sc, 4));
    return { geo: g, centers };
  }, []);

  const lipidMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uA; attribute vec4 aCen; attribute vec3 aDir; attribute vec4 aScat;
      varying vec3 vC; varying float vA;
      void main(){
        float e=smoothstep(aScat.w*.45,aScat.w*.45+.5,uA);
        vec3 c=aCen.xyz+vec3(sin(uTime*.2+aCen.x*3.)*.25,sin(uTime*.27+aCen.y*2.)*.2,0.);
        vec3 wob=aDir*(1.+.04*sin(uTime*2.+aScat.x*9.));
        vec3 sph=c+wob*aCen.w;
        vec3 sc=aScat.xyz+vec3(sin(uTime*.3+aScat.w*40.),cos(uTime*.25+aScat.x*5.),0.)*.4;
        vec3 p=mix(sc,sph,e*e*(3.-2.*e));
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.045+.03*e)*uPx/-mv.z);
        vC=mix(vec3(.9,.55,.25),vec3(.5,.95,1.),e)*(1.+.8*smoothstep(.85,1.,e)*(.5+.5*sin(uTime*3.+aCen.x*7.)));
        vA=uW*(.35+.65*e);
      }`,
    fragmentShader: POINT_FRAG,
  }), []);

  const shellMat = useMemo(() => makeGlass('#67e8ff', { rim: 1.4, fill: 0.05, power: 2.2, noise: 2 }), []);
  const ventMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 } },
    transparent: true,
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){vP=position;vN=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; varying vec3 vN; uniform float uTime,uW,uHeat; ${NOISE}
      void main(){ float n=fbm(vP*2.2+vec3(0,0,uTime*.05)); float cr=smoothstep(.45,.8,fbm(vP*4.+3.));
        float glow=smoothstep(.45,.9,vP.y*.35+.2+n*.5)*uHeat;
        vec3 rock=vec3(.035,.04,.06)*(.5+n)+vec3(.04,.1,.12)*pow(1.-abs(normalize(vN).z),3.);
        vec3 hot=vec3(1.6,.55,.12)*glow*(cr*.8+.4);
        gl_FragColor=vec4((rock+hot)*uW,uW); }`,
  }), []);
  const plumeMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uHeat; attribute vec4 aR; varying vec3 vC; varying float vA;
      void main(){
        float s=fract(aR.x+uTime*(.05+.07*aR.y)*uHeat);
        float h=s*10.;
        vec2 sp=(vec2(aR.z,aR.w)-.5)*(.3+s*3.2);
        vec3 p=vec3(0.,-3.2+h,-1.5)+vec3(sp.x+sin(h*.7+aR.z*9.+uTime*.4)*.25*s,0.,sp.y);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.09+.12*s)*uPx/-mv.z);
        vC=mix(vec3(1.6,.6,.18),vec3(.2,.55,.9),smoothstep(0.,.6,s));
        vA=uW*(1.-s)*smoothstep(0.,.05,s)*(.3+.7*aR.y)*uHeat;
      }`,
    fragmentShader: POINT_FRAG,
  }), []);
  const plumeGeo = useMemo(() => {
    const r = rng(9);
    const n = Math.floor(1800 * world.quality);
    const a = new Float32Array(n * 4), p = new Float32Array(n * 3);
    for (let i = 0; i < n * 4; i++) a[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    return g;
  }, []);
  const glow = useRef<THREE.Mesh>(null);
  const shells = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useDispose(geo, plumeGeo, lipidMat, shellMat, ventMat, plumeMat);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, time = timeNow(), w = scene.weight, px = pxScale(state);
    const A = smoothstep(0.12, 0.8, t); // assembly
    const pulse = near(eventPos('first-life'), 0.7);
    const heat = 0.65 + 0.35 * smoothstep(0, 0.5, t) + pulse * 0.4;
    for (const m of [lipidMat, plumeMat]) { m.uniforms.uTime.value = time; m.uniforms.uPx.value = px; m.uniforms.uW.value = w; }
    lipidMat.uniforms.uA.value = A;
    plumeMat.uniforms.uHeat.value = heat;
    ventMat.uniforms.uTime.value = time; ventMat.uniforms.uW.value = w; ventMat.uniforms.uHeat.value = heat;
    shellMat.uniforms.uW.value = w * smoothstep(0.45, 0.85, t); shellMat.uniforms.uTime.value = time;
    shellMat.uniforms.uGlow.value = pulse * 0.8;
    if (shells.current) {
      for (let v = 0; v < NV; v++) {
        const c = centers[v];
        const e = smoothstep(0.35 + (v / NV) * 0.35, 0.8, t);
        dummy.position.set(c.x + Math.sin(time * 0.2 + c.x * 3) * 0.25, c.y + Math.sin(time * 0.27 + c.y * 2) * 0.2, c.z);
        dummy.scale.setScalar(Math.max(0.0001, c.w * e * (1 + 0.04 * Math.sin(time * 2 + v))));
        dummy.updateMatrix();
        shells.current.setMatrixAt(v, dummy.matrix);
      }
      shells.current.instanceMatrix.needsUpdate = true;
    }
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = w * (0.5 + 0.5 * heat) * 0.22;
    }
  });

  return (
    <group>
      <Backdrop color="#1c6a9a" caustics={0.12} shafts={0.1} haze={0.2} />
      <Plankton count={900} box={[18, 11, 9]} color="#ffb070" size={0.05} dir={[0.0, 0.18, 0]} />
      {/* vent chimney */}
      <mesh position={[0, -4.6, -1.5]} material={ventMat}>
        <coneGeometry args={[2.1, 4.2, 40, 14, true]} />
      </mesh>
      <mesh position={[-2.8, -4.9, -2.5]} material={ventMat} rotation={[0, 0, 0.1]}>
        <coneGeometry args={[1.2, 3.2, 28, 8, true]} />
      </mesh>
      <mesh position={[3.2, -5, -3]} material={ventMat}>
        <coneGeometry args={[1.5, 3.6, 28, 8, true]} />
      </mesh>
      <mesh ref={glow} position={[0, -2.7, -1.2]}>
        <sphereGeometry args={[1.2, 24, 16]} />
        <meshBasicMaterial color={[2.4, 0.9, 0.25]} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <points geometry={plumeGeo} material={plumeMat} frustumCulled={false} />
      <points geometry={geo} material={lipidMat} frustumCulled={false} />
      <instancedMesh ref={shells} args={[undefined, undefined, NV]} material={shellMat} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 20]} />
      </instancedMesh>
    </group>
  );
}
