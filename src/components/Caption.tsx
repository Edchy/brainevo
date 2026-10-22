import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TimelineEvent } from '../types';
import { events } from '../data';
import { captionParts, fmtWhen } from '../lib/format';
import { canNarrate, toggleNarration, useNarration } from '../audio/narration';
import { CAPTIONS_MEASURED, titleState } from '../style/titles/state';
import DeepContent from './Deep';
import { setAge, useAge } from '../lib/age';
import { MirrorButton } from './MirrorPanel';

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

/** The caption: the narration line, word for word, led by its date in gilt italics. */
function CaptionText({ event }: { event: TimelineEvent }) {
  const c = captionParts(event.summary, event.yearLabel);
  return <p className="summary"><span className={c.lead ? 'when lead' : 'when'}>{c.when}</span>{c.lead ? ' ' : ''}{c.rest}</p>;
}

/** "Four Thousand Weeks": the visitor may give their age so the weeks they have lived fill in (kept in this browser) */
function AgeField() {
  const age = useAge();
  return (
    <label className={`age-field${age == null ? ' age-empty' : ''}`}>
      <span>How old are you?</span>
      <input
        type="number" inputMode="numeric" min={1} max={119} placeholder="age"
        value={age ?? ''}
        onChange={(e) => setAge(e.target.value === '' ? null : Number(e.target.value))}
        aria-describedby="age-note"
      />
      <small id="age-note">Stays on this device</small>
    </label>
  );
}

/** heartbeats since the visitor arrived, at a resting 70 a minute, counting up live */
function Heartbeats() {
  const beats = () => Math.round((performance.now() / 60000) * 70);
  const [n, setN] = useState(beats);
  useEffect(() => { const id = setInterval(() => setN(beats()), 857); return () => clearInterval(id); }, []);
  return <p className="beats" aria-live="off">{n.toLocaleString('en-US')}</p>;
}

/** a closing reflection: one centred line, no headline or date */
function CodaCaption({ event, opacity, onMore }: { event: TimelineEvent; opacity: number; onMore: () => void }) {
  return (
    <section
      className={`caption coda${event.extra ? ` coda-${event.extra}` : ''}`}
      aria-label={event.title}
      style={{ opacity, transform: `translateY(${(1 - opacity) * 8}px)`, visibility: opacity < 0.02 ? 'hidden' : 'visible' } as CSSProperties}
    >
      {event.extra === 'heartbeats' && <Heartbeats />}
      <p className="coda-line">{event.summary}</p>
      <div className="cap-actions">
        <Narrate event={event} />
        <button type="button" className="btn-text" aria-haspopup="dialog" onClick={onMore}>Why</button>
      </div>
    </section>
  );
}

/**
 * Invisible copies of every caption. Their heights tell the depth-title layer where each headline must sit so it rests
 * on its own caption. Re-measured on resize and font load.
 */
const CaptionMeasure = memo(function CaptionMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const h = Array.from(el.children, (c) => (c as HTMLElement).offsetHeight);
      const changed = h.length !== titleState.capHeights.length || h.some((v, i) => v !== titleState.capHeights[i]);
      titleState.capHeights = h;
      titleState.version++;
      if (changed) window.dispatchEvent(new Event(CAPTIONS_MEASURED));
    };
    measure();
    document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    window.addEventListener('resize', measure);
    return () => { document.fonts.removeEventListener('loadingdone', measure); window.removeEventListener('resize', measure); };
  }, []);
  return (
    <div ref={ref} aria-hidden="true">
      {events.map((ev) => (
        <div key={ev.id} className="caption caption-measure">
          <CaptionText event={ev} />
          {ev.extra === 'weeks' && <AgeField />}
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
      {event?.kind === 'coda' && <CodaCaption event={event} opacity={opacity} onMore={() => { setOpen(event); sheet.current?.showModal(); }} />}
      {event && event.kind !== 'coda' && (
        <section
          className="caption"
          aria-label="Current event"
          style={{ opacity, transform: `translateY(${(1 - opacity) * 8}px)`, visibility: opacity < 0.02 ? 'hidden' : 'visible' } as CSSProperties}
        >
          <h2 className="ev-title">{event.title}</h2>
          <CaptionText event={event} />
          {event.extra === 'weeks' && <AgeField />}
          <div className="cap-actions">
            <Narrate event={event} />
            <MirrorButton event={event} />
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
            {open.kind !== 'coda' && <p className="sheet-when">{fmtWhen(open.yearLabel)}</p>}
            <p className="summary">{open.summary}</p>
            <DeepContent event={open} />
            <button type="button" className="btn-quiet sheet-close" onClick={() => sheet.current?.close()} autoFocus>Close</button>
          </>
        )}
      </dialog>
    </>
  );
}
