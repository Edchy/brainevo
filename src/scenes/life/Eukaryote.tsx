import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, makeGlass, pxScale, timeNow, useDispose } from './common';

const R = 2.5;
const NM = 7;
const DIR = new THREE.Vector3(0.82, 0.18, 0.2).normalize();

/** archaeal host swallows a bacterium; it becomes the mitochondrion */
export default function Eukaryote() {
  const scene = useScene();
  const hostMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uBulge: { value: 0 }, uDir: { value: DIR.clone() }, uFill: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uTime,uBulge; uniform vec3 uDir; varying vec3 vN; varying vec3 vV; varying vec3 vO; ${NOISE}
      void main(){ vec3 n=normalize(position);
        float bump=fbm(n*2.2+uTime*.15)-.5;
        float b=pow(max(0.,dot(n,uDir)),4.)*uBulge;
        vec3 p=position*(1.+bump*.09+b*.45);
        vO=n; vec4 wp=modelMatrix*vec4(p,1.); vN=normalize(mat3(modelMatrix)*n); vV=normalize(cameraPosition-wp.xyz);
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `uniform float uW,uTime,uFill; varying vec3 vN; varying vec3 vV; varying vec3 vO; ${NOISE}
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);
        float n=fbm(vO*3.+uTime*.1);
        vec3 c=vec3(.35,.55,1.)*(f*1.1*(.5+n))+vec3(.12,.2,.5)*uFill*(.35+n)*.08;
        gl_FragColor=vec4(c*uW,1.); }`,
  }), []);
  const mitoMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uMito: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vO;
      void main(){ vO=position; mat4 im=instanceMatrix; vec4 wp=modelMatrix*im*vec4(position,1.);
        vN=normalize(mat3(modelMatrix*im)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `uniform float uW,uTime,uMito,uPulse; varying vec3 vN; varying vec3 vV; varying vec3 vO; ${NOISE}
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.6);
        float fold=sin(vO.y*13.+sin(vO.x*5.+vO.z*4.)*1.4);
        float cr=smoothstep(.55,.95,fold)*uMito;
        vec3 bac=vec3(.55,1.,.45), mit=vec3(1.5,.5,.2);
        vec3 base=mix(bac,mit,uMito);
        vec3 c=base*(f*.9+.1+cr*1.1+uPulse*.4);
        gl_FragColor=vec4(c*uW,1.); }`,
  }), []);
  const nucMat = useMemo(() => makeGlass('#c9a6ff', { rim: 1.7, fill: 0.35, power: 1.8, noise: 4 }), []);
  const mitos = useRef<THREE.InstancedMesh>(null), nuc = useRef<THREE.Mesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  const clones = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: NM - 1 }, (_, i) => {
      const a = (i / (NM - 1)) * Math.PI * 2 + r() * 0.4, rad = 1.2 + r() * 0.6;
      return { x: Math.cos(a) * rad - 0.3, y: Math.sin(a) * rad * 0.9, z: (r() - 0.5) * 1.2, rot: r() * 3.14 };
    });
  }, []);

  // internals: cytoskeleton filaments + atp sparks
  const fil = useMemo(() => {
    const r = rng(8), n = 70, p = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const a = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.5 + r() * 1.9);
      const b = a.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.4)).clampLength(0, 2.3);
      p.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  const filMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(0.35, 0.6, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const sparkGeo = useMemo(() => {
    const n = Math.floor(260 * world.quality), r = rng(66);
    const p = new Float32Array(n * 3), a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { a.set([r(), r(), r(), r()], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(a, 4)); return g;
  }, []);
  const sparkMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uTime: { value: 0 }, uAtp: { value: 0 }, uM: { value: new Array(NM).fill(0).map(() => new THREE.Vector3()) } },
    vertexShader: /* glsl */ `uniform float uPx,uW,uTime,uAtp; uniform vec3 uM[${NM}]; attribute vec4 aR; varying vec3 vC; varying float vA;
      void main(){ int k=int(floor(aR.x*${NM}.)); vec3 m=uM[0]; for(int i=0;i<${NM};i++){ if(i==k) m=uM[i]; }
        float s=fract(aR.y+uTime*.18*(.5+aR.z)); vec3 dir=normalize(vec3(aR.z-.5,aR.w-.5,aR.y-.5)+.001);
        vec3 p=m+dir*s*1.6; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,.07*(1.-s)*uPx/-mv.z); vC=vec3(1.6,1.2,.3); vA=uW*uAtp*(1.-s)*step(.001,length(m)); }`,
    fragmentShader: POINT_FRAG,
  }), []);
  const vesGeo = useMemo(() => {
    const r = rng(2), n = Math.floor(160 * world.quality), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.pow(r(), 0.5) * 2.2); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  const vesMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 500 }, uW: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx,uW,uTime; varying vec3 vC; varying float vA;
      void main(){ vec3 p=position+vec3(sin(uTime*.4+position.y*3.),cos(uTime*.35+position.x*3.),sin(uTime*.3+position.z*2.))*.1;
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,.06*uPx/-mv.z); vC=vec3(.5,.7,1.4); vA=uW*.5; }`,
    fragmentShader: POINT_FRAG,
  }), []);
  useDispose(hostMat, mitoMat, nucMat, fil, filMat, sparkGeo, sparkMat, vesGeo, vesMat);

  const grp = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const approach = range(0.0, 0.26, t), contact = smoothstep(0.2, 0.34, t), inside = smoothstep(0.32, 0.48, t);
    const becomes = smoothstep(0.45, 0.66, t);
    const clone = smoothstep(0.62, 0.95, t);
    const pulse = near(eventPos('eukaryotes'), 0.55);
    // bacterium path
    const dist = THREE.MathUtils.lerp(7.5 - approach * 0 , R + 0.5, smoothstep(0, 1, approach));
    const bulge = contact * (1 - inside) * 1.6;
    hostMat.uniforms.uW.value = w; hostMat.uniforms.uTime.value = time; hostMat.uniforms.uBulge.value = bulge;
    mitoMat.uniforms.uW.value = w; mitoMat.uniforms.uMito.value = becomes; mitoMat.uniforms.uPulse.value = pulse;
    nucMat.uniforms.uW.value = w * smoothstep(0.5, 0.75, t); nucMat.uniforms.uTime.value = time;
    filMat.opacity = w * 0.35 * smoothstep(0.55, 0.9, t);
    vesMat.uniforms.uW.value = w; vesMat.uniforms.uTime.value = time; vesMat.uniforms.uPx.value = px;
    sparkMat.uniforms.uW.value = w; sparkMat.uniforms.uTime.value = time; sparkMat.uniforms.uPx.value = px;
    sparkMat.uniforms.uAtp.value = becomes * (0.8 + pulse);
    if (nuc.current) { const s = 0.85 * (0.4 + 0.6 * smoothstep(0.5, 0.75, t)); nuc.current.scale.setScalar(s); nuc.current.position.set(-0.7, 0.15, -0.2); }
    // first mito: bacterium
    const inPos = new THREE.Vector3().copy(DIR).multiplyScalar(THREE.MathUtils.lerp(dist, 0.9, inside));
    const scale = THREE.MathUtils.lerp(1, 0.78, becomes);
    const um = sparkMat.uniforms.uM.value as THREE.Vector3[];
    if (mitos.current) {
      d.position.copy(inPos); d.position.y += Math.sin(time * 0.6) * 0.05 * inside;
      d.rotation.set(0, 0, Math.atan2(DIR.y, DIR.x) + (1 - inside) * Math.sin(time * 1.5) * 0.15 + 0.5 * becomes);
      d.scale.set(0.5 * scale, 0.5 * scale * (1 + 0.1 * Math.sin(time * 2)), 0.5 * scale);
      d.updateMatrix(); mitos.current.setMatrixAt(0, d.matrix);
      um[0].copy(inPos).multiplyScalar(becomes > 0.2 ? 1 : 0);
      clones.forEach((c, i) => {
        const e = smoothstep(0.1 + i * 0.1, 0.1 + i * 0.1 + 0.3, clone);
        d.position.set(c.x + Math.sin(time * 0.3 + i) * 0.1, c.y + Math.cos(time * 0.27 + i) * 0.1, c.z);
        d.rotation.set(0, 0, c.rot + time * 0.05); d.scale.set(0.45 * e, 0.45 * e, 0.45 * e + 0.0001); d.scale.y *= 1.0;
        d.updateMatrix(); mitos.current!.setMatrixAt(i + 1, d.matrix);
        um[i + 1].set(c.x, c.y, c.z).multiplyScalar(e > 0.3 ? 1 : 0);
      });
      mitos.current.instanceMatrix.needsUpdate = true;
    }
    if (grp.current) grp.current.rotation.y = Math.sin(t * 2) * 0.15;
  });

  return (
    <group>
      <Backdrop color="#6d6bff" caustics={0.1} shafts={0.1} haze={0.15} />
      <Plankton count={300} box={[20, 12, 8]} color="#a0b4ff" size={0.04} dir={[0.02, 0.0, 0]} />
      <group ref={grp}>
        <mesh material={hostMat} frustumCulled={false}>
          <sphereGeometry args={[R, 96, 64]} />
        </mesh>
        <mesh ref={nuc} material={nucMat} frustumCulled={false}>
          <icosahedronGeometry args={[1, 4]} />
        </mesh>
        <lineSegments geometry={fil} material={filMat} frustumCulled={false} />
        <points geometry={vesGeo} material={vesMat} frustumCulled={false} />
        <points geometry={sparkGeo} material={sparkMat} frustumCulled={false} />
        <instancedMesh ref={mitos} args={[undefined, undefined, NM]} material={mitoMat} frustumCulled={false}>
          <capsuleGeometry args={[0.5, 1, 6, 16]} />
        </instancedMesh>
      </group>
    </group>
  );
}
