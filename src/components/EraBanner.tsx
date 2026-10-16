import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { Era } from '../types';
import { ERA_META, ERA_ORDER } from '../lib/eras';

function EraBanner({ era, x }: { era: Era; x: number }) {
  const m = ERA_META[era];
  const n = ERA_ORDER.indexOf(era) + 1;
  return (
    <section className="banner" style={{ left: `calc(var(--intro-w) + ${x}px)` } as CSSProperties} aria-label={`Era: ${m.name}`}>
      <h2 className="banner-title">{m.name}</h2>
      <p className="banner-tag">Chapter {n} of {ERA_ORDER.length}. {m.tagline}</p>
    </section>
  );
}
export default memo(EraBanner);
