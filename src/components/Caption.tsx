import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TimelineEvent } from '../types';
import { events } from '../data';
import { fmtWhen } from '../lib/format';
import { canNarrate, toggleNarration, useNarration } from '../audio/narration';
import { useSettings } from '../style/store';
import { titleState } from '../style/titles/state';
import DeepContent from './Deep';

interface Props { event: TimelineEvent | null; opacity: number }

function Narrate({ event }: { event: TimelineEvent }) {
  const n = useNarration();
  if (!canNarrate(event)) return null;
  const mine = n.id === event.id;
  const playing = mine && n.playing;
  const label = playing ? 'Pause' : mine && n.progress > 0.02 && n.progress < 0.98 ? 'Resume' : 'Listen';
  return (
    <button
      type="button"
      className="btn-text narrate"
      data-state={playing ? 'playing' : 'idle'}
      style={{ '--p': mine ? n.progress : 0 } as CSSProperties}
      onClick={() => toggleNarration(event)}
      aria-label={`${label} narration: ${event.title}`}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        {playing ? <path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" /> : <path d="M5 2.8v10.4L13 8z" fill="currentColor" />}
      </svg>
      {label}
      <i className="np" aria-hidden="true" />
    </button>
  );
}

/**
 * Invisible copies of every caption. Their heights tell the depth-title layer where each headline must sit so it rests
 * on its own caption (headline set "with the text"). Re-measured on resize, font load and layout changes.
 */
const CaptionMeasure = memo(function CaptionMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const { text } = useSettings();
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      titleState.capHeights = Array.from(el.children, (c) => (c as HTMLElement).offsetHeight);
      titleState.version++;
    };
    measure();
    document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    window.addEventListener('resize', measure);
    return () => { document.fonts.removeEventListener('loadingdone', measure); window.removeEventListener('resize', measure); };
  }, [text]);
  return (
    <div ref={ref} aria-hidden="true">
      {events.map((ev) => (
        <div key={ev.id} className="caption caption-measure">
          <p className="summary"><span className="when">{fmtWhen(ev.yearLabel)}</span>{ev.summary}</p>
          <div className="cap-actions"><span className="btn-text">Listen</span><span className="btn-text">Read more</span></div>
        </div>
      ))}
    </div>
  );
});

/** The reading block for the event at the focus point. The headline itself is painted into the scene (depth titles). */
export default function Caption({ event, opacity }: Props) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<TimelineEvent | null>(null);
  return (
    <>
      <CaptionMeasure />
      {event && (
        <section
          className="caption"
          aria-label="Current event"
          style={{ opacity, transform: `translateY(${(1 - opacity) * 8}px)`, visibility: opacity < 0.02 ? 'hidden' : 'visible' } as CSSProperties}
        >
          <h2 className="ev-title">{event.title}</h2>
          <p className="summary"><span className="when">{fmtWhen(event.yearLabel)}</span>{event.summary}</p>
          <div className="cap-actions">
            <Narrate event={event} />
            <button type="button" className="btn-text" aria-haspopup="dialog" onClick={() => { setOpen(event); sheet.current?.showModal(); }}>
              Read more
            </button>
          </div>
        </section>
      )}
      <dialog
        ref={sheet}
        className="sheet"
        aria-labelledby="sheet-title"
        onClose={() => setOpen(null)}
        onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}
      >
        {open && (
          <>
            <h2 id="sheet-title">{open.title}</h2>
            <p className="sheet-when">{fmtWhen(open.yearLabel)}</p>
            <p className="summary">{open.summary}</p>
            <DeepContent event={open} />
            <button type="button" className="btn-quiet sheet-close" onClick={() => sheet.current?.close()} autoFocus>Close</button>
          </>
        )}
      </dialog>
    </>
  );
}
