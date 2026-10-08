import { memo } from 'react';
import { yearsToX, type Layout } from '../lib/layout';
import { tickLabel } from '../lib/format';

const POWERS = [1e10, 1e9, 1e8, 1e7, 1e6, 1e5, 1e4, 1e3, 100, 10, 0];

/** Axis along the bottom of the track. Event dots are evenly roomy; decade ticks reveal the compression. */
function Ruler({ layout }: { layout: Layout }) {
  const ticks = POWERS.map((y) => ({ y, x: y === 0 ? layout.stations.at(-1)?.x ?? null : yearsToX(layout, y) })).filter(
    (t): t is { y: number; x: number } => t.x != null,
  );
  return (
    <div className="ruler" aria-hidden="true">
      <div className="ruler-line" style={{ width: `calc(var(--intro-w) + ${layout.total}px)` }} />
      {layout.stations.map((s) => (
        <span key={s.event.id} className="ruler-dot" style={{ left: `calc(var(--intro-w) + ${s.x}px)` }} />
      ))}
      {ticks.map((t) => (
        <span key={t.y} className="ruler-tick" style={{ left: `calc(var(--intro-w) + ${t.x}px)` }}>
          <i />
          <b>{tickLabel(t.y)}</b>
        </span>
      ))}
      <span className="ruler-note" style={{ left: `calc(var(--intro-w) + 40px)` }}>
        Time is compressed: ticks mark powers of ten, so equal distances do not mean equal time.
      </span>
    </div>
  );
}
export default memo(Ruler);
