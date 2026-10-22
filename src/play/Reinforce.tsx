import { useRef, useState } from 'react';
import { palette, useCanvas } from './kit';
import { Reveal } from './Reveal';

/**
 * Breakthrough 2, reinforcing. Two lights; one pays off most of the time, the other rarely, and halfway through they
 * secretly swap. Under them runs a trace of the visitor's own surprise, computed from their choices with the simple
 * learning rule that dopamine neurons appear to follow: prediction error = what happened - what was expected.
 */
const TRIALS = 24, ALPHA = 0.3;

interface Trial { pick: 0 | 1; reward: 0 | 1; delta: number }

export default function Reinforce() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const V = useRef<[number, number]>([0.5, 0.5]);
  const best = useRef<0 | 1>(Math.random() < 0.5 ? 0 : 1);
  const flash = useRef<{ side: number; reward: number; t: number } | null>(null);
  const pal = useRef(palette());

  const choose = (pick: 0 | 1) => {
    if (trials.length >= TRIALS) return;
    const n = trials.length;
    const good = n < TRIALS / 2 ? best.current : (1 - best.current) as 0 | 1; // the secret swap
    const p = pick === good ? 0.8 : 0.2;
    const reward = (Math.random() < p ? 1 : 0) as 0 | 1;
    const delta = reward - V.current[pick];
    V.current[pick] += ALPHA * delta;
    flash.current = { side: pick, reward, t: performance.now() / 1000 };
    setTrials([...trials, { pick, reward, delta }]);
  };

  const ref = useCanvas((g, w, h, _dt, t) => {
    const P = pal.current;
    g.clearRect(0, 0, w, h);
    const top = h * 0.46;
    // the two lights
    for (const side of [0, 1]) {
      const x = w * (side ? 0.68 : 0.32), y = top * 0.55, r = Math.min(w, h) * 0.09;
      const f = flash.current;
      const lit = f && f.side === side ? Math.max(0, 1 - (t - f.t) * 1.4) : 0;
      const won = !!(f && f.side === side && f.reward);
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
      gr.addColorStop(0, won ? `rgba(245,205,120,${0.35 + 0.6 * lit})` : `rgba(160,170,200,${0.18 + 0.3 * lit})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.6, 0, 7); g.fill();
      g.strokeStyle = P.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      if (lit > 0 && f) {
        g.fillStyle = won ? P.gilt : P.dim; g.font = `600 ${Math.round(r * 0.55)}px "Cormorant Garamond", serif`; g.textAlign = 'center';
        g.fillText(won ? 'reward' : 'nothing', x, y - r * 1.5 - (1 - lit) * 10);
      }
    }
    // the surprise trace: one bar per choice, gold above the line (better than expected), blue below (worse)
    const base = h * 0.78, span = h * 0.17, bw = (w * 0.84) / TRIALS, x0 = w * 0.08;
    g.strokeStyle = P.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + bw * TRIALS, base); g.stroke();
    g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x0 + bw * TRIALS / 2, base - span * 1.05); g.lineTo(x0 + bw * TRIALS / 2, base + span * 1.05); g.stroke(); g.setLineDash([]);
    trials.forEach((tr, i) => {
      const hgt = tr.delta * span;
      g.fillStyle = tr.delta >= 0 ? P.gilt : P.cool;
      g.fillRect(x0 + i * bw + bw * 0.18, Math.min(base, base - hgt), bw * 0.64, Math.max(1.5, Math.abs(hgt)));
    });
    g.fillStyle = P.dim; g.font = `italic ${Math.round(Math.max(12, h * 0.032))}px "EB Garamond", serif`; g.textAlign = 'left';
    g.fillText('your surprise, choice by choice', x0, base + span + Math.max(16, h * 0.05));
  });

  const done = trials.length >= TRIALS;
  const won = trials.filter((x) => x.reward).length;
  return (
    <>
      <p className="play-prompt">One light pays off more often than the other. Pick a light, {TRIALS} times, and try to collect as many rewards as you can.</p>
      <canvas ref={ref} className="play-stage" aria-label="Two lights, and a bar chart of surprise below them" />
      {!done ? (
        <div className="play-controls">
          <button type="button" className="btn-begin" onClick={() => choose(0)}>Left light</button>
          <span className="play-hint">{trials.length} of {TRIALS}</span>
          <button type="button" className="btn-begin" onClick={() => choose(1)}>Right light</button>
        </div>
      ) : (
        <Reveal
          lead={`${won} rewards out of ${TRIALS}.`}
          again={() => { setTrials([]); V.current = [0.5, 0.5]; best.current = Math.random() < 0.5 ? 0 : 1; flash.current = null; }}
          sources={[{ label: 'Schultz, Dayan & Montague (1997). A neural substrate of prediction and reward. Science', url: 'https://doi.org/10.1126/science.275.5306.1593' }]}
        >
          Each bar is a prediction error, worked out from your own choices with a simple learning model: gold when a choice turned out better than you expected, blue when worse. Dopamine neurons send this kind of signal. Watch the surprises shrink as you learned, then jump at the dashed line, where the lights secretly swapped. Learning from surprise is reinforcing, the second breakthrough.
        </Reveal>
      )}
    </>
  );
}
