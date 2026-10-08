import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const NV = 16; // vesicles
const PER = 120; // lipids per vesicle
const FLOOR = -3.6;
/** alkaline hydrothermal chimney field: x, z, height, base radius, top radius */
const VENTS: Array<[number, number, number, number, number]> = [
  [0.7, -1.6, 4.0, 1.0, 0.42],
  [-2.7, -2.4, 3.0, 0.85, 0.36],
  [3.2, -2.8, 3.5, 0.92, 0.38],
  [-5.3, -3.8, 2.5, 0.75, 0.3],
  [5.8, -4.6, 2.9, 0.8, 0.34],
  [-1.2, -0.3, 1.7, 0.55, 0.26],
  [2.1, 0.2, 1.2, 0.44, 0.21],
];
const NVENT = VENTS.length;
const top = (v: number) => new THREE.Vector3(VENTS[v][0], FLOOR + VENTS[v][2] - 0.08, VENTS[v][1]);

const ventUniform = () => VENTS.map((_, i) => { const t = top(i); return new THREE.Vector4(t.x, t.y, t.z, VENTS[i][2]); });

/** hydrothermal vent field + lipids self-assembling into vesicles */
export default function Protocells() {
  const scene = useScene();
  const { geo, centers } = useMemo(() => {
    const r = rng(404);
    const centers: Array<THREE.Vector4 & { tc: number; ts: number }> = [];
    for (let i = 0; i < NV; i++) {
      const v = i % NVENT, t0 = top(v);
      const c = new THREE.Vector4(t0.x + (r() - 0.5) * 4.4, t0.y + 1.6 + r() * 4.2, t0.z + (r() - 0.5) * 2.2, 0.26 + r() * 0.34) as THREE.Vector4 & { tc: number; ts: number };
      c.tc = 0.42 + 0.4 * r(); c.ts = c.tc - 0.3;
      centers.push(c);
    }
    const n = NV * PER;
    const pos = new Float32Array(n * 3), cen = new Float32Array(n * 4), dir = new Float32Array(n * 3), sc = new Float32Array(n * 4), tim = new Float32Array(n * 2);
    for (let v = 0; v < NV; v++) for (let k = 0; k < PER; k++) {
      const i = v * PER + k, t0 = top(v % NVENT);
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      dir.set([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], i * 3);
      cen.set([centers[v].x, centers[v].y, centers[v].z, centers[v].w], i * 4);
      sc.set([t0.x + (r() - 0.5) * 1.1, t0.y + r() * 0.5, t0.z + (r() - 0.5) * 1.1, r()], i * 4);
      tim.set([centers[v].ts + r() * 0.06, centers[v].tc - r() * 0.05], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCen', new THREE.BufferAttribute(cen, 4));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aScat', new THREE.BufferAttribute(sc, 4));
    g.setAttribute('aTim', new THREE.BufferAttribute(tim, 2));
    return { geo: g, centers };
  }, []);

  const lipidMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uA; attribute vec4 aCen; attribute vec3 aDir; attribute vec4 aScat; attribute vec2 aTim;
      varying vec3 vC; varying float vA;
      void main(){
        float e=smoothstep(aTim.x,aTim.y,uA);
        vec3 c=aCen.xyz+vec3(sin(uTime*.2+aCen.x*3.)*.25,sin(uTime*.27+aCen.y*2.)*.2,0.);
        vec3 wob=aDir*(1.+.04*sin(uTime*2.+aScat.x*9.));
        float burst=exp(-pow((uA-aTim.y)*18.,2.));
        vec3 sph=c+wob*aCen.w*(1.+.35*burst);
        // lipids stream up from the vent mouth on a curved path, then fold into a sphere
        float s=fract(aScat.w+uTime*.05);
        vec3 sc=aScat.xyz+vec3(sin(uTime*.6+aScat.w*40.)*.35*s, s*(.6+aScat.w), cos(uTime*.5+aScat.x*5.)*.3*s);
        vec3 sw=vec3(sin(e*3.14159)*(aScat.x-aCen.x)*.0,sin(e*3.14159)*.7,sin(e*3.14159)*.6);
        vec3 p=mix(sc,sph,e*e*(3.-2.*e))+sw;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.05+.035*e+.05*burst)*uPx/-mv.z);
        vC=mix(vec3(1.5,.62,.22),vec3(.5,.95,1.),e)*(1.+1.4*burst+.8*smoothstep(.85,1.,e)*(.5+.5*sin(uTime*3.+aCen.x*7.)));
        vA=uW*(.4+.6*e);
      }`,
    fragmentShader: POINT_FRAG,
  }), []);

  const shellMat = useMemo(() => makeGlass('#67e8ff', { rim: 1.7, fill: 0.07, power: 2.2, noise: 2 }), []);
  const ventU = useMemo(ventUniform, []);

  // carbonate chimney: irregular porous mineral tower with strata, sparkle crystals, glowing seeps
  const chimMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vWP; varying vec3 vWN; varying vec3 vL; uniform float uTime; ${NOISE}
      void main(){
        vL=position;
        vec3 wp0=(modelMatrix*vec4(position,1.)).xyz;
        vec3 nw=normalize(mat3(modelMatrix)*normal);
        float u=position.y/ (1.0) ;
        float lump=fbm(wp0*vec3(1.6,.55,1.6))*.5+fbm(wp0*vec3(4.,1.2,4.))*.22;
        float ledge=smoothstep(.55,.9,sin(wp0.y*3.1+fbm(wp0*1.4)*5.))*.1;
        vec3 wp=wp0+vec3(nw.x,0.,nw.z)*(lump*.5+ledge-.18);
        vWP=wp; vWN=nw;
        gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWP; varying vec3 vWN; varying vec3 vL; uniform float uTime,uW,uHeat; ${NOISE}
      void main(){
        vec3 p=vWP;
        float fl=${FLOOR.toFixed(2)};
        float hgt=clamp((p.y-fl)/4.2,0.,1.);
        vec3 n=normalize(vWN);
        // bump from noise gradient
        float b0=fbm(p*5.), bx=fbm(p*5.+vec3(.07,0,0)), by=fbm(p*5.+vec3(0,.07,0)), bz=fbm(p*5.+vec3(0,0,.07));
        n=normalize(n-vec3(bx-b0,by-b0,bz-b0)*5.5);
        vec3 L=normalize(vec3(-.35,.75,.55));
        float lit=max(dot(n,L),0.), up=max(n.y,0.);
        vec3 V=normalize(cameraPosition-p);
        float fr=pow(1.-max(dot(n,V),0.),2.5);
        float band=fbm(vec3(p.xz*.8,p.y*3.4)+vec3(0,fbm(p*2.)*2.,0));
        float strata=smoothstep(.35,.7,band);
        float pores=smoothstep(.62,.7,fbm(p*10.+3.));
        vec3 dark=vec3(.025,.035,.05), pale=vec3(.95,1.,.98), warm=vec3(.5,.34,.26);
        vec3 mineral=mix(dark,pale,strata*.75+.15*b0);
        mineral=mix(mineral,warm,smoothstep(.55,.9,fbm(p*2.5+9.))*.35*hgt);
        float ambient=.16+.14*hgt;
        vec3 col=mineral*(ambient+lit*.9+up*.2)*(1.-pores*.7);
        // heated fluid glows through hairline cracks and the porous mouth
        float cr=1.-abs(2.*fbm(p*vec3(3.,2.2,3.)+4.)-1.);
        float cracks=smoothstep(.945,.99,cr)*(.25+hgt)*uHeat;
        float mouth=smoothstep(.82,1.,hgt)*uHeat;
        col+=vec3(2.4,.85,.25)*(cracks*1.1+mouth*.8*(.5+.5*fbm(p*4.-uTime*.3)));
        col+=vec3(.25,.7,.85)*fr*(.5+.7*hgt)*1.1;
        float sp=smoothstep(.93,1.,vnoise(p*34.))*lit;
        col+=vec3(.9,1.,1.)*sp*.9;
        float fog=smoothstep(2.,14.,length(cameraPosition-p));
        col=mix(col,vec3(.01,.05,.08),fog*.55);
        gl_FragColor=vec4(col*uW,uW);
      }`,
  }), []);

  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 }, uV: { value: ventU } },
    vertexShader: 'varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uTime,uW,uHeat; uniform vec4 uV[${NVENT}]; ${NOISE}
      void main(){
        float n=fbm(vP*vec3(.9,1.,.9)); float r=fbm(vP*3.+2.);
        vec3 c=vec3(.02,.05,.07)*(.4+n*1.6)+vec3(.05,.08,.09)*smoothstep(.55,.8,r)*.8;
        for(int i=0;i<${NVENT};i++){ float d=length(vP.xz-uV[i].xz); c+=vec3(1.5,.5,.14)*uHeat*.35/(1.+d*d*1.2)*(.5+.5*fbm(vP*2.+uTime*.2)); }
        float fade=exp(-length(vP.xz-vec2(0.,-3.))*.09);
        gl_FragColor=vec4(c*fade*uW,uW*smoothstep(0.,6.,12.-length(vP.xz-vec2(0.,-2.))));
      }`,
  }), [ventU]);

  const columnMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: 'varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vWP; void main(){ vL=position; vec4 wp=modelMatrix*vec4(position,1.); vWP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }',
    fragmentShader: /* glsl */ `varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vWP; uniform float uTime,uW,uHeat; ${NOISE}
      void main(){
        float u=vL.y+.5;
        float soft=pow(abs(dot(normalize(vN),normalize(vV))),1.6);
        float a1=fbm(vec3(vWP.xz*1.7,vWP.y*.9-uTime*.9));
        float a2=fbm(vec3(vWP.xz*3.4+5.,vWP.y*1.8-uTime*1.5));
        float shimmer=smoothstep(.3,.8,a1*.7+a2*.5);
        float strand=pow(1.-abs(2.*fbm(vec3(vWP.xz*2.6,vWP.y*.5-uTime*1.1))-1.),5.);
        float a=(shimmer*.55+strand*.6)*soft*smoothstep(0.,.1,u)*pow(1.-u,1.2)*uHeat;
        vec3 col=mix(vec3(1.7,.62,.2),vec3(.3,.7,1.),smoothstep(0.,.65,u));
        gl_FragColor=vec4(col*a*uW*1.15,1.); }`,
  }), []);

  const plumeMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uHeat: { value: 1 }, uV: { value: ventU } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uHeat; uniform vec4 uV[${NVENT}]; attribute vec4 aR; attribute float aV; varying vec3 vC; varying float vA;
      void main(){
        vec4 vt=uV[int(aV)];
        float s=fract(aR.x+uTime*(.06+.08*aR.y)*uHeat);
        float h=s*(5.5+aR.y*3.);
        vec2 sp=(vec2(aR.z,aR.w)-.5)*(.2+s*2.4);
        vec3 p=vt.xyz+vec3(sp.x+sin(h*.8+aR.z*9.+uTime*.5)*.28*s,h,sp.y);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.07+.12*s)*uPx/-mv.z);
        vC=mix(vec3(1.8,.65,.18),vec3(.25,.6,1.),smoothstep(0.,.55,s));
        vA=uW*(1.-s)*smoothstep(0.,.04,s)*(.3+.7*aR.y)*uHeat*.8;
      }`,
    fragmentShader: POINT_FRAG,
  }), [ventU]);
  const plumeGeo = useMemo(() => {
    const r = rng(9);
    const n = Math.floor(2600 * world.quality);
    const a = new Float32Array(n * 4), p = new Float32Array(n * 3), vi = new Float32Array(n);
    for (let i = 0; i < n * 4; i++) a[i] = r();
    for (let i = 0; i < n; i++) vi[i] = Math.min(NVENT - 1, Math.floor(Math.pow(r(), 1.3) * NVENT));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aV', new THREE.BufferAttribute(vi, 1));
    return g;
  }, []);
  // glowing vent mouths (points)
  const mouthGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VENTS.flatMap((_, i) => top(i).toArray())), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(VENTS.map((v) => v[4] * 2.6)), 1));
    return g;
  }, []);
  const mouthMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uHeat: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'uniform float uPx,uW,uHeat,uTime; attribute float aS; varying vec3 vC; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aS*uPx/-mv.z*(1.+.08*sin(uTime*5.+position.x*9.)); vC=vec3(2.1,.85,.3); vA=uW*uHeat*.7; }',
    fragmentShader: POINT_FRAG,
  }), []);

  const colRefs = useRef<Array<THREE.Mesh | null>>([]);
  const shells = useRef<THREE.InstancedMesh>(null);
  const bursts = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const burstMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, wireframe: false, side: THREE.BackSide }), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const chimGeos = useMemo(() => VENTS.map(([, , h, rb, rt]) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 56, 36, true);
    return g;
  }), []);
  useDispose(geo, plumeGeo, lipidMat, shellMat, chimMat, floorMat, columnMat, plumeMat, mouthGeo, mouthMat, burstMat, coreMat, ...chimGeos);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, time = timeNow(), w = scene.weight, px = pxScale(state);
    const pulse = near(eventPos('first-life'), 0.7);
    const heat = 0.7 + 0.35 * smoothstep(0, 0.5, t) + pulse * 0.4;
    for (const m of [lipidMat, plumeMat, mouthMat]) { m.uniforms.uTime.value = time; m.uniforms.uPx.value = px; m.uniforms.uW.value = w; }
    lipidMat.uniforms.uA.value = t;
    plumeMat.uniforms.uHeat.value = heat; mouthMat.uniforms.uHeat.value = heat;
    for (const m of [chimMat, floorMat, columnMat]) { m.uniforms.uTime.value = time; m.uniforms.uW.value = w; m.uniforms.uHeat.value = heat; }
    shellMat.uniforms.uW.value = w; shellMat.uniforms.uTime.value = time;
    shellMat.uniforms.uGlow.value = pulse * 0.8;
    burstMat.opacity = w; coreMat.opacity = w;
    for (let i = 0; i < NVENT; i++) {
      const m = colRefs.current[i]; if (!m) continue;
      m.scale.set(1.0 + 0.1 * Math.sin(time * 0.7 + i), 1, 1.0 + 0.1 * Math.cos(time * 0.6 + i));
    }
    const S = shells.current, B = bursts.current, C = cores.current;
    if (S && B && C) {
      for (let v = 0; v < NV; v++) {
        const c = centers[v];
        const e = smoothstep(c.ts, c.tc, t);
        const cx = c.x + Math.sin(time * 0.2 + c.x * 3) * 0.25, cy = c.y + Math.sin(time * 0.27 + c.y * 2) * 0.2;
        dummy.position.set(cx, cy, c.z);
        dummy.scale.setScalar(Math.max(0.0001, c.w * e * (1 + 0.04 * Math.sin(time * 2 + v))));
        dummy.updateMatrix(); S.setMatrixAt(v, dummy.matrix);
        // completion burst: expanding shell that fades
        const b = Math.min(1, Math.max(0, (t - c.tc) / 0.09));
        const bi = t > c.tc ? (1 - b) * (1 - b) * 1.3 : 0;
        dummy.scale.setScalar(Math.max(0.0001, c.w * (1 + 2.6 * b) * (t > c.tc ? 1 : 0.0001)));
        dummy.updateMatrix(); B.setMatrixAt(v, dummy.matrix);
        B.setColorAt(v, col.setRGB(bi * 0.6, bi * 1.1, bi * 1.4));
        // living core igniting inside
        const ig = smoothstep(c.tc, c.tc + 0.1, t) * (0.75 + 0.25 * Math.sin(time * 3 + v * 2) + pulse * 0.6);
        dummy.scale.setScalar(Math.max(0.0001, c.w * 0.3 * ig));
        dummy.updateMatrix(); C.setMatrixAt(v, dummy.matrix);
        C.setColorAt(v, col.setRGB(1.5 * ig, 0.95 * ig, 0.45 * ig));
      }
      S.instanceMatrix.needsUpdate = true; B.instanceMatrix.needsUpdate = true; C.instanceMatrix.needsUpdate = true;
      if (B.instanceColor) B.instanceColor.needsUpdate = true;
      if (C.instanceColor) C.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <Backdrop color="#1c6a9a" caustics={0.12} shafts={0.1} haze={0.2} />
      <Plankton count={900} box={[18, 11, 9]} color="#ffb070" size={0.05} dir={[0.0, 0.18, 0]} />
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, -3]} frustumCulled={false} renderOrder={-2}>
        <planeGeometry args={[40, 30, 1, 1]} />
      </mesh>
      {VENTS.map(([x, z, h], i) => (
        <group key={i} position={[x, FLOOR + h / 2, z]}>
          <mesh ref={(m) => { colRefs.current[i] = m; }} geometry={chimGeos[i]} material={chimMat} frustumCulled={false} />
        </group>
      ))}
      {VENTS.map(([x, z, h, , rt], i) => {
        const H = 5 + h * 0.8;
        return (
          <mesh key={`c${i}`} material={columnMat} position={[x, FLOOR + h + H / 2 - 0.1, z]} scale={[rt * 1.4 + 0.6, H, rt * 1.4 + 0.6]} frustumCulled={false}>
            <cylinderGeometry args={[2.2, 0.35, 1, 28, 1, true]} />
          </mesh>
        );
      })}
      <points geometry={mouthGeo} material={mouthMat} frustumCulled={false} />
      <points geometry={plumeGeo} material={plumeMat} frustumCulled={false} />
      <points geometry={geo} material={lipidMat} frustumCulled={false} />
      <instancedMesh ref={shells} args={[undefined, undefined, NV]} material={shellMat} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 20]} />
      </instancedMesh>
      <instancedMesh ref={bursts} args={[undefined, undefined, NV]} material={burstMat} frustumCulled={false}>
        <sphereGeometry args={[1, 24, 16]} />
      </instancedMesh>
      <instancedMesh ref={cores} args={[undefined, undefined, NV]} material={coreMat} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
      </instancedMesh>
    </group>
  );
}
