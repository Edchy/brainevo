import { CanvasTexture } from 'three';

let tex: CanvasTexture | null = null;

/** Soft round point sprite. Plain THREE.PointsMaterial draws SQUARES, which look like artifacts when a point is large. */
export function roundSprite(): CanvasTexture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  tex = new CanvasTexture(c);
  return tex;
}
