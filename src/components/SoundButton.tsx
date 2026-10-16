import { useSyncExternalStore } from 'react';
import { setSetting, useSettings } from '../style/store';
import { isRunning, onAudioChange, unlock } from '../audio/engine';

/** One switch for all sound. The click doubles as the gesture browsers require before audio may start. */
export default function SoundButton() {
  const { sound } = useSettings();
  const running = useSyncExternalStore(onAudioChange, isRunning);
  const waiting = sound && !running; // switched on in a past visit; the next click or key press resumes it
  const toggle = () => {
    setSetting('sound', !sound);
    if (!sound) unlock();
  };
  return (
    <button
      type="button"
      className="sound-btn"
      aria-pressed={sound}
      aria-label={sound ? 'Sound on. Switch sound off' : 'Sound off. Switch sound on'}
      title={waiting ? 'Sound resumes on your next click or key press' : sound ? 'Sound on' : 'Sound off'}
      onClick={toggle}
    >
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 7.6h2.6L10 4.4v11.2l-3.9-3.2H3.5z" fill="currentColor" stroke="none" />
        {sound ? (
          <>
            <path d="M12.6 7.4a3.6 3.6 0 0 1 0 5.2" opacity={waiting ? 0.45 : 1} />
            <path d="M14.8 5.2a6.7 6.7 0 0 1 0 9.6" opacity={waiting ? 0.45 : 1} />
          </>
        ) : (
          <path d="M13 7.6l4 4.8M17 7.6l-4 4.8" />
        )}
      </svg>
    </button>
  );
}
