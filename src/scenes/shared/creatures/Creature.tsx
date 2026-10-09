import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { world } from '../../../world/store';
import { DEFAULT_LOOK, DEFAULT_PALETTE, PrimSet, applyLook, applyPalette, createCompositeMaterial, createCreatureMaterial, uploadPrims } from './sdf';
import type { CreatureMaterial, Look, Palette } from './sdf';
import { newRigState } from './rig';
import type { RigState } from './rig';
import { QUAD_PRESETS, quadParams, solveQuad } from './quadruped';
import type { QuadParams, QuadPresetName } from './quadruped';
import { BIPED_PRESETS, bipedParams, solveBiped } from './biped';
import type { BipedParams, BipedPresetName } from './biped';

export interface CreatureHandle {
  /** live rig controls: mutate (alert, mouth, headYaw, armL...) from the scene's useFrame */
  state: RigState;
  material: CreatureMaterial;
  /** mutable look (light, rim, fur...) - written to the material on the next draw */
  look: Look;
  palette: Palette;
  /** imperative gait override (takes priority over props); set fields to undefined to return to automatic */
  override: { phase?: number; walk?: number };
}

export interface CreatureProps {
  rig?: 'quadruped' | 'biped';
  /** quadruped: shrew | cynodont | rat | primate;  biped: sapiens | erectus | lucy | sahelanthropus */
  preset?: QuadPresetName | BipedPresetName;
  /** override any rig parameter */
  params?: Partial<QuadParams> | Partial<BipedParams>;
  palette?: Partial<Palette>;
  look?: Partial<Look>;
  /** gait amount 0..1. Omit for automatic (derived from how fast the parent moves along its +x axis). */
  walk?: number;
  /** explicit gait phase in cycles (omit = integrate parent motion: feet plant, scrubbing works in both directions) */
  phase?: number;
  /** world-space point the head should track (null = none) */
  lookAt?: THREE.Vector3 | null;
  /** floor level in creature space for contact occlusion (default 0) */
  /** called right before the creature is drawn (after the rig is solved), e.g. to sync scene-driven uniforms */
  onBeforeDraw?: (c: CreatureHandle) => void;
  /** update the rig every N rendered frames (2 = half rate) */
  every?: number;
  /**
   * Render resolution relative to the canvas, 0.4..1. 'auto' (default) renders natively up to a pixel ratio of ~1.25 and
   * at 1.25/dpr above that (into a shared low-res buffer that is blitted back with depth). Cost scales with pixels.
   */
  resolution?: number | 'auto';
  /** extra distance-travelled-to-phase multiplier */
  cadence?: number;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector2();

/** one shared offscreen buffer: each creature fills it and is blitted back immediately, so creatures can reuse it */
let sharedRT: THREE.WebGLRenderTarget | null = null;
const rtScene = new THREE.Scene();
const rtMesh = new THREE.Mesh(BOX);
rtMesh.frustumCulled = false; rtMesh.matrixAutoUpdate = false;
rtScene.add(rtMesh);
rtScene.matrixWorldAutoUpdate = false;
function getRT(w: number, h: number) {
  if (!sharedRT) {
    sharedRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  } else if (sharedRT.width !== w || sharedRT.height !== h) sharedRT.setSize(w, h);
  return sharedRT;
}
const _clear = new THREE.Color();

/**
 * A procedural, raymarched creature. Place it in a group; the group's transform places/scales it (UNIFORM scale only).
 * Local frame: +x forward, +y up, feet on y = 0.
 */
export const Creature = forwardRef<CreatureHandle, CreatureProps>(function Creature(props, ref) {
  const { rig = 'quadruped' } = props;
  const material = useMemo(() => createCreatureMaterial(), []);
  const composite = useMemo(() => createCompositeMaterial(material), [material]);
  const dpr = useThree((st) => st.viewport.dpr);
  const res = props.resolution ?? 'auto';
  const scale = res === 'auto' ? Math.min(1, 1.25 / dpr) : Math.min(1, Math.max(0.4, res));
  const lowRes = scale < 0.97;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const ps = useMemo(() => new PrimSet(), []);
  const mesh = useRef<THREE.Mesh>(null);
  const preset = props.preset ?? (rig === 'biped' ? 'sapiens' : 'rat');
  const P = useMemo(
    () => (rig === 'biped' ? bipedParams(preset as BipedPresetName, props.params as Partial<BipedParams>) : quadParams(preset as QuadPresetName, props.params as Partial<QuadParams>)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rig, preset, props.params],
  );
  const handle = useMemo<CreatureHandle>(() => ({ state: newRigState(), material, look: { ...DEFAULT_LOOK }, palette: { ...DEFAULT_PALETTE }, override: {} }), [material]);
  useMemo(() => {
    Object.assign(handle.palette, DEFAULT_PALETTE, P.palette, props.palette);
    Object.assign(handle.look, DEFAULT_LOOK, P.look, props.look);
  }, [handle, P, props.palette, props.look]);
  useImperativeHandle(ref, () => handle, [handle]);

  const cfg = useRef({ props, P, handle, ps });
  cfg.current = { props, P, handle, ps };

  useEffect(() => {
    const m = mesh.current!;
    const auto = { init: false, px: 0, py: 0, pz: 0, phase: 0, walk: 0, stamp: -1, frame: 0, lookYaw: 0, lookPitch: 0 };
    m.onBeforeRender = (renderer, _scene, camera) => {
      const { props: pr, P: Q, handle: h, ps: set } = cfg.current;
      // camera-dependent uniforms are cheap: always refresh
      const u = material.uniforms;
      renderer.getDrawingBufferSize(_v2);
      u.uPixAng.value = 2 / ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * Math.max(_v2.y, 1));
      if (auto.stamp === world.time) return; // second pass of the same frame (title layer etc.): reuse
      const dt = Math.min(0.1, Math.max(world.time - auto.stamp, 1e-3));
      auto.stamp = world.time;
      if (++auto.frame % Math.max(1, pr.every ?? 1) !== 0 && auto.init) return;

      const st = h.state;
      const e = m.matrixWorld.elements;
      const sc = Math.hypot(e[0], e[1], e[2]) || 1;
      const stride = (Q as QuadParams).stride ?? (Q as BipedParams).gait.stride;
      const px = e[12], py = e[13], pz = e[14];
      let dist = 0;
      if (auto.init) {
        // signed distance moved along the creature's forward axis, in creature units
        dist = ((px - auto.px) * e[0] + (py - auto.py) * e[1] + (pz - auto.pz) * e[2]) / (sc * sc);
        if (Math.abs(dist) > stride * 0.8) dist = 0; // teleport / big scrub jump
      }
      auto.px = px; auto.py = py; auto.pz = pz; auto.init = true;
      const cadence = pr.cadence ?? 1;
      auto.phase += (dist / stride) * cadence;
      const targetWalk = Math.min(1, (Math.abs(dist) / dt) / (stride * 0.9));
      auto.walk += (Math.min(1, targetWalk * 1.6) - auto.walk) * Math.min(1, dt * 6);
      st.phase = h.override.phase ?? pr.phase ?? auto.phase;
      st.walk = h.override.walk ?? pr.walk ?? auto.walk;
      st.time = world.reduced ? 0 : world.time;

      // head tracking
      let yaw = 0, pitch = 0;
      if (pr.lookAt) {
        _inv.copy(m.matrixWorld).invert();
        _v.copy(pr.lookAt).applyMatrix4(_inv);
        const dx = _v.x - st.headX, dy = _v.y - st.headY, dz = _v.z - st.headZ;
        yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(dz, Math.max(dx, 0.05))));
        pitch = Math.max(-0.6, Math.min(0.7, Math.atan2(dy, Math.hypot(dx, dz))));
      }
      const k = Math.min(1, dt * 7);
      auto.lookYaw += (yaw - auto.lookYaw) * k; auto.lookPitch += (pitch - auto.lookPitch) * k;
      const sy = st.headYaw, sp = st.headPitch;
      st.headYaw += auto.lookYaw; st.headPitch += auto.lookPitch;
      if (rig === 'biped') solveBiped(set, Q as BipedParams, st); else solveQuad(set, Q as QuadParams, st);
      st.headYaw = sy; st.headPitch = sp;

      uploadPrims(material, set);
      if (import.meta.env.DEV) { const w = window as unknown as Record<string, number | undefined>; u.uSteps.value = w.__sdfSteps ?? 44; u.uDbg.value = w.__sdfDbg ?? 0; }
      if (import.meta.env.DEV && (window as unknown as Record<string, unknown>).__creaturesOff) { u.uN.value = 0; u.uNW.value = 0; } // dev: A/B the GPU cost
      applyPalette(material, h.palette);
      applyLook(material, h.look);
      pr.onBeforeDraw?.(h);
      // onBeforeDraw may tweak look; re-apply cheap scalar fields
      applyLook(material, h.look);
    };
    // low-res mode: the SDF is drawn into a shared buffer right before this mesh is blitted
    const m0 = m.onBeforeRender;
    m.onBeforeRender = (renderer, scene, camera, geometry, mat, group) => {
      m0(renderer, scene, camera, geometry, mat, group);
      if (mat !== composite) return;
      const sc = scaleRef.current;
      renderer.getDrawingBufferSize(_v2);
      const w = Math.max(2, Math.round(_v2.x * sc)), h = Math.max(2, Math.round(_v2.y * sc));
      const rt = getRT(w, h);
      composite.uniforms.uRes.value.set(_v2.x, _v2.y);
      composite.uniforms.tColor.value = rt.texture; composite.uniforms.tDepth.value = rt.depthTexture;
      // SDF material sees this smaller buffer: pixel angle grows
      material.uniforms.uPixAng.value = 2 / ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * h);
      rtMesh.material = material;
      rtMesh.matrix.copy(m.matrixWorld); rtMesh.matrixWorld.copy(m.matrixWorld);
      const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(_clear);
      renderer.setRenderTarget(rt); renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
      renderer.render(rtScene, camera);
      renderer.setRenderTarget(prevRT); renderer.autoClear = prevAuto; renderer.setClearColor(_clear, prevAlpha);
    };
    return () => { m.onBeforeRender = () => {}; };
  }, [material, composite, rig]);

  useEffect(() => () => { material.dispose(); composite.dispose(); }, [material, composite]);

  return <mesh ref={mesh} geometry={BOX} material={lowRes ? composite : material} frustumCulled={false} renderOrder={2} />;
});

export { QUAD_PRESETS, BIPED_PRESETS };
