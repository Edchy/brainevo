# Look and reading layer

The piece has one look: an **oil painting**, applied globally to every scene, in five colour worlds (palettes) and two
brushworks. The reading layer (depth headline + caption) is designed to stay secondary to the picture. Everything here is
switchable live from the **Lab** button (top right; hide it with `?lab=0`).

## Post-processing chain (`src/world/Stage.tsx`, `PostFX`)
```
scene -> Bloom -> Vignette -> Dip (crossfade dip-to-dark) -> Scrim (reading shade)   [pass 1]
      -> Oil (convolution, own pass: samples the finished frame) -> TitleLayer (depth headline, crisp)   [pass 2]
```
- `Scrim` (`src/world/Scrim.tsx`) carries a no-op `mainUv`, which makes the composer end the pass there, so the oil taps see
  bloom, the dip and the shade. Without that split the oil sampled the raw scene and everything merged in pass 1 came out at
  ~20% strength.
- Oil: `src/style/oil/index.ts`. Palette and brush are uniforms that ease toward the current setting (switching cross-dissolves,
  never recompiles). `OIL_BLOOM` scales the mood-driven bloom.

## Palettes and brushwork (`src/style/palettes.ts`)
| id | look |
|---|---|
| `prussian` (default) | night-blue ground, warm lamplit highlights (the original oil look) |
| `grisaille` | monochrome underpainting in greys; only strongly saturated, lit areas keep their colour |
| `umber` | Rembrandt browns: warm dark ground, golden light |
| `verdigris` | deep green-teal ground, cool shadows, warm light |
| `oxblood` | deep crimson ground, like a red-primed canvas |

Each palette sets `ground` (what thin dark paint sinks into), `cast`, split `toneLo/toneHi`, `spec`, `sat` and `mono`.
Brushwork: `fine` (default) or `full` (broader strokes, heavier impasto). To add a palette: an entry in `PALETTES_DEF`, the id in
`PaletteId` + `PALETTES` (store), CSS tokens under `:root[data-palette='id']` in `src/style/oil/theme.css`, a Lab swatch.
`--ground` / `--ground-deep` in the theme are sampled from the rendered canvas so the text band and dialogs match the paint.

## Reading layer
- **Headline in depth** (`src/style/titles`): drawn into the frame after the oil pass; Cormorant Garamond 600 at ~6% of the frame
  height, no kicker; it rests on its own caption (each caption's height is measured from hidden copies in `Caption.tsx`), so
  headline + date + summary read as one block at the lower left. Plane at 0.7 x focal distance; only lit geometry occludes; glow
  (no depth) dims letters only lightly (`--title-key`). Lab alternative: "Top, placed per scene" (`anchors.ts`).
- **Caption** (`src/components/Caption.tsx`): EB Garamond (variable weight, 430 for light-on-dark), measure 30em, an italic gilt
  date run in ahead of the summary, then Listen / Read more. Read more opens the sheet with significance, details, the
  narration script and **Sources**.
- **Text layout** (`settings.text`): `scrim` (default; the painting darkens under the text, painted by the oil pass), `band` (the
  canvas stops above a strip of ground-coloured margin that holds the text), `overlay` (text straight on the picture with a halo).
- Geometry lives in one place, `readingGeometry()` in `App.tsx` (band height, caption bottom, headline baseline, measure), shared
  with CSS variables and with the title layer through `titleState`.

## Tokens (`src/style/oil/theme.css`)
`--ink`, `--ink-dim`, `--ink-faint`, `--rule`, `--gilt` (the one accent), `--ground`, `--ground-deep`, mapped onto the UI tokens
`--ui-ink`, `--ui-ink-dim`, `--ui-line`, `--ui-panel`, `--accent`, `--ui-font-display`, `--ui-font-body`. Title knobs:
`--title-font`, `--title-color`, `--title-weight`, `--title-size`, `--title-spacing`, `--title-opacity`, `--title-softness`,
`--title-parallax`, `--title-shadow`, `--title-key`, `--title-blend`. UI code uses tokens only.

## Settings (`src/style/store.ts`, localStorage `brainevo.settings.v3`; URL params override)
`?palette=`, `?brush=fine|full`, `?text=scrim|band|overlay`, `?headline=text|top`, `?titles=0|1`, `?lab=0|1`. Also stored:
`sound`, `narration`, `music`, `previewVoice` (see `src/audio`). `<html>` gets `data-palette/brush/text/titles/headline`.

## Verification
Judge paused stills through the real scroller (see SCENES.md for the hooks and the contact-sheet recipe), in more than one
palette, and at phone width (an iframe of 390 x 780 works when the window cannot be resized).
