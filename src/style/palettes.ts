type V3 = [number, number, number];

/**
 * The painting's colour world: Grisaille, a monochrome underpainting in greys where only true colour survives
 * (saturated, glowing sources keep theirs as splashes). Chosen by the user in the Lab on 2026-10-22, with Fine brushwork;
 * the other palettes (Prussian, Umber, Verdigris, Oxblood) and Full brushwork are in git history. The matching CSS tokens
 * are in oil/theme.css.
 */
export const PALETTE: {
  /** linear-light colour the painting's shadows sink into (the ground showing through thin dark paint) */
  ground: V3;
  /** overall colour cast (multiplier) */
  cast: V3;
  /** tint of shadows and of highlights (multipliers, blended by luminance) */
  toneLo: V3;
  toneHi: V3;
  /** colour of the light glinting on impasto ridges */
  spec: V3;
  /** saturation (1 = source) */
  sat: number;
  /** 0..1 how far colour is drained to a single hue; saturated, emissive sources keep theirs as colour splashes */
  mono: number;
} = {
  ground: [0.014, 0.0145, 0.016], cast: [1, 1, 1], toneLo: [0.95, 0.98, 1.04], toneHi: [1.05, 1.0, 0.92], spec: [1, 0.97, 0.92], sat: 1.05, mono: 1,
};

/** Fine brushwork: small strokes, detail survives. */
export const BRUSH = { size: 0.8, relief: 1 };
