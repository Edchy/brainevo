import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';
import { world } from '../../../world/store';
import { axialTube, constellation, cubeSphere } from './geometry';
import { FRAG, NUC_FRAG, NUC_VERT, STAR_FRAG, STAR_VERT, VERT } from './glsl';
import { PART_REGIONS, REGION_DEFS, STAGES, shapeAt } from './params';
import type { BrainRegion, BrainShape } from './params';

export type CutAxis = 'sagittal' | 'axial' | 'coronal';
type PartKey = 'cerebrum' | 'cerebellum' | 'stem' | 'tectum' | 'bulbs';
type Col = THREE.ColorRepresentation;

/**
 * Mutable control object. Create with `useBrainCtl()` (or `newBrainCtl()`), mutate fields every frame from your
 * scene's useFrame, and pass it to <Brain ctl={ctl} />. Nothing here triggers React renders.
 */
export interface BrainCtl {
  /** 0..1 over the stages tube -> fish -> reptile -> mammal -> primate -> hominin -> human (see STAGE_NAMES / stageGrow) */
  grow: number;
  /** extra anatomy overrides applied after `grow` (e.g. { frontal: 1, fold: 0.7 }) */
  shape: Partial<BrainShape> | null;
  /** uniform size multiplier */
  size: number;
  /** overall opacity (dithered, so crossfades stay clean); drive from scene.weight */
  alpha: number;
  /** 0..1 translucent glass shell (shows inner nuclei, rim light) */
  glass: number;
  /** 0..1 hologram line-art look (additive sulcal lines + contours) */
  holo: number;
  /** cutaway: 0 off, 1 on. axis + position (-1..1 across the cerebrum) + flip which half is kept */
  cut: number; cutAxis: CutAxis; cutPos: number; cutFlip: boolean;
  /** 0..1 exploded diagram (parts separate along y) */
  explode: number;
  /** 0..1 colour each anatomical part with its own hue (diagram mode) */
  tint: number;
  /** override the per-part tint colours */
  tintColors: Partial<Record<PartKey, Col>>;
  /** glowing activity regions (max 8 surface regions); mutate `.i` per frame */
  regions: BrainRegion[];
  /** 0..1 shows the internal nuclei (visible through glass / hologram / cut) */
  inner: number;
  /** nucleus glow 0..~2 */
  nuc: { striatum: number; thalamus: number; hippocampus: number; amygdala: number };
  nucColors: Partial<Record<'striatum' | 'thalamus' | 'hippocampus' | 'amygdala', Col>>;
  /** 0..1 constellation draw-in progress (stars + links on the cortex); 0 hides it */
  stars: number;
  starColor: Col;
  /** tissue colour and hologram colour */
  tissue: Col; holoColor: Col;
}

export const newBrainCtl = (init: Partial<BrainCtl> = {}): BrainCtl => ({
  grow: 1, shape: null, size: 1, alpha: 1, glass: 0, holo: 0,
  cut: 0, cutAxis: 'sagittal', cutPos: 0, cutFlip: false, explode: 0, tint: 0, tintColors: {},
  regions: [], inner: 0, nuc: { striatum: 0, thalamus: 0, hippocampus: 0, amygdala: 0 }, nucColors: {},
  stars: 0, starColor: '#cfe3ff', tissue: '#d2c6c1', holoColor: '#9fd0ff',
  ...init,
});
export const useBrainCtl = (init?: Partial<BrainCtl>) => useMemo(() => newBrainCtl(init), []); // eslint-disable-line react-hooks/exhaustive-deps

const PART_TINT: Record<PartKey, string> = { cerebrum: '#6fe08a', cerebellum: '#c06bff', stem: '#ff8a3c', tectum: '#42e8ff', bulbs: '#ffd24a' };
const EXPLODE_Y: Record<PartKey, number> = { cerebrum: 1.55, bulbs: 1.55, tectum: 0.5, cerebellum: -0.65, stem: -1.75 };
const NUC_COL = { striatum: '#4fa8ff', thalamus: '#cdd8ff', hippocampus: '#ff9a3c', amygdala: '#ff4a6a' };

const shapeKeys = Object.keys(STAGES.human) as (keyof BrainShape)[];

function makeShared() {
  const regA = Array.from({ length: 8 }, () => new THREE.Vector4());
  const regB = Array.from({ length: 8 }, () => new THREE.Vector4());
  return {
    uTime: { value: 0 },
    uTube: { value: 0 }, uTilt: { value: 1 }, uStemX: { value: 0 }, uStemY: { value: 0 }, uStemLen: { value: 2 }, uStemR: { value: 0.3 }, uPons: { value: 1 },
    uCer: { value: new THREE.Vector3(2, 1.2, 1.6) }, uCerOff: { value: new THREE.Vector3() },
    uFold: { value: 1 }, uFF: { value: 5 }, uFiss: { value: 0.5 }, uHemi: { value: 0 }, uPrim: { value: 1 }, uTemporal: { value: 1 },
    uFrontal: { value: 0.8 }, uGlob: { value: 1 }, uOcc: { value: 0.7 }, uFlat: { value: 1 },
    uOlfS: { value: 0.2 }, uOlfX: { value: 0 },
    uCbS: { value: 1 }, uCbFolia: { value: 1 }, uCbK: { value: 50 }, uCbAt: { value: 0.22 }, uCb: { value: new THREE.Vector2(-1.2, -0.9) },
    uTecS: { value: 0.2 },
    uOpacity: { value: 1 }, uGlass: { value: 0 }, uHolo: { value: 0 }, uSliceOn: { value: 0 }, uCap: { value: 0.5 },
    uCamObj: { value: new THREE.Vector3() }, uSlice: { value: new THREE.Vector4(0, 0, 1, 0) }, uVP: { value: new THREE.Matrix4() },
    uTissue: { value: new THREE.Color('#d2c6c1') }, uHoloCol: { value: new THREE.Color('#9fd0ff') },
    uRegA: { value: regA }, uRegB: { value: regB }, uRegK: { value: new Array(8).fill(0) as number[] },
  };
}
type Shared = ReturnType<typeof makeShared>;

function makeMat(shared: Shared, part: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      ...shared,
      uPart: { value: part }, uOff: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 }, uPartGlow: { value: new THREE.Color(0, 0, 0) },
    },
  });
}

function makeStarMats(shared: Shared) {
  const u = () => ({
    ...shared,
    uDraw: { value: 0 }, uStarScale: { value: 1 }, uPx: { value: 1 }, uStarCol: { value: new THREE.Color('#cfe3ff') },
  });
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;
  return {
    pts: new THREE.ShaderMaterial({ ...common, uniforms: u(), vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, defines: { POINTS: '' } }),
    lines: new THREE.ShaderMaterial({ ...common, uniforms: u(), vertexShader: STAR_VERT, fragmentShader: STAR_FRAG }),
  };
}

function nucMat() {
  return new THREE.ShaderMaterial({
    vertexShader: NUC_VERT, fragmentShader: NUC_FRAG, transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uColor: { value: new THREE.Color() }, uAmt: { value: 0 }, uOpacity: { value: 0 } },
  });
}

const tubeGeo = (pts: [number, number, number][], r: number) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 48, r, 10, false);

type GroupProps = Omit<ThreeElements['group'], 'children' | 'ref'>;
export interface BrainProps extends GroupProps { ctl: BrainCtl; children?: ReactNode }

const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
const cur = { ...STAGES.human } as BrainShape;

/** The reusable procedural brain. See README.md. */
export function Brain({ ctl, children, ...rest }: BrainProps) {
  const q = world.quality;
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const nucG = useRef<THREE.Group>(null);
  const meshes = useRef<Record<PartKey, THREE.Mesh | null>>({ cerebrum: null, cerebellum: null, stem: null, tectum: null, bulbs: null });
  const starPts = useRef<THREE.Points>(null), starLines = useRef<THREE.LineSegments>(null);

  const R = useMemo(() => {
    const shared = makeShared();
    const parts: Record<PartKey, THREE.ShaderMaterial> = {
      cerebrum: makeMat(shared, 0), cerebellum: makeMat(shared, 1), stem: makeMat(shared, 2), bulbs: makeMat(shared, 3), tectum: makeMat(shared, 4),
    };
    const nuc = { striatum: nucMat(), thalamus: nucMat(), hippocampus: nucMat(), amygdala: nucMat() };
    const geos = {
      cerebrum: cubeSphere(q < 0.6 ? 72 : 150), cerebellum: cubeSphere(q < 0.6 ? 48 : 80), stem: axialTube(q < 0.6 ? 120 : 220, 40),
      small: cubeSphere(28, true),
    };
    const ng = {
      ball: new THREE.SphereGeometry(1, 28, 20),
      hip: tubeGeo([[-0.42, 0.05, 0.3], [-0.46, -0.2, 0.44], [-0.28, -0.42, 0.55], [0.0, -0.52, 0.6], [0.22, -0.55, 0.56], [0.3, -0.5, 0.5]], 0.042),
      cau: tubeGeo([[0.34, 0.16, 0.2], [0.26, 0.31, 0.22], [0.04, 0.36, 0.26], [-0.2, 0.24, 0.3], [-0.3, 0.05, 0.36]], 0.05),
    };
    const stars = constellation(Math.floor(900 * Math.max(0.5, q)), 3);
    return { shared, parts, nuc, geos, ng, stars, starMats: makeStarMats(shared) };
  }, [q]);

  useEffect(() => () => {
    Object.values(R.parts).forEach((m) => m.dispose()); Object.values(R.nuc).forEach((m) => m.dispose());
    Object.values(R.ng).forEach((g) => g.dispose()); R.starMats.pts.dispose(); R.starMats.lines.dispose();
  }, [R]);

  const state = useMemo(() => ({ frame: -1 }), []);

  /** push ctl -> uniforms; called from onBeforeRender so it is always current for this frame */
  const sync = (renderer: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
    const fr = renderer.info.render.frame;
    if (state.frame === fr) return;
    state.frame = fr;
    const sh = R.shared;
    sh.uTime.value = world.reduced ? 0 : world.time;
    shapeAt(ctl.grow, cur);
    if (ctl.shape) for (const k in ctl.shape) (cur as unknown as Record<string, number>)[k] = (ctl.shape as Record<string, number>)[k];
    for (const k of shapeKeys) {
      const u = (sh as unknown as Record<string, { value: number }>)[k === 'ff' ? 'uFF' : 'u' + k.charAt(0).toUpperCase() + k.slice(1)];
      if (u) u.value = cur[k];
    }
    const cs = cur.cerS;
    sh.uCer.value.set(cur.cx * cs, cur.cy * cs, cur.cz * cs);
    sh.uCerOff.value.set(cur.cox, cur.coy, 0);
    sh.uCb.value.set(cur.cbx, cur.cby);
    sh.uOpacity.value = ctl.alpha; sh.uGlass.value = ctl.glass; sh.uHolo.value = ctl.holo;
    sh.uTissue.value.set(ctl.tissue); sh.uHoloCol.value.set(ctl.holoColor).multiplyScalar(1.5);
    const dw = ctl.glass < 0.3 && ctl.holo < 0.3;
    // slice plane in brain space
    sh.uSliceOn.value = ctl.cut > 0.5 ? 1 : 0;
    if (ctl.cut > 0.5) {
      const fl = ctl.cutFlip ? -1 : 1;
      const v = sh.uSlice.value;
      if (ctl.cutAxis === 'sagittal') v.set(0, 0, fl, fl * ctl.cutPos * cur.cz * cs);
      else if (ctl.cutAxis === 'axial') v.set(0, fl, 0, fl * (cur.coy + ctl.cutPos * cur.cy * cs));
      else v.set(fl, 0, 0, fl * (cur.cox + ctl.cutPos * cur.cx * cs));
    }
    // camera in brain-local space + object->clip
    const b = body.current;
    if (b) {
      tmpM.copy(b.matrixWorld).invert();
      sh.uCamObj.value.copy(camera.position).applyMatrix4(tmpM);
      sh.uVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(b.matrixWorld);
    }
    // regions
    const A = sh.uRegA.value, B = sh.uRegB.value, K = sh.uRegK.value;
    for (let i = 0; i < 8; i++) { B[i].set(0, 0, 0, 0); K[i] = 0; }
    const glow: Record<PartKey, THREE.Color> = {} as never;
    for (const p of Object.keys(R.parts) as PartKey[]) { glow[p] = R.parts[p].uniforms.uPartGlow.value as THREE.Color; glow[p].setRGB(0, 0, 0); }
    let ri = 0;
    for (const r of ctl.regions) {
      if (r.i <= 0.001) continue;
      tmpC.set(r.color).multiplyScalar(r.i);
      if (typeof r.at === 'string' && (PART_REGIONS as readonly string[]).includes(r.at)) {
        const key: PartKey = r.at === 'pallium' ? 'cerebrum' : r.at === 'cerebellum' ? 'cerebellum' : r.at === 'brainstem' ? 'stem' : r.at === 'tectum' ? 'tectum' : 'bulbs';
        glow[key].add(tmpC);
        continue;
      }
      if (ri >= 8) continue;
      let dir: [number, number, number], rad: number, kind: number, sym: boolean;
      if (typeof r.at === 'string') { const d = REGION_DEFS[r.at]; dir = d.dir; rad = d.r; kind = d.kind; sym = d.sym; }
      else { dir = r.at; rad = 0.4; kind = r.band ? 1 : 0; sym = !!r.sym; }
      if (r.r) rad = r.r;
      tmpV.set(dir[0], dir[1], sym ? Math.abs(dir[2]) : dir[2]).normalize();
      A[ri].set(tmpV.x, tmpV.y, tmpV.z, rad);
      B[ri].set(tmpC.r, tmpC.g, tmpC.b, 1);
      K[ri] = kind + (sym ? 2 : 0);
      ri++;
    }
    // per-part
    for (const p of Object.keys(R.parts) as PartKey[]) {
      const m = R.parts[p];
      m.depthWrite = dw;
      m.uniforms.uOff.value.set(0, EXPLODE_Y[p] * ctl.explode, 0);
      m.uniforms.uTintAmt.value = ctl.tint;
      (m.uniforms.uTint.value as THREE.Color).set(ctl.tintColors[p] ?? PART_TINT[p]);
    }
    // nuclei
    const ng = nucG.current;
    if (ng) {
      ng.visible = ctl.inner > 0.01;
      ng.position.set(cur.cox, cur.coy, 0);
      ng.scale.set(cur.cx * cs, cur.cy * cs, cur.cz * cs);
      for (const k of Object.keys(R.nuc) as (keyof typeof R.nuc)[]) {
        const u = R.nuc[k].uniforms;
        u.uAmt.value = ctl.nuc[k]; u.uOpacity.value = ctl.inner * ctl.alpha;
        (u.uColor.value as THREE.Color).set(ctl.nucColors[k] ?? NUC_COL[k]);
      }
    }
    // constellation
    const sm = R.starMats;
    for (const m of [sm.pts, sm.lines]) {
      m.uniforms.uDraw.value = ctl.stars; m.uniforms.uOpacity.value = ctl.alpha;
      (m.uniforms.uStarCol.value as THREE.Color).set(ctl.starColor);
      m.uniforms.uPx.value = renderer.getPixelRatio();
    }
    sm.lines.uniforms.uStarCol.value.multiplyScalar(0.55);
    // part visibility
    const mm = meshes.current;
    if (mm.cerebrum) mm.cerebrum.visible = cs > 0.03;
    if (mm.cerebellum) mm.cerebellum.visible = cur.cbS > 0.03;
    if (mm.bulbs) mm.bulbs.visible = cur.olfS > 0.03 && cs > 0.03;
    if (mm.tectum) mm.tectum.visible = cur.tecS > 0.03;
    if (starPts.current) starPts.current.visible = starLines.current!.visible = ctl.stars > 0.001 && cs > 0.03;
    if (body.current) body.current.scale.setScalar(ctl.size);
  };

  const part = (k: PartKey, geo: THREE.BufferGeometry) => (
    <mesh ref={(m) => { meshes.current[k] = m; }} geometry={geo} material={R.parts[k]} frustumCulled={false} onBeforeRender={sync} />
  );

  return (
    <group ref={root} {...rest}>
      <group ref={body}>
        {part('cerebrum', R.geos.cerebrum)}
        {part('cerebellum', R.geos.cerebellum)}
        {part('stem', R.geos.stem)}
        {part('bulbs', R.geos.small)}
        {part('tectum', R.geos.small)}
        <group ref={nucG} visible={false}>
          {[1, -1].map((sd) => (
            <group key={sd} scale={[1, 1, sd]}>
              <mesh geometry={R.ng.hip} material={R.nuc.hippocampus} frustumCulled={false} />
              <mesh geometry={R.ng.cau} material={R.nuc.striatum} frustumCulled={false} />
              <mesh geometry={R.ng.ball} material={R.nuc.striatum} position={[0.2, -0.03, 0.43]} scale={[0.2, 0.17, 0.08]} frustumCulled={false} />
              <mesh geometry={R.ng.ball} material={R.nuc.thalamus} position={[-0.1, 0.0, 0.13]} scale={[0.16, 0.13, 0.11]} frustumCulled={false} />
              <mesh geometry={R.ng.ball} material={R.nuc.amygdala} position={[0.3, -0.48, 0.5]} scale={0.07} frustumCulled={false} />
            </group>
          ))}
        </group>
        <points ref={starPts} geometry={R.stars.stars} material={R.starMats.pts} frustumCulled={false} visible={false} />
        <lineSegments ref={starLines} geometry={R.stars.lines} material={R.starMats.lines} frustumCulled={false} visible={false} />
        {children}
      </group>
    </group>
  );
}

export default Brain;
