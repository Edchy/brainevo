import { useEffect, useRef, useState } from 'react';
import { getConversation, startGuide, stopGuide, useGuide } from './session';
import { useMirror } from '../lib/mirror';
import './guide.css';

const LIMIT = 15 * 60; // the agent's own cap (scripts/guide-agent.ts, max_duration_seconds)
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** "Talk": the voice guide's button and its small panel (dev only, rendered by App when import.meta.env.DEV) */
export default function Guide() {
  const g = useGuide();
  const m = useMirror();
  const orb = useRef<HTMLSpanElement>(null);
  const [secs, setSecs] = useState(0);
  const [closed, setClosed] = useState(0); // the error the visitor dismissed (by its time)
  const live = g.status === 'on' || g.status === 'connecting';

  // the button breathes with whoever is speaking
  useEffect(() => {
    if (g.status !== 'on') return;
    let raf = 0;
    const loop = () => {
      const c = getConversation();
      if (c && orb.current) orb.current.style.setProperty('--v', Math.min(1, Math.max(c.getOutputVolume(), c.getInputVolume() * 0.7) * 1.6).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    loop();
    const t = window.setInterval(() => setSecs(Math.floor((performance.now() - g.since) / 1000)), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, [g.status, g.since]);

  const status = g.status === 'connecting' ? 'Connecting…' : g.status === 'error' ? 'Could not start' : g.speaking ? 'Speaking' : 'Listening';
  const hidden = g.status === 'error' && closed === g.since;

  return (
    <>
      <button
        type="button"
        className={`guide-btn${live ? ' live' : ''}${g.speaking ? ' speaking' : ''}`}
        onClick={live ? stopGuide : startGuide}
        aria-pressed={live}
        aria-label={live ? 'End the conversation with the guide' : 'Talk to the guide'}
        title={live ? 'End the conversation' : 'Talk to the guide (private test, uses your ElevenLabs credits)'}
      >
        <span className="guide-orb" ref={orb} aria-hidden="true" />
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <rect x="7" y="2.6" width="6" height="10" rx="3" fill={live ? 'currentColor' : 'none'} />
          <path d="M4.4 9.6a5.6 5.6 0 0 0 11.2 0M10 15.2v2.4" />
        </svg>
      </button>
      {(live || g.status === 'error') && !hidden && (
        // the mirror sits on the right: the panel steps aside rather than cover the visitor's forehead
        <div className={`guide-panel${m.wanted && m.status === 'on' ? ' aside' : ''}`} role="status" aria-live="polite">
          <div className="guide-head">
            <span className={`guide-dot ${g.status}`} aria-hidden="true" />
            <span>{status}</span>
            {g.status === 'on' && <span className="guide-time">{clock(Math.max(0, secs))} / {clock(LIMIT)}</span>}
            {live
              ? <button type="button" className="btn-text" onClick={stopGuide}>End</button>
              : <button type="button" className="btn-text" onClick={() => setClosed(g.since)}>Close</button>}
          </div>
          {g.error && <p className="guide-error">{g.error}</p>}
          {g.lines.slice(-3).map((l, i) => (
            <p key={g.lines.length - 3 + i} className={`guide-line ${l.who}`}>{l.who === 'you' ? <span className="guide-you">You </span> : null}{l.text}</p>
          ))}
          {g.status === 'on' && g.lines.length === 0 && <p className="guide-line hint">Say hello, ask about anything on screen, or ask to go somewhere.</p>}
          <p className="guide-note">Private test on this computer · uses your ElevenLabs credits · headphones keep the music out of the mic</p>
        </div>
      )}
    </>
  );
}
