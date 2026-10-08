import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { BloomEffect } from 'postprocessing';
import * as THREE from 'three';
import { SCENES } from '../scenes';
import Ambient from '../scenes/Ambient';
import { SceneCtx } from './context';
import { world } from './store';
import { clamp01, smoothstep } from './util';
import type { CameraPose, SceneDef, SceneState } from './types';

const DEFAULT_POSE: CameraPose = { pos: [0, 0, 6], look: [0, 0, 0], fov: 55 };
const MOUNT_MARGIN = 2.2; // stations beyond the fade at which a scene is mounted (but hidden)

interface Resolved { def: SceneDef; a: number; b: number; fade: number; state: SceneState }

function resolve(): Resolved[] {
  return SCENES.flatMap((def) => {
    const a = world.eventIndex[def.from];
    const b = world.eventIndex[def.to];
    if (a === undefined || b === undefined) {
      if (import.meta.env.DEV) console.warn(`[scene ${def.id}] unknown event id`, def.from, def.to);
      return [];
    }
    return [{
      def,
      a: a - (def.lead ?? 0.4),
      b: b + (def.tail ?? 0.4),
      fade: def.fade ?? 0.6,
      state: { t: 0, weight: 0, active: false },
    }];
  });
}

function World() {
  const resolved = useMemo(resolve, []);
  const advance = useThree((s) => s.advance);
  if (import.meta.env.DEV) {
    // hidden/throttled tabs never fire rAF: window.__tick(n) renders n frames (16ms apart) manually
    (window as unknown as Record<string, unknown>).__tick = (n = 1) => {
      for (let i = 0; i < n; i++) advance(performance.now() + i * 16.7, true);
    };
  }
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const ambientW = useRef(1);
  const bloom = useRef<BloomEffect>(null);
  const mountedKey = useRef('');
  const [mounted, setMounted] = useState<string[]>([]);
  const pos = useRef(new THREE.Vector3(...DEFAULT_POSE.pos));
  const look = useRef(new THREE.Vector3(...DEFAULT_POSE.look));
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3(), bg: new THREE.Color(), c: new THREE.Color() }), []);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.1);
    world.time += dt;
    // smoothed signed velocity in viewports/sec
    const vw = state.size.width || 1;
    const inst = dt > 0 ? world.pendingDx / vw / dt : 0;
    world.pendingDx = 0;
    world.velocity += (inst - world.velocity) * Math.min(1, dt * 8);

    const f = world.stationF;
    let sumW = 0;
    const p = tmp.p.set(0, 0, 0), l = tmp.l.set(0, 0, 0), bg = tmp.bg.setRGB(0, 0, 0);
    let fov = 0, bl = 0, moodW = 0;
    const live: string[] = [];

    for (const r of resolved) {
      const t = clamp01((f - r.a) / (r.b - r.a));
      const dist = f < r.a ? r.a - f : f > r.b ? f - r.b : 0;
      // sharpened: overlap only in the middle of the fade so neighbouring scenes don't bleed through each other
      const w = smoothstep(0.2, 0.8, 1 - dist / r.fade);
      r.state.t = t; r.state.weight = w; r.state.active = w > 0.001;
      const g = groups.current[r.def.id];
      if (g) g.visible = r.state.active;
      if (dist < r.fade + MOUNT_MARGIN) live.push(r.def.id);
      if (w <= 0.001) continue;
      sumW += w;
      const pose = r.def.camera ? r.def.camera(t) : DEFAULT_POSE;
      p.x += pose.pos[0] * w; p.y += pose.pos[1] * w; p.z += pose.pos[2] * w;
      l.x += pose.look[0] * w; l.y += pose.look[1] * w; l.z += pose.look[2] * w;
      fov += (pose.fov ?? 55) * w;
      const mood = r.def.mood?.(t);
      if (mood) { bg.add(tmp.c.set(mood.bg ?? '#000').multiplyScalar(w)); bl += (mood.bloom ?? 0.6) * w; moodW += w; }
    }
    // default pose fills any remaining weight
    const rest = Math.max(0, 1 - sumW);
    p.x += DEFAULT_POSE.pos[0] * rest; p.y += DEFAULT_POSE.pos[1] * rest; p.z += DEFAULT_POSE.pos[2] * rest;
    l.x += DEFAULT_POSE.look[0] * rest; l.y += DEFAULT_POSE.look[1] * rest; l.z += DEFAULT_POSE.look[2] * rest;
    fov += 55 * rest;
    const norm = sumW + rest || 1;
    p.divideScalar(norm); l.divideScalar(norm); fov /= norm;
    bl += 0.5 * (1 - Math.min(1, moodW)); moodW = Math.max(moodW, 1);

    const k = 1 - Math.exp(-dt * 14); // slight damping, still scrubs tightly
    pos.current.lerp(p, k); look.current.lerp(l, k);
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.copy(pos.current);
    cam.lookAt(look.current);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); }

    (state.scene.background as THREE.Color).lerp(bg.multiplyScalar(1 / moodW), k);
    if (bloom.current) bloom.current.intensity += (bl / moodW - bloom.current.intensity) * k;

    ambientW.current = clamp01(1 - sumW);
    const key = live.join('|');
    if (key !== mountedKey.current) { mountedKey.current = key; setMounted(live); }
  }, -1);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <Ambient weight={ambientW} />
      {resolved.filter((r) => mounted.includes(r.def.id)).map((r) => (
        <group key={r.def.id} visible={false} ref={(g) => { groups.current[r.def.id] = g; }}>
          <SceneCtx.Provider value={r.state}>
            <Suspense fallback={null}><r.def.Component /></Suspense>
          </SceneCtx.Provider>
        </group>
      ))}
      <EffectComposer multisampling={0}>
        <Bloom ref={bloom} intensity={0.5} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

const DPR_MAX = world.quality < 1 ? 1.25 : 1.75;
const DPR_MIN = 0.6;

export default function Stage() {
  // adaptive resolution: if the GPU can't hold frame rate, quietly render fewer pixels
  const [dpr, setDpr] = useState(DPR_MAX);
  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        camera={{ fov: 55, near: 0.05, far: 4000, position: DEFAULT_POSE.pos }}
      >
        <PerformanceMonitor ms={250} iterations={6} flipflops={4} onChange={({ factor }) => setDpr(DPR_MIN + factor * (DPR_MAX - DPR_MIN))} />
        <World />
      </Canvas>
    </div>
  );
}
