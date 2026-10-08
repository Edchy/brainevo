import { memo } from 'react';

interface Props { top: string; bottom: string; scroll: number; reduced: boolean; accent: string; darkness: number }

function Background({ top, bottom, scroll, reduced, accent, darkness }: Props) {
  const s = reduced ? 0 : scroll;
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-grad" style={{ background: `radial-gradient(120% 70% at 70% 105%, ${bottom}, transparent 70%), linear-gradient(180deg, ${top}, ${bottom})` }} />
      <div className="bg-stars bg-stars-far" style={{ transform: `translate3d(${-(s * 0.08) % 700}px,0,0)`, opacity: 0.35 + darkness * 0.5 }} />
      <div className="bg-stars bg-stars-near" style={{ transform: `translate3d(${-(s * 0.22) % 900}px,0,0)`, opacity: 0.2 + darkness * 0.5 }} />
      <div className="bg-hills" style={{ transform: `translate3d(${-(s * 0.35) % 1200}px,0,0)`, color: accent }} />
      <div className="bg-vignette" />
    </div>
  );
}
export default memo(Background);
