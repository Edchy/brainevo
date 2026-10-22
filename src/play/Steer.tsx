import { useEffect, useRef, useState } from 'react';
import { palette, rand, useCanvas } from './kit';
import { Reveal } from './Reveal';

/**
 * Breakthrough 1, steering. You are a worm that cannot see. It crawls forward on its own; you can only turn. All you
 * feel is whether the smell of food is getting stronger (the worm glows gold) or weaker (it cools to blue). Turn when
 * things get worse, keep going while they get better, and you will find the food you never saw.
 */
const W = 1000, H = 620, SIGMA = 250, SPEED = 78, TURN = 2.3;

export default function Steer() {
  const [found, setFound] = useState<'no' | 'yes' | 'gave-up'>('no');
  const turn = useRef(0); // -1 left, +1 right
  const S = useRef({ x: 120, y: 520, a: -0.6, c: 0, v: 0, food: { x: 0, y: 0 }, trail: [] as [number, number][], t: 0, done: false, pal: palette() });
  useEffect(() => {
    const s = S.current;
    // food somewhere far from the start
    do { s.food = { x: rand(520, 920), y: rand(80, 400) }; } while (Math.hypot(s.food.x - s.x, s.food.y - s.y) < 520);
    const key = (e: KeyboardEvent, down: boolean) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { turn.current = down ? -1 : (turn.current === -1 ? 0 : turn.current); e.preventDefault(); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { turn.current = down ? 1 : (turn.current === 1 ? 0 : turn.current); e.preventDefault(); }
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const conc = (x: number, y: number) => { const f = S.current.food; return Math.exp(-((x - f.x) ** 2 + (y - f.y) ** 2) / (2 * SIGMA * SIGMA)); };

  const ref = useCanvas((g, w, h, dt) => {
    const s = S.current, P = s.pal;
    const k = Math.min(w / W, h / H), ox = (w - W * k) / 2, oy = (h - H * k) / 2;
    if (!s.done) {
      s.t += dt;
      s.a += (turn.current * TURN + Math.sin(s.t * 3.1) * 0.25) * dt;
      s.x += Math.cos(s.a) * SPEED * dt; s.y += Math.sin(s.a) * SPEED * dt;
      // the dish has walls: bump off them
      if (s.x < 20 || s.x > W - 20) { s.a = Math.PI - s.a; s.x = Math.max(20, Math.min(W - 20, s.x)); }
      if (s.y < 20 || s.y > H - 20) { s.a = -s.a; s.y = Math.max(20, Math.min(H - 20, s.y)); }
      const c = conc(s.x, s.y);
      const dv = (c - s.c) / Math.max(dt, 1e-3);
      s.c = c;
      s.v += (dv * 60 - s.v) * Math.min(1, dt * 6); // smoothed "better / worse"
      if (s.trail.length === 0 || Math.hypot(s.x - s.trail[s.trail.length - 1][0], s.y - s.trail[s.trail.length - 1][1]) > 6) s.trail.push([s.x, s.y]);
      if (Math.hypot(s.x - s.food.x, s.y - s.food.y) < 34) { s.done = true; setFound('yes'); }
      else if (s.t > 55) { s.done = true; setFound('gave-up'); }
    }
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.strokeStyle = P.line; g.lineWidth = 1.5 / k; g.strokeRect(2, 2, W - 4, H - 4);
    // the trail
    g.strokeStyle = 'rgba(216,180,106,0.28)'; g.lineWidth = 3; g.beginPath();
    s.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    // the food, unseen until it is found
    if (s.done) {
      const gr = g.createRadialGradient(s.food.x, s.food.y, 0, s.food.x, s.food.y, 60);
      gr.addColorStop(0, 'rgba(240,210,140,.9)'); gr.addColorStop(1, 'rgba(240,210,140,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(s.food.x, s.food.y, 60, 0, 7); g.fill();
    }
    // the worm: a short body behind its head; its glow is the only thing it knows
    const better = Math.tanh(s.v * 0.3); // sign: better or worse; strength fades with distance, as a real gradient does
    const col = better >= 0 ? `rgba(240,200,110,${0.25 + 0.6 * better})` : `rgba(110,160,255,${0.25 - 0.6 * better})`;
    const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 46);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, 46, 0, 7); g.fill();
    g.strokeStyle = P.ink; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < 8; i++) { const b = s.trail[Math.max(0, s.trail.length - 1 - i)] ?? [s.x, s.y]; if (i === 0) g.moveTo(s.x, s.y); else g.lineTo(b[0], b[1]); }
    g.stroke();
    g.restore();
  });

  const hold = (d: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); turn.current = d; },
    onPointerUp: () => { turn.current = 0; }, onPointerCancel: () => { turn.current = 0; }, onPointerLeave: () => { turn.current = 0; },
  });

  return (
    <>
      <p className="play-prompt">You are a worm that cannot see. It crawls on its own; you can only turn. It glows <b className="gold">gold</b> when the smell of food gets stronger, <b className="blue">blue</b> when it fades. Find the food.</p>
      <canvas ref={ref} className="play-stage" aria-label="A dark dish with a worm crawling in it" />
      {found === 'no' ? (
        <div className="play-controls">
          <button type="button" className="btn-text play-hold" {...hold(-1)} aria-label="Turn left (hold, or the left arrow key)">◀ Turn left</button>
          <span className="play-hint">Hold, or use the arrow keys</span>
          <button type="button" className="btn-text play-hold" {...hold(1)} aria-label="Turn right (hold, or the right arrow key)">Turn right ▶</button>
        </div>
      ) : (
        <Reveal
          lead={found === 'yes' ? 'You found it without ever seeing it.' : 'There it was.'}
          sources={[{ label: 'Pierce-Shimomura, Morse & Lockery (1999). The fundamental role of pirouettes in C. elegans chemotaxis. Journal of Neuroscience', url: 'https://doi.org/10.1523/jneurosci.19-21-09557.1999' }]}
        >
          No map and no picture: just <em>better</em> or <em>worse</em>, and a turn when things got worse. Tiny nematode worms still find food this way, and the first animals with a front and a back, over 550 million years ago, probably did too. That is steering, the first breakthrough.
        </Reveal>
      )}
    </>
  );
}
