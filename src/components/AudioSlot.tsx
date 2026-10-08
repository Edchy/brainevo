import { useEffect, useRef, useState } from 'react';
import type { TimelineEvent } from '../types';

type State = 'idle' | 'playing' | 'failed';

export default function AudioSlot({ event }: { event: TimelineEvent }) {
  const [state, setState] = useState<State>('idle');
  const ref = useRef<HTMLAudioElement | null>(null);
  const audio = event.audio;

  useEffect(() => () => { ref.current?.pause(); }, []);

  const toggle = () => {
    if (state === 'failed') return;
    if (state === 'playing') {
      ref.current?.pause();
      setState('idle');
      return;
    }
    if (!audio) { setState('failed'); return; }
    if (!ref.current) {
      const a = new Audio();
      a.preload = 'none';
      a.addEventListener('error', () => setState('failed'));
      a.addEventListener('ended', () => setState('idle'));
      a.src = audio.src;
      ref.current = a;
    }
    ref.current.play().then(() => setState('playing')).catch(() => setState('failed'));
  };

  return (
    <div className="audio">
      <button
        type="button"
        className="btn-play"
        onClick={toggle}
        disabled={state === 'failed'}
        aria-label={state === 'playing' ? `Pause narration: ${event.title}` : `Play narration: ${event.title}`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          {state === 'playing' ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}
        </svg>
      </button>
      <span className="audio-label" role="status">
        {state === 'failed' ? 'Narration coming soon' : state === 'playing' ? 'Playing' : 'Listen'}
      </span>
    </div>
  );
}
