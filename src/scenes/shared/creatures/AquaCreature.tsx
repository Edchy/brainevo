import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { world } from '../../../world/store';
import {
  AquaSet, DEFAULT_AQUA_LOOK, DEFAULT_AQUA_PALETTE, applyAquaLook, applyAquaPalette, aquaPreset, createAquaMaterial, createCompositeMaterial,
  newAquaState, solveAqua, uploadAqua,
} from './aquatic';
import type { AquaKind, AquaLook, AquaMaterial, AquaPalette, AquaParams, AquaState } from './aquatic';

export interface AquaHandle {
  /** live rig controls: mutate from the scene's useFrame (phase, beat, sig, morph, land...) */
  state: AquaState;
  material: AquaMaterial;
  look: AquaLook;
  palette: AquaPalette;
  /** numeric rig knobs (len, girth, ...) - mutable */
  k: AquaParams;
  /** nerve-net impulse origin (model space) + front radius (-1 = off) for jelly 'net' surfaces */
  netO: THREE.Vector4;
}

export interface AquaProps {
  kind: AquaKind;
  /** override rig knobs (see AQUA_PRESETS[kind].k) */
  params?: AquaParams;
  palette?: Partial<AquaPalette>;
  look?: Partial<AquaLook>;
  /** automatic phase speed in cycles per second (0 = scene drives state.phase) */
  cadence?: number;
  /** render resolution factor (0.4..1) or 'auto' (native up to dpr 1.25, then drawn small and blitted with depth) */
  resolution?: number | 'auto';
  /** called right before drawing, after the rig has not yet been solved: set state/look/palette here to avoid frame lag */
  onBeforeDraw?: (h: AquaHandle) => void;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _v2 = new THREE.Vector2();
const _clear = new THREE.Color();
let sharedRT: THREE.WebGLRenderTarget | null = null;
const rtScene = new THREE.Scene();
const rtMesh = new THREE.Mesh(BOX);
rtMesh.frustumCulled = false; rtMesh.matrixAutoUpdate = false;
rtScene.add(rtMesh); rtScene.matrixWorldAutoUpdate = false;
function getRT(w: number, h: number) {
  if (!sharedRT) {
    sharedRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  } else if (sharedRT.width !== w || sharedRT.height !== h) sharedRT.setSize(w, h);
  return sharedRT;
}

/**
 * Procedural raymarched aquatic creature. Local frame: +x forward (head), +y up, z lateral. UNIFORM scale on the parent only.
 * Drive it with the handle: `h.state.phase += dt * f` (swim / pulse / gait cycles), `h.state.sig` (impulse along the body), etc.
 */
export const AquaCreature = forwardRef<AquaHandle, AquaProps>(function AquaCreature(props, ref) {
  const { kind } = props;
  const material = useMemo(() => createAquaMaterial(), []);
  const composite = useMemo(() => createCompositeMaterial(material), [material]);
  const dpr = useThree((s) => s.viewport.dpr);
  const res = props.resolution ?? 'auto';
  const scale = res === 'auto' ? Math.min(1, 1.25 / dpr) : Math.min(1, Math.max(0.4, res));
  const lowRes = scale < 0.97;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const ps = useMemo(() => new AquaSet(), []);
  const mesh = useRef<THREE.Mesh>(null);
  const handle = useMemo<AquaHandle>(() => ({
    state: newAquaState(), material, look: { ...DEFAULT_AQUA_LOOK }, palette: { ...DEFAULT_AQUA_PALETTE }, k: {}, netO: new THREE.Vector4(0, 1, 0, -1),
  }), [material]);
  useMemo(() => {
    const P = aquaPreset(kind, { palette: props.palette, look: props.look, k: props.params });
    Object.assign(handle.palette, P.palette); Object.assign(handle.look, P.look);
    for (const key of Object.keys(handle.k)) delete handle.k[key];
    Object.assign(handle.k, P.k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, kind, props.params, props.palette, props.look]);
  useImperativeHandle(ref, () => handle, [handle]);
  const cfg = useRef({ props, handle, ps, kind });
  cfg.current = { props, handle, ps, kind };

  useEffect(() => {
    const m = mesh.current!;
    const auto = { stamp: -1, init: false };
    const pre = (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
      const { props: pr, handle: h, ps: set, kind: kd } = cfg.current;
      const u = material.uniforms;
      renderer.getDrawingBufferSize(_v2);
      u.uPixAng.value = 2 / ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * Math.max(_v2.y, 1));
      if (auto.stamp === world.time && auto.init) return; // second pass of the same frame (title layer etc.)
      const dt = auto.init ? Math.min(0.1, Math.max(world.time - auto.stamp, 0)) : 0;
      auto.stamp = world.time; auto.init = true;
      const st = h.state;
      st.time = world.reduced ? 0 : world.time;
      if (pr.cadence) st.phase += dt * pr.cadence * (world.reduced ? 0 : 1);
      pr.onBeforeDraw?.(h);
      solveAqua(kd, set, h.k, st);
      if (import.meta.env.DEV) { const w = window as unknown as Record<string, unknown>; (w.__aqs ??= {} as Record<string, unknown>); (w.__aqs as Record<string, unknown>)[kd] = { h, set }; }
      uploadAqua(material, set);
      u.uTime.value = st.time; u.uSig.value = st.sig;
      (u.uNetO.value as THREE.Vector4).copy(h.netO);
      if (import.meta.env.DEV) { const w = window as unknown as Record<string, number | undefined>; u.uSteps.value = w.__sdfSteps ?? 46; if ((window as unknown as Record<string, unknown>).__creaturesOff) { u.uN.value = 0; u.uNF.value = 0; } }
      applyAquaPalette(material, h.palette);
      applyAquaLook(material, h.look);
    };
    m.onBeforeRender = (renderer, scene, camera, geometry, mat, group) => {
      pre(renderer, camera);
      if (mat !== composite) return;
      void scene; void geometry; void group;
      const sc = scaleRef.current;
      renderer.getDrawingBufferSize(_v2);
      const w = Math.max(2, Math.round(_v2.x * sc)), hh = Math.max(2, Math.round(_v2.y * sc));
      const rt = getRT(w, hh);
      composite.uniforms.uRes.value.set(_v2.x, _v2.y);
      composite.uniforms.tColor.value = rt.texture; composite.uniforms.tDepth.value = rt.depthTexture;
      material.uniforms.uPixAng.value = 2 / ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * hh);
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
  }, [material, composite]);
  useEffect(() => () => { material.dispose(); composite.dispose(); }, [material, composite]);

  return <mesh ref={mesh} geometry={BOX} material={lowRes ? composite : material} frustumCulled={false} renderOrder={2} />;
});
