import type { TimelineEvent } from '../types';
import { openMirror, useMirror } from '../lib/mirror';

/**
 * An invitation: the one unmistakable way the piece asks the visitor to do something (open the mirror here; give your
 * age and try the breakthroughs elsewhere share its look). A large gilt card in the picture, not a small link in the
 * caption, that starts to breathe once the event has settled, and that the narration names too.
 */
const INVITES: Record<string, { title: string; sub: string }> = {
  'mirror-self-recognition': { title: 'Take the mirror test yourself', sub: 'Uses your camera. Nothing leaves your device.' },
  now: { title: 'Look into the mirror', sub: 'Meet the brain this whole story led to.' },
};

export function MirrorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <ellipse cx="8" cy="7" rx="4.6" ry="5.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 12.6v2.2M5.6 15h4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Invite({ event, opacity }: { event: TimelineEvent | null; opacity: number }) {
  const m = useMirror();
  const inv = event ? INVITES[event.id] : undefined;
  if (!event || !inv) return null;
  const open = m.wanted && (m.status === 'on' || m.status === 'asking');
  if (open || m.status === 'unsupported') return null;
  return (
    <div className="invite" style={{ opacity, visibility: opacity < 0.05 ? 'hidden' : 'visible' }} key={event.id}>
      <button type="button" className="invite-card" onClick={openMirror}>
        <span className="invite-icon"><MirrorIcon size={26} /></span>
        <span className="invite-title">{inv.title}</span>
        <span className="invite-sub">{m.status === 'denied' ? 'The camera is blocked in this browser: allow it in the address bar, then try again.' : inv.sub}</span>
      </button>
    </div>
  );
}
