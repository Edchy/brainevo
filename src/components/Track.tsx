import { memo } from 'react';
import type { Layout } from '../lib/layout';
import EventCard from './EventCard';
import EraBanner from './EraBanner';
import BreakthroughMarker from './BreakthroughMarker';
import Ruler from './Ruler';

interface Props { layout: Layout; activeIndex: number; cards: boolean; onBegin: () => void; onRestart: () => void }

function Track({ layout, activeIndex, cards, onBegin, onRestart }: Props) {
  return (
    <div className="track" style={{ width: `calc(var(--intro-w) + ${layout.total}px)` }}>
      <section className="intro" aria-labelledby="intro-title">
        <div className="intro-top">
          <p className="intro-kicker">13.8 billion years in one scroll</p>
          <h1 id="intro-title">Evolution of the Brain</h1>
        </div>
        <div className="intro-bottom">
          <p className="intro-sub">From the silence before the first star to a mind that can study itself.</p>
          <button type="button" className="btn-begin" onClick={onBegin}>Begin the journey</button>
          <p className="intro-hint" aria-hidden="true">
            <span className="hint-arrow">→</span> Scroll, drag, swipe or press the arrow keys
          </p>
        </div>
      </section>
      {layout.banners.map((b) => <EraBanner key={b.era + b.x} era={b.era} x={b.x} />)}
      {layout.markers.map((m) => <BreakthroughMarker key={m.breakthrough} id={m.breakthrough} x={m.x} />)}
      {cards && layout.stations.map((s) => (
        <EventCard key={s.event.id} event={s.event} x={s.x} active={s.index === activeIndex} />
      ))}
      <section className="outro" style={{ left: `calc(var(--intro-w) + ${layout.endX - 200}px)` }} aria-labelledby="outro-title">
        <h2 id="outro-title">You are here</h2>
        <p>Every brain that has ever wondered about its own origins is the latest page of this story.</p>
        <button type="button" className="btn-begin" onClick={onRestart}>Return to the beginning</button>
      </section>
      {cards && <Ruler layout={layout} />}
    </div>
  );
}
export default memo(Track);
