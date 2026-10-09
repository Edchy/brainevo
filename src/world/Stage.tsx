import { Suspense, memo, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { BloomEffect } from 'postprocessing';
import * as THREE from 'three';
import { SCENES } from '../scenes';
import { STYLE_DEFS } from '../style/registry';
import { getSettings, useSettings } from '../style/store';
import TitleLayer from '../style/titles';
import PerfHud from './PerfHud';
import { titleState } from '../style/titles/state';
import Ambient from '../scenes/Ambient';
import { SceneCtx } from './context';
import { world } from './store';
import { clamp01, smoothstep } from './util';
import type { CameraPose, SceneDef, SceneState } from './types';

const DEFAULT_POSE: CameraPose = { pos: [0, 0, 6], look: [0, 0, 0], fov: 55 };
const MOUNT_MARGIN = 3; // stations beyond the fade at which a scene is mounted (hidden) and its shaders pre-compiled
const KEEP_DIST = 9; // once mounted, a scene stays mounted until the viewer is this many stations away.
// Unmounting disposes materials, and three then has to RECOMPILE the shaders on the next mount (a visible stall).

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

/**
 * The post-processing chain lives in its own memoised component. react-postprocessing REBUILDS the whole effect pass
 * (recompiling the merged shader, which outputs a black frame) whenever its children change identity, and World
 * re-renders every time a scene mounts/unmounts while scrolling. Keep this out of World's render path.
 */
/**
 * Scrub NaN / Inf / runaway HDR texels before the bloom blur sees them. A single bad texel (a divide-by-zero or an
 * additive-blend overflow in half-float from some scene's particles) otherwise gets smeared by the mip blur over the
 * whole frame, which shows up as one-frame black flashes. Only the bloom input is sanitised.
 */
function sanitizeBloom(b: BloomEffect | null) {
  if (!b) return;
  const m = b.luminanceMaterial;
  if (m.userData.sanitized) return;
  m.userData.sanitized = true;
  m.fragmentShader = m.fragmentShader.replace(
    'vec4 texel=texture2D(inputBuffer,vUv);',
    'vec4 texel=texture2D(inputBuffer,vUv);texel=(any(isnan(texel))||any(isinf(texel)))?vec4(0.0):clamp(texel,vec4(0.0),vec4(64.0));',
  );
  m.needsUpdate = true;
}

const PostFX = memo(function PostFX({ bloom }: { bloom: RefObject<BloomEffect | null> }) {
  if (import.meta.env.DEV) (window as unknown as Record<string, number>).__postRenders = ((window as unknown as Record<string, number>).__postRenders ?? 0) + 1;
  const { style, titles } = useSettings();
  const StyleEffects = STYLE_DEFS[style].Effects;
  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={(b) => { bloom.current = b; sanitizeBloom(b); }} intensity={0.5} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette eskil={false} offset={0.2} darkness={0.7} />
      {titles ? <TitleLayer /> : <></>}
      <StyleEffects />
    </EffectComposer>
  );
});

function World() {
  if (import.meta.env.DEV) (window as unknown as Record<string, number>).__worldRenders = ((window as unknown as Record<string, number>).__worldRenders ?? 0) + 1;
  const resolved = useMemo(resolve, []);
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const keep = useRef(new Set<string>());
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
    if (import.meta.env.DEV) { (world as unknown as Record<string, number>).__dt = dt; }
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
    let fov = 0, bl = 0, moodW = 0, td = 0;
    const live: string[] = [];

    for (const r of resolved) {
      const t = clamp01((f - r.a) / (r.b - r.a));
      const dist = f < r.a ? r.a - f : f > r.b ? f - r.b : 0;
      // sharpened: overlap only in the middle of the fade so neighbouring scenes don't bleed through each other
      const w = smoothstep(0.2, 0.8, 1 - dist / r.fade);
      r.state.t = t; r.state.weight = w; r.state.active = w > 0.001;
      const g = groups.current[r.def.id];
      if (g) g.visible = r.state.active;
      if (dist < r.fade + MOUNT_MARGIN || (keep.current.has(r.def.id) && dist < KEEP_DIST)) { live.push(r.def.id); keep.current.add(r.def.id); }
      else keep.current.delete(r.def.id);
      if (w <= 0.001) continue;
      sumW += w;
      const pose = r.def.camera ? r.def.camera(t) : DEFAULT_POSE;
      p.x += pose.pos[0] * w; p.y += pose.pos[1] * w; p.z += pose.pos[2] * w;
      l.x += pose.look[0] * w; l.y += pose.look[1] * w; l.z += pose.look[2] * w;
      fov += (pose.fov ?? 55) * w;
      const tdef = r.def.titleDepth;
      td += (tdef === undefined ? Math.hypot(pose.pos[0] - pose.look[0], pose.pos[1] - pose.look[1], pose.pos[2] - pose.look[2]) : typeof tdef === 'function' ? tdef(t) : tdef) * w;
      const mood = r.def.mood?.(t);
      if (mood) { bg.add(tmp.c.set(mood.bg ?? '#000').multiplyScalar(w)); bl += (mood.bloom ?? 0.6) * w; moodW += w; }
    }
    // default pose fills any remaining weight
    const rest = Math.max(0, 1 - sumW);
    p.x += DEFAULT_POSE.pos[0] * rest; p.y += DEFAULT_POSE.pos[1] * rest; p.z += DEFAULT_POSE.pos[2] * rest;
    l.x += DEFAULT_POSE.look[0] * rest; l.y += DEFAULT_POSE.look[1] * rest; l.z += DEFAULT_POSE.look[2] * rest;
    fov += 55 * rest;
    td += 6 * rest;
    const norm = sumW + rest || 1;
    p.divideScalar(norm); l.divideScalar(norm); fov /= norm;
    titleState.depth += (td / norm - titleState.depth) * (1 - Math.exp(-dt * 14));
    bl += 0.5 * (1 - Math.min(1, moodW)); moodW = Math.max(moodW, 1);

    const k = 1 - Math.exp(-dt * 14); // slight damping, still scrubs tightly
    pos.current.lerp(p, k); look.current.lerp(l, k);
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.copy(pos.current);
    cam.lookAt(look.current);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); }

    (state.scene.background as THREE.Color).lerp(bg.multiplyScalar(1 / moodW), k);
    if (bloom.current) bloom.current.intensity += (bl / moodW * (STYLE_DEFS[getSettings().style].bloomScale ?? 1) - bloom.current.intensity) * k;

    ambientW.current = clamp01(1 - sumW);
    const key = live.join('|');
    if (key !== mountedKey.current) { mountedKey.current = key; setMounted(live); }
  }, -1);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <Ambient weight={ambientW} />
      {resolved.filter((r) => mounted.includes(r.def.id)).map((r) => (
        <group key={r.def.id} visible={false} ref={(g) => {
          groups.current[r.def.id] = g;
          if (g && !g.userData.warmed) {
            // pre-compile this scene's shaders off the main thread so the first visible frame doesn't stall
            g.userData.warmed = true;
            g.visible = true;
            gl.compileAsync(g, camera).catch(() => {});
            g.visible = false;
          }
        }}>
          <SceneCtx.Provider value={r.state}>
            <Suspense fallback={null}><r.def.Component /></Suspense>
          </SceneCtx.Provider>
        </group>
      ))}
      {!SAFE && <PostFX bloom={bloom} />}
      {PERF && <PerfHud />}
    </>
  );
}

const DPR_MAX = world.quality < 1 ? 1.25 : 1.75;
// Discrete resolution steps, only ever stepping DOWN. Changing the pixel ratio resizes the canvas and rebuilds the
// post-processing buffers, which blanks a frame, so it must be rare (never a continuous nudge). ?adaptive=0 disables it.
const DPR_LEVELS = [DPR_MAX, 1.25, 1, 0.8].filter((v, i, a) => i === 0 || v < a[i - 1]);
const ADAPTIVE = typeof location === 'undefined' || new URLSearchParams(location.search).get('adaptive') !== '0';
const COOLDOWN_MS = 6000;
const QS = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const SAFE = QS.get('safe') === '1'; // no post-processing at all: isolates GPU load / pass problems
const PERF = QS.get('perf') === '1';
const DPR_OVERRIDE = Number(QS.get('dpr')) || 0;

export default function Stage() {
  const [level, setLevel] = useState(0);
  const lastChange = useRef(0);
  const stepDown = () => {
    const now = performance.now();
    if (now - lastChange.current < COOLDOWN_MS) return;
    lastChange.current = now;
    setLevel((l) => Math.min(l + 1, DPR_LEVELS.length - 1));
  };
  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        dpr={DPR_OVERRIDE || DPR_LEVELS[level]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        camera={{ fov: 55, near: 0.05, far: 4000, position: DEFAULT_POSE.pos }}
      >
        {ADAPTIVE && <PerformanceMonitor ms={400} iterations={10} bounds={() => [30, 70]} flipflops={0} onDecline={stepDown} />}
        <World />
      </Canvas>
    </div>
  );
}
