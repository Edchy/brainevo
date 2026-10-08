import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';

const NF = 40;
export default function Handaxe() {
  const scene = useScene();
  const q = world.quality;
  const tool = useRef<THREE.Group>(null), chips = useRef<THREE.InstancedMesh>(null), mirror = useRef<THREE.Mesh>(null);
  const dum = useMemo(() => new THREE.Object3D(), []);
  const R = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 36, 30);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uForm: { value: 0 }, uAlpha: { value: 1 }, uSweep: { value: 0 }, uSym: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uForm;
        varying vec3 vP; varying vec2 vC;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float u = uv.x, ph = uv.y * 6.2831853;
          float ui = floor(u * 36. + .5), vi = mod(floor(uv.y * 30. + .5), 30.);
          float j = h2(vec2(ui, vi)) - .5;
          // cobble -> teardrop biface, length along +y
          float wAxe = 1.05 * pow(sin(3.14159 * pow(u, .78)), .85) * (1. - .12 * u);
          float tAxe = .34 * pow(sin(3.14159 * pow(u, .85)), 1.1);
          float wCob = .95 * pow(sin(3.14159 * u), .6);
          float tCob = .78 * pow(sin(3.14159 * u), .6);
          float w = mix(wCob, wAxe, uForm), th = mix(tCob, tAxe, uForm);
          float c = cos(ph), s = sin(ph);
          float sh = mix(.7, .38, uForm);
          float cx = sign(c) * pow(abs(c), sh), sz = sign(s) * pow(abs(s), mix(.9, .8, uForm));
          float rough = (1. - uForm * .85) * .26 + .04;
          vec3 p = vec3(cx * w, (u - .5) * 3.0, sz * th);
          p += normalize(vec3(cx, 0., sz) + .001) * j * rough * smoothstep(.0, .12, u) * smoothstep(1., .88, u);
          vC = vec2(c, u);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha, uSweep, uSym, uForm; varying vec3 vP; varying vec2 vC;
        void main(){
          vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
          if (n.z < 0.) n = -n;
          float f = pow(1. - n.z, 1.6);
          float lit = max(dot(n, normalize(vec3(.4, .6, .7))), 0.);
          vec3 stone = vec3(.55, .62, .75);
          vec3 c = stone * (.04 + lit * .32) + vec3(1., .66, .35) * f * .9;
          float band = smoothstep(.1, 0., abs(abs(vC.x) - fract(uSweep)));
          c += vec3(1.6, 1.1, .6) * band * uSym * (.4 + f);
          float edge = smoothstep(.85, 1., abs(vC.x));
          c += vec3(1.8, 1.3, .8) * edge * uForm * (.3 + uSym * .8);
          gl_FragColor = vec4(c * uAlpha * .38, 1.);
        }`,
    });
    const symMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uAlpha, uT; varying vec2 vUv;
        void main(){ float x=abs(vUv.x-.5)*2.; float core=exp(-x*x*900.); float halo=exp(-x*x*30.)*.12;
          float seg = .6+.4*sin(vUv.y*40.-uT*3.); float fade=smoothstep(0.,.15,vUv.y)*smoothstep(1.,.85,vUv.y);
          gl_FragColor=vec4(vec3(1.,.8,.5)*(core*seg*1.4+halo)*fade*uAlpha,1.); }`,
    });
    const chipGeo = new THREE.TetrahedronGeometry(1, 0); chipGeo.scale(1, .3, .7);
    const chipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.2, .9), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true, toneMapped: false });
    const r = rng(4);
    const ch = Array.from({ length: Math.floor(NF * Math.max(.5, q)) }, () => ({ a: r() * 6.28, y: (r() - .5) * 2.6, sp: .6 + r() * 1.6, s: .05 + r() * .08, t0: r() * .7 }));
    // dust
    const nD = Math.floor(600 * q), dp = new Float32Array(nD * 3);
    for (let i = 0; i < nD; i++) { dp[i * 3] = (r() - .5) * 14; dp[i * 3 + 1] = (r() - .5) * 8; dp[i * 3 + 2] = (r() - .5) * 8 - 1; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'uniform float uTime; void main(){ vec3 p=position; p.y=mod(p.y+uTime*.12+4.,8.)-4.; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=30./-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(1.,.75,.45)*a*a*.35*uAlpha,1.); }' });
    return { geo, mat, symMat, chipGeo, chipMat, ch, dg, dm };
  }, [q]);
  useEffect(() => () => { R.geo.dispose(); R.mat.dispose(); R.symMat.dispose(); R.chipGeo.dispose(); R.chipMat.dispose(); R.dg.dispose(); R.dm.dispose(); }, [R]);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    const form = smoothstep(0.02, 0.52, t);
    const ev = near(eventPos('acheulean-handaxe'), 0.7);
    const u = R.mat.uniforms; u.uForm.value = form; u.uAlpha.value = w; u.uSym.value = smoothstep(0.35, 0.6, t) * (0.4 + ev * 0.6); u.uSweep.value = t * 4;
    R.symMat.uniforms.uAlpha.value = w * smoothstep(0.35, 0.55, t) * (0.5 + ev * 0.5); R.symMat.uniforms.uT.value = tm + t * 6;
    R.dm.uniforms.uAlpha.value = w; R.dm.uniforms.uTime.value = tm;
    if (tool.current) { tool.current.rotation.set(0.15, Math.sin(t * 5) * 0.55 + (world.reduced ? 0 : Math.sin(tm * 0.4) * 0.12), 0.1 + (1 - form) * 0.5); tool.current.scale.setScalar(1.0 + ev * 0.05); }
    const C = chips.current;
    if (C) {
      R.ch.forEach((c, i) => {
        const k = smoothstep(c.t0 * 0.5, c.t0 * 0.5 + 0.35, t) * (1 - smoothstep(0.55, 0.62 + c.t0 * 0.3, t));
        const tt = Math.max(0, (t - c.t0 * 0.5)) * 6 * c.sp;
        const rr = 1.0 + tt * 1.6;
        dum.position.set(Math.cos(c.a) * rr, c.y + Math.sin(tt) * 0.2 - tt * 0.15, Math.sin(c.a) * rr * 0.6);
        dum.rotation.set(tt * 3, c.a + tt * 2, tt); dum.scale.setScalar(c.s * k * w); dum.updateMatrix(); C.setMatrixAt(i, dum.matrix);
      });
      C.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <points geometry={R.dg} material={R.dm} frustumCulled={false} />
      <mesh ref={mirror} material={R.symMat} position={[0, 0, 0.25]}><planeGeometry args={[1.2, 4.4]} /></mesh>
      <group ref={tool}><mesh geometry={R.geo} material={R.mat} frustumCulled={false} /></group>
      <instancedMesh ref={chips} args={[R.chipGeo, R.chipMat, R.ch.length]} frustumCulled={false} />
    </group>
  );
}

export const handaxeCamera = (t: number) => ({ pos: [0, 0.2, 6.4 - t * 0.6] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 50 });
