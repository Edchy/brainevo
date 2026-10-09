import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const PER = 90; // lipids per vesicle
const FLOOR = -3.6;
/** alkaline hydrothermal chimney field: x, z, height, base radius, top radius */
const VENTS: Array<[number, number, number, number, number]> = [
  [0.7, -1.6, 4.2, 0.8, 0.22],
  [-2.8, -2.6, 3.1, 0.68, 0.2],
  [3.3, -2.9, 3.5, 0.72, 0.2],
];
const NVENT = VENTS.length;
const top = (v: number) => new THREE.Vector3(VENTS[v][0], FLOOR + VENTS[v][2] - 0.02, VENTS[v][1]);
const ventUniform = () => VENTS.map((_, i) => { const t = top(i); return new THREE.Vector4(t.x, t.y, t.z, VENTS[i][2]); });

/** a deliberate cast: one hero vesicle riding the main plume, three smaller companions receding in depth. x, y, z, radius, vent, completion t */
const VES: Array<[number, number, number, number, number, number]> = [
  [1.0, 2.05, 0.5, 0.6, 0, 0.62],
  [-2.5, 2.35, -0.9, 0.36, 1, 0.46],
  [3.2, 2.2, -1.4, 0.29, 2, 0.38],
  [-0.9, 3.0, -1.6, 0.21, 0, 0.78],
];
const NV = VES.length;

/** smooth lathe-turned chimney: flared foot, slender neck, a lip and a hollow mouth */
function chimneyGeo(h: number, rb: number, rt: number) {
  const pts: THREE.Vector2[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const r = rt + (rb - rt) * Math.pow(1 - u, 3.2) + 0.05 * Math.pow(1 - u, 9) + 0.035 * smoothstep(0.9, 1, u);
    pts.push(new THREE.Vector2(r, u * h));
  }
  pts.push(new THREE.Vector2(rt * 0.62, h + 0.015), new THREE.Vector2(rt * 0.5, h - 0.12));
  return new THREE.LatheGeometry(pts, 72);
}

/** hydrothermal vent field + lipids self-assembling into a few luminous vesicles */
export default function Protocells() {
  const scene = useScene();
  const { geo } = useMemo(() => {
    const r = rng(404);
    const n = NV * PER;
    const pos = new Float32Array(n * 3), cen = new Float32Array(n * 4), dir = new Float32Array(n * 3), sc = new Float32Array(n * 4), tim = new Float32Array(n * 2);
    for (let v = 0; v < NV; v++) for (let k = 0; k < PER; k++) {
      const i = v * PER + k, t0 = top(VES[v][4]);
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      dir.set([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], i * 3);
      cen.set([VES[v][0], VES[v][1], VES[v][2], VES[v][3]], i * 4);
      sc.set([t0.x + (r() - 0.5) * 0.5, t0.y + r() * 0.3, t0.z + (r() - 0.5) * 0.5, r()], i * 4);
      const tc = VES[v][5];
      tim.set([tc - 0.3 + r() * 0.06, tc - r() * 0.05], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCen', new THREE.BufferAttribute(cen, 4));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aScat', new THREE.BufferAttribute(sc, 4));
    g.setAttribute('aTim', new THREE.BufferAttribute(tim, 2));
    return { geo: g };
  }, []);

  const lipidMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uA; attribute vec4 aCen; attribute vec3 aDir; attribute vec4 aScat; attribute vec2 aTim;
      varying vec3 vC; varying float vA;
      void main(){
        float e=smoothstep(aTim.x,aTim.y,uA);
        vec3 c=aCen.xyz+vec3(sin(uTime*.2+aCen.x*3.)*.12,sin(uTime*.27+aCen.y*2.)*.1,0.);
        vec3 sph=c+aDir*aCen.w*(1.+.015*sin(uTime*2.+aScat.x*9.));
        // lipids rise from the vent mouth on a gentle curve, then fold onto the sphere
        float s=fract(aScat.w+uTime*.04);
        vec3 sc=aScat.xyz+vec3(sin(uTime*.5+aScat.w*40.)*.25*s, s*(.5+aScat.w*.8), cos(uTime*.4+aScat.x*5.)*.2*s);
        float k=e*e*(3.-2.*e);
        vec3 p=mix(sc,sph,k);
        p+=(c-p)*sin(e*3.14159)*.0;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.026+.014*e)*uPx/-mv.z);
        vC=mix(vec3(1.2,.85,.55),vec3(.9,.97,1.1),e);
        vA=uW*(.25+.35*e)*(1.-.6*smoothstep(.85,1.,e));
      }`,
    fragmentShader: POINT_FRAG,
  }), []);

  const shellMat = useMemo(() => makeGlass('#e4f4ff', { rim: 0.95, fill: 0.006, power: 4.6, noise: 0 }), []);
  const ventU = useMemo(ventUniform, []);

  const chimMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: 'varying vec3 vWP; varying vec3 vWN; varying float vU; void main(){ vU=uv.y; vec4 w=modelMatrix*vec4(position,1.); vWN=normalize(mat3(modelMatrix)*normal); vec2 o=normalize(vWN.xz+1e-4); float k=smoothstep(0.,.6,position.y); w.xz+=o*k*(.035*sin(w.y*1.9+w.x*2.3)+.018*sin(w.y*4.1+w.z*3.)); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */ `
      varying vec3 vWP; varying vec3 vWN; varying float vU; uniform float uTime,uW,uHeat; ${NOISE}
      void main(){
        vec3 p=vWP, n=normalize(vWN);
        float hgt=clamp(vU,0.,1.);
        vec3 V=normalize(cameraPosition-p);
        vec3 L=normalize(vec3(-.45,.7,.5));
        float lam=max(dot(n,L),0.), wrap=.5+.5*dot(n,L);
        float fr=pow(1.-max(dot(n,V),0.),2.4);
        // fine strata: a few hairlines that wander gently with height
        float w0=fbm(p*vec3(.9,.3,.9))*1.4;
        float s=fract(p.y*3.7+w0);
        float line=smoothstep(.05,0.,min(s,1.-s))*.5+smoothstep(.12,0.,abs(fract(p.y*1.3+w0*.7)-.5)-.0)*.0;
        vec3 base=vec3(.015,.02,.024)+vec3(.06,.066,.074)*wrap*wrap*wrap;
        vec3 col=base*(.55+.6*lam)+vec3(.5,.57,.64)*fr*(.25+.35*hgt)*(.25+.8*lam);
        col+=vec3(.5,.56,.6)*line*(.15+.5*lam)*(.5+.5*fr);
        // warm breath at the mouth
        col+=vec3(1.5,1.0,.65)*pow(smoothstep(.85,1.,hgt),2.)*.28*uHeat*(.8+.2*sin(uTime*1.3));
        float fog=smoothstep(3.,16.,length(cameraPosition-p));
        col=mix(col,vec3(.01,.03,.05),fog*.6);
        gl_FragColor=vec4(col,uW);
      }`,
  }), []);

  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 }, uV: { value: ventU } },
    vertexShader: 'varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uTime,uW,uHeat; uniform vec4 uV[${NVENT}]; ${NOISE}
      void main(){
        float n=fbm(vP*vec3(.35,1.,.35));
        vec3 c=vec3(.012,.02,.028)*(.5+n*1.2);
        for(int i=0;i<${NVENT};i++){ float d=length(vP.xz-uV[i].xz); c+=vec3(.9,.65,.45)*uHeat*.16/(1.+d*d*1.6); }
        float fade=exp(-length(vP.xz-vec2(0.,-3.))*.12);
        gl_FragColor=vec4(c*fade,uW*smoothstep(0.,6.,12.-length(vP.xz-vec2(0.,-2.))));
      }`,
  }), [ventU]);

  // a faint, slow column of warmed water above each mouth (low-frequency, no strands)
  const columnMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uW: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: 'varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vWP; void main(){ vL=position; vec4 wp=modelMatrix*vec4(position,1.); vWP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }',
    fragmentShader: /* glsl */ `varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vWP; uniform float uTime,uW,uHeat; ${NOISE}
      void main(){
        float u=vL.y+.5;
        float soft=pow(abs(dot(normalize(vN),normalize(vV))),2.2);
        float a1=fbm(vec3(vWP.xz*.8,vWP.y*.45-uTime*.35));
        float a=smoothstep(.3,.8,a1)*soft*smoothstep(0.,.12,u)*pow(1.-u,1.6)*uHeat*.12;
        vec3 col=mix(vec3(1.3,.9,.6),vec3(.7,.85,1.),smoothstep(0.,.5,u));
        gl_FragColor=vec4(col*a*uW,1.); }`,
  }), []);

  const plumeMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uHeat: { value: 1 }, uV: { value: ventU } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx,uW,uHeat; uniform vec4 uV[${NVENT}]; attribute vec4 aR; attribute float aV; varying vec3 vC; varying float vA;
      void main(){
        vec4 vt=uV[int(aV)];
        float s=fract(aR.x+uTime*(.05+.05*aR.y)*uHeat);
        float h=s*(5.+aR.y*3.);
        vec2 sp=(vec2(aR.z,aR.w)-.5)*(.1+s*1.4);
        vec3 p=vt.xyz+vec3(sp.x+sin(h*.7+aR.z*9.+uTime*.35)*.2*s,h,sp.y);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.03+.05*s)*uPx/-mv.z);
        vC=mix(vec3(1.4,.95,.62),vec3(.78,.9,1.1),smoothstep(0.,.4,s));
        vA=uW*(1.-s)*smoothstep(0.,.05,s)*(.25+.5*aR.y)*uHeat*.7;
      }`,
    fragmentShader: POINT_FRAG,
  }), [ventU]);
  const plumeGeo = useMemo(() => {
    const r = rng(9);
    const n = Math.floor(520 * world.quality);
    const a = new Float32Array(n * 4), p = new Float32Array(n * 3), vi = new Float32Array(n);
    for (let i = 0; i < n * 4; i++) a[i] = r();
    for (let i = 0; i < n; i++) vi[i] = Math.min(NVENT - 1, Math.floor(Math.pow(r(), 1.3) * NVENT));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aV', new THREE.BufferAttribute(vi, 1));
    return g;
  }, []);
  const mouthGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VENTS.flatMap((_, i) => top(i).toArray())), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(VENTS.map((v) => v[4] * 3.2)), 1));
    return g;
  }, []);
  const mouthMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uHeat: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'uniform float uPx,uW,uHeat,uTime; attribute float aS; varying vec3 vC; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aS*uPx/-mv.z*(1.+.05*sin(uTime*2.+position.x*9.)); vC=vec3(1.5,1.0,.62); vA=uW*uHeat*.32; }',
    fragmentShader: POINT_FRAG,
  }), []);

  // per-instance coloured soft materials (instanceColor drives intensity)
  const inst = /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying vec3 vCol;
    void main(){
      vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);
      vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); vV=normalize(cameraPosition-wp.xyz);
      #ifdef USE_INSTANCING_COLOR
        vCol=instanceColor;
      #else
        vCol=vec3(1.);
      #endif
      gl_Position=projectionMatrix*viewMatrix*wp; }`;
  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: inst,
    fragmentShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vCol; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),14.)*1.6; gl_FragColor=vec4(vCol*f,1.); }',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const coreMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: inst,
    fragmentShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vCol; void main(){ float f=pow(abs(dot(normalize(vN),normalize(vV))),2.6); gl_FragColor=vec4(vCol*f,1.); }',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const shells = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const chimGeos = useMemo(() => VENTS.map(([, , h, rb, rt]) => chimneyGeo(h, rb, rt)), []);
  useDispose(geo, plumeGeo, lipidMat, shellMat, chimMat, floorMat, columnMat, plumeMat, mouthGeo, mouthMat, ringMat, coreMat, ...chimGeos);

  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, time = timeNow(), w = scene.weight, px = pxScale(state);
    const pulse = near(eventPos('first-life'), 0.5);
    const heat = 0.75 + 0.2 * smoothstep(0, 0.5, t) + pulse * 0.25;
    for (const m of [lipidMat, plumeMat, mouthMat]) { m.uniforms.uTime.value = time; m.uniforms.uPx.value = px; m.uniforms.uW.value = w; }
    lipidMat.uniforms.uA.value = t;
    plumeMat.uniforms.uHeat.value = heat; mouthMat.uniforms.uHeat.value = heat;
    for (const m of [chimMat, floorMat, columnMat]) { m.uniforms.uTime.value = time; m.uniforms.uW.value = w; m.uniforms.uHeat.value = heat; }
    shellMat.uniforms.uW.value = w; shellMat.uniforms.uTime.value = time;
    shellMat.uniforms.uGlow.value = pulse * 0.5;
    const S = shells.current, B = rings.current, C = cores.current;
    if (S && B && C) {
      for (let v = 0; v < NV; v++) {
        const [vx, vy, vz, vr, , tc] = VES[v];
        const e = smoothstep(tc - 0.3, tc, t);
        const cx = vx + Math.sin(time * 0.2 + vx * 3) * 0.12, cy = vy + Math.sin(time * 0.27 + vy * 2) * 0.1;
        dummy.position.set(cx, cy, vz);
        dummy.scale.setScalar(Math.max(0.0001, vr * e * (1 + 0.015 * Math.sin(time * 2 + v))));
        dummy.updateMatrix(); S.setMatrixAt(v, dummy.matrix);
        // completion: one thin ring expanding and fading
        const b = Math.min(1, Math.max(0, (t - tc) / 0.1));
        const bi = t > tc ? (1 - b) * (1 - b) * 0.9 : 0;
        dummy.scale.setScalar(Math.max(0.0001, vr * (1 + 1.4 * b) * (t > tc ? 1 : 0.0001)));
        dummy.updateMatrix(); B.setMatrixAt(v, dummy.matrix);
        B.setColorAt(v, col.setRGB(bi * 0.9, bi * 1.0, bi * 1.1));
        // the faint living core
        const ig = smoothstep(tc, tc + 0.12, t) * (0.8 + 0.2 * Math.sin(time * 1.6 + v * 2) + pulse * 0.4);
        dummy.scale.setScalar(Math.max(0.0001, vr * 0.82 * Math.min(1, e + 0.0001)));
        dummy.updateMatrix(); C.setMatrixAt(v, dummy.matrix);
        C.setColorAt(v, col.setRGB(0.16 * ig * w, 0.18 * ig * w, 0.21 * ig * w));
      }
      S.instanceMatrix.needsUpdate = true; B.instanceMatrix.needsUpdate = true; C.instanceMatrix.needsUpdate = true;
      if (B.instanceColor) B.instanceColor.needsUpdate = true;
      if (C.instanceColor) C.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <Plankton count={80} box={[18, 11, 9]} color="#d6e8ff" size={0.03} dir={[0.0, 0.12, 0]} intensity={0.5} />
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, -3]} frustumCulled={false} renderOrder={-2}>
        <planeGeometry args={[40, 30, 1, 1]} />
      </mesh>
      {VENTS.map(([x, z], i) => (
        <mesh key={i} geometry={chimGeos[i]} material={chimMat} position={[x, FLOOR, z]} frustumCulled={false} />
      ))}
      {VENTS.map(([x, z, h, , rt], i) => {
        const H = 5 + h * 0.8;
        return (
          <mesh key={`c${i}`} material={columnMat} position={[x, FLOOR + h + H / 2 - 0.1, z]} scale={[rt * 1.4 + 0.5, H, rt * 1.4 + 0.5]} frustumCulled={false}>
            <cylinderGeometry args={[2.0, 0.3, 1, 28, 1, true]} />
          </mesh>
        );
      })}
      <points geometry={mouthGeo} material={mouthMat} frustumCulled={false} />
      <points geometry={plumeGeo} material={plumeMat} frustumCulled={false} />
      <points geometry={geo} material={lipidMat} frustumCulled={false} />
      <instancedMesh ref={cores} args={[undefined, undefined, NV]} material={coreMat} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 20]} />
      </instancedMesh>
      <instancedMesh ref={shells} args={[undefined, undefined, NV]} material={shellMat} frustumCulled={false}>
        <sphereGeometry args={[1, 64, 40]} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[undefined, undefined, NV]} material={ringMat} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 28]} />
      </instancedMesh>
    </group>
  );
}
