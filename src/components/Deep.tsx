import type { TimelineEvent } from '../types';

const MODERN_CC = 1350;
const MAX_CC = 1600;

export function BrainVolume({ cc }: { cc: number }) {
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

/** The deeper content of an event, shown in the Read more sheet. */
export default function DeepContent({ event }: { event: TimelineEvent }) {
  return (
    <div className="deep-body">
      <h3>For the brain</h3>
      <p className="significance">{event.brainSignificance}</p>
      {event.details && <p className="detail">{event.details}</p>}
      {event.brainVolumeCc != null && <BrainVolume cc={event.brainVolumeCc} />}
      {event.tags && event.tags.length > 0 && <p className="tags">{event.tags.join(' · ')}</p>}
      {event.sources && event.sources.length > 0 && (
        <>
          <h3>Sources</h3>
          <ul className="sources">
            {event.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
