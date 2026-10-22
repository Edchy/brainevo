import { memo } from 'react';
import type { Layout } from '../lib/layout';
import EraBanner from './EraBanner';
import BreakthroughMarker from './BreakthroughMarker';

interface Props { layout: Layout; onBegin: (withSound: boolean) => void; onWatch: () => void; onRestart: () => void }

function Track({ layout, onBegin, onWatch, onRestart }: Props) {
  return (
    <div className="track" style={{ width: `calc(var(--intro-w) + ${layout.total}px)` }}>
      <section className="intro" aria-labelledby="intro-title">
        <div className="intro-top">
          <h1 id="intro-title">Evolution of the Brain</h1>
          <p className="intro-sub">From the silence before the first star to a mind that can study itself.</p>
        </div>
        <div className="intro-bottom">
          <div className="intro-begin">
            <button type="button" className="btn-begin" onClick={() => onBegin(true)}>Begin with sound</button>
            <button type="button" className="btn-quiet" onClick={() => onBegin(false)}>Begin in silence</button>
          </div>
          <button type="button" className="btn-quiet intro-watch" onClick={onWatch}>Or sit back and watch it as a film</button>
          <p className="intro-hint" aria-hidden="true">Scroll, drag, swipe or use the arrow keys</p>
        </div>
      </section>
      {layout.banners.map((b) => <EraBanner key={b.era + b.x} era={b.era} x={b.x} />)}
      {layout.markers.map((m) => <BreakthroughMarker key={m.breakthrough} id={m.breakthrough} x={m.x} />)}
      {/* the closing reflection has said everything; past it there is only the way back */}
      <section className="outro" style={{ left: `calc(var(--intro-w) + ${layout.endX - 200}px)` }} aria-label="End">
        <button type="button" className="btn-begin" onClick={onRestart}>Return to the beginning</button>
      </section>
    </div>
  );
}
export default memo(Track);
