import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep, range } from '../../world/util';
import { pointMaterial, pointScale } from './kit';

interface Branch { pts: THREE.Vector3[]; depth: number; t0: number; chosen: boolean; leaf: boolean }

const VERT = /* glsl */ `
attribute vec4 aSeed; attribute vec4 aInfo; // x: reveal time, y: chosen, z: size, w: depth
uniform float uTime, uScale, uW, uGrow, uChoose, uBeat; varying vec3 vCol; varying float vA;
void main(){
  vec3 p = position;
  float shimmer = sin(uTime*1.3 + aSeed.x*40.)*.5+.5;
  p += (aSeed.yzw-.5)*.04*(1.+shimmer);
  vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
  float d = uGrow - aInfo.x;
  float on = smoothstep(0., .02, d);
  float tip = exp(-max(d,0.)*22.) * on;
  float ch = aInfo.y;
  float ghost = mix(.5, .13, uChoose);
  float a = on*(ghost*(1.-ch) + ch*mix(.3, 1.4, uChoose)) + tip*1.1;
  vec3 ghostCol = mix(vec3(.75,.85,1.15), vec3(.9,.9,1.1), aInfo.w/5.);
  vec3 goldCol = vec3(1.9,1.6,1.1);
  vCol = mix(ghostCol, goldCol, ch*uChoose) + vec3(1.,.9,.9)*tip*.6;
  vA = uW*a*(.75+.25*shimmer)*(1.+uBeat*.4);
  gl_PointSize = aInfo.z*.8*(1.+tip*1.4)*uScale/-mv.z;
}`;

export default function Futures() {
  const scene = useScene();
  const agent = useRef<THREE.Mesh>(null);

  const built = useMemo(() => {
    const r = rng(33);
    const branches: Branch[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion(), axis = new THREE.Vector3();
    const perp = (d: THREE.Vector3) => axis.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(d).normalize().clone();
    const MAXD = 5;
    const lens = [1.6, 2.0, 1.8, 1.5, 1.2];
    const grow = (start: THREE.Vector3, dir: THREE.Vector3, depth: number, t0: number, chosen: boolean): THREE.Vector3[] => {
      const n = 22; const pts: THREE.Vector3[] = [start.clone()];
      const d = dir.clone(); const L = lens[depth] * (0.8 + r() * 0.4);
      for (let i = 1; i <= n; i++) {
        q.setFromAxisAngle(perp(d), (r() - 0.5) * 0.22); d.applyQuaternion(q);
        d.y += 0.004; d.normalize();
        pts.push(pts[i - 1].clone().addScaledVector(d, L / n));
      }
      const b: Branch = { pts, depth, t0, chosen, leaf: depth === MAXD - 1 };
      branches.push(b);
      if (depth < MAXD - 1) {
        const kids = depth === 0 ? 4 : 2 + (r() < 0.45 ? 1 : 0);
        const end = pts[pts.length - 1];
        const dirs: THREE.Vector3[] = [];
        for (let k = 0; k < kids; k++) {
          const nd = d.clone();
          q.setFromAxisAngle(perp(d), 0.5 + r() * 0.7); nd.applyQuaternion(q);
          nd.y += 0.02; nd.normalize(); dirs.push(nd);
        }
        // the chosen continuation is the child that heads highest and to the right
        let best = 0, bs = -1e9;
        dirs.forEach((nd, k) => { const s = nd.y + nd.x * 0.5 + (r() - 0.5) * 0.1; if (s > bs) { bs = s; best = k; } });
        dirs.forEach((nd, k) => grow(end, nd, depth + 1, t0 + 0.2 + r() * 0.04, chosen && k === best));
      }
      return pts;
    };
    grow(new THREE.Vector3(0, -2.6, 0), up, 0, 0, true);
    // reveal times: each branch grows from t0 over 0.22
    const per = Math.max(10, Math.floor(26 * Math.max(0.6, world.quality)));
    const total = branches.length * per + branches.filter((b) => b.leaf).length;
    const pos = new Float32Array(total * 3), seed = new Float32Array(total * 4), info = new Float32Array(total * 4);
    let k = 0;
    const curve = new THREE.CatmullRomCurve3();
    const chosenPath: THREE.Vector3[] = [];
    for (const b of branches) {
      curve.points = b.pts;
      if (b.chosen) for (let i = 0; i <= 8; i++) chosenPath.push(curve.getPoint(i / 8));
      for (let i = 0; i < per; i++) {
        const u = i / (per - 1); const p = curve.getPoint(u);
        pos.set([p.x, p.y, p.z], k * 3);
        seed.set([r(), r(), r(), r()], k * 4);
        info.set([b.t0 + u * 0.22, b.chosen ? 1 : 0, 0.11 - b.depth * 0.012, b.depth], k * 4);
        k++;
      }
      if (b.leaf) {
        const p = b.pts[b.pts.length - 1];
        pos.set([p.x, p.y, p.z], k * 3);
        seed.set([r(), r(), r(), r()], k * 4);
        info.set([b.t0 + 0.22, b.chosen ? 1 : 0, b.chosen ? 0.55 : 0.28, 5], k * 4);
        k++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    const m = pointMaterial(VERT, { uGrow: { value: 0 }, uChoose: { value: 0 }, uBeat: { value: 0 } });
    return { g, m, chosenCurve: new THREE.CatmullRomCurve3(chosenPath) };
  }, []);
  useEffect(() => () => { built.g.dispose(); built.m.dispose(); }, [built]);
  const agentMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 2.0), toneMapped: false }), []);
  useEffect(() => () => agentMat.dispose(), [agentMat]);

  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat = near(eventPos('agranular-prefrontal-simulation'), 0.7);
    const grow = range(0.08, 0.62, t) * 1.45;   // the futures fan out ahead of the animal
    const choose = smoothstep(0.62, 0.92, t);   // one is selected, the rest dim
    for (const m of [built.m]) {
      const u = m.uniforms;
      u.uW.value = w; u.uScale.value = k; u.uTime.value = time; u.uBeat.value = beat; u.uChoose.value = choose;
    }
    built.m.uniforms.uGrow.value = grow;
    const a = agent.current!;
    const prog = smoothstep(0.7, 1.0, t);
    built.chosenCurve.getPoint(prog, a.position);
    a.scale.setScalar((0.9 + 0.15 * Math.sin(time * 5)) * (1 + beat * 0.4));
    agentMat.color.setRGB(2.6 * w, 2.4 * w, 2.0 * w);
  });

  return (
    <group>
      <points geometry={built.g} material={built.m} frustumCulled={false} />
      <mesh ref={agent} material={agentMat}><sphereGeometry args={[0.12, 14, 12]} /></mesh>
    </group>
  );
}
