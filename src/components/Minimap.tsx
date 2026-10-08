import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Layout } from '../lib/layout';
import { ERA_META } from '../lib/eras';
import { fmtYearsAgo } from '../lib/format';
import { BREAKTHROUGH_BY_ID, BREAKTHROUGH_COUNT } from '../lib/breakthroughs';
import AboutDialog from './AboutDialog';
import BrainGlyph from './BrainGlyph';

interface Props {
  variant: 'hud' | 'tidy';
  layout: Layout;
  progress: number;
  xToFrac: (x: number) => number;
  years: number;
  accent: string;
  eraName: string;
  onJump: (frac: number) => void;
}

/** `hud`: slim era bar with names + years. `tidy`: the fuller minimap (glyph, era bar, breakthrough strip), quieter. */
export default function Minimap({ variant, layout, progress, xToFrac, years, accent, eraName, onJump }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const segs = layout.banners.map((b, i) => {
    const start = i === 0 ? 0 : xToFrac(b.x - 260);
    const next = layout.banners[i + 1];
    return { era: b.era, start, end: next ? xToFrac(next.x - 260) : 1 };
  });
  const bts = layout.markers.map((m, i) => {
    const start = xToFrac(m.x - 220);
    const next = layout.markers[i + 1];
    return { id: m.breakthrough, start, end: next ? xToFrac(next.x - 220) : 1 };
  });
  const jump = (e: React.MouseEvent, start: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || e.detail === 0) return onJump(start);
    onJump((e.clientX - r.left) / r.width);
  };
  const tidy = variant === 'tidy';
  return (
    <footer className="minimap" style={{ '--accent': accent } as CSSProperties}>
      {tidy && <BrainGlyph progress={progress} accent={accent} />}
      <div className="mm-main">
        <div className="mm-read">
          <strong className="mm-years" aria-live="off">{fmtYearsAgo(years)}</strong>
          <span className="mm-era">{eraName}</span>
          <AboutDialog />
        </div>
        <div className="mm-bar" ref={bar}>
          {segs.map((s, i) => (
            <button
              key={`${s.era}-${i}`}
              type="button"
              className="mm-seg"
              style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%`, '--seg': ERA_META[s.era].bottom, '--segc': ERA_META[s.era].accent } as CSSProperties}
              aria-label={`Jump to ${ERA_META[s.era].name}`}
              title={ERA_META[s.era].name}
              onClick={(e) => jump(e, s.start)}
            >
              <span>{ERA_META[s.era].name}</span>
            </button>
          ))}
          <div className="mm-head" style={{ left: `${progress * 100}%` }} />
        </div>
        {tidy && bts.length > 0 && (
          <div className="mm-bts" role="group" aria-label="Five breakthroughs">
            {bts.map((b) => {
              const m = BREAKTHROUGH_BY_ID[b.id];
              return (
                <button
                  key={b.id}
                  type="button"
                  className="mm-bt"
                  style={{ left: `${b.start * 100}%`, width: `${(b.end - b.start) * 100}%`, '--bt': m.accent } as CSSProperties}
                  aria-label={`Jump to breakthrough ${m.number} of ${BREAKTHROUGH_COUNT}: ${m.name}`}
                  title={`${m.number}. ${m.name}`}
                  onClick={() => onJump(b.start)}
                >
                  <span>{m.number}. {m.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </footer>
  );
}
