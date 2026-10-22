import type { TimelineEvent } from '../types';
import { answerTest, closeMirror, restartTest, useMirror } from '../lib/mirror';

/** stations that can show the visitor's reflection */
export const MIRROR_EVENTS = ['mirror-self-recognition', 'now', 'coda-here'];

/** the caption's button: open the mirror (camera) or close it */
export function MirrorButton({ event }: { event: TimelineEvent }) {
  const m = useMirror();
  if (event.id !== 'mirror-self-recognition' && event.id !== 'now') return null;
  // opening is the invitation's job (src/components/Invite.tsx); the caption only offers the way out
  const on = m.wanted && (m.status === 'on' || m.status === 'asking');
  if (!on) return null;
  const label = 'Close the mirror';
  return (
    <button type="button" className="btn-text mirror-btn" onClick={closeMirror} aria-pressed={on}>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><ellipse cx="8" cy="7" rx="4.6" ry="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 12.6v2.2M5.6 15h4.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
      {label}
    </button>
  );
}

const FACTS = 'Chimpanzees, orangutans, dolphins, elephants and magpies have passed this test; most animals never do. Human children usually pass between about 18 months and two years.';

/** the mirror test's words beside the mirror, and the line at "Now" */
export default function MirrorPanel({ event }: { event: TimelineEvent | null }) {
  const m = useMirror();
  if (!event || m.status !== 'on') return null;
  if (event.id === 'now') {
    return (
      <p className="mirror-panel" role="status" aria-live="polite">
        {m.tracking === 'on' && m.face
          ? <>Behind your eyes, right now: 86 billion neurons, running on about 20 watts. The whole story led here.</>
          : m.tracking === 'failed' ? <>Here you are: the latest page of a 13.8-billion-year story.</> : <>Look into the mirror.</>}
      </p>
    );
  }
  if (event.id !== 'mirror-self-recognition') return null;
  const lost = m.tracking === 'on' && !m.face && (m.phase === 'find' || m.phase === 'mark' || m.phase === 'hint');
  let body: React.ReactNode;
  switch (m.phase) {
    case 'loading': body = 'Getting the mirror ready…'; break;
    case 'find': body = m.tracking === 'failed' ? 'Line your face up with the oval.' : 'Look into the mirror.'; break;
    case 'mark': body = <><strong>Something has changed.</strong> Can you find it?</>; break;
    case 'hint': body = <><strong>Something has changed.</strong> Look closely at your forehead.</>; break;
    case 'ask':
      body = (
        <>
          A red mark is on your forehead. To touch it, would you reach for…
          <span className="mirror-choices">
            <button type="button" className="btn-begin" onClick={() => answerTest('forehead')}>my own forehead</button>
            <button type="button" className="btn-begin" onClick={() => answerTest('mirror')}>the mirror</button>
          </span>
        </>
      );
      break;
    case 'touched':
      body = <><strong>You touched your own forehead, not the mirror.</strong> You know that face is you: you just passed the mirror test. {FACTS}</>;
      break;
    case 'answered':
      body = m.answer === 'forehead'
        ? <><strong>Your own forehead: you know that face is you.</strong> That is the mirror test. {FACTS}</>
        : <><strong>The mirror? That is what most animals do:</strong> they treat the reflection as someone else. You know better, which is exactly what the test looks for. {FACTS}</>;
      break;
  }
  const done = m.phase === 'touched' || m.phase === 'answered';
  return (
    <div className="mirror-panel" role="status" aria-live="polite" data-phase={m.phase}>
      <p>{lost ? 'Look into the mirror: your face has left it.' : body}</p>
      {done && <button type="button" className="btn-text mirror-again" onClick={restartTest}>Try it again</button>}
      <span className="mirror-private">
        {m.tracking === 'on' ? 'Your face and hands are tracked on this device; the image never leaves it.' : 'Your camera image stays on this device.'}
      </span>
    </div>
  );
}
