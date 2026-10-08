import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Layout } from '../lib/layout';
import { ERA_META } from '../lib/eras';
import { BREAKTHROUGHS } from '../lib/breakthroughs';
import { ABOUT_KEYS } from './AboutDialog';

interface Props { layout: Layout; onGo: (trackX: number) => void }

/** The one small menu button of the minimal interface: chapters, breakthroughs, every event, and About. */
export default function Menu({ layout, onGo }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const go = (x: number) => { ref.current?.close(); onGo(x); };
  return (
    <>
      <button type="button" className="menu-btn" onClick={() => ref.current?.showModal()} aria-haspopup="dialog" aria-label="Menu: chapters, breakthroughs and events">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
      <dialog ref={ref} className="menu" aria-labelledby="menu-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <header className="menu-head">
          <h2 id="menu-title">Evolution of the Brain</h2>
          <button type="button" className="btn-quiet" onClick={() => ref.current?.close()} autoFocus>Close</button>
        </header>
        <div className="menu-scroll">
          <h3>Chapters</h3>
          <ol className="menu-list">
            {layout.banners.map((b, i) => (
              <li key={b.era + i}>
                <button type="button" style={{ '--accent': ERA_META[b.era].accent } as CSSProperties} onClick={() => go(b.x)}>
                  <span className="mi-n">{i + 1}</span>{ERA_META[b.era].name}
                </button>
              </li>
            ))}
          </ol>
          <h3>Five breakthroughs</h3>
          <ol className="menu-list">
            {layout.markers.map((mk) => {
              const b = BREAKTHROUGHS.find((x) => x.id === mk.breakthrough)!;
              return (
                <li key={b.id}>
                  <button type="button" style={{ '--accent': b.accent } as CSSProperties} onClick={() => go(mk.x)}>
                    <span className="mi-n">{b.number}</span>{b.name}
                  </button>
                </li>
              );
            })}
          </ol>
          <details className="menu-fold">
            <summary>All {layout.stations.length} events</summary>
            <ul className="menu-list menu-events">
              {layout.stations.map((s) => (
                <li key={s.event.id}>
                  <button type="button" style={{ '--accent': ERA_META[s.event.era].accent } as CSSProperties} onClick={() => go(s.x)}>
                    <span className="mi-y">{s.event.yearLabel}</span>{s.event.title}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          <details className="menu-fold">
            <summary>About</summary>
            <p>
              Organised around the five &ldquo;breakthroughs&rdquo; framework from Max Bennett&rsquo;s <em>A Brief History of Intelligence</em> (2023).
              Any mistakes in the retelling are ours, not his. Images and narration are placeholders.
            </p>
            <p>{ABOUT_KEYS}</p>
          </details>
        </div>
      </dialog>
    </>
  );
}
