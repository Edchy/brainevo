import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE } from './common';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';
import { BIPED_PRESETS, morphBiped } from '../shared/creatures/biped';
import type { BipedParams } from '../shared/creatures/biped';

export const walkerX = (t: number) => lerp(-2.6, 2.6, t);
const tNow = () => (world.reduced ? 0 : world.time);

const treeVert = /* glsl */ `
attribute float aR;
uniform float uDry, uAcacia, uCanopy;
varying vec3 vN; varying float vY; varying float vDepth;
void main(){
  float gone = smoothstep(aR*.75, aR*.75+.22, uDry);
  float appear = smoothstep(.25+aR*.5, .5+aR*.5, uDry);
  float k = mix(1.-gone, appear, uAcacia);
  vec3 lp = position;
  if (uCanopy > .5) lp *= k; else lp.y *= mix(k, 1., .12);
  vec4 wp = instanceMatrix * vec4(lp,1.);
  if (uCanopy > .5) wp.y *= mix(k, 1., .1);
  vec4 mv = modelViewMatrix * wp;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vY = position.y; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const treeFrag = /* glsl */ `
uniform vec3 uCol, uFog; uniform float uAlpha;
varying vec3 vN; varying float vY; varying float vDepth;
void main(){
  float f = pow(1. - abs(normalize(vN).z), 2.);
  vec3 c = uCol * (.035 + f * .38 + max(0., vY) * .04);
  c = mix(c, uFog, smoothstep(8., 34., vDepth));
  gl_FragColor = vec4(c, uAlpha);
}`;

function treeMat(col: string, acacia: number, canopy: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uCol: { value: new THREE.Color(col) }, uFog: { value: new THREE.Color() }, uAlpha: { value: 1 }, uDry: { value: 0 }, uAcacia: { value: acacia }, uCanopy: { value: canopy } },
    vertexShader: treeVert, fragmentShader: treeFrag,
  });
}

export default function Savanna() {
  const scene = useScene();
  const q = world.quality;
  const hero = useRef<CreatureHandle>(null);
  const heroParams = useMemo(() => ({}), []);
  const walker = useRef<THREE.Group>(null);
  const R = useMemo(() => {
    const r = rng(11);
    // trees
    const nTree = 16;
    const nAc = 7;
    const mk = (n: number, acacia: boolean) => {
      const trunkM: THREE.Matrix4[] = [], canM: THREE.Matrix4[] = [], rs = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = -22 + r() * 44, z = -(acacia ? 9 + r() * 22 : 7 + r() * 20);
        const h = acacia ? 1.8 + r() * 1.4 : 3 + r() * 4, w = acacia ? 1 : 0.7 + r() * 0.8;
        rs[i] = r();
        trunkM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.9, h, w * 0.9)));
        const cs = acacia ? new THREE.Vector3(2.3 + r(), 0.45, 2.3 + r()) : new THREE.Vector3(w * 1.3, w * 1.2 + 0.5, w * 1.3);
        canM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h * (acacia ? 1 : 0.95), z), new THREE.Quaternion(), cs));
      }
      return { trunkM, canM, rs };
    };
    const forest = mk(nTree, false), ac = mk(nAc, true);
    const trunkG = new THREE.CylinderGeometry(0.07, 0.13, 1, 6); trunkG.translate(0, 0.5, 0);
    // lumpy cloud canopy: several displaced blobs merged into one geometry
    const blobs: THREE.BufferGeometry[] = [];
    for (let b = 0; b < 7; b++) {
      let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4);
      const rr = 0.5 + r() * 0.35, ox = (r() - 0.5) * 1.1, oy = (r() - 0.35) * 0.8, oz = (r() - 0.5) * 1.1;
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        const n = 1 + 0.12 * Math.sin(x * 5 + b) * Math.cos(z * 4 + y * 3);
        pa.setXYZ(i, x * rr * n + ox, y * rr * n * 0.8 + oy, z * rr * n + oz);
      }
      g.computeVertexNormals(); blobs.push(g);
    }
    const canG = mergeGeometries(blobs)!; blobs.forEach((g) => g.dispose());
    const attach = (g: THREE.BufferGeometry, rs: Float32Array) => { const geo = g.clone(); geo.setAttribute('aR', new THREE.InstancedBufferAttribute(rs, 1)); return geo; };
    const geos = [attach(trunkG, forest.rs), attach(canG, forest.rs), attach(trunkG, ac.rs), attach(canG, ac.rs)];
    trunkG.dispose(); canG.dispose();
    const mats = [treeMat('#2f7a56', 0, 0), treeMat('#3fb078', 0, 1), treeMat('#b98a4a', 1, 0), treeMat('#ffcc66', 1, 1)];
    const inst = (g: THREE.BufferGeometry, m: THREE.ShaderMaterial, ms: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(g, m, ms.length);
      ms.forEach((mx, i) => im.setMatrixAt(i, mx)); im.frustumCulled = false; return im;
    };
    const meshes = [inst(geos[0], mats[0], forest.trunkM), inst(geos[1], mats[1], forest.canM), inst(geos[2], mats[2], ac.trunkM), inst(geos[3], mats[3], ac.canM)];

    // grass
    const nG = Math.floor(6200 * q);
    const bg = new THREE.InstancedBufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5, 0, 0, .5, 0, 0, -.36, .5, 0, .36, .5, 0, 0, 1, 0]), 3));
    bg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const off = new Float32Array(nG * 3), ar = new Float32Array(nG * 2);
    for (let i = 0; i < nG; i++) {
      off[i * 3] = -16 + r() * 32; off[i * 3 + 2] = -5 + r() * 7;
      ar[i * 2] = r(); ar[i * 2 + 1] = r();
    }
    bg.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
    bg.setAttribute('aR', new THREE.InstancedBufferAttribute(ar, 2));
    bg.instanceCount = nG;
    const grassMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uDry: { value: 0 }, uAlpha: { value: 1 }, uFog: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute vec3 offset; attribute vec2 aR;
        uniform float uTime, uDry, uAlpha;
        varying float vY; varying float vDepth; varying float vR;
        void main(){
          float vis = step(aR.x, mix(.28, 1., uDry));
          float h = (.14 + aR.y * .3) * mix(.8, 1.2, uDry) * vis * uAlpha;
          float a = aR.x * 62.8;
          vec3 p = position; p.x *= .02 * (1. + uDry * .7);
          float sway = (sin(uTime * 1.5 + offset.x * .55 + offset.z * .3) * .28 + sin(uTime * 3.3 + offset.x * 2.1) * .07) * mix(.5, 1., uDry);
          vec3 w = vec3(cos(a) * p.x, p.y * h, sin(a) * p.x);
          w.x += sway * p.y * p.y * h;
          w += offset;
          vY = position.y; vR = aR.y;
          vec4 mv = viewMatrix * vec4(w, 1.);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDry, uAlpha; uniform vec3 uFog;
        varying float vY; varying float vDepth; varying float vR;
        void main(){
          vec3 lo = mix(vec3(.01, .07, .04), vec3(.16, .09, .03), uDry);
          vec3 hi = mix(vec3(.08, .3, .2), vec3(.7, .5, .22), uDry) * (.2 + vR * .2);
          vec3 c = mix(lo, hi, vY * vY);
          c = mix(c, uFog, smoothstep(5., 18., vDepth));
          gl_FragColor = vec4(c, uAlpha);
        }`,
    });
    const grass = new THREE.Mesh(bg, grassMat); grass.frustumCulled = false;

    // ground + sky + haze
    const groundMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uDry: { value: 0 }, uAlpha: { value: 1 }, uFog: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vW; varying float vDepth; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: /* glsl */ `${GLSL_NOISE}
        uniform float uDry, uAlpha; uniform vec3 uFog; varying vec3 vW; varying float vDepth;
        void main(){
          float n = n3(vec3(vW.x * 1.7, 0., vW.z * 1.7)) * .6 + n3(vec3(vW.x * 6., 1., vW.z * 6.)) * .4;
          vec3 c = mix(vec3(.012, .045, .03), vec3(.2, .11, .045), uDry) * (.25 + n * .45);
          c = mix(c, uFog, smoothstep(6., 40., vDepth));
          gl_FragColor = vec4(c, uAlpha);
        }`,
    });
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uDry: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: /* glsl */ `uniform float uDry, uAlpha; varying vec3 vD;
        void main(){
          float h = max(vD.y, 0.);
          vec3 top = mix(vec3(.01, .05, .05), vec3(.05, .03, .08), uDry);
          vec3 hor = mix(vec3(.06, .22, .17), vec3(.95, .4, .13), uDry);
          vec3 c = mix(hor, top, pow(h, .45)) * (1. - step(vD.y, 0.));
          vec3 sd = normalize(vec3(.25, .09, -1.));
          float s = max(dot(vD, sd), 0.);
          c += mix(vec3(.2, .45, .3), vec3(1., .65, .25), uDry) * (pow(s, 90.) * .9 + pow(s, 700.) * 6. * uDry + pow(s, 6.) * .18);
          gl_FragColor = vec4(c * uAlpha * .38, 1.);
        }`,
    });
    const hazeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDry: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: /* glsl */ `uniform float uTime, uDry, uAlpha; varying vec2 vUv;
        void main(){
          float y = vUv.y;
          float w = sin(vUv.x * 120. + uTime * 2.2 + y * 30.) * .5 + sin(vUv.x * 47. - uTime * 1.3 + y * 12.) * .5;
          float band = pow(1. - y, 3.) * smoothstep(0., .08, y) * (.55 + .45 * w);
          gl_FragColor = vec4(vec3(1., .5, .2) * band * .05 * uDry * uAlpha, 1.);
        }`,
    });
    // dust motes
    const nM = Math.floor(90 * q), mp = new Float32Array(nM * 3);
    for (let i = 0; i < nM; i++) { mp[i * 3] = -22 + r() * 44; mp[i * 3 + 1] = r() * 5; mp[i * 3 + 2] = -10 + r() * 14; }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const moteMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDry: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: /* glsl */ `uniform float uTime; varying float vA; void main(){
        vec3 p = position; p.y = mod(p.y + uTime * .25, 5.); p.x += sin(uTime * .5 + position.z) * .6;
        vA = smoothstep(0., 1., p.y) * (1. - smoothstep(3., 5., p.y));
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = 55. / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uDry, uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(mix(vec3(.4,.9,.6),vec3(1.,.7,.3),uDry)*a*a*vA*.5*uAlpha,1.); }`,
    });
    return { meshes, mats, grass, grassMat, groundMat, skyMat, hazeMat, mg, moteMat, geos, bg };
  }, [q]);
  useEffect(() => () => {
    R.geos.forEach((g) => g.dispose()); R.mats.forEach((m) => m.dispose()); R.bg.dispose(); R.grassMat.dispose();
    R.groundMat.dispose(); R.skyMat.dispose(); R.hazeMat.dispose(); R.mg.dispose(); R.moteMat.dispose();
  }, [R]);

  const fog = useMemo(() => new THREE.Color(), []);
  const cA = useMemo(() => new THREE.Color('#0d2a22'), []);
  const cB = useMemo(() => new THREE.Color('#4a2410'), []);
  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight;
    const dry = smoothstep(0.12, 0.85, t);
    fog.lerpColors(cA, cB, dry);
    for (const m of R.mats) { const u = m.uniforms; u.uDry.value = dry; u.uAlpha.value = w; u.uFog.value.copy(fog); }
    const gu = R.grassMat.uniforms; gu.uDry.value = dry; gu.uAlpha.value = w; gu.uFog.value.copy(fog); gu.uTime.value = tNow();
    const du = R.groundMat.uniforms; du.uDry.value = dry; du.uAlpha.value = w; du.uFog.value.copy(fog);
    R.skyMat.uniforms.uDry.value = dry; R.skyMat.uniforms.uAlpha.value = w;
    R.hazeMat.uniforms.uDry.value = dry; R.hazeMat.uniforms.uAlpha.value = w; R.hazeMat.uniforms.uTime.value = tNow();
    R.moteMat.uniforms.uDry.value = dry; R.moteMat.uniforms.uAlpha.value = w; R.moteMat.uniforms.uTime.value = tNow();
    const x = walkerX(t);
    if (walker.current) walker.current.position.x = x;
    const h = hero.current;
    if (h) {
      // Sahelanthropus stooped at the forest edge -> Ardipithecus upright on the open ground, straightening at 'bipedalism'
      const p = h.params as BipedParams, up = smoothstep(0.1, 0.62, t);
      morphBiped(p, BIPED_PRESETS.sahelanthropus, BIPED_PRESETS.ardipithecus, smoothstep(0.6, 0.9, t));
      p.lean += (1 - up) * 0.08 - 0.03; p.kneeFlex += (1 - up) * 0.2 - 0.05; p.neckFwd += (1 - up) * 0.1;
      h.look.w = w;
      h.state.headYaw = Math.sin(tNow() * 0.4) * 0.25; h.state.headPitch = 0.1 * Math.sin(tNow() * 0.23) + 0.38 * (1 - up);
      h.look.keyK = 0.75; h.look.amb = 0.3; h.look.rimK = 1.9 + near(eventPos('bipedalism'), 0.5) * 0.8;
    }
  });

  return (
    <group>
      <mesh material={R.skyMat} renderOrder={-10}><sphereGeometry args={[300, 32, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.groundMat}><planeGeometry args={[220, 110]} /></mesh>
      {R.meshes.map((m, i) => <primitive key={i} object={m} />)}
      <primitive object={R.grass} />
      <mesh position={[0, 1.6, -19]} material={R.hazeMat}><planeGeometry args={[160, 3.2]} /></mesh>
      <points geometry={R.mg} material={R.moteMat} frustumCulled={false} />
      <group ref={walker} position={[-7, 0, 0]}><group scale={1.55}><Creature ref={hero} rig="biped" preset="sahelanthropus" params={heroParams} look={{ rimDir: [0.85, 0.3], keyDir: [-0.2, 0.3, 0.9] }} palette={{ rim: '#ffb070', key: '#a89078' }} /></group></group>
    </group>
  );
}

export const savannaCamera = (t: number) => {
  const x = walkerX(t);
  return { pos: [x - 0.4, 0.95, 3.2] as [number, number, number], look: [x - 0.85, 0.9, 0] as [number, number, number], fov: 46 };
};
