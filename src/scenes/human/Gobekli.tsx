import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { rng, smoothstep } from '../../world/util';
import { PBuf, pointMat, tickU } from './common';
import { Coals, Embers, Flame, newFlameCtl } from '../hominin/flame';
import { GLSL_NOISE, makeGlowMat } from '../hominin/common';

// Göbekli Tepe at night: a ring of T-shaped limestone pillars round two taller central ones, carved with arms, belts and
// animals (fox, boar, vulture, snake), lit by a low fire under a sky full of stars. The carvings are a bump map drawn on
// a canvas, so under the oil pass they read as worn relief.

const tNow = () => (world.reduced ? 0 : world.time);
const FIRE = new THREE.Vector3(0, 0, 1.15);

type Motif = 'figure' | 'fox' | 'boar' | 'vulture' | 'snake';

/** carving height map for a pillar's broad face (white = raised), drawn soft so the bump reads as worn stone */
function relief(motif: Motif) {
  const W = 256, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, W, H);
  g.filter = 'blur(3px)';
  g.fillStyle = '#d8d8d8'; g.strokeStyle = '#d8d8d8'; g.lineCap = 'round'; g.lineJoin = 'round';
  const ell = (x: number, y: number, rx: number, ry: number, a = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); };
  if (motif === 'figure') {
    // the central pillars are bodies: arms down the sides, long fingers meeting over a belt, a fox pelt hanging from it
    g.lineWidth = 15;
    g.beginPath(); g.moveTo(40, 120); g.quadraticCurveTo(30, 300, 112, 352); g.stroke();
    g.beginPath(); g.moveTo(216, 120); g.quadraticCurveTo(226, 300, 144, 352); g.stroke();
    g.lineWidth = 5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(104 + i * 1.5, 352); g.lineTo(122 + i * 3, 372 - i * 2); g.stroke(); g.beginPath(); g.moveTo(152 - i * 1.5, 352); g.lineTo(134 - i * 3, 372 - i * 2); g.stroke(); }
    g.fillRect(14, 388, W - 28, 20);
    for (let i = 0; i < 6; i++) ell(40 + i * 35, 398, 7, 7);
    g.beginPath(); g.moveTo(108, 408); g.lineTo(128, 500); g.lineTo(148, 408); g.fill();
  } else if (motif === 'fox') {
    ell(128, 260, 74, 34, -0.15); // body
    g.beginPath(); g.moveTo(190, 230); g.lineTo(236, 200); g.lineTo(214, 256); g.fill(); // head
    g.beginPath(); g.moveTo(222, 206); g.lineTo(230, 176); g.lineTo(238, 210); g.fill(); // ear
    g.lineWidth = 12;
    g.beginPath(); g.moveTo(58, 250); g.quadraticCurveTo(20, 230, 26, 300); g.stroke(); // tail
    for (const x of [86, 112, 152, 178]) { g.beginPath(); g.moveTo(x, 284); g.lineTo(x - 6, 336); g.stroke(); }
    g.lineWidth = 6;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(206 + i * 2, 250); g.lineTo(204 + i * 4, 262); g.stroke(); } // bared teeth
  } else if (motif === 'boar') {
    ell(124, 270, 82, 50); // body
    ell(204, 272, 36, 28); // head
    g.beginPath(); g.moveTo(226, 262); g.lineTo(250, 268); g.lineTo(230, 290); g.fill(); // snout
    g.lineWidth = 6; g.beginPath(); g.moveTo(228, 290); g.quadraticCurveTo(246, 296, 242, 276); g.stroke(); // tusk
    g.lineWidth = 14;
    for (const x of [74, 104, 150, 180]) { g.beginPath(); g.moveTo(x, 306); g.lineTo(x, 352); g.stroke(); }
    g.lineWidth = 6; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(70 + i * 16, 222); g.lineTo(66 + i * 16, 206); g.stroke(); } // bristles
  } else if (motif === 'vulture') {
    ell(128, 230, 30, 70); // body
    g.beginPath(); g.moveTo(104, 190); g.lineTo(18, 150); g.lineTo(30, 210); g.lineTo(104, 236); g.fill(); // wings
    g.beginPath(); g.moveTo(152, 190); g.lineTo(238, 150); g.lineTo(226, 210); g.lineTo(152, 236); g.fill();
    ell(128, 150, 18, 20); // head
    g.beginPath(); g.moveTo(140, 150); g.lineTo(160, 160); g.lineTo(140, 164); g.fill(); // beak
    g.lineWidth = 8; g.beginPath(); g.moveTo(116, 298); g.lineTo(108, 330); g.moveTo(140, 298); g.lineTo(148, 330); g.stroke();
    ell(200, 360, 22, 22); // the disc above the vulture's wing on the "Vulture Stone"
  } else {
    // snakes running down the face
    g.lineWidth = 12;
    for (const x0 of [70, 128, 186]) {
      g.beginPath();
      for (let y = 60; y <= 460; y += 6) { const x = x0 + Math.sin(y * 0.045 + x0) * 16; if (y === 60) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      ell(x0 + Math.sin(460 * 0.045 + x0) * 16, 466, 11, 15);
    }
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.NoColorSpace;
  return tx;
}

/** pale limestone: mottled colour on its own canvas, so every pillar has the same weathered stone */
function stoneTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d')!;
  const r = rng(77);
  g.fillStyle = '#b9ad98'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(r() * 70);
    g.fillStyle = `rgba(${v},${v - 8},${v - 22},${0.08 + r() * 0.12})`;
    g.fillRect(r() * S, r() * S, 2 + r() * 10, 2 + r() * 10);
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  return tx;
}

interface Pillar { x: number; z: number; rot: number; h: number; motif: Motif; big?: boolean }

export default function Gobekli() {
  const scene = useScene();
  const ctl = useMemo(newFlameCtl, []);
  const light = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.Mesh>(null);
  const R = useMemo(() => {
    const stone = stoneTexture();
    const motifs: Motif[] = ['fox', 'boar', 'vulture', 'snake'];
    const reliefs = Object.fromEntries((['figure', ...motifs] as Motif[]).map((m) => [m, relief(m)])) as Record<Motif, THREE.CanvasTexture>;
    const mat = (m: Motif) => new THREE.MeshStandardMaterial({
      map: stone, bumpMap: reliefs[m], bumpScale: 6, roughness: 0.96, metalness: 0, color: '#d9ccb6', transparent: true,
    });
    const mats = Object.fromEntries((['figure', ...motifs] as Motif[]).map((m) => [m, mat(m)])) as Record<Motif, THREE.MeshStandardMaterial>;
    const plain = new THREE.MeshStandardMaterial({ map: stone, roughness: 1, color: '#9c9080', transparent: true });
    // the ring: ten pillars set into a low wall, facing the centre, and the two tall central ones
    const pillars: Pillar[] = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.25;
      pillars.push({ x: Math.sin(a) * 4.6, z: -Math.cos(a) * 4.6, rot: -a, h: 2.3 + (i % 3) * 0.2, motif: motifs[i % motifs.length] });
    }
    // (turned so their carved broad sides face the way in, where the camera stands)
    pillars.push({ x: -0.95, z: -0.6, rot: Math.PI / 2, h: 4.2, motif: 'figure', big: true }, { x: 0.95, z: -0.6, rot: Math.PI / 2, h: 4.2, motif: 'figure', big: true });
    const ground = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uF: { value: 0 }, uAlpha: { value: 1 }, uFire: { value: FIRE } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE}
        uniform float uF, uAlpha; uniform vec3 uFire; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          float n = n3(vec3(p*1.8, 0.))*.5 + n3(vec3(p*7., 1.))*.3 + n3(vec3(p*30., 2.))*.2;
          float d = length(p - uFire.xz);
          float lit = uF/(1. + pow(d/1.6, 2.));
          vec3 c = vec3(.018,.017,.02)*(.6 + n*.8);
          c += vec3(1.,.45,.14)*lit*(.12 + n*.9)*.32;
          c = mix(c, vec3(.004,.004,.008), smoothstep(7., 18., vD));
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    // a sky crowded with stars, as it would have been, and a faint band of the Milky Way
    const sb = new PBuf(311);
    const r = sb.r;
    for (let i = 0; i < 1500 * world.quality; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const rr = Math.sqrt(1 - y * y);
      const band = Math.exp(-Math.pow((Math.cos(th) * rr - y * 0.6) / 0.22, 2));
      if (r() > 0.35 + band * 0.65) continue;
      const v = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(60);
      sb.add(v.x, v.y, v.z, r() < 0.15 ? [2.0, 1.6, 1.1] : [1.3, 1.5, 2.1], band);
    }
    const sMat = pointMat({
      size: 5,
      body: `float tw = .55 + .45*pow(.5+.5*sin(uTime*(.6+aSeed.y*1.6)+aSeed.z*70.),3.);
        a = (.25 + .6*aSeed.x)*tw*(.6+.6*aSeed.w); size = .25 + aSeed.x*.9;`,
    });
    const haloMat = makeGlowMat('#ff8a3a', 1.6);
    return { stone, reliefs, mats, plain, pillars, ground, sGeo: sb.build(), sMat, haloMat };
  }, []);
  useEffect(() => () => {
    R.stone.dispose(); Object.values(R.reliefs).forEach((t) => t.dispose()); Object.values(R.mats).forEach((m) => m.dispose());
    R.plain.dispose(); R.ground.dispose(); R.sGeo.dispose(); R.sMat.dispose(); R.haloMat.dispose();
  }, [R]);

  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, tm = tNow();
    const F = smoothstep(0.02, 0.25, scene.t);
    const flick = 0.82 + 0.18 * Math.sin(tm * 10.7) * Math.sin(tm * 6.3 + 1.3) + 0.05 * Math.sin(tm * 21.);
    ctl.F = F; ctl.flick = flick; ctl.alpha = w; ctl.time = tm;
    for (const m of [...Object.values(R.mats), R.plain]) m.opacity = w;
    R.ground.uniforms.uF.value = F * flick * w; R.ground.uniforms.uAlpha.value = w;
    if (light.current) light.current.intensity = 26 * F * flick * w;
    R.haloMat.uniforms.uAlpha.value = w * F * (0.2 + 0.06 * flick);
    if (halo.current) { halo.current.position.set(FIRE.x, 0.7, FIRE.z); halo.current.quaternion.copy(st.camera.quaternion); halo.current.scale.setScalar(3.6); }
    tickU(R.sMat, scene, st.gl.getPixelRatio());
  });

  return (
    <group>
      <hemisphereLight args={['#2a3550', '#0a0806', 0.35]} />
      <directionalLight position={[-6, 9, 4]} intensity={0.22} color="#8fa6d8" />
      <pointLight ref={light} position={[FIRE.x, 0.9, FIRE.z]} color="#ff9a52" distance={16} decay={1.6} />
      <points geometry={R.sGeo} material={R.sMat} frustumCulled={false} />
      <mesh material={R.ground} rotation-x={-Math.PI / 2}><circleGeometry args={[16, 64]} /></mesh>
      {/* the low wall the outer pillars stand in */}
      <mesh material={R.plain} position={[0, 0.45, 0]}><cylinderGeometry args={[4.95, 5.05, 0.9, 72, 1, true]} /></mesh>
      {R.pillars.map((p, i) => {
        const wS = p.big ? 0.5 : 0.36, d = p.big ? 0.3 : 0.24;
        const head = p.big ? 1.45 : 1.05;
        return (
          <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot}>
            {/* shaft: its broad faces carry the relief */}
            <mesh material={R.mats[p.motif]} position={[0, p.h / 2, 0]}><boxGeometry args={[d, p.h, wS * 1.9]} /></mesh>
            {/* the T's head */}
            <mesh material={R.mats[p.motif]} position={[0, p.h + 0.28, 0.12]}><boxGeometry args={[d * 1.1, 0.56, head]} /></mesh>
          </group>
        );
      })}
      <group position={FIRE.toArray()}>
        <Coals ctl={ctl} logs={4} />
        <Flame ctl={ctl} height={0.95} width={0.5} />
        <Embers ctl={ctl} count={90} radius={0.25} rise={2.6} />
      </group>
      <mesh ref={halo} material={R.haloMat}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}
