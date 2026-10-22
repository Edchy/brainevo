import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { events } from './data';
import { buildLayout, focusX, xToYears } from './lib/layout';
import { visionNote } from './lib/vision';
import { mirrorNear } from './lib/mirror';
import { setNav } from './lib/nav';
import MirrorPanel, { MIRROR_EVENTS } from './components/MirrorPanel';
import PlayDialog from './play/PlayDialog';
import WeeksChart from './components/WeeksChart';
import Invite from './components/Invite';
import { startWatch, stopWatch, toggleWatchPause, useWatch, useWatchDirector } from './lib/watch';
import { ERA_META, lerpColor } from './lib/eras';
import { usePrefersReducedMotion, useSmoothScroll } from './lib/useSmoothScroll';
import Background from './components/Background';
const Stage = lazy(() => import('./world/Stage')); // three.js + scenes load after the intro paints
// the voice guide (src/guide) is a parked, local-only test: it appears only under `npm run dev` with VITE_GUIDE=1 in .env.local.
// `import.meta.env.DEV` is false in the build, so it is left out of it entirely
const Guide = import.meta.env.DEV && import.meta.env.VITE_GUIDE === '1' ? lazy(() => import('./guide/Guide')) : null;
import { webglAvailable } from './world/gl';
import { updateWorld, world } from './world/store';
import Track from './components/Track';
import Caption from './components/Caption';
import Axis from './components/Axis';
import Menu from './components/Menu';
import SoundButton from './components/SoundButton';
import { setSetting } from './style/store';
import { CAPTIONS_MEASURED, titleState } from './style/titles/state';
import { unlock } from './audio/engine';
import './audio/narration';
import './audio/score';
import './audio/soundscape';

/**
 * The reading layer's geometry, in one place: the column the caption sits in and where its bottom edge is, so the depth
 * headline rests on its own caption and headline + text read as one block. CSS gets it as variables, the WebGL title
 * layer through titleState.
 */
function readingGeometry() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 760;
  const bar = mobile ? 52 : 56;
  const gutter = mobile ? 20 : Math.round(vw * 0.06);
  // the caption sits bar + 26px (phones: 16px) above the bottom (index.css)
  const capBottom = vh - bar - (mobile ? 16 : 26);
  // the caption's measure (index.css: min(30em, 100vw - 2 gutters) at --t-body), so the headline wraps to the same column
  const em = Math.min(20, Math.max(16.96, 14.4 + vw * 0.004));
  const measure = Math.min(30 * em, vw - 2 * gutter);
  return { gutter, canvasH: vh, canvasW: vw, capBottom, measure };
}

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

  const [geo, setGeo] = useState(readingGeometry);
  useLayoutEffect(() => {
    const m = () => {
      const g = readingGeometry();
      setGeo(g);
      Object.assign(titleState, { left: g.gutter, capBottom: g.capBottom, canvasH: g.canvasH, canvasW: g.canvasW, measure: g.measure });
      titleState.version++;
    };
    m();
    window.addEventListener('resize', m);
    window.addEventListener(CAPTIONS_MEASURED, m);
    return () => { window.removeEventListener('resize', m); window.removeEventListener(CAPTIONS_MEASURED, m); };
  }, []);

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
  // the camera (if the visitor opened the mirror) only runs near a station that shows it
  useEffect(() => {
    const d = (id: string) => Math.abs(world.stationF - (world.eventIndex[id] ?? -99));
    mirrorNear(MIRROR_EVENTS.some((id) => d(id) < 1.2), d('mirror-self-recognition') < 0.6);
  });
  const darkness = Math.min(1, sl / Math.max(1, vw));

  const goToTrackX = useCallback((x: number) => scrollToX(xToScroll(x)), [scrollToX, xToScroll]);

  const goToStation = useCallback((i: number) => {
    const s = layout.stations[Math.max(0, Math.min(layout.stations.length - 1, i))];
    if (s) scrollToX(xToScroll(s.x));
  }, [layout, scrollToX, xToScroll]);

  useEffect(() => {
    setNav({
      goToEvent: (id) => { const s = layout.stations.find((x) => x.event.id === id); if (s) scrollToX(xToScroll(s.x)); return !!s; },
      goToIndex: goToStation,
    });
    return () => setNav(null);
  }, [layout, scrollToX, xToScroll, goToStation]);

  // stable callbacks: Track is memoised and App re-renders on every scroll frame
  const begin = useCallback((withSound: boolean) => {
    setSetting('sound', withSound);
    if (withSound) unlock();
    const b = layout.banners[0];
    scrollToX(b ? xToScroll(b.x) : vw);
  }, [layout, scrollToX, xToScroll, vw]);
  const restart = useCallback(() => scrollToX(0), [scrollToX]);
  // Watch: the piece plays itself (with sound, so the narration carries it)
  const watch = useCallback(() => { setSetting('sound', true); unlock(); startWatch(); }, []);
  useWatchDirector(
    layout,
    useCallback((x: number) => scrollToX(xToScroll(x), true), [scrollToX, xToScroll]),
    useCallback(() => (scroller.current ? scroller.current.scrollLeft + focusX(vw) - introW : 0), [vw, introW]),
  );
  const watching = useWatch();

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const inside = (sel: string) => typeof t?.closest === 'function' && !!t.closest(sel); // the target can be the window
      if (inside('input, textarea, select, summary, audio, dialog')) return;
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
        case 'PageDown': case ' ': if (inside('button, a')) return; e.preventDefault(); scrollByX(e.shiftKey && e.key === ' ' ? -vw * 0.8 : vw * 0.8); break;
        case 'PageUp': e.preventDefault(); scrollByX(-vw * 0.8); break;
        case 'Home': e.preventDefault(); scrollToX(0); break;
        case 'End': e.preventDefault(); scrollToX(max); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, vw, introW, max, goToStation, scrollByX, scrollToX]);

  return (
    <div className={gl ? 'app has-gl' : 'app'} style={{ '--intro-w': `${introW}px`, '--gutter': `${geo.gutter}px` } as React.CSSProperties}>
      <a className="skip" href="#timeline-end" onClick={(e) => { e.preventDefault(); scrollToX(max); }}>Skip to the end of the timeline</a>
      {gl ? <Suspense fallback={null}><Stage /></Suspense> : null}
      {!gl && <Background top={top} bottom={bottom} scroll={sl} reduced={reduced} accent={accent} darkness={darkness} />}
      <main
        ref={scroller}
        className="scroller"
        tabIndex={0}
        aria-label="Timeline of brain evolution. Use the left and right arrow keys to move between events."
      >
        <Track layout={layout} onBegin={begin} onWatch={watch} onRestart={restart} />
      </main>
      <Caption event={capEvent} opacity={capOpacity} />
      <MirrorPanel event={capOpacity > 0.3 ? capEvent : null} />
      {capEvent?.extra === 'weeks' && <WeeksChart opacity={capOpacity} />}
      <Invite event={capOpacity > 0.3 ? capEvent : null} opacity={capOpacity} />
      <Menu layout={layout} onGo={goToTrackX} onWatch={watch} />
      {watching.on && (
        <div className="watch-bar" role="group" aria-label="Watching">
          <span className="watch-dot" aria-hidden="true" />
          <button type="button" className="btn-text" onClick={toggleWatchPause}>{watching.paused ? 'Resume' : 'Pause'}</button>
          <button type="button" className="btn-text" onClick={stopWatch}>Explore on my own</button>
        </div>
      )}
      <PlayDialog />
      <SoundButton />
      {Guide && <Suspense fallback={null}><Guide /></Suspense>}
      <Axis layout={layout} progress={progress} xToFrac={xToFrac} years={years} readout={capEvent?.era === 'after' ? 'Here and now' : undefined} eraName={eraName} vision={activeIndex >= 0 ? visionNote(world.stationF) : null} onJump={(f) => scrollToX(f * max)} />
    </div>
  );
}
