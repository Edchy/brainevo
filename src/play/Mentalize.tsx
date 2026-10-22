import { useEffect, useRef, useState } from 'react';
import { palette, useCanvas } from './kit';
import { Reveal } from './Reveal';

/**
 * Breakthrough 4, mentalizing: a false-belief test. A chimpanzee watches a banana go into one box, then looks away while
 * it is moved to the other. Where will she look for it? Answering "where she last saw it" means modelling what is in
 * her mind, not what is true. (Children pass this around age four; great apes look to the right place in eye-tracking.)
 */
type Box = 0 | 1;
// scripted beats, in seconds
const T_PLACE = 0.6, T_TURN = 2.6, T_MOVE = 3.6, T_BACK = 5.6, T_ASK = 6.4;

export default function Mentalize() {
  const [first] = useState<Box>(() => (Math.random() < 0.5 ? 0 : 1));
  const [asked, setAsked] = useState(false);
  const [answer, setAnswer] = useState<Box | null>(null);
  const t0 = useRef(performance.now() / 1000);
  const pal = useRef(palette());
  useEffect(() => { const id = setTimeout(() => setAsked(true), T_ASK * 1000); return () => clearTimeout(id); }, []);

  const ref = useCanvas((g, w, h, _dt, now) => {
    const P = pal.current;
    const t = now - t0.current;
    const k = Math.min(w / 160, h / 100), ox = (w - 160 * k) / 2, oy = (h - 100 * k) / 2;
    const X = (x: number, y: number): [number, number] => [ox + x * k, oy + y * k];
    g.clearRect(0, 0, w, h);
    const boxX = [52, 108];
    // the boxes
    for (const b of [0, 1] as Box[]) {
      const [x, y] = X(boxX[b] - 13, 62);
      g.strokeStyle = P.ink; g.lineWidth = 1.6; g.strokeRect(x, y, 26 * k, 18 * k);
      g.fillStyle = 'rgba(239,230,212,0.05)'; g.fillRect(x, y, 26 * k, 18 * k);
      g.fillStyle = P.dim; g.font = `italic ${Math.round(4.6 * k)}px "EB Garamond", serif`; g.textAlign = 'center';
      g.fillText(b ? 'right box' : 'left box', ...X(boxX[b], 88));
    }
    // the banana's journey: into the first box, then (while she looks away) to the other
    const other = (1 - first) as Box;
    let bx: number, by: number;
    if (t < T_PLACE) { bx = 80; by = 30; }
    else if (t < T_PLACE + 1) { const u = t - T_PLACE; bx = 80 + (boxX[first] - 80) * u; by = 30 + 34 * u; }
    else if (t < T_MOVE) { bx = boxX[first]; by = 64; }
    else if (t < T_MOVE + 1.2) { const u = (t - T_MOVE) / 1.2; bx = boxX[first] + (boxX[other] - boxX[first]) * u; by = 64 - Math.sin(u * Math.PI) * 26; }
    else { bx = boxX[other]; by = 64; }
    const inBox = (t > T_PLACE + 1 && t < T_MOVE) || t > T_MOVE + 1.2;
    if (!inBox || answer !== null) {
      const [x, y] = X(bx, by);
      // a banana: a filled crescent with a dark stalk
      g.fillStyle = P.gilt;
      g.beginPath(); g.arc(x, y - 9 * k, 8 * k, Math.PI * 0.12, Math.PI * 0.88); g.arc(x, y - 12.5 * k, 8.6 * k, Math.PI * 0.8, Math.PI * 0.2, true); g.fill();
      g.fillStyle = '#5a4630'; g.fillRect(x + 6.6 * k, y - 6.4 * k, 1.6 * k, 1.8 * k);
    }
    // the chimpanzee, on the left edge: facing the boxes, then turned away while the banana moves
    const away = t > T_TURN && t < T_BACK;
    const [cx, cy] = X(18, 52);
    g.fillStyle = '#6b5446';
    g.beginPath(); g.ellipse(cx, cy + 12 * k, 9 * k, 13 * k, 0, 0, 7); g.fill(); // body
    g.beginPath(); g.arc(cx, cy - 6 * k, 7 * k, 0, 7); g.fill(); // head
    g.fillStyle = '#c9a58c';
    if (!away) { g.beginPath(); g.ellipse(cx + 3.6 * k, cy - 5 * k, 3.6 * k, 4.4 * k, 0, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(cx + 5 * k, cy - 7 * k, 0.9 * k, 0, 7); g.fill(); }
    // her gaze, while she is watching
    if (!away && t < T_BACK + 10) {
      g.strokeStyle = 'rgba(239,230,212,0.14)'; g.setLineDash([2 * k, 2.5 * k]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx + 7 * k, cy - 7 * k); g.lineTo(...X(boxX[first], 62)); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = P.dim; g.font = `italic ${Math.round(4.4 * k)}px "EB Garamond", serif`; g.textAlign = 'center';
    g.fillText(away ? 'looking away' : 'watching', cx, cy + 32 * k);
  });

  const right = answer === first;
  return (
    <>
      <p className="play-prompt">Watch carefully. A chimpanzee sees where the banana is hidden. Then she looks away.</p>
      <canvas ref={ref} className="play-stage" aria-label="A chimpanzee, two boxes and a banana being hidden, then moved" />
      {answer === null ? (
        <div className="play-controls" aria-hidden={!asked}>
          {asked ? (
            <>
              <span className="play-ask">Where will she look for the banana?</span>
              <button type="button" className="btn-begin" onClick={() => setAnswer(0)}>Left box</button>
              <button type="button" className="btn-begin" onClick={() => setAnswer(1)}>Right box</button>
            </>
          ) : <span className="play-hint">…</span>}
        </div>
      ) : (
        <Reveal
          lead={right ? 'Yes: where she last saw it.' : `She will look in the ${first ? 'right' : 'left'} box, where she last saw it.`}
          sources={[
            { label: 'Wimmer & Perner (1983). Beliefs about beliefs. Cognition', url: 'https://doi.org/10.1016/0010-0277(83)90004-5' },
            { label: 'Krupenye et al. (2016). Great apes anticipate that other individuals will act according to false beliefs. Science', url: 'https://doi.org/10.1126/science.aaf8110' },
          ]}
        >
          You know the banana moved; she doesn&rsquo;t. To answer, you kept two worlds in mind at once: what is true, and what she believes. Children pass this test at around four, and in eye-tracking studies great apes look to where the other one wrongly thinks things are. Modelling minds, including wrong ones, is mentalizing, the fourth breakthrough.
        </Reveal>
      )}
    </>
  );
}
