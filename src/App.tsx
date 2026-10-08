import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { events } from './data';
import { buildLayout, focusX, xToYears } from './lib/layout';
import { ERA_META, lerpColor } from './lib/eras';
import { usePrefersReducedMotion, useSmoothScroll } from './lib/useSmoothScroll';
import Background from './components/Background';
const Stage = lazy(() => import('./world/Stage')); // three.js + scenes load after the intro paints
import { webglAvailable } from './world/gl';
import { updateWorld, world } from './world/store';
import Minimap from './components/Minimap';
import Track from './components/Track';

export default function App() {
  const reduced = usePrefersReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => buildLayout(events), []);
  const [sl, setSl] = useState(0);
  const [dims, setDims] = useState({ vw: window.innerWidth, max: 1 });
  const { scrollToX, scrollByX } = useSmoothScroll(scroller, reduced);
  const frame = useRef(0);
  const [gl] = useState(webglAvailable);
  world.reduced = reduced;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => { setDims({ vw: el.clientWidth, max: Math.max(1, el.scrollWidth - el.clientWidth) }); updateWorld(layout, el.scrollLeft, el.clientWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const onScroll = () => {
      updateWorld(layout, el.scrollLeft, el.clientWidth);
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setSl(el.scrollLeft));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.focus({ preventScroll: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, [layout]);

  const { vw, max } = dims;
  const introW = vw;
  const trackX = sl + focusX(vw) - introW; // track x at the point of focus
  const progress = Math.min(1, Math.max(0, sl / max));
  const xToScroll = useCallback((x: number) => introW + x - focusX(vw), [introW, vw]);
  const xToFrac = useCallback((x: number) => Math.min(1, Math.max(0, xToScroll(x) / max)), [xToScroll, max]);

  // nearest station + blended colours
  const st = layout.stations;
  let activeIndex = -1;
  let best = Infinity;
  for (const s of st) {
    const d = Math.abs(s.x - trackX);
    if (d < best) { best = d; activeIndex = s.index; }
  }
  if (activeIndex >= 0 && best > vw * 0.6 && trackX < st[0].x) activeIndex = -1;

  let top = ERA_META.cosmic.top, bottom = ERA_META.cosmic.bottom, accent = ERA_META.cosmic.accent;
  let eraName = ERA_META.cosmic.name;
  if (st.length) {
    let i = 0;
    while (i < st.length - 1 && st[i + 1].x <= trackX) i++;
    const a = ERA_META[st[i].event.era];
    const nxt = st[Math.min(i + 1, st.length - 1)];
    const b = ERA_META[nxt.event.era];
    const t = trackX <= st[0].x ? 0 : nxt === st[i] ? 0 : (trackX - st[i].x) / (nxt.x - st[i].x);
    const k = Math.min(1, Math.max(0, (t - 0.3) / 0.5));
    top = lerpColor(a.top, b.top, k);
    bottom = lerpColor(a.bottom, b.bottom, k);
    accent = k > 0.5 ? b.accent : a.accent;
    eraName = (k > 0.5 ? b : a).name;
  }
  const years = xToYears(layout, trackX);
  const span = Math.abs(xToYears(layout, trackX - vw / 2) - xToYears(layout, trackX + vw / 2));
  const darkness = Math.min(1, sl / Math.max(1, vw));

  const goToStation = useCallback((i: number) => {
    const s = layout.stations[Math.max(0, Math.min(layout.stations.length - 1, i))];
    if (s) scrollToX(xToScroll(s.x));
  }, [layout, scrollToX, xToScroll]);

  const begin = () => {
    const b = layout.banners[0];
    scrollToX(b ? xToScroll(b.x) : vw);
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (t.closest('input, textarea, select, summary, audio, dialog')) return;
      const cx = scroller.current ? scroller.current.scrollLeft + focusX(vw) - introW : 0;
      const idx = layout.stations.findIndex((s) => s.x > cx + 8);
      const cur = idx === -1 ? layout.stations.length : idx; // first station ahead
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); e.shiftKey ? scrollByX(vw * 0.8) : goToStation(cur); break;
        case 'ArrowLeft': {
          e.preventDefault();
          if (e.shiftKey) { scrollByX(-vw * 0.8); break; }
          const prevIdx = layout.stations.findLastIndex((s) => s.x < cx - 8);
          if (prevIdx === -1) scrollToX(0); else goToStation(prevIdx);
          break;
        }
        case 'PageDown': case ' ': if (t.closest('button, a')) return; e.preventDefault(); scrollByX(e.shiftKey && e.key === ' ' ? -vw * 0.8 : vw * 0.8); break;
        case 'PageUp': e.preventDefault(); scrollByX(-vw * 0.8); break;
        case 'Home': e.preventDefault(); scrollToX(0); break;
        case 'End': e.preventDefault(); scrollToX(max); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, vw, introW, max, goToStation, scrollByX, scrollToX]);

  return (
    <div className="app" style={{ '--intro-w': `${introW}px` } as React.CSSProperties}>
      <a className="skip" href="#timeline-end" onClick={(e) => { e.preventDefault(); scrollToX(max); }}>Skip to the end of the timeline</a>
      {gl ? <Suspense fallback={null}><Stage /></Suspense> : null}
      {!gl && <Background top={top} bottom={bottom} scroll={sl} reduced={reduced} accent={accent} darkness={darkness} />}
      <main
        ref={scroller}
        className="scroller"
        tabIndex={0}
        aria-label="Timeline of brain evolution. Use the left and right arrow keys to move between events."
      >
        <Track layout={layout} activeIndex={activeIndex} onBegin={begin} onRestart={() => scrollToX(0)} />
      </main>
      <Minimap
        layout={layout}
        progress={progress}
        xToFrac={xToFrac}
        years={years}
        span={span}
        accent={accent}
        eraName={eraName}
        onJump={(f) => scrollToX(f * max)}
      />
    </div>
  );
}
