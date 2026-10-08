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

/** The deeper content of an event: shared by the tidy card's expander and the overlay sheet. */
export default function DeepContent({ event }: { event: TimelineEvent }) {
  return (
    <div className="deep-body">
      <p className="significance">{event.brainSignificance}</p>
      {event.details && <p className="detail">{event.details}</p>}
      {event.brainVolumeCc != null && <BrainVolume cc={event.brainVolumeCc} />}
      {event.audio?.transcript && (
        <details className="transcript">
          <summary>Narration transcript</summary>
          <p>{event.audio.transcript}</p>
        </details>
      )}
      {event.tags && event.tags.length > 0 && (
        <ul className="tags" aria-label="Key terms">
          {event.tags.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}
