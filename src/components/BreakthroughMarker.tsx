import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Breakthrough } from '../types';
import { BREAKTHROUGH_BY_ID, BREAKTHROUGH_COUNT } from '../lib/breakthroughs';

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
    </section>
  );
}
export default memo(BreakthroughMarker);
