/**
 * Dev only (imported lazily from soundscape.ts): render soundscape layers offline, measure them and draw spectrograms,
 * so the sounds can be checked without listening.
 *
 *   await __scapeTest('fire', 10)           -> { peak, rmsDb } of one layer at level 1 (dry + its reverb send)
 *   await __scapeSheet(8, { speed: 0 })     -> every layer, measured, drawn as spectrograms over the page (click closes)
 */
import { hall } from './engine';
import { LAYERS, LAYER_IDS, sharedNoise, type Drive, type LayerId } from './instruments';
import { chordNow } from './score';
import { Ensemble } from './ensemble';

const SR = 44100;

async function render(id: LayerId, seconds: number, drive: Partial<Drive> = {}, level = 1) {
  const ctx = new OfflineAudioContext(2, SR * seconds, SR);
  const rev = ctx.createConvolver();
  rev.buffer = hall(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  rev.connect(wet).connect(ctx.destination);
  const d: Drive = { speed: 0, age: 0.5, chord: chordNow(), ...drive };
  const layer = new LAYERS[id]({ ctx, out: ctx.destination, wet: rev, noise: sharedNoise(ctx) });
  for (let t = 0; t < seconds; t += 0.1) layer.update(t, t + 0.3, level, d);
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, sum = 0;
  const skip = SR; // the first second is the layer fading in
  for (let i = skip; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i] + R[i] * R[i]; }
  const rms = Math.sqrt(sum / (2 * (L.length - skip)));
  return { buf, peak: +peak.toFixed(3), peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1), rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1) };
}

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** log-frequency spectrogram (40 Hz .. 16 kHz, -100..-20 dB) plus a waveform strip */
function draw(g: CanvasRenderingContext2D, buf: AudioBuffer, x0: number, y0: number, w: number, h: number) {
  const d = buf.getChannelData(0), N = 2048, hop = Math.max(256, Math.floor((d.length - N) / w));
  const re = new Float32Array(N), im = new Float32Array(N);
  const img = g.createImageData(w, h);
  const fLo = Math.log(40), fHi = Math.log(16000);
  for (let col = 0; col < w; col++) {
    const s = col * hop;
    for (let i = 0; i < N; i++) { const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); re[i] = (d[s + i] ?? 0) * win; im[i] = 0; }
    fft(re, im);
    for (let row = 0; row < h; row++) {
      const f = Math.exp(fHi - (row / h) * (fHi - fLo));
      const bin = Math.min(N / 2 - 1, Math.round((f / SR) * N));
      const mag = Math.hypot(re[bin], im[bin]) / (N / 4);
      const db = 20 * Math.log10(mag + 1e-9);
      const v = Math.max(0, Math.min(1, (db + 100) / 80));
      const k = (row * w + col) * 4;
      img.data[k] = 255 * Math.min(1, v * 1.6); img.data[k + 1] = 255 * Math.max(0, v * 1.6 - 0.6); img.data[k + 2] = 255 * (v < 0.4 ? v * 1.5 : Math.max(0, 1 - v));
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, x0, y0);
  // waveform envelope underneath
  g.fillStyle = '#7fd';
  const per = Math.floor(d.length / w);
  for (let col = 0; col < w; col++) {
    let m = 0;
    for (let i = col * per; i < (col + 1) * per; i += 8) m = Math.max(m, Math.abs(d[i]));
    const hh = Math.min(24, m * 48);
    g.fillRect(x0 + col, y0 + h + 26 - hh, 1, Math.max(1, hh));
  }
}

async function sheet(seconds = 8, drive: Partial<Drive> = {}, ids: LayerId[] = LAYER_IDS) {
  const cols = 2, w = 560, h = 90, rowH = h + 48;
  const cv = document.createElement('canvas');
  cv.width = cols * (w + 20) + 20; cv.height = Math.ceil(ids.length / cols) * rowH + 20;
  Object.assign(cv.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#111', width: `${cv.width / 2}px`, height: `${cv.height / 2}px` });
  cv.style.width = '100vw'; cv.style.height = 'auto';
  const g = cv.getContext('2d')!;
  g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '15px monospace';
  const stats: Record<string, unknown> = {};
  for (const [i, id] of ids.entries()) {
    const r = await render(id, seconds, drive);
    stats[id] = { peakDb: r.peakDb, rmsDb: r.rmsDb };
    const x = 20 + (i % cols) * (w + 20), y = 10 + Math.floor(i / cols) * rowH;
    g.fillStyle = '#eee';
    g.fillText(`${id}   peak ${r.peakDb} dB   rms ${r.rmsDb} dB`, x, y + 14);
    draw(g, r.buf, x, y + 20, w, h);
  }
  cv.onclick = () => cv.remove();
  document.body.appendChild(cv);
  return stats;
}

/** the breakthrough ensemble alone, with `have` voices, over one chord: { peak, rms } */
async function ensemble(have: number, seconds = 20) {
  const ctx = new OfflineAudioContext(2, SR * seconds, SR);
  const rev = ctx.createConvolver();
  rev.buffer = hall(ctx);
  const lvl = ctx.createGain(); lvl.gain.value = 0.7; // the score's LEVEL
  lvl.connect(ctx.destination);
  lvl.connect(rev).connect(ctx.destination);
  const e = new Ensemble(ctx, lvl);
  const chord = chordNow();
  for (let t = 0; t < seconds; t += 0.1) e.update(t, t + 0.3, have, chord);
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0);
  let peak = 0, sum = 0;
  for (let i = SR * 3; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i])); sum += L[i] * L[i]; }
  return { have, peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1), rmsDb: +(20 * Math.log10(Math.sqrt(sum / (L.length - SR * 3)) + 1e-9)).toFixed(1) };
}

const w = window as unknown as Record<string, unknown>;
w.__ensembleTest = ensemble;
w.__scapeTest = async (id: LayerId, seconds = 10, drive: Partial<Drive> = {}) => { const { buf: _b, ...r } = await render(id, seconds, drive); return r; };
w.__scapeSheet = sheet;
