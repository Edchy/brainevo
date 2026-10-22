/**
 * The shape of the painted shade under the reading text, shared by its two stages: Scrim (before the oil pass, so the
 * darkened area is painted) and the glaze at the end of the oil pass (src/style/oil), which takes down the floor the
 * oil pass lifts its darkest paint to (canvas ground, brush relief). Needs `uAspect` (frame width / height) set.
 */
export const SHADE_GLSL = /* glsl */ `
uniform float uAspect;
float shade(vec2 uv) {
  // vertical fall-off: dark at the bottom, gone by just above the middle
  float v = 1.0 - smoothstep(0.0, 0.62, uv.y);
  v = v * v * (3.0 - 2.0 * v);
  // heavier on the left where the caption is; the right side keeps more of the picture
  float h = mix(1.0, 0.5, smoothstep(0.3, 0.95, uv.x));
  // an extra pocket of shade right under the caption block
  vec2 c = (uv - vec2(0.24, 0.17)) * vec2(uAspect, 1.0);
  float pocket = smoothstep(0.55, 0.0, length(c * vec2(0.62, 1.25)));
  return clamp(v * h * 0.86 + pocket * 0.3, 0.0, 0.93);
}`;

/** how far the glaze darkens the shade's core (0 = off). Raised from 0 at the user's request on 2026-10-22: darker. */
export const GLAZE = 0.5;
