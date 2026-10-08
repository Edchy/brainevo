# Style & UI experiments

Goal: find a **distinct, non-generic visual identity**. We are experimenting with five looks, three UI densities and
depth-sandwiched headlines, all switchable live from the "Lab" button (top right). Be bold: each look must be
unmistakably different, beautiful and cohesive across ALL 65 scenes (they were authored without any style in mind,
so styles act globally: post-processing + palette + typography + UI theme).

Read SCENES.md first for the engine, dev hooks and verification workflow. Everything there still applies.

## Architecture
- `src/style/types.ts`, `store.ts` (settings: style / ui / titles; sets `<html data-style data-ui data-titles>`), `registry.ts`.
- Each look lives in `src/style/<id>/`: `index.ts` (exports a `StyleDef`; `Effects` = react-postprocessing effects rendered inside
  the EffectComposer after bloom and after the title layer) and `theme.css` (scoped under `[data-style="<id>"]`; also imported by index.ts).
- Stage (`src/world/Stage.tsx`) renders: scene -> Bloom -> Vignette -> TitleLayer -> style Effects. `StyleDef.bloomScale` multiplies bloom.
- Switching must work at runtime without reload. `window.__set('style','oil')` (dev) or `?style=oil&lab=0` in the URL.
- Custom effects: subclass `Effect` from `postprocessing` (GLSL `mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor)`),
  wrap with `<primitive object={...} />` or `wrapEffect`. Animate uniforms in useFrame (e.g. `world.velocity`, `world.time`, `world.stationF`).
  Mind perf: one fullscreen pass, few texture taps, consider cheaper approximations. Memoise/dispose effects.

## UI design tokens (themes set these under `[data-style="x"]`; UI code must use them, never hard-code)
`--ui-ink`, `--ui-ink-dim`, `--ui-line`, `--ui-panel` (bg), `--ui-panel-blur`, `--ui-radius`, `--ui-font-display`, `--ui-font-body`,
`--ui-font-mono` (defaults in `src/index.css`). Event/era accent colours still come from `--accent` per station. Webfonts: use Google Fonts
`@import url(...)` at the top of your theme.css (one or two families max, `display=swap`). Themes may also restyle panels, buttons, scrollbars,
focus rings, the minimap, with selectors scoped to `[data-style="x"]`.

## Ownership (do NOT edit outside your area; report needs instead)
- style agents: only `src/style/<id>/`.
- titles agent: `src/style/titles/` plus MINIMAL additive edits to `src/world/types.ts` and `src/world/Stage.tsx`.
- ui agent: `src/components/*`, `src/App.tsx`, `src/index.css` (keep the token block and Lab block), `src/lib/*` if needed.
- weak-spot agent: only the scene files named in its brief.

## Verification (REQUIRED, with screenshots; same hooks as SCENES.md)
Dev server http://localhost:5199 is running (don't start another). Use ONE Chrome tab of your own and CLOSE it when done
(parallel agents each running heavy WebGL tabs will freeze everything). The tab is hidden: a screenshot wakes the page; then
`window.__setF(f); window.__tick(40)`; switch looks with `window.__set('style', id)`. To see the real UI with cards, scroll the real scroller:
`const el=document.querySelector('.scroller'); el.scrollLeft=frac*(el.scrollWidth-el.clientWidth); el.dispatchEvent(new Event('scroll')); window.__tick(30)`.
Judge at least these stations (f): -1, 0.12, 0.45, 1.0, 2.0, 7, 11, 21, 29, 35, 48, 62, 78, 84.6. Typecheck: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep <your path>`.
After adding dependencies the dev server needs a restart: ask me instead (avoid new deps).
