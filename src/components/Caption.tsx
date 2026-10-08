import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TimelineEvent } from '../types';
import { BREAKTHROUGH_BY_ID } from '../lib/breakthroughs';
import { ERA_META } from '../lib/eras';
import AudioSlot from './AudioSlot';
import DeepContent from './Deep';

interface Props { event: TimelineEvent | null; opacity: number }

/** Fixed caption for the event at the focus point (minimal + HUD interfaces). 'More' opens the deeper content as a modal sheet. */
export default function Caption({ event, opacity }: Props) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<TimelineEvent | null>(null);
  const bt = event?.breakthrough ? BREAKTHROUGH_BY_ID[event.breakthrough] : undefined;
  const m = event ? ERA_META[event.era] : null;
  const shown = open ?? event;
  const sm = shown ? ERA_META[shown.era] : null;
  return (
    <>
      {event && m && (
        <section
          className="caption"
          aria-label="Current event"
          style={{ '--accent': m.accent, opacity, transform: `translateY(${(1 - opacity) * 10}px)`, visibility: opacity < 0.02 ? 'hidden' : 'visible' } as CSSProperties}
        >
          <p className="kicker">
            <time className="year" data-depth-title>{event.yearLabel}</time>
            {bt && <span className="kicker-bt" style={{ '--bt': bt.accent } as CSSProperties}>{bt.number} · {bt.name}</span>}
          </p>
          <h2 className="ev-title">{event.title}</h2>
          <p className="summary">{event.summary}</p>
          <div className="card-actions">
            <AudioSlot event={event} />
            <button type="button" className="btn-more" aria-haspopup="dialog" onClick={() => { setOpen(event); sheet.current?.showModal(); }}>
              More
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" /></svg>
            </button>
          </div>
        </section>
      )}
      <dialog
        ref={sheet}
        className="sheet"
        aria-labelledby="sheet-title"
        style={{ '--accent': sm?.accent } as CSSProperties}
        onClose={() => setOpen(null)}
        onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}
      >
        {open && (
          <>
            <p className="kicker"><time className="year">{open.yearLabel}</time><span className="kicker-era">{sm?.name}</span></p>
            <h2 id="sheet-title">{open.title}</h2>
            <p className="summary">{open.summary}</p>
            <DeepContent event={open} />
            <button type="button" className="btn-quiet sheet-close" onClick={() => sheet.current?.close()} autoFocus>Close</button>
          </>
        )}
      </dialog>
    </>
  );
}
