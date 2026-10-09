import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, range, rng, smoothstep } from '../../world/util';
import Critter, { SHAPES } from './Critter';
import { pointMaterial, pointScale, silhouetteMaterial } from './kit';

// maze graph (x, z) on the floor plane; rat runs S -> J -> L1 -> L2, replay explores L, R and C
const P = {
  S: [0, 2.6], J: [0, 0.3], L1: [-2.5, 0.3], L2: [-2.5, -1.6], R1: [2.5, 0.3], R2: [2.5, -1.6], C: [0, -1.6],
} as const;
const v = (k: keyof typeof P) => new THREE.Vector3(P[k][0], 0.04, P[k][1]);
const PATHS = {
  run: [v('S'), v('J'), v('L1'), v('L2')],
  right: [v('S'), v('J'), v('R1'), v('R2')],
  center: [v('S'), v('J'), v('C')],
};
const SEGMENTS: [keyof typeof P, keyof typeof P][] = [['S', 'J'], ['J', 'L1'], ['L1', 'L2'], ['J', 'R1'], ['R1', 'R2'], ['J', 'C']];

function lengths(poly: THREE.Vector3[]) {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + poly[i].distanceTo(poly[i - 1]));
  return cum;
}
const LEN = { run: lengths(PATHS.run), right: lengths(PATHS.right), center: lengths(PATHS.center) };
function sample(poly: THREE.Vector3[], cum: number[], s: number, out: THREE.Vector3) {
  const d = Math.min(1, Math.max(0, s)) * cum[cum.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return out.lerpVectors(poly[i - 1], poly[i], Math.min(1, Math.max(0, f)));
}

const CELL_VERT = /* glsl */ `
attribute float aAct; attribute vec3 aCol; varying vec2 vUv; varying float vAct; varying vec3 vCol;
void main(){ vUv=uv; vAct=aAct; vCol=aCol; gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`;
const CELL_FRAG = /* glsl */ `
uniform float uW; varying vec2 vUv; varying float vAct; varying vec3 vCol;
void main(){ float r = length(vUv-.5)*2.; if(r>1.) discard;
  float core = exp(-r*r*22.); float halo = exp(-r*r*7.)*vAct*.2;
  vec3 c = vec3(1.)*(core*(.06+vAct*1.9) + halo);
  gl_FragColor = vec4(c*uW,1.); }`;
const TRAIL_VERT = /* glsl */ `
attribute float aS; uniform float uScale, uW, uHead, uDecay, uMem, uAmp; uniform vec3 uColor; varying vec3 vCol; varying float vA;
void main(){
  vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
  float d = uHead - aS; float on = step(0.,d);
  float a = on*(exp(-d*uDecay)*uAmp + uMem);
  vCol = uColor; vA = uW*a; gl_PointSize = (.05 + .05*exp(-d*uDecay)*on)*uScale/-mv.z;
}`;

function Trail({ poly, cum, color, mat }: { poly: THREE.Vector3[]; cum: number[]; color: THREE.Color; mat: THREE.ShaderMaterial }) {
  const geo = useMemo(() => {
    const n = Math.floor(420 * Math.max(0.5, world.quality));
    const pos = new Float32Array(n * 3), s = new Float32Array(n);
    const o = new THREE.Vector3();
    for (let i = 0; i < n; i++) { sample(poly, cum, i / (n - 1), o); pos.set([o.x, o.y + 0.03, o.z], i * 3); s[i] = i / (n - 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    return g;
  }, [poly, cum]);
  useEffect(() => () => geo.dispose(), [geo]);
  mat.uniforms.uColor.value = color;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

const trailMat = (extra: Record<string, number>) => {
  const m = pointMaterial(TRAIL_VERT, {
    uHead: { value: 0 }, uDecay: { value: 3 }, uMem: { value: 0 }, uAmp: { value: 1 }, uColor: { value: new THREE.Color() },
  });
  Object.entries(extra).forEach(([k, val]) => { m.uniforms[k].value = val; });
  return m;
};

interface Cell { pos: THREE.Vector3; path: 'run' | 'right' | 'center'; s: number; col: THREE.Color }

export default function Hippocampus() {
  const scene = useScene();
  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    const r = rng(8);
    const spec: ['run' | 'right' | 'center', number, number, number][] = [['run', 12, 0, 1], ['right', 4, 0.55, 1], ['center', 3, 0.6, 1]];
    let h = 0;
    for (const [path, n, a, b] of spec) {
      for (let i = 0; i < n; i++) {
        const s = a + (b - a) * ((i + 0.5 + (r() - 0.5) * 0.4) / n);
        const p = sample(PATHS[path], LEN[path], s, new THREE.Vector3());
        p.x += (r() - 0.5) * 0.25; p.z += (r() - 0.5) * 0.25; p.y = 0.02;
        const col = new THREE.Color(1, 1, 1); h++;
        out.push({ pos: p, path, s, col });
      }
    }
    return out;
  }, []);

  const cellMesh = useRef<THREE.InstancedMesh>(null);
  const actAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(cells.length), 1), [cells]);
  const colAttr = useMemo(() => {
    const a = new Float32Array(cells.length * 3);
    cells.forEach((c, i) => { a[i * 3] = c.col.r; a[i * 3 + 1] = c.col.g; a[i * 3 + 2] = c.col.b; });
    return new THREE.InstancedBufferAttribute(a, 3);
  }, [cells]);
  const cellMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: CELL_VERT, fragmentShader: CELL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uW: { value: 1 } },
  }), []);
  const ratMat = useMemo(() => silhouetteMaterial('#e4ecff', '#010102', 2.4, 2.0), []);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.25, 0.32), toneMapped: false, transparent: true }), []);
  const noseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.4, 2.2), toneMapped: false }), []);
  const rewardMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 1.6), toneMapped: false }), []);
  const headMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.0, 2.6), toneMapped: false }), []);

  const runTrail = useMemo(() => trailMat({ uDecay: 1.4, uMem: 0.35 }), []);
  const rTrail = useMemo(() => trailMat({ uDecay: 3.5, uMem: 0.0 }), []);
  const cTrail = useMemo(() => trailMat({ uDecay: 3.5, uMem: 0.0 }), []);
  const lTrail = useMemo(() => trailMat({ uDecay: 3.5, uMem: 0.0 }), []);
  const cWarm = useMemo(() => new THREE.Color(1.7, 1.6, 1.4), []);
  const cViolet = useMemo(() => new THREE.Color(0.9, 1.0, 1.4), []);
  const cViolet2 = useMemo(() => new THREE.Color(0.8, 0.95, 1.4), []);
  const cViolet3 = useMemo(() => new THREE.Color(1.0, 0.95, 1.3), []);

  const rat = useRef<THREE.Group>(null);
  const ratHead = useRef<THREE.Group>(null);
  const comet = useRef<THREE.Mesh>(null);
  useEffect(() => () => { [cellMat, ratMat, lineMat, noseMat, rewardMat, headMat, runTrail, rTrail, cTrail, lTrail].forEach((d) => d.dispose()); }, [cellMat, ratMat, lineMat, noseMat, rewardMat, headMat, runTrail, rTrail, cTrail, lTrail]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ratPos = useMemo(() => new THREE.Vector3(), []);
  const ratPrev = useMemo(() => new THREE.Vector3(), []);
  const hp = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const m = cellMesh.current;
    if (!m) return;
    cells.forEach((c, i) => { dummy.position.copy(c.pos); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(0.5); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true;
    m.geometry.setAttribute('aAct', actAttr);
    m.geometry.setAttribute('aCol', colAttr);
  }, [cells, dummy, actAttr, colAttr]);

  useFrame((state) => {
    if (!scene.active) return;
    const w = scene.weight;
    const f = world.stationF;
    const p31 = eventPos('limbic-hippocampus'), p32 = eventPos('vicarious-trial-and-error-replay');
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat32 = near(p32, 0.6);

    // phase A: the rat runs the maze, place fields ignite one by one
    const runP = range(p31 - 0.55, p31 + 0.55, f);
    // phase B: rat returns to the junction and hesitates (VTE head-swing)
    const toJ = smoothstep(p31 + 0.55, p31 + 0.9, f);

    const runLen = LEN.run;
    const sJ = runLen[1] / runLen[3];
    const s = toJ > 0 ? 1 + (sJ - 1) * toJ : runP;
    const sign = toJ > 0 ? -1 : 1;
    sample(PATHS.run, runLen, s, ratPos);
    sample(PATHS.run, runLen, s - 0.01 * sign, ratPrev);
    const g = rat.current!;
    g.position.copy(ratPos);
    const swing = Math.sin(time * 3.2 + f * 6) * 0.9 * beat32 * toJ;
    const dir = tmp.subVectors(ratPos, ratPrev);
    const heading = dir.lengthSq() > 1e-8 ? Math.atan2(-dir.z, dir.x) : 0;
    g.rotation.y = heading + (toJ > 0 ? swing : 0);
    ratHead.current!.rotation.y = swing * 0.4;
    g.position.y = 0.02 + Math.abs(Math.sin(s * 80)) * 0.015 * (toJ > 0 ? 0 : 1);

    // replay: a compressed re-run of three possible routes at high speed, in imagination
    const rp = range(p32 - 0.45, p32 + 0.3, f) * 3;
    const seg = (i: number) => Math.min(1, Math.max(0, rp - i));
    const hL = seg(0), hR = seg(1), hC = seg(2);
    runTrail.uniforms.uHead.value = runP < 0.001 ? -1 : toJ > 0 ? 1.05 : runP;
    runTrail.uniforms.uAmp.value = 0.9;
    lTrail.uniforms.uHead.value = hL > 0 ? hL * 1.02 : -1;
    rTrail.uniforms.uHead.value = hR > 0 ? hR * 1.02 : -1;
    cTrail.uniforms.uHead.value = hC > 0 ? hC * 1.02 : -1;
    lTrail.uniforms.uMem.value = (hL >= 1 ? 0.1 : 0) * smoothstep(1, 0.4, hR);
    for (const m of [runTrail, rTrail, cTrail, lTrail]) { m.uniforms.uW.value = w; m.uniforms.uScale.value = k; m.uniforms.uTime.value = time; }
    cellMat.uniforms.uW.value = w; ratMat.uniforms.uW.value = w; lineMat.opacity = w;

    // replay comet position & which path it is on
    let cp: THREE.Vector3 | null = null; let hs = 0; let ph: 'run' | 'right' | 'center' = 'run';
    if (rp > 0 && rp < 3.0) {
      const idx = Math.min(2, Math.floor(rp));
      ph = idx === 0 ? 'run' : idx === 1 ? 'right' : 'center';
      hs = rp - idx;
      cp = sample(PATHS[ph], LEN[ph], hs, hp);
    }
    const cm = comet.current!;
    cm.visible = !!cp && w > 0.01;
    if (cp) { cm.position.copy(cp); cm.position.y = 0.12; cm.scale.setScalar(1 + 0.4 * Math.sin(time * 20)); }

    // place-field activations
    const arr = actAttr.array as Float32Array;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      let a = 0;
      if (c.path === 'run') {
        const d = ratPos.distanceTo(c.pos);
        a = Math.exp(-(d * d) / (2 * 0.32 * 0.32)) * (toJ > 0 ? 0.6 : 1);
        a = Math.max(a, runP > c.s && toJ === 0 ? 0.16 : 0, runP > 0.01 ? 0.1 : 0);
      } else a = 0.06;
      if (cp) {
        const d = cp.distanceTo(c.pos);
        if (ph === c.path || (ph === 'run' && c.path === 'run')) a = Math.max(a, Math.exp(-(d * d) / (2 * 0.38 * 0.38)) * 1.5);
        else if (c.path === 'run' && c.s < 0.38 && ph !== 'run') a = Math.max(a, Math.exp(-(d * d) / (2 * 0.38 * 0.38)) * 1.5);
      }
      arr[i] = a;
    }
    actAttr.needsUpdate = true;
    rewardMat.color.setRGB(2.6 * w, 2.2 * w, 1.6 * w);
    noseMat.color.setRGB(2.5 * w, 2.4 * w, 2.2 * w);
    headMat.color.setRGB(1.8 * w, 2.0 * w, 2.6 * w);
    runTrail.uniforms.uColor.value = cWarm;
  });

  const segs = SEGMENTS.map(([a, b]) => {
    const A = new THREE.Vector3(P[a][0], 0, P[a][1]), B = new THREE.Vector3(P[b][0], 0, P[b][1]);
    const c = A.clone().add(B).multiplyScalar(0.5); const l = A.distanceTo(B);
    const ang = Math.atan2(B.z - A.z, B.x - A.x);
    return { c, l, ang };
  });

  return (
    <group scale={1.3} position={[0, 0, 0.3]}>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.c.x, 0.0, s.c.z]} rotation={[-Math.PI / 2, 0, -s.ang]} material={lineMat}>
          <planeGeometry args={[s.l + 0.04, 0.025]} />
        </mesh>
      ))}
      <instancedMesh ref={cellMesh} args={[undefined, undefined, cells.length]} material={cellMat} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      <Trail poly={PATHS.run} cum={LEN.run} color={cWarm} mat={runTrail} />
      <Trail poly={PATHS.run} cum={LEN.run} color={cViolet} mat={lTrail} />
      <Trail poly={PATHS.right} cum={LEN.right} color={cViolet2} mat={rTrail} />
      <Trail poly={PATHS.center} cum={LEN.center} color={cViolet3} mat={cTrail} />
      <mesh position={[P.L2[0], 0.12, P.L2[1] - 0.1]} material={rewardMat}><sphereGeometry args={[0.1, 14, 12]} /></mesh>
      <mesh position={[P.R2[0], 0.1, P.R2[1] - 0.1]} material={rewardMat}><sphereGeometry args={[0.045, 12, 10]} /></mesh>
      <mesh position={[P.C[0], 0.1, P.C[1] - 0.1]} material={rewardMat}><sphereGeometry args={[0.045, 12, 10]} /></mesh>
      <mesh ref={comet} material={headMat}><sphereGeometry args={[0.07, 12, 10]} /></mesh>
      <group ref={rat}>
        <group ref={ratHead} position={[0, 0, 0]}>
          <group scale={0.3} position={[-0.15, 0.2, 0]}><Critter mat={ratMat} shape={SHAPES.shrew} eyeMat={noseMat} /></group>
        </group>
      </group>
    </group>
  );
}
