interface Props { progress: number; accent: string }

const OUTLINE =
  'M50 8 C38 2 22 6 16 18 C6 22 4 36 10 44 C6 54 14 66 26 66 C32 74 44 74 50 68 C56 74 68 74 74 66 C86 66 94 54 90 44 C96 36 94 22 84 18 C78 6 62 2 50 8 Z';
const FOLDS = [
  { d: 'M50 8 V68', at: 0.25 },
  { d: 'M22 24 C30 20 36 28 30 34', at: 0.45 },
  { d: 'M78 24 C70 20 64 28 70 34', at: 0.45 },
  { d: 'M16 46 C26 40 34 50 28 58', at: 0.62 },
  { d: 'M84 46 C74 40 66 50 72 58', at: 0.62 },
  { d: 'M36 40 C42 34 46 44 42 52', at: 0.78 },
  { d: 'M64 40 C58 34 54 44 58 52', at: 0.78 },
  { d: 'M30 62 C38 58 44 64 48 62', at: 0.9 },
  { d: 'M70 62 C62 58 56 64 52 62', at: 0.9 },
];

/** Dot -> ring -> brain, driven by scroll progress (0..1). */
export default function BrainGlyph({ progress, accent }: Props) {
  const p = Math.min(1, Math.max(0, progress));
  const draw = Math.min(1, Math.max(0, (p - 0.04) / 0.5));
  const dotR = 1.6 + Math.min(p / 0.06, 1) * 1.4;
  return (
    <svg className="glyph" viewBox="0 0 100 80" aria-hidden="true" focusable="false" style={{ color: accent }}>
      <circle cx="50" cy="40" r={dotR} fill="currentColor" opacity={p < 0.04 ? 0.9 : Math.max(0, 1 - draw * 1.6)} />
      <path
        d={OUTLINE}
        pathLength={1}
        fill="currentColor"
        fillOpacity={0.14 * draw}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeDasharray="1"
        strokeDashoffset={1 - draw}
        opacity={draw > 0 ? 1 : 0}
      />
      {FOLDS.map((f) => (
        <path
          key={f.d}
          d={f.d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={Math.min(1, Math.max(0, (p - f.at) / 0.08)) * 0.85}
        />
      ))}
    </svg>
  );
}
