# Look and reading layer

The piece has one look: an **oil painting** in **Grisaille** (a monochrome underpainting in greys where only true colour
survives) with **fine** brushwork, applied globally to every scene. The reading layer (depth headline + caption) stays
secondary to the picture. The user chose all of it in the Lab on 2026-10-22; the Lab and the other options (four more palettes,
full brushwork, a text band, text straight on the picture, art-directed headline placement) were then removed; the last
commit that has them is c2ec986.

## Post-processing chain (`src/world/Stage.tsx`, `PostFX`)
```
scene -> Bloom -> Vignette -> Dip (crossfade dip-to-dark) -> Scrim (painted shade)   [pass 1]
      -> Oil (convolution, own pass: samples the finished frame; ends with the shade's glaze) -> TitleLayer (headline)   [pass 2]
```
- `Scrim` (`src/world/Scrim.tsx`) carries a no-op `mainUv`, which makes the composer end the pass there, so the oil taps see
  bloom, the dip and the shade. Without that split the oil sampled the raw scene and everything merged in pass 1 came out at
  ~20% strength.
- Oil: `src/style/oil/index.ts`. Palette and brush are uniforms eased toward their targets together with the perception stages
  (`src/lib/vision.ts`), so those cross-dissolve as you travel. `OIL_BLOOM` scales the mood-driven bloom.
- postprocessing sorts the effects merged into one pass by their attributes (convolution, then depth, then the rest), so an
  attribute-less effect placed between Oil and TitleLayer actually runs AFTER the headline. That is why the shade's glaze is
  the last step of the oil shader rather than an effect of its own.

## Palette and brushwork (`src/style/palettes.ts`)
One palette, `PALETTE` (Grisaille): `ground` (what thin dark paint sinks into), `cast`, split `toneLo/toneHi`, `spec`, `sat`, and
`mono: 1` (colour drained to grey; saturated, emissive sources keep theirs as splashes). One brush, `BRUSH` (fine: small strokes,
detail survives). The matching CSS tokens are the defaults in `src/style/oil/theme.css`; `index.html`'s theme-color follows
`--ground-deep`.

## Reading layer
- **Headline in depth** (`src/style/titles`): drawn into the frame after the oil pass; Cormorant Garamond 600 at ~6% of the frame
  height, no kicker; it rests on its own caption (each caption's height is measured from hidden copies in `Caption.tsx`), so
  headline + date + summary read as one block at the lower left. Plane at 0.7 x focal distance; only lit geometry occludes; glow
  (no depth) dims letters only lightly (`--title-key`). Without WebGL the caption shows its HTML headline instead (`.has-gl`).
- **Caption** (`src/components/Caption.tsx`): EB Garamond (variable weight, 430 for light-on-dark), measure 30em, an italic gilt
  date run in ahead of the summary, then Listen / Read more. Read more opens the sheet with significance, details, the
  narration script and **Sources**.
- **Painted shade**: the painting darkens toward its lower edge and most of all under the caption. Its shape is in
  `src/world/shade.ts`, used twice: `Scrim` before the oil pass (the darkened area gets painted: ground colour, brush texture)
  and a glaze at the end of the oil shader, which takes down the floor the oil pass lifts its darkest paint to. `GLAZE` sets its
  strength (0.5; made darker at the user's request on 2026-10-22). Dev: `window.__glaze = 0.3` tries another strength live.
- Geometry lives in one place, `readingGeometry()` in `App.tsx` (caption bottom, measure, gutter), shared with CSS variables and
  with the title layer through `titleState`.

## Tokens (`src/style/oil/theme.css`)
`--ink`, `--ink-dim`, `--ink-faint`, `--rule`, `--gilt` (the one accent), `--ground`, `--ground-deep`, mapped onto the UI tokens
`--ui-ink`, `--ui-ink-dim`, `--ui-line`, `--ui-panel`, `--accent`, `--ui-font-display`, `--ui-font-body`. Title knobs:
`--title-font`, `--title-color`, `--title-weight`, `--title-size`, `--title-spacing`, `--title-opacity`, `--title-softness`,
`--title-parallax`, `--title-shadow`, `--title-key`, `--title-blend`. UI code uses tokens only.

## Settings (`src/style/store.ts`, localStorage `brainevo.settings.v3`)
Only the sound switches: `sound`, `narration`, `music`, `ambience` (see `src/audio`). Look settings saved by earlier visits are
ignored.

## Verification
Judge paused stills through the real scroller (see SCENES.md for the hooks and the contact-sheet recipe), and at phone width
(an iframe of 390 x 780 works when the window cannot be resized).
