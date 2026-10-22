import { useEffect, useRef } from 'react';
import { useAge } from '../lib/age';

/**
 * Four Thousand Weeks, drawn crisp over the painting: 52 weeks a row, 80 rows, a gap every ten years. Weeks lived fill
 * in gold, this week glows, the rest stay open. (Drawn as a 2D chart rather than painted: squares a few pixels wide are
 * smaller than a brush stroke, and the paint smeared them into moire.)
 */
const COLS = 52, ROWS = 80;

export default function WeeksChart({ opacity }: { opacity: number }) {
  const age = useAge();
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const css = getComputedStyle(document.documentElement);
    const gilt = css.getPropertyValue('--gilt').trim() || '#d8b46a';
    const ink = css.getPropertyValue('--ui-ink').trim() || '#efe6d4';
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const labelW = 26, decGap = 0.7; // gap between decades, in cells
      const cell = Math.min((w - labelW) / COLS, h / (ROWS + 7 * decGap));
      const sq = Math.max(1, cell * 0.74), off = (cell - sq) / 2;
      const ox = labelW + (w - labelW - cell * COLS) / 2, oy = (h - cell * (ROWS + 7 * decGap)) / 2;
      const lived = age == null ? -1 : age * 52;
      // the grid fills in row by row when it first appears
      const reveal = Math.min(1, (now - t0) / 1600);
      shown.current = reveal;
      const pulse = 0.55 + 0.45 * Math.sin(now / 320);
      g.font = `italic ${Math.max(10, Math.min(13, cell * 1.6))}px "EB Garamond", serif`;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let y = 0; y < ROWS; y++) {
        if (y / ROWS > reveal * 1.05) break;
        const yy = oy + (y + Math.floor(y / 10) * decGap) * cell;
        if (y % 10 === 0) { g.fillStyle = 'rgba(239,230,212,0.45)'; g.fillText(String(y), ox - 7, yy + cell / 2); }
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x, xx = ox + x * cell;
          if (i < lived - 0.5) { g.fillStyle = gilt; g.globalAlpha = 0.9; g.fillRect(xx + off, yy + off, sq, sq); }
          else if (i < lived + 0.5) {
            g.globalAlpha = 1; g.fillStyle = ink; g.shadowColor = gilt; g.shadowBlur = 10 * pulse;
            g.fillRect(xx + off - 0.5, yy + off - 0.5, sq + 1, sq + 1); g.shadowBlur = 0;
          } else { g.globalAlpha = 0.32; g.strokeStyle = ink; g.lineWidth = 0.75; g.strokeRect(xx + off + 0.375, yy + off + 0.375, sq - 0.75, sq - 0.75); }
        }
      }
      g.globalAlpha = 1;
      if (reveal >= 1 && age == null) {
        g.textAlign = 'center'; g.fillStyle = 'rgba(239,230,212,0.6)';
        g.fillText('Each square is one week of an 80-year life', ox + (cell * COLS) / 2, oy - 12);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [age]);
  return <canvas ref={ref} className="weeks-chart" style={{ opacity, visibility: opacity < 0.02 ? 'hidden' : 'visible' }} aria-label={age == null ? 'A grid of 4,160 weeks: an 80-year life' : `A grid of 4,160 weeks; the first ${Math.round(age * 52).toLocaleString('en-US')} are filled in`} role="img" />;
}
