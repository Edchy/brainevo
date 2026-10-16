import { Suspense, lazy, memo, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { BloomEffect } from 'postprocessing';
import * as THREE from 'three';
import { SCENES } from '../scenes';
import { useSettings } from '../style/store';
import { OIL_BLOOM, OilEffects } from '../style/oil';
import TitleLayer from '../style/titles';
import PerfHud from './PerfHud';
import Dip from './Dip';
import Scrim from './Scrim';
import { titleState } from '../style/titles/state';
import Ambient from '../scenes/Ambient';
// dev-only tools, loaded on demand; in production builds the dead branch drops them from the bundle entirely
const BrainLab = import.meta.env.DEV ? lazy(() => import('../scenes/shared/brain/BrainLab')) : null;
const CreatureDemo = import.meta.env.DEV ? lazy(() => import('../scenes/shared/creatures/CreatureDemo')) : null;
import { SceneCtx } from './context';
import { world } from './store';
import { clamp01, smoothstep } from './util';
import type { CameraPose, SceneDef, SceneState } from './types';

const DEFAULT_POSE: CameraPose = { pos: [0, 0, 6], look: [0, 0, 0], fov: 55 };
/** default title plane as a fraction of the focal distance (SceneDef.titleDepth overrides) */
const TITLE_PLANE = 0.7;
const MOUNT_MARGIN = 3; // stations beyond the fade at which a scene is mounted (hidden) and its shaders pre-compiled
const KEEP_DIST = 9; // once mounted, a scene stays mounted until the viewer is this many stations away.
// Unmounting disposes materials, and three then has to RECOMPILE the shaders on the next mount (a visible stall).

/** a..b is the scene's story window (drives t); wa..wb is where it is fully visible (drives weight) */
interface Resolved { def: SceneDef; a: number; b: number; wa: number; wb: number; fade: number; state: SceneState }

// Frames after mount at which a scene's shaders are (re-)compiled: once its children exist, and again to catch materials
// created lazily in effects/first frames. Later compiles are cheap cache hits for programs that already exist.
const WARM_AT = [2, 30];

/**
 * Pre-compile every material under `g`, including objects the scene keeps hidden until its story beat (moons, rings,
 * shells...). three's compile only visits VISIBLE objects, so we force the whole subtree visible for the synchronous part
 * of compileAsync and restore it. Compiling against the real scene keeps fog/lights in the program key identical.
 * The program key also depends on the bound render target (tone mapping + output colour space): with post-processing the
 * scene draws into the composer's buffer, so compile with a render target bound too, or every warmed program is the wrong
 * variant and gets recompiled on the scene's first visible frame.
 */
let warmTarget: THREE.WebGLRenderTarget | null = null;
function warm(gl: THREE.WebGLRenderer, g: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene) {
  if (!SAFE && !warmTarget) warmTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const prevTarget = gl.getRenderTarget();
  const hidden: THREE.Object3D[] = [];
  g.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  gl.setRenderTarget(SAFE ? null : warmTarget);
  try { gl.compileAsync(g, camera, scene).catch(() => {}); }
  finally {
    gl.setRenderTarget(prevTarget);
    for (const o of hidden) o.visible = false;
  }
}

function resolve(): Resolved[] {
  const out = SCENES.flatMap((def) => {
    const a = world.eventIndex[def.from];
    const b = world.eventIndex[def.to];
    if (a === undefined || b === undefined) {
      if (import.meta.env.DEV) console.warn(`[scene ${def.id}] unknown event id`, def.from, def.to);
      return [];
    }
    const wa = a - (def.lead ?? 0.4), wb = b + (def.tail ?? 0.4);
    return [{ def, a: wa, b: wb, wa, wb, fade: def.fade ?? 0.6, state: { t: 0, weight: 0, active: false } }];
  }).sort((x, y) => x.a - y.a);
  // Neighbouring windows often abut or overlap by most of a station, which left both scenes at full weight on top of each other
  // (a busy double exposure). Give every such hand-off one crossfade centred in the overlap, with each scene at half
  // weight at the cut, so the dip-to-dark lands there. `t` still runs over the full story window; scenes flagged
  // `layer` deliberately play over their predecessor and keep the overlap.
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1], cur = out[i];
    if (cur.def.layer) continue; // only ever shrinks windows, so abutting and gapped neighbours are handled too
    const cut = (prev.wb + cur.wa) / 2;
    prev.wb = Math.max(prev.wa, Math.min(prev.wb, cut - prev.fade / 2));
    cur.wa = Math.min(cur.wb, Math.max(cur.wa, cut + cur.fade / 2));
  }
  return out;
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
  const { titles } = useSettings();
  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={(b) => { bloom.current = b; sanitizeBloom(b); }} intensity={0.5} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette eskil={false} offset={0.2} darkness={0.7} />
      <Dip />
      <Scrim />
      <OilEffects />
      {titles ? <TitleLayer /> : <></>}
    </EffectComposer>
  );
});

function World() {
  const resolved = useMemo(resolve, []);
  const advance = useThree((s) => s.advance);
  const getState = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const keep = useRef(new Set<string>());
  if (import.meta.env.DEV) {
    // hidden/throttled tabs never fire rAF: window.__tick(n) renders n frames (16ms apart) manually
    (window as unknown as Record<string, unknown>).__tick = (n = 1) => {
      // with frameloop 'always' R3F takes dt from the wall clock, which is ~0 between back-to-back manual frames; that
      // left every damped value (camera, title depth) frozen in test captures. Backdate the clock so each frame is 16.7ms.
      const clock = getState().clock;
      for (let i = 0; i < n; i++) { clock.oldTime = performance.now() - 16.7; advance(performance.now(), true); }
    };
    (window as unknown as Record<string, unknown>).__gl = gl;
  }
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const ambientW = useRef(0);
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
    let fov = 0, bl = 0, moodW = 0, td = 0, w1 = 0, w2 = 0;
    let d1: SceneDef | null = null, d2: SceneDef | null = null;
    const live: string[] = [];

    for (const r of resolved) {
      const t = clamp01((f - r.a) / (r.b - r.a));
      const dist = f < r.wa ? r.wa - f : f > r.wb ? f - r.wb : 0;
      // sharpened: overlap only in the middle of the fade so neighbouring scenes don't bleed through each other
      const w = smoothstep(0.2, 0.8, 1 - dist / r.fade);
      r.state.t = t; r.state.weight = w; r.state.active = w > 0.001;
      const g = groups.current[r.def.id];
      if (g) {
        const age = (g.userData.age = (g.userData.age ?? 0) + 1);
        if (WARM_AT.includes(age)) warm(gl, g, state.camera, state.scene);
        g.visible = r.state.active;
      }
      if (dist < r.fade + MOUNT_MARGIN || (keep.current.has(r.def.id) && dist < KEEP_DIST)) { live.push(r.def.id); keep.current.add(r.def.id); }
      else keep.current.delete(r.def.id);
      if (w <= 0.001) continue;
      sumW += w;
      if (w > w1) { w2 = w1; d2 = d1; w1 = w; d1 = r.def; } else if (w > w2) { w2 = w; d2 = r.def; }
      const pose = r.def.camera ? r.def.camera(t) : DEFAULT_POSE;
      p.x += pose.pos[0] * w; p.y += pose.pos[1] * w; p.z += pose.pos[2] * w;
      l.x += pose.look[0] * w; l.y += pose.look[1] * w; l.z += pose.look[2] * w;
      fov += (pose.fov ?? 55) * w;
      const tdef = r.def.titleDepth;
      // default headline plane: a little in front of the focal point, so the hero stays behind the words and only
      // things clearly in the foreground (a passing creature, near particles) slip in front of them
      td += (tdef === undefined ? TITLE_PLANE * Math.hypot(pose.pos[0] - pose.look[0], pose.pos[1] - pose.look[1], pose.pos[2] - pose.look[2]) : typeof tdef === 'function' ? tdef(t) : tdef) * w;
      const mood = r.def.mood?.(t);
      if (mood) { bg.add(tmp.c.set(mood.bg ?? '#000').multiplyScalar(w)); bl += (mood.bloom ?? 0.6) * w; moodW += w; }
    }
    // default pose fills any remaining weight
    const rest = Math.max(0, 1 - sumW);
    p.x += DEFAULT_POSE.pos[0] * rest; p.y += DEFAULT_POSE.pos[1] * rest; p.z += DEFAULT_POSE.pos[2] * rest;
    l.x += DEFAULT_POSE.look[0] * rest; l.y += DEFAULT_POSE.look[1] * rest; l.z += DEFAULT_POSE.look[2] * rest;
    fov += 55 * rest;
    td += 6 * TITLE_PLANE * rest;
    const norm = sumW + rest || 1;
    p.divideScalar(norm); l.divideScalar(norm); fov /= norm;
    // portrait screens: scenes are composed for landscape and three's fov is vertical, so a tall narrow canvas would crop
    // the hero at the sides. Keep at least the horizontal view of a square frame.
    const aspect = state.size.width / Math.max(1, state.size.height);
    if (aspect < 1) fov = Math.min(100, (2 * Math.atan(Math.tan((fov * Math.PI) / 360) / aspect) * 180) / Math.PI);
    titleState.depth += (td / norm - titleState.depth) * (1 - Math.exp(-dt * 14));
    bl += 0.5 * (1 - Math.min(1, moodW)); moodW = Math.max(moodW, 1);

    const k = 1 - Math.exp(-dt * 14); // slight damping, still scrubs tightly
    pos.current.lerp(p, k); look.current.lerp(l, k);
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.copy(pos.current);
    cam.lookAt(look.current);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); }

    (state.scene.background as THREE.Color).lerp(bg.multiplyScalar(1 / moodW), k);
    if (bloom.current) bloom.current.intensity += (bl / moodW * OIL_BLOOM - bloom.current.intensity) * k;

    // Hand-off depth: the weaker of the two leading scenes relative to an even split (1 at the crossfade midpoint).
    // Scenes flagged `layer` continue the previous shot and never dip.
    world.overlap = d2 && !d1?.layer && !d2.layer ? clamp01(2 * w2 / (w1 + w2)) : 0;
    ambientW.current = clamp01(1 - sumW);
    const key = live.join('|');
    if (key !== mountedKey.current) { mountedKey.current = key; setMounted(live); }
  }, -1);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <Ambient weight={ambientW} />
      {BRAINLAB && BrainLab && <Suspense fallback={null}><BrainLab stage={BRAINLAB} /></Suspense>}
      {CREATURES && CreatureDemo && <Suspense fallback={null}><CreatureDemo kind={CREATURES === 'biped' || ['sapiens', 'erectus', 'lucy', 'sahelanthropus'].includes(CREATURES) ? 'biped' : 'quadruped'} solo={['quadruped', 'biped'].includes(CREATURES) ? undefined : CREATURES} /></Suspense>}
      {!BRAINLAB && !CREATURES && resolved.filter((r) => mounted.includes(r.def.id)).map((r) => (
        <group key={r.def.id} visible={false} ref={(g) => { groups.current[r.def.id] = g; }}>
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
// dev: ?brainlab=fish renders the brain turntable instead of the timeline (src/scenes/shared/brain/BrainLab.tsx)
const BRAINLAB = import.meta.env.DEV ? QS.get('brainlab') : null;
// dev: ?creatures=quadruped | biped | <preset> renders the creature-toolkit lineup instead of the timeline
const CREATURES = import.meta.env.DEV ? QS.get('creatures') : null;

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
        // Error checking reads the shader info logs, which blocks until a (parallel) compile finishes: a stall on each
        // scene's first frame. Keep it in dev, where shader errors would otherwise be silent.
        onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV; }}
      >
        {ADAPTIVE && <PerformanceMonitor ms={400} iterations={10} bounds={() => [30, 70]} flipflops={0} onDecline={stepDown} />}
        <World />
      </Canvas>
    </div>
  );
}
