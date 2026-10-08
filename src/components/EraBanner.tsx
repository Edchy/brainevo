import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Era } from '../types';
import { ERA_META, ERA_ORDER } from '../lib/eras';

function EraBanner({ era, x }: { era: Era; x: number }) {
  const m = ERA_META[era];
  const n = ERA_ORDER.indexOf(era) + 1;
  return (
    <section className="banner" style={{ left: `calc(var(--intro-w) + ${x}px)`, '--accent': m.accent } as CSSProperties} aria-label={`Era: ${m.name}`}>
      <p className="banner-kicker">Chapter {n} · {ERA_ORDER.length}</p>
      <h2 className="banner-title">{m.name}</h2>
      <p className="banner-tag">{m.tagline}</p>
    </section>
  );
}
export default memo(EraBanner);
