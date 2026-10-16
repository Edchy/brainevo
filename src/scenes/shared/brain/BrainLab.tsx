import { useFrame } from '@react-three/fiber';
import { Brain } from './Brain';
import { useBrainCtl } from './Brain';
import { STAGE_NAMES, stageGrow } from './params';
import type { StageName } from './params';

/**
 * Dev-only turntable for tuning the brain stages through the real post-processing (oil) pipeline:
 * `?brainlab=fish` (or tube | reptile | mammal | primate | hominin | human), `&yaw=0.6` fixes the view angle,
 * `&tissue=%23c9b8b0` overrides the tissue colour. Rendered by Stage instead of the timeline.
 */
export default function BrainLab({ stage }: { stage: string }) {
  const q = new URLSearchParams(location.search);
  const name = (STAGE_NAMES as readonly string[]).includes(stage) ? (stage as StageName) : 'fish';
  const brain = useBrainCtl({ grow: stageGrow(name), tissue: q.get('tissue') ?? '#d2c6c1' });
  const yaw = q.has('yaw') ? Number(q.get('yaw')) : null;
  const cut = q.has('cut') ? Number(q.get('cut')) : null;
  useFrame((state) => {
    brain.grow = stageGrow(name);
    if (cut !== null) { brain.cut = 1; brain.cutAxis = 'sagittal'; brain.cutPos = cut; }
    const g = state.scene.getObjectByName('brainlab');
    if (g) g.rotation.y = yaw ?? state.clock.elapsedTime * 0.25;
  });
  return (
    <group name="brainlab" position={[0, 0, 0]}>
      <Brain ctl={brain} scale={name === 'tube' || name === 'fish' || name === 'reptile' ? 1.4 : 1} />
    </group>
  );
}
