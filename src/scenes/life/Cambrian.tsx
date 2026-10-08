import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, timeNow, useDispose } from './common';

type Part = { s: [number, number, number]; p: [number, number, number]; part: number; rot?: [number, number, number] };

function buildGeo(parts: Part[]) {
  const gs = parts.map((o) => {
    const g = new THREE.SphereGeometry(1, 14, 10);
    g.scale(...o.s);
    if (o.rot) g.rotateZ(o.rot[2]);
    g.translate(...o.p);
    const a = new Float32Array(g.attributes.position.count).fill(o.part);
    g.setAttribute('aPart', new THREE.BufferAttribute(a, 1));
    return g;
  });
  const m = mergeGeometries(gs)!;
  gs.forEach((g) => g.dispose());
  return m;
}

function trilobite(): Part[] {
  const p: Part[] = [];
  p.push({ s: [0.26, 0.09, 0.24], p: [0.3, 0, 0], part: 0 });
  p.push({ s: [0.1, 0.07, 0.07], p: [0.3, 0.07, 0], part: 0 });
  for (let i = 0; i < 9; i++) { const x = 0.12 - i * 0.056, w = 0.21 - i * 0.012; p.push({ s: [0.034, 0.065, w], p: [x, 0.0, 0], part: 0 }); }
  p.push({ s: [0.12, 0.05, 0.12], p: [-0.42, 0, 0], part: 0 });
  p.push({ s: [0.028, 0.028, 0.028], p: [0.36, 0.09, 0.11], part: 1 });
  p.push({ s: [0.028, 0.028, 0.028], p: [0.36, 0.09, -0.11], part: 1 });
  return p;
}
function anomalocaris(): Part[] {
  const p: Part[] = [];
  for (let i = 0; i < 10; i++) {
    const x = 0.6 - i * 0.17, k = 1 - i * 0.065;
    p.push({ s: [0.12, 0.17 * k, 0.24 * k], p: [x, 0, 0], part: 0 });
    for (const sg of [-1, 1]) p.push({ s: [0.13, 0.025, 0.3 * k], p: [x, -0.04, sg * (0.3 * k + 0.13)], part: 2 });
  }
  for (const [x, z, sz] of [[-1.15, 0, 0.2], [-1.3, 0.1, 0.16], [-1.3, -0.1, 0.16]] as const) p.push({ s: [sz, 0.02, 0.07], p: [x, 0, z], part: 0 });
  p.push({ s: [0.28, 0.2, 0.28], p: [0.82, 0, 0], part: 0 });
  p.push({ s: [0.07, 0.07, 0.2], p: [1.05, -0.12, 0], part: 3 });
  for (const sg of [-1, 1]) {
    p.push({ s: [0.03, 0.03, 0.14], p: [0.9, 0.12, sg * 0.3], part: 0 });
    p.push({ s: [0.085, 0.085, 0.085], p: [0.92, 0.16, sg * 0.42], part: 1 });
    for (let i = 0; i < 7; i++) p.push({ s: [0.08 - i * 0.007, 0.06 - i * 0.005, 0.06 - i * 0.005], p: [1.0 + i * 0.1, -0.1 + Math.sin(i * 0.5) * 0.1 - i * 0.015, sg * (0.12 + i * 0.01)], part: 3 });
  }
  return p;
}

interface Critter { kind: 0 | 1; x: number; y: number; z: number; s: number; yaw: number; sp: number; ph: number }

export default function Cambrian() {
  const scene = useScene();
  const geoT = useMemo(() => buildGeo(trilobite()), []);
  const geoA = useMemo(() => buildGeo(anomalocaris()), []);
  const crit = useMemo<Critter[]>(() => {
    const r = rng(540);
    const list: Critter[] = [
      { kind: 1, x: 0.5, y: 0.9, z: 0.5, s: 1.25, yaw: 0, sp: 0.5, ph: 0 },
      { kind: 1, x: -6.5, y: 2.6, z: -7, s: 1.0, yaw: -0.3, sp: 0.35, ph: 1.7 },
      { kind: 1, x: 7, y: 1.2, z: -11, s: 1.6, yaw: Math.PI + 0.2, sp: 0.3, ph: 3.1 },
    ];
    for (let i = 0; i < 13; i++) list.push({ kind: 0, x: (r() - 0.5) * 18, y: -3.1 + r() * 0.1, z: -4 + r() * 4.5, s: 0.9 + r() * 0.8, yaw: r() * 6.28, sp: 0.1 + r() * 0.2, ph: r() * 6 });
    return list;
  }, []);
  const U = useMemo(() => ({ uTime: { value: 0 }, uW: { value: 0 }, uEye: { value: 0 }, uLight: { value: 0.2 } }), []);
  const mk = (mode: number) => new THREE.ShaderMaterial({
    transparent: true, uniforms: { ...U, uMode: { value: mode } },
    vertexShader: `uniform float uTime,uMode; attribute float aPart; varying vec3 vN; varying vec3 vV; varying float vP; varying float vD; varying vec3 vO;
      void main(){ vec3 p=position; vP=aPart;
        float amp=uMode>.5?.1:.0;
        if(aPart>1.5&&aPart<2.5) p.y+=sin(p.x*5.-uTime*5.+p.z*2.)*.09*abs(p.z);
        else p.y+=sin(p.x*3.-uTime*2.)*amp*smoothstep(.6,-1.3,p.x);
        if(aPart>2.5) p.z*=1.+.15*sin(uTime*2.+p.x*4.);
        vO=p; mat4 im=instanceMatrix; vec4 wp=modelMatrix*im*vec4(p,1.);
        vN=normalize(mat3(modelMatrix*im)*normal); vV=normalize(cameraPosition-wp.xyz);
        vec4 mv=viewMatrix*wp; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uW,uEye,uLight,uTime,uMode; varying vec3 vN; varying vec3 vV; varying float vP; varying float vD; varying vec3 vO; ${NOISE}
      void main(){ vec3 n=normalize(vN); float f=pow(1.-abs(dot(n,normalize(vV))),2.2);
        float up=max(dot(n,normalize(vec3(.2,1.,.3))),0.);
        float seg=.5+.5*sin(vO.x*(uMode>.5?22.:60.));
        vec3 body=vec3(.05,.07,.09)+vec3(.22,.3,.28)*up*uLight*(.7+.3*seg)+vec3(.3,.55,.6)*f*uLight*.9;
        body+=vec3(.25,.12,.08)*(vP>2.5?1.:0.)*uLight*(.4+up);
        vec3 fog=vec3(.01,.04,.07)+vec3(.04,.14,.2)*uLight;
        float fa=1.-exp(-vD*(.07-.025*uLight)); body=mix(body,fog,fa);
        vec3 c=body;
        if(vP>.5&&vP<1.5){ c=vec3(.1,.1,.12)+vec3(1.,1.6,1.8)*uEye*3.2; }
        gl_FragColor=vec4(c,uW); }`,
  });
  const mat = useMemo(() => mk(0), []); // eslint-disable-line react-hooks/exhaustive-deps
  const matA = useMemo(() => mk(1), []); // eslint-disable-line react-hooks/exhaustive-deps
  const instT = useRef<THREE.InstancedMesh>(null), instA = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);

  const floorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uLight: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec3 vP; uniform float uW,uTime,uLight; ${NOISE}
      void main(){ float n=fbm(vec3(vP.xz*.6,0.)); float rip=pow(1.-abs(vnoise(vec3(vP.xz*1.0,uTime*.25))*2.-1.),8.)+pow(1.-abs(vnoise(vec3(vP.xz*1.6+4.,uTime*.3))*2.-1.),8.);
       float fade=exp(-length(vP.xz-vec2(0.,-4.))*.08);
       gl_FragColor=vec4((vec3(.04,.1,.12)*(.4+n)+vec3(.35,.8,.9)*rip*.28*uLight)*fade*uW,1.); }`,
  }), []);
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.1, 2.2), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const beamMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uW; void main(){ float a=pow(vUv.y,1.6)*exp(-pow((vUv.x-.5)*4.5,2.)); gl_FragColor=vec4(vec3(.35,.8,.95)*a*uW*.22,1.); }',
  }), []);
  const beams = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  useDispose(geoT, geoA, mat, matA, floorMat, flashMat, beamMat);

  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow();
    const ev = eventPos('cambrian-explosion-eyes');
    const open = smoothstep(ev - 0.18, ev + 0.08, world.stationF);
    const fl = near(ev, 0.22);
    const tail = 1 - smoothstep(0.75, 1, t);
    const light = (0.12 + 0.88 * smoothstep(ev - 0.5, ev + 0.5, world.stationF)) * (0.3 + 0.7 * tail);
    U.uTime.value = time; U.uW.value = w; U.uEye.value = open * (0.8 + 0.4 * Math.sin(time * 2) * (world.reduced ? 0 : 1)) + fl * 1.5; U.uLight.value = light;
    floorMat.uniforms.uW.value = w; floorMat.uniforms.uTime.value = time; floorMat.uniforms.uLight.value = light;
    flashMat.opacity = w * fl * fl * 0.09;
    if (flash.current) flash.current.scale.setScalar(1 + (1 - fl) * 0.2);
    beamMat.uniforms.uW.value = w * open * (0.6 + 0.4 * tail);
    if (beams.current) beams.current.visible = open > 0.02;
    let ia = 0, it = 0;
    const flap = 0.2;
    for (const c of crit) {
      const tt = t - 0.5;
      const drift = tt * 14 * c.sp * (c.kind ? (c.z < -5 ? -1 : 1) : 0.5) * (c.yaw > 3 ? -1 : 1);
      let x = c.x + drift, y = c.y, yaw = c.yaw, s = c.s;
      if (c.kind === 1) {
        y += Math.sin(time * 0.7 + c.ph) * 0.12;
        if (c.z > -1) { yaw = -0.85 * smoothstep(0.1, 0.55, t) + 0.35 * (1 - smoothstep(0.55, 1, t)) * 0 ; x = c.x + drift * 0.25 + 1.2 * smoothstep(0.5, 0.1, t); }
        d.position.set(x, y, c.z); d.rotation.set(0, yaw, Math.sin(time * 0.9 + c.ph) * flap * 0.3); d.scale.setScalar(s);
        d.updateMatrix(); instA.current?.setMatrixAt(ia++, d.matrix);
      } else {
        x = ((c.x + 9 + drift * 0.6) % 18 + 18) % 18 - 9;
        d.position.set(x, y + 0.05 * Math.sin(time * 6 + c.ph) * 0.2, c.z); d.rotation.set(0, c.yaw + Math.sin(time * 0.5 + c.ph) * 0.2, 0); d.scale.setScalar(s);
        d.updateMatrix(); instT.current?.setMatrixAt(it++, d.matrix);
      }
    }
    if (instA.current) instA.current.instanceMatrix.needsUpdate = true;
    if (instT.current) instT.current.instanceMatrix.needsUpdate = true;
  });

  const nA = crit.filter((c) => c.kind === 1).length, nT = crit.length - nA;
  const shafts = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: -12 + i * 4 + (i % 2) * 1.2, w: 1.2 + (i % 3) * 0.8, tilt: 0.25 })), []);
  return (
    <group>
      <Backdrop color="#46c4d8" caustics={0.5} shafts={0.55} haze={0.25} z={-18} uLight={() => U.uLight.value * 1.2} />
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, -4]} frustumCulled={false}>
        <planeGeometry args={[70, 40]} />
      </mesh>
      <Plankton count={900} box={[26, 14, 16]} color="#c8f4ff" size={0.04} dir={[0.02, -0.04, 0]} intensity={0.8} />
      <group ref={beams}>
        {shafts.map((sh, i) => (
          <mesh key={i} position={[sh.x, 4, -9 - (i % 3) * 2]} rotation={[0, 0, sh.tilt]} material={beamMat} frustumCulled={false}>
            <planeGeometry args={[sh.w, 18]} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={instA} args={[geoA, matA, nA]} frustumCulled={false} />
      <instancedMesh ref={instT} args={[geoT, mat, nT]} frustumCulled={false} />
      <mesh ref={flash} position={[0, 0, 3]} material={flashMat} renderOrder={50} frustumCulled={false}>
        <planeGeometry args={[60, 40]} />
      </mesh>
    </group>
  );
}
