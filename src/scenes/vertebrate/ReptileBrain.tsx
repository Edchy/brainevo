import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { Plankton, TM, Backdrop, makeTubeMat } from './shared';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const BOX: [number, number, number] = [18, 12, 8];

// Monochrome diagram with a single colour splash: the parts are neutral tissue and grey leader lines, and only the
// brainstem "reptile core" carries colour, so the eye goes to the one idea the frame is about.
const NEUTRAL = '#c9d2da';
const CORE = '#ff8a3c';
const LAYERS = [
  { name: 'pallium', color: NEUTRAL, y: 0.62, rx: 1.3, rz: 0.8, glow: 0.6 },
  { name: 'basal ganglia', color: NEUTRAL, y: 0.22, rx: 1.3, rz: 1.0, glow: 0.7 },
  { name: 'tectum', color: NEUTRAL, y: -0.08, rx: 1.3, rz: 1.1, glow: 0.7 },
  { name: 'cerebellum', color: NEUTRAL, y: -0.5, rx: 1.3, rz: 1.0, glow: 0.7 },
  { name: 'brainstem', color: CORE, y: -1.3, rx: 1.3, rz: 1.15, glow: 1.2 },
];

/** the reptile brain as an exploded, layered diagram in space; the brainstem "reptile core" glows through the stack */
export default function ReptileBrain() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const brain = useBrainCtl({ grow: stageGrow('reptile'), tissue: '#d9d2cd' });
  const regs = useMemo(() => [
    { at: 'brainstem' as const, color: CORE, i: 0 },
    { at: 'pallium' as const, color: NEUTRAL, i: 0 },
    { at: 'tectum' as const, color: NEUTRAL, i: 0 },
    { at: 'cerebellum' as const, color: NEUTRAL, i: 0 },
  ], []);
  brain.regions = regs;
  const S = useMemo(() => {
    const lines = LAYERS.map((l) => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(l.rx * 0.95, l.y, 0), new THREE.Vector3(3.9, l.y, 0)), 2, 0.012, 4, false));
    const lineMats = LAYERS.map((l) => makeTubeMat(l.color, { base: 0.9, count: 1 }));
    const dotG = new THREE.SphereGeometry(0.07, 12, 10);
    return { lines, lineMats, dotG };
  }, []);
  useEffect(() => () => { S.lines.forEach((g) => g.dispose()); S.lineMats.forEach((m) => m.dispose()); S.dotG.dispose(); }, [S]);
  const p26 = eventPos('reptile-brain-plan');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = TM(), n = near(p26, 0.8);
    const ex = smoothstep(0.08, 0.6, t);
    brain.alpha = w; brain.explode = ex * 0.72; brain.tint = 0;
    brain.glass = 0.0;
    const core = 0.45 + 0.25 * Math.sin(tm * 2.2) + n * 0.9;
    regs[0].i = smoothstep(0.15, 0.45, t) * core;
    // the other parts only breathe faintly, in white light
    regs[1].i = ex * 0.18 * (0.65 + 0.35 * Math.sin(tm * 1.3)); regs[2].i = ex * 0.2 * (0.65 + 0.35 * Math.sin(tm * 1.7 + 1)); regs[3].i = ex * 0.2 * (0.65 + 0.35 * Math.sin(tm * 1.1 + 2));
    LAYERS.forEach((_, i) => {
      S.lineMats[i].uniforms.uOpacity.value = w * smoothstep(0.55, 0.8, t); S.lineMats[i].uniforms.uGrow.value = smoothstep(0.55, 0.8, t); S.lineMats[i].uniforms.uPulseAmt.value = 0;
    });
    if (grp.current) grp.current.rotation.y = -0.5 + t * 1.1;
  });
  return (
    <group>
      <Backdrop top="#0a1a22" bottom="#03050b" ray={0.15} rays={false} />
      <Plankton count={500} box={BOX} color="#9fe8c8" size={0.035} flow={1.5} center={[0, 0, -2]} />
      <group ref={grp} position={[0, -0.25, 0]} scale={1.0}>
        <Brain ctl={brain} position={[-1.0, -0.1, 0]} scale={1.35} />
        {LAYERS.map((l, i) => <mesh key={'l' + l.name} geometry={S.lines[i]} material={S.lineMats[i]} frustumCulled={false} />)}
        {LAYERS.map((l, i) => <mesh key={'d' + l.name} geometry={S.dotG} material={S.lineMats[i]} position={[3.9, l.y, 0]} />)}
      </group>
    </group>
  );
}
