import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return r;
}

/** Maps wheel + mouse drag to horizontal scroll with easing; touch and keys stay native/explicit. */
export function useSmoothScroll(ref: RefObject<HTMLElement | null>, reduced: boolean) {
  const target = useRef(0);
  // Float position we own. The browser snaps scrollLeft to device pixels, so reading it back as truth makes tiny
  // eased steps overshoot (then step back) or round to nothing. We only ever WRITE to scrollLeft.
  const pos = useRef(0);
  const written = useRef(0); // what scrollLeft read back right after our last write, to tell our scrolls from external ones
  const animating = useRef(false);
  const raf = useRef(0);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const max = () => {
    const el = ref.current;
    return el ? el.scrollWidth - el.clientWidth : 0;
  };

  const write = (el: HTMLElement, x: number) => {
    pos.current = x;
    el.scrollLeft = x;
    written.current = el.scrollLeft;
  };

  const tick = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const d = target.current - pos.current;
    if (Math.abs(d) < 0.25) {
      write(el, target.current);
      animating.current = false;
      return;
    }
    write(el, pos.current + Math.sign(d) * Math.min(Math.abs(d), Math.max(0.25, Math.abs(d) * 0.14)));
    raf.current = requestAnimationFrame(tick);
  }, [ref]);

  const scrollToX = useCallback((x: number, instant = false) => {
    const el = ref.current;
    if (!el) return;
    target.current = Math.min(max(), Math.max(0, x));
    if (instant || reducedRef.current) {
      cancelAnimationFrame(raf.current);
      animating.current = false;
      write(el, target.current);
      return;
    }
    if (!animating.current) {
      animating.current = true;
      raf.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line
  }, [ref, tick]);

  const scrollByX = useCallback((dx: number) => {
    const el = ref.current;
    if (!el) return;
    scrollToX((animating.current ? target.current : pos.current) + dx);
  }, [ref, scrollToX]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Lock the axis for the whole gesture: at slow speeds deltaX and deltaY are both 1-2px of noise, and choosing the
    // larger one per event flips axis (and sign), which injects backward nudges.
    let lastWheel = 0, ax = 0, ay = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (e.timeStamp - lastWheel > 160) { ax = 0; ay = 0; }
      lastWheel = e.timeStamp;
      ax += Math.abs(e.deltaX); ay += Math.abs(e.deltaY);
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientWidth : 1;
      const d = (ax > ay ? e.deltaX : e.deltaY) * unit;
      if (!d) return;
      e.preventDefault();
      const base = animating.current ? target.current : pos.current;
      scrollToX(base + d * 1.25);
    };
    const onScroll = () => {
      // a scroll we didn't cause (drag, scrollbar, programmatic): adopt it as the new truth
      if (Math.abs(el.scrollLeft - written.current) > 0.75) {
        pos.current = el.scrollLeft;
        written.current = el.scrollLeft;
        if (!animating.current) target.current = el.scrollLeft;
      }
    };

    let startX = 0, startLeft = 0, down = false, dragging = false, pid = -1;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragging = false; pid = e.pointerId;
      startX = e.clientX; startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        cancelAnimationFrame(raf.current);
        animating.current = false;
        el.setPointerCapture(pid);
        el.classList.add('is-dragging');
      }
      if (dragging) {
        el.scrollLeft = startLeft - dx;
        target.current = pos.current = written.current = el.scrollLeft;
      }
    };
    const onUp = () => {
      down = false;
      if (dragging) {
        el.classList.remove('is-dragging');
        setTimeout(() => { dragging = false; }, 0);
      }
    };
    const onClickCapture = (e: MouseEvent) => {
      if (dragging) { e.stopPropagation(); e.preventDefault(); }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClickCapture, true);
    target.current = pos.current = written.current = el.scrollLeft;
    return () => {
      cancelAnimationFrame(raf.current);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref, scrollToX]);

  return { scrollToX, scrollByX };
}
