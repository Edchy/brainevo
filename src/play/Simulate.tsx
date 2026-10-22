import { useRef, useState } from 'react';
import { palette, useCanvas } from './kit';
import { Reveal } from './Reveal';

/**
 * Breakthrough 3, simulating. A rat at a fork. Behind one bend there is food, behind the other a cat. You cannot see
 * round either corner, but you can imagine: send a ghost of yourself down a path first and watch what it meets, then
 * choose. (Real rats do this: at a fork, the hippocampus plays each path out ahead of the animal.)
 */
type Side = 'left' | 'right';
interface Run { side: Side; ghost: boolean; t0: number }

// the maze in a 100 x 100 box: up the stem, then out along each arm and round its bend
const PATH: Record<Side, [number, number][]> = {
  left: [[50, 92], [50, 52], [22, 40], [16, 14]],
  right: [[50, 92], [50, 52], [78, 40], [84, 14]],
};
function along(pts: [number, number][], u: number): [number, number] {
  const seg = pts.length - 1, f = Math.min(0.9999, Math.max(0, u)) * seg, i = Math.floor(f), k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

export default function Simulate() {
  const [food] = useState<Side>(() => (Math.random() < 0.5 ? 'left' : 'right'));
  const [imagined, setImagined] = useState<Side[]>([]);
  const [chosen, setChosen] = useState<Side | null>(null);
  const [outcome, setOutcome] = useState<'food' | 'cat' | null>(null);
  const run = useRef<Run | null>(null);
  const pal = useRef(palette());

  const go = (side: Side, ghost: boolean) => {
    if (run.current && performance.now() / 1000 - run.current.t0 < 2.4) return;
    run.current = { side, ghost, t0: performance.now() / 1000 };
    // the ghost sees what waits only when it gets there
    if (ghost) setTimeout(() => setImagined((xs) => (xs.includes(side) ? xs : [...xs, side])), 1900);
    else { setChosen(side); setTimeout(() => setOutcome(side === food ? 'food' : 'cat'), 2300); }
  };

  const ref = useCanvas((g, w, h, _dt, t) => {
    const P = pal.current;
    const k = Math.min(w, h) / 100, ox = (w - 100 * k) / 2, oy = (h - 100 * k) / 2;
    const X = (p: [number, number]): [number, number] => [ox + p[0] * k, oy + p[1] * k];
    g.clearRect(0, 0, w, h);
    // corridors
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const side of ['left', 'right'] as Side[]) {
      g.strokeStyle = 'rgba(239,230,212,0.09)'; g.lineWidth = 11 * k; g.beginPath(); PATH[side].forEach((p, i) => { const q = X(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
      g.strokeStyle = P.line; g.lineWidth = 1; g.stroke();
    }
    // what waits round each bend: hidden until imagined (faint) or reached (clear)
    for (const side of ['left', 'right'] as Side[]) {
      const end = X(PATH[side][3]);
      const seen = chosen === side && outcome ? 1 : imagined.includes(side) ? 0.45 : 0;
      if (seen <= 0) continue;
      const isFood = side === food;
      g.globalAlpha = seen;
      g.fillStyle = isFood ? P.gilt : '#c96a5a';
      g.font = `600 ${Math.round(6 * k)}px "Cormorant Garamond", serif`; g.textAlign = 'center';
      g.fillText(isFood ? 'food' : 'cat', end[0], end[1] - 4 * k);
      g.beginPath(); g.arc(end[0], end[1] + 2 * k, (isFood ? 2.6 : 3.4) * k, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    // the rat, or the ghost it sends ahead in imagination
    const r = run.current;
    let pos = X(PATH.left[0]);
    if (r && !r.ghost) pos = X(along(PATH[r.side], Math.min(1, (t - r.t0) / 2.2)));
    if (r && r.ghost) {
      const gp = X(along(PATH[r.side], Math.min(1, (t - r.t0) / 1.9)));
      const fade = Math.max(0, 1 - Math.max(0, t - r.t0 - 2.2) * 0.8);
      const gr = g.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], 7 * k);
      gr.addColorStop(0, `rgba(170,200,255,${0.65 * fade})`); gr.addColorStop(1, 'rgba(170,200,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(gp[0], gp[1], 7 * k, 0, 7); g.fill();
    }
    g.fillStyle = P.ink; g.beginPath(); g.ellipse(pos[0], pos[1], 2.2 * k, 3 * k, 0, 0, 7); g.fill();
    g.fillStyle = P.dim; g.font = `italic ${Math.round(4.2 * k)}px "EB Garamond", serif`; g.textAlign = 'center';
    g.fillText('you', X(PATH.left[0])[0], X(PATH.left[0])[1] + 6.5 * k);
  });

  return (
    <>
      <p className="play-prompt">You are a rat at a fork. Food is round one bend, a cat round the other, and you cannot see either. Before you move, imagine: send a ghost of yourself down a path and watch what it meets.</p>
      <canvas ref={ref} className="play-stage" aria-label="A maze with a fork; the ends of both paths are hidden" />
      {!outcome ? (
        <div className="play-controls">
          <button type="button" className="btn-text" disabled={!!chosen} onClick={() => go('left', true)}>Imagine left</button>
          <button type="button" className="btn-text" disabled={!!chosen} onClick={() => go('right', true)}>Imagine right</button>
          <span className="play-hint">then</span>
          <button type="button" className="btn-begin" disabled={!!chosen} onClick={() => go('left', false)}>Go left</button>
          <button type="button" className="btn-begin" disabled={!!chosen} onClick={() => go('right', false)}>Go right</button>
        </div>
      ) : (
        <Reveal
          lead={outcome === 'food' ? (imagined.length ? 'Food, and you knew before you moved.' : 'Food, but that was luck.') : (imagined.length ? 'The cat: you imagined, then ignored it.' : 'The cat. Imagining first would have shown you.')}
          sources={[{ label: 'Johnson & Redish (2007). Neural ensembles in CA3 transiently encode paths forward of the animal at a decision point. Journal of Neuroscience', url: 'https://doi.org/10.1523/jneurosci.3761-07.2007' }]}
        >
          When a rat pauses at a fork, cells in its hippocampus fire in sequence down one path ahead of it, then down the other, as if it were trying each in its head. Running a move in imagination, where mistakes are free, is simulating, the third breakthrough.
        </Reveal>
      )}
    </>
  );
}
