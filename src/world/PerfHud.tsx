import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { world } from './store';

/**
 * Diagnostic overlay, enabled with ?perf=1. Shows frame rate, long frames, resolution, GPU resource counts and
 * WebGL context-loss events so black flashes can be attributed (GPU overload / context loss / shader compiles).
 */
export default function PerfHud() {
  const gl = useThree((s) => s.gl);
  const st = useThree((s) => s.size);
  const acc = { frames: 0, ms: 0, worst: 0, long: 0, lost: 0, restored: 0, last: performance.now() };
  useEffect(() => {
    const el = document.createElement('pre');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;margin:0;padding:8px 10px;font:11px/1.35 ui-monospace,Menlo,monospace;color:#9fffb0;background:rgba(0,0,0,.72);border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    const c = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); acc.lost++; };
    const onRestored = () => { acc.restored++; };
    c.addEventListener('webglcontextlost', onLost);
    c.addEventListener('webglcontextrestored', onRestored);
    let frames = 0, t0 = performance.now(), sum = 0, worst = 0, long = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      const fps = (acc.frames / (now - t0)) * 1000;
      sum = acc.ms; worst = acc.worst; long = acc.long; frames = acc.frames;
      el.textContent =
        `fps ${fps.toFixed(0)}   avg ${(sum / Math.max(1, frames)).toFixed(1)}ms   worst ${worst.toFixed(0)}ms   long(>50ms) ${long}\n` +
        `canvas ${gl.domElement.width}x${gl.domElement.height}  dpr ${gl.getPixelRatio().toFixed(2)}  css ${st.width}x${st.height}\n` +
        `geometries ${gl.info.memory.geometries}  textures ${gl.info.memory.textures}  programs ${gl.info.programs?.length ?? '?'}\n` +
        `draw calls ${gl.info.render.calls}  triangles ${(gl.info.render.triangles / 1000).toFixed(0)}k  points ${(gl.info.render.points / 1000).toFixed(0)}k\n` +
        `context lost ${acc.lost}  restored ${acc.restored}   f ${world.stationF.toFixed(2)}`;
      acc.frames = 0; acc.ms = 0; acc.worst = 0; acc.long = 0; t0 = now;
    }, 1000);
    return () => { clearInterval(id); c.removeEventListener('webglcontextlost', onLost); c.removeEventListener('webglcontextrestored', onRestored); el.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);
  useFrame(() => {
    const now = performance.now();
    const d = now - acc.last;
    acc.last = now;
    acc.frames++; acc.ms += d;
    if (d > acc.worst) acc.worst = d;
    if (d > 50) acc.long++;
  });
  return null;
}
