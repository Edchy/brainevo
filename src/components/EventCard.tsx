import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { TimelineEvent } from '../types';
import { ERA_META } from '../lib/eras';
import { BREAKTHROUGH_BY_ID, BREAKTHROUGH_COUNT } from '../lib/breakthroughs';
import AudioSlot from './AudioSlot';

const MODERN_CC = 1350;
const MAX_CC = 1600;

function BrainVolume({ cc }: { cc: number }) {
  return (
    <div className="volume">
      <div className="volume-head">
        <span>Brain volume</span>
        <strong>{cc.toLocaleString('en-US')} cm³</strong>
      </div>
      <div className="volume-bar" role="img" aria-label={`${cc} cubic centimetres, compared with about ${MODERN_CC} for modern humans`}>
        <span className="volume-fill" style={{ width: `${Math.min(100, (cc / MAX_CC) * 100)}%` }} />
        <span className="volume-ref" style={{ left: `${(MODERN_CC / MAX_CC) * 100}%` }} />
      </div>
      <div className="volume-note">Marker: modern human, about {MODERN_CC.toLocaleString('en-US')} cm³</div>
    </div>
  );
}

interface Props { event: TimelineEvent; x: number; active: boolean }

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
        <header className="card-head">
          <time className="year">{event.yearLabel}</time>
          <span className="era-chip">{m.name}</span>
        </header>
        {bt && (
          <p className="bt-chip" style={{ '--bt': bt.accent } as CSSProperties} title={`Breakthrough ${bt.number} of ${BREAKTHROUGH_COUNT}: ${bt.name}`}>
            <b>{bt.number}</b> {bt.name}
          </p>
        )}
        <h2 id={hid}>{event.title}</h2>
        <p className="summary">{event.summary}</p>
        <AudioSlot event={event} />
        <details className="deep">
          <summary>What it meant for the brain</summary>
          <section className="significance">
            <p>{event.brainSignificance}</p>
          </section>
          {event.details && <p className="detail">{event.details}</p>}
          {event.brainVolumeCc != null && <BrainVolume cc={event.brainVolumeCc} />}
          {event.tags && event.tags.length > 0 && (
            <ul className="tags" aria-label="Key terms">
              {event.tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </details>
      </div>
    </article>
  );
}

export default memo(EventCard);
