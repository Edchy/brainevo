import { memo } from 'react';
import type { Layout } from '../lib/layout';
import EraBanner from './EraBanner';
import BreakthroughMarker from './BreakthroughMarker';

interface Props { layout: Layout; onBegin: (withSound: boolean) => void; onRestart: () => void }

function Track({ layout, onBegin, onRestart }: Props) {
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
          <p className="intro-hint" aria-hidden="true">Scroll, drag, swipe or use the arrow keys</p>
        </div>
      </section>
      {layout.banners.map((b) => <EraBanner key={b.era + b.x} era={b.era} x={b.x} />)}
      {layout.markers.map((m) => <BreakthroughMarker key={m.breakthrough} id={m.breakthrough} x={m.x} />)}
      <section className="outro" style={{ left: `calc(var(--intro-w) + ${layout.endX - 200}px)` }} aria-labelledby="outro-title">
        <h2 id="outro-title">You are here</h2>
        <p>Every brain that has ever wondered about its own origins is the latest page of this story.</p>
        <button type="button" className="btn-begin" onClick={onRestart}>Return to the beginning</button>
      </section>
    </div>
  );
}
export default memo(Track);
