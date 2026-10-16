import type { Layout } from '../lib/layout';
import { fmtYearsAgo } from '../lib/format';

interface Props {
  layout: Layout;
  progress: number;
  xToFrac: (x: number) => number;
  years: number;
  eraName: string;
  onJump: (frac: number) => void;
}

/** Minimal interface: a hairline time axis with only the years readout and era name. Navigation lives in the Menu. */
export default function Axis({ layout, progress, xToFrac, years, eraName, onJump }: Props) {
  return (
    <footer className="axis">
      <p className="ax-read">
        <strong>{fmtYearsAgo(years)}</strong>
        <span>{eraName}</span>
      </p>
      <div
        className="ax-line"
        aria-hidden="true"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onJump((e.clientX - r.left) / r.width); }}
      >
        <i className="ax-fill" style={{ width: `${progress * 100}%` }} />
        {layout.banners.map((b, i) => (
          <i key={`${b.era}-${i}`} className="ax-tick" style={{ left: `${(i === 0 ? 0 : xToFrac(b.x - 260)) * 100}%` }} />
        ))}
        <i className="ax-head" style={{ left: `${progress * 100}%` }} />
      </div>
    </footer>
  );
}
