import { useState } from 'react';
import type { TimelineEvent } from '../types';
import { ERA_META } from '../lib/eras';

export function Placeholder({ event }: { event: TimelineEvent }) {
  const m = ERA_META[event.era];
  const gid = `g-${event.id}`;
  const initial = event.title.trim().charAt(0).toUpperCase();
  return (
    <svg className="ph" viewBox="0 0 320 180" role="img" aria-label={`Illustration placeholder for ${event.title}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.top} />
          <stop offset="1" stopColor={m.bottom} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gid})`} />
      <circle cx="250" cy="40" r="90" fill={m.accent} opacity="0.12" />
      <circle cx="60" cy="170" r="70" fill={m.accent} opacity="0.1" />
      <path d="M0 140 Q80 110 160 135 T320 120 V180 H0Z" fill={m.accent} opacity="0.12" />
      <text x="160" y="112" textAnchor="middle" fontSize="92" fontWeight="700" fill={m.accent} opacity="0.9" fontFamily="Georgia, serif">
        {initial}
      </text>
    </svg>
  );
}

export default function ImageSlot({ event }: { event: TimelineEvent }) {
  const [failed, setFailed] = useState(false);
  const img = event.image;
  return (
    <figure className="figure">
      {img && !failed ? (
        <img src={img.src} alt={img.alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <Placeholder event={event} />
      )}
      {img?.credit && !failed && <figcaption>{img.credit}</figcaption>}
    </figure>
  );
}
