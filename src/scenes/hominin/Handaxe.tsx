import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { makeSkin } from './limbs';

export default function Handaxe() {
  const scene = useScene();
  const q = world.quality;
  const tool = useRef<THREE.Group>(null), chips = useRef<THREE.InstancedMesh>(null), mirror = useRef<THREE.Mesh>(null);
  const dum = useMemo(() => new THREE.Object3D(), []);
  const R = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 36, 30);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uForm: { value: 0 }, uAlpha: { value: 1 }, uSweep: { value: 0 }, uSym: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uForm;
        varying vec3 vP; varying vec3 vO; varying vec2 vC;
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
          vP = mv.xyz; vO = p;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha, uSweep, uSym, uForm; varying vec3 vP; varying vec3 vO; varying vec2 vC;
        vec3 h33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
        // F1/F2 voronoi on the stone surface: each cell is one flake scar
        vec4 vor(vec3 x){
          vec3 i = floor(x), f = fract(x); float d1 = 8., d2 = 8.; vec3 id = vec3(0.);
          for (int a=-1;a<=1;a++) for (int b=-1;b<=1;b++) for (int c=-1;c<=1;c++){
            vec3 g = vec3(float(a),float(b),float(c)); vec3 o = h33(i+g); vec3 d = g + o - f; float l = dot(d,d);
            if (l < d1){ d2 = d1; d1 = l; id = o; } else if (l < d2) d2 = l;
          }
          return vec4(id, sqrt(d2) - sqrt(d1));
        }
        void main(){
          vec3 nF = normalize(cross(dFdx(vP), dFdy(vP)));
          if (nF.z < 0.) nF = -nF;
          vec4 v = vor(vO*mix(2.0, 3.6, uForm));
          vec4 v2 = vor(vO*mix(5.0, 9.0, uForm) + 3.7);
          vec3 tilt = (v.xyz - .5)*mix(.25, .9, uForm) + (v2.xyz - .5)*.25;
          vec3 n = normalize(nF + tilt*vec3(1.,1.,.6));
          float ridge = smoothstep(.0, .09, v.w);                      // dark thin seams between scars
          float cortexN = fract(sin(dot(vO.xy*13.1, vec2(12.9898,78.233)))*43758.5453);
          float cortex = mix(1., 1. - smoothstep(.1, .3, vC.y + (cortexN - .5)*.09), uForm);
          vec3 flint = vec3(.05,.052,.058), cort = vec3(.27,.23,.18)*(.8 + .4*cortexN);
          vec3 alb = mix(flint, cort, cortex)*(.7 + .3*ridge);
          vec3 L = normalize(vec3(-.55,.5,.7)), L2 = normalize(vec3(.7,.3,-.6));
          vec3 V = normalize(-vP);
          float lit = max(dot(n, L), 0.), back = max(dot(n, L2), 0.);
          vec3 c = alb*(.1 + lit*1.9) + vec3(1.,.74,.45)*alb*back*1.3;
          float sp = pow(max(dot(reflect(-L, n), V), 0.), 36.)*(1. - cortex)*.3*ridge;
          c += vec3(1.,.95,.9)*sp;
          float fr = pow(1. - max(dot(n, V), 0.), 2.4);
          c += vec3(1.,.62,.3)*fr*.45*(.4 + back);
          // ochre-gold symmetry sweep: the one colour accent
          float band = smoothstep(.1, 0., abs(abs(vC.x) - fract(uSweep)));
          c += vec3(2.6,1.55,.4)*band*uSym*(.25 + fr + lit*.4);
          float edge = smoothstep(.9, 1., abs(vC.x));
          c += vec3(2.2,1.3,.35)*edge*uForm*uSym*.35;
          gl_FragColor = vec4(c*uAlpha, 1.);
        }`,
    });
    const symMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uAlpha, uT; varying vec2 vUv;
        void main(){ float x=abs(vUv.x-.5)*2.; float core=exp(-x*x*900.); float halo=exp(-x*x*30.)*.12;
          float seg = .6+.4*sin(vUv.y*40.-uT*3.); float fade=smoothstep(0.,.15,vUv.y)*smoothstep(1.,.85,vUv.y);
          gl_FragColor=vec4(vec3(1.,.8,.5)*(core*seg*0.7+halo*.6)*fade*uAlpha,1.); }`,
    });
    const chipGeo = new THREE.TetrahedronGeometry(1, 0); chipGeo.scale(1, .3, .7);
    const chipMat = makeSkin('#3a3631', '#fff0d8', { flat: true, rimPow: 1.4 });
    const r = rng(4);
    const ch = Array.from({ length: Math.floor(7 * Math.max(.5, q)) }, () => ({ a: r() * 6.28, y: (r() - .5) * 2.6, sp: .6 + r() * 1.6, s: .05 + r() * .08, t0: r() * .7 }));
    // dust
    const nD = Math.floor(120 * q), dp = new Float32Array(nD * 3);
    for (let i = 0; i < nD; i++) { dp[i * 3] = (r() - .5) * 14; dp[i * 3 + 1] = (r() - .5) * 8; dp[i * 3 + 2] = (r() - .5) * 8 - 1; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'uniform float uTime; void main(){ vec3 p=position; p.y=mod(p.y+uTime*.12+4.,8.)-4.; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=30./-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAlpha; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(1.,.7,.4)*a*a*.25*uAlpha,1.); }' });
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
    R.dm.uniforms.uAlpha.value = w; R.chipMat.uniforms.uAlpha.value = w; R.dm.uniforms.uTime.value = tm;
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

export const handaxeCamera = (t: number) => ({ pos: [-0.6, 0.2, 6.2 - t * 0.6] as [number, number, number], look: [-0.6, 0, 0] as [number, number, number], fov: 50 });
