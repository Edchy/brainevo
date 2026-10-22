import { useRef, useState } from 'react';
import { palette, pick, useCanvas } from './kit';
import { Reveal } from './Reveal';

/**
 * Breakthrough 5, speaking. Only the visitor sees a small picture. With five words from a word bank they describe it,
 * and "another mind" that never saw it paints what it hears. A picture crosses from one head to another through words.
 */
const COLORS = { red: '#c4513f', blue: '#4f7fc8', gold: '#d8b46a', green: '#5f9a63' } as const;
type Color = keyof typeof COLORS;
const THINGS = ['bird', 'fish', 'boat', 'tree', 'house', 'moon'] as const;
type Thing = (typeof THINGS)[number];
const RELS = ['on', 'under', 'beside'] as const;
type Rel = (typeof RELS)[number];
interface Scene { c1: Color; a: Thing; rel: Rel; c2: Color; b: Thing }

function randomScene(): Scene {
  const cs = Object.keys(COLORS) as Color[];
  const a = pick(THINGS);
  let b = pick(THINGS);
  while (b === a) b = pick(THINGS);
  let c2 = pick(cs);
  const c1 = pick(cs);
  while (c2 === c1) c2 = pick(cs);
  return { c1, a, rel: pick(RELS), c2, b };
}

function drawThing(g: CanvasRenderingContext2D, t: Thing, x: number, y: number, s: number, col: string) {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.06; g.lineJoin = 'round';
  g.beginPath();
  switch (t) {
    case 'bird': g.ellipse(x, y, s * 0.32, s * 0.2, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + s * 0.3, y - s * 0.04); g.lineTo(x + s * 0.48, y); g.lineTo(x + s * 0.3, y + s * 0.05); g.fill(); g.beginPath(); g.moveTo(x - s * 0.1, y - s * 0.05); g.lineTo(x - s * 0.02, y - s * 0.4); g.lineTo(x + s * 0.12, y - s * 0.06); g.fill(); break;
    case 'fish': g.ellipse(x, y, s * 0.36, s * 0.18, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - s * 0.3, y); g.lineTo(x - s * 0.52, y - s * 0.17); g.lineTo(x - s * 0.52, y + s * 0.17); g.fill(); break;
    case 'boat': g.moveTo(x - s * 0.45, y); g.lineTo(x + s * 0.45, y); g.lineTo(x + s * 0.3, y + s * 0.2); g.lineTo(x - s * 0.3, y + s * 0.2); g.fill(); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 0.5); g.lineTo(x + s * 0.3, y - s * 0.08); g.fill(); break;
    case 'tree': g.fillRect(x - s * 0.06, y - s * 0.05, s * 0.12, s * 0.3); g.beginPath(); g.arc(x, y - s * 0.22, s * 0.28, 0, 7); g.fill(); break;
    case 'house': g.fillRect(x - s * 0.3, y - s * 0.12, s * 0.6, s * 0.38); g.beginPath(); g.moveTo(x - s * 0.38, y - s * 0.1); g.lineTo(x, y - s * 0.44); g.lineTo(x + s * 0.38, y - s * 0.1); g.fill(); break;
    case 'moon': g.arc(x, y, s * 0.3, Math.PI * 0.35, Math.PI * 1.65); g.arc(x + s * 0.14, y, s * 0.25, Math.PI * 1.6, Math.PI * 0.4, true); g.fill(); break;
  }
}

function drawScene(g: CanvasRenderingContext2D, sc: Partial<Scene>, cx: number, cy: number, s: number) {
  const off = sc.rel === 'on' ? [0, -s * 0.62] : sc.rel === 'under' ? [0, s * 0.62] : [s * 0.85, 0];
  const bx = cx - (sc.rel === 'beside' ? s * 0.42 : 0), by = cy + (sc.rel === 'on' ? s * 0.25 : sc.rel === 'under' ? -s * 0.25 : 0);
  if (sc.b) drawThing(g, sc.b, bx, by, s, sc.c2 ? COLORS[sc.c2] : '#8a8a8a');
  if (sc.a) drawThing(g, sc.a, bx + off[0], by + off[1], s, sc.c1 ? COLORS[sc.c1] : '#8a8a8a');
}

const SLOTS = ['c1', 'a', 'rel', 'c2', 'b'] as const;
const BANKS: Record<(typeof SLOTS)[number], readonly string[]> = { c1: Object.keys(COLORS), a: THINGS, rel: RELS, c2: Object.keys(COLORS), b: THINGS };
const PREFIX: Record<(typeof SLOTS)[number], string> = { c1: 'a', a: '', rel: '', c2: 'a', b: '' };

export default function Speak() {
  const [secret, setSecret] = useState<Scene>(randomScene);
  const [words, setWords] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const pal = useRef(palette());
  const heard: Partial<Scene> = Object.fromEntries(words.map((w, i) => [SLOTS[i], w]));

  const ref = useCanvas((g, w, h) => {
    const P = pal.current;
    g.clearRect(0, 0, w, h);
    const half = w / 2, s = Math.min(half, h) * 0.34;
    g.strokeStyle = P.line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(half, h * 0.08); g.lineTo(half, h * 0.92); g.stroke();
    g.fillStyle = P.dim; g.font = `italic ${Math.round(Math.max(12, h * 0.045))}px "EB Garamond", serif`; g.textAlign = 'center';
    g.fillText('only you can see this', half / 2, h * 0.1);
    g.fillText('another mind, hearing your words', half * 1.5, h * 0.1);
    drawScene(g, secret, half / 2, h * 0.56, s);
    if (sent) drawScene(g, heard, half * 1.5, h * 0.56, s);
    else { g.fillStyle = 'rgba(239,230,212,0.25)'; g.font = `${Math.round(s * 0.5)}px "Cormorant Garamond", serif`; g.fillText('?', half * 1.5, h * 0.6); }
  });

  const slot = SLOTS[words.length];
  const matches = sent ? SLOTS.filter((k) => heard[k] === secret[k]).length : 0;
  const sentence = words.map((w, i) => [PREFIX[SLOTS[i]], w].filter(Boolean).join(' ')).join(' ');

  return (
    <>
      <p className="play-prompt">Describe the picture on the left in five words, so that a mind which has never seen it can paint it.</p>
      <canvas ref={ref} className="play-stage" aria-label={`A picture only you can see: a ${secret.c1} ${secret.a} ${secret.rel} a ${secret.c2} ${secret.b}`} />
      {!sent ? (
        <div className="play-words">
          <p className="play-sentence" aria-live="polite">{sentence || <span className="play-hint">Your words appear here</span>}</p>
          {slot && (
            <div className="play-bank">
              {BANKS[slot].map((wd) => <button key={wd} type="button" className="btn-text" onClick={() => setWords([...words, wd])}>{wd}</button>)}
            </div>
          )}
          <div className="play-controls">
            <button type="button" className="btn-text" disabled={!words.length} onClick={() => setWords(words.slice(0, -1))}>Undo</button>
            <button type="button" className="btn-begin" disabled={words.length < SLOTS.length} onClick={() => setSent(true)}>Say it</button>
          </div>
        </div>
      ) : (
        <Reveal
          lead={matches === 5 ? 'A perfect copy, painted from five words.' : `${matches} of 5 details made it across.`}
          again={() => { setSecret(randomScene()); setWords([]); setSent(false); }}
          sources={[{ label: 'Bennett (2023). A Brief History of Intelligence (the five breakthroughs framework)', url: 'https://www.medlink.com/news/new-books-in-neuroscience-max-bennett-a-brief-history-of-intelligence-evolution-ai-and-the-five-breakthroughs-that-made-our-brains-mariner-books-2023' }]}
        >
          The other mind never saw your picture. It rebuilt it from a few sounds you chose, because you share a language. Moving a picture from one brain into another is what language does, and it is how every idea in this story was passed on. That is speaking, the fifth breakthrough.
        </Reveal>
      )}
    </>
  );
}
