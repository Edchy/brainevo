import type { ReactNode } from 'react';
import { openPlay, type Src } from './kit';

/** what just happened in the visitor's head, and where the science comes from */
export function Reveal({ lead, children, sources, again }: { lead: string; children: ReactNode; sources: Src[]; again?: () => void }) {
  return (
    <div className="play-reveal" role="status" aria-live="polite">
      <p><strong>{lead}</strong> {children}</p>
      <ul className="play-sources">
        {sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
      </ul>
      <div className="play-controls">
        {again && <button type="button" className="btn-text" onClick={again}>Try again</button>}
        <button type="button" className="btn-begin" onClick={() => openPlay(null)} autoFocus>Back to the story</button>
      </div>
    </div>
  );
}
