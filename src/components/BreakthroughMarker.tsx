import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Breakthrough } from '../types';
import { BREAKTHROUGH_BY_ID, BREAKTHROUGH_COUNT } from '../lib/breakthroughs';
import { openPlay } from '../play/kit';

function BreakthroughMarker({ id, x }: { id: Breakthrough; x: number }) {
  const b = BREAKTHROUGH_BY_ID[id];
  return (
    <section
      className="bt-marker"
      style={{ left: `calc(var(--intro-w) + ${x}px)` } as CSSProperties}
      aria-label={`Breakthrough ${b.number} of ${BREAKTHROUGH_COUNT}: ${b.name}`}
    >
      <h2 className="bt-title">{b.name}</h2>
      <p className="bt-date">Breakthrough {b.number} of {BREAKTHROUGH_COUNT}, {b.date}</p>
      <button type="button" className="bt-play" onClick={() => openPlay(id)}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 3l8 5-8 5z" fill="currentColor" /></svg>
        Try it yourself
      </button>
    </section>
  );
}
export default memo(BreakthroughMarker);
