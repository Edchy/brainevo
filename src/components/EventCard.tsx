import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { TimelineEvent } from '../types';
import { BREAKTHROUGH_BY_ID } from '../lib/breakthroughs';
import { ERA_META } from '../lib/eras';
import AudioSlot from './AudioSlot';
import DeepContent from './Deep';

interface Props { event: TimelineEvent; x: number; active: boolean }

/** Track card, used by the `tidy` interface. Minimal and HUD use the fixed Caption instead. */
function EventCard({ event, x, active }: Props) {
  const m = ERA_META[event.era];
  const bt = event.breakthrough ? BREAKTHROUGH_BY_ID[event.breakthrough] : undefined;
  const hid = `h-${event.id}`;
  return (
    <article
      className={`station${active ? ' is-active' : ''}`}
      style={{ left: `calc(var(--intro-w) + ${x}px)`, '--accent': m.accent } as CSSProperties}
      aria-labelledby={hid}
      aria-current={active ? 'true' : undefined}
      tabIndex={0}
      data-event-id={event.id}
    >
      <div className="card">
        <p className="kicker">
          <time className="year" data-depth-title>{event.yearLabel}</time>
          {bt && <span className="kicker-bt" style={{ '--bt': bt.accent } as CSSProperties}>{bt.number} · {bt.name}</span>}
        </p>
        <h2 id={hid} className="ev-title">{event.title}</h2>
        <p className="summary">{event.summary}</p>
        <div className="card-actions">
          <AudioSlot event={event} />
        </div>
        <details className="deep">
          <summary>More</summary>
          <DeepContent event={event} />
        </details>
      </div>
    </article>
  );
}

export default memo(EventCard);
