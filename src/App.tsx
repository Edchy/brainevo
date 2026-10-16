import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { events } from './data';
import { buildLayout, focusX, xToYears } from './lib/layout';
import { ERA_META, lerpColor } from './lib/eras';
import { usePrefersReducedMotion, useSmoothScroll } from './lib/useSmoothScroll';
import Background from './components/Background';
const Stage = lazy(() => import('./world/Stage')); // three.js + scenes load after the intro paints
import { webglAvailable } from './world/gl';
import { updateWorld, world } from './world/store';
import LabPanel from './components/LabPanel';
import Track from './components/Track';
import Caption from './components/Caption';
import Axis from './components/Axis';
import Menu from './components/Menu';
import SoundButton from './components/SoundButton';
import { setSetting, useSettings } from './style/store';
import { titleState } from './style/titles/state';
import { unlock } from './audio/engine';
import './audio/narration';

/**
 * The reading layer's geometry, in one place: the text band (band layout), the top of the caption, and where the depth
 * headline's last baseline sits so headline + text read as one block. CSS gets it as variables, the WebGL title layer
 * through titleState.
 */
function readingGeometry(text: string) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 760;
  const bar = mobile ? 52 : 56;
  const gutter = mobile ? 20 : Math.round(vw * 0.06);
  const band = text === 'band' ? Math.round(mobile ? Math.min(330, Math.max(240, vh * 0.4)) : Math.min(290, Math.max(210, vh * 0.32))) : 0;
  const canvasH = vh - band;
  // band: the headline stands on the picture's lower edge; otherwise it rests on its caption (bottom: bar + 26px)
  const baseline = text === 'band' ? canvasH - (mobile ? 22 : 30) : 0;
  const capBottom = vh - bar - (mobile ? 16 : 26);
  // the caption's measure (index.css: min(30em, 100vw - 2 gutters) at --t-body), so the headline wraps to the same column
  const em = Math.min(20, Math.max(16.96, 14.4 + vw * 0.004));
  const measure = Math.min(30 * em, vw - 2 * gutter);
  return { band, gutter, canvasH, canvasW: vw, baseline, capBottom, measure };
}

export default function App() {
  const { text, headline } = useSettings();
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

  const [geo, setGeo] = useState(() => readingGeometry(text));
  useLayoutEffect(() => {
    const m = () => {
      const g = readingGeometry(text);
      setGeo(g);
      Object.assign(titleState, { left: g.gutter, baseline: g.baseline, capBottom: g.capBottom, canvasH: g.canvasH, canvasW: g.canvasW, measure: g.measure });
      titleState.version++;
    };
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, [text, headline]);

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
  // caption fades out between events so chapter / breakthrough markers can breathe
  const capOpacity = activeIndex < 0 ? 0 : 1 - Math.min(1, Math.max(0, (best - 70) / 150));
  const capEvent = activeIndex >= 0 ? st[activeIndex].event : null;

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
  const darkness = Math.min(1, sl / Math.max(1, vw));

  const goToTrackX = useCallback((x: number) => scrollToX(xToScroll(x)), [scrollToX, xToScroll]);

  const goToStation = useCallback((i: number) => {
    const s = layout.stations[Math.max(0, Math.min(layout.stations.length - 1, i))];
    if (s) scrollToX(xToScroll(s.x));
  }, [layout, scrollToX, xToScroll]);

  // stable callbacks: Track is memoised and App re-renders on every scroll frame
  const begin = useCallback((withSound: boolean) => {
    setSetting('sound', withSound);
    if (withSound) unlock();
    const b = layout.banners[0];
    scrollToX(b ? xToScroll(b.x) : vw);
  }, [layout, scrollToX, xToScroll, vw]);
  const restart = useCallback(() => scrollToX(0), [scrollToX]);

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
    <div className="app" style={{ '--intro-w': `${introW}px`, '--band-h': `${geo.band}px`, '--gutter': `${geo.gutter}px` } as React.CSSProperties}>
      <a className="skip" href="#timeline-end" onClick={(e) => { e.preventDefault(); scrollToX(max); }}>Skip to the end of the timeline</a>
      {gl ? <Suspense fallback={null}><Stage /></Suspense> : null}
      {!gl && <Background top={top} bottom={bottom} scroll={sl} reduced={reduced} accent={accent} darkness={darkness} />}
      <main
        ref={scroller}
        className="scroller"
        tabIndex={0}
        aria-label="Timeline of brain evolution. Use the left and right arrow keys to move between events."
      >
        <Track layout={layout} onBegin={begin} onRestart={restart} />
      </main>
      <div className="band" aria-hidden="true" />
      <Caption event={capEvent} opacity={capOpacity} />
      <Menu layout={layout} onGo={goToTrackX} />
      <SoundButton />
      <LabPanel />
      <Axis layout={layout} progress={progress} xToFrac={xToFrac} years={years} eraName={eraName} onJump={(f) => scrollToX(f * max)} />
    </div>
  );
}
