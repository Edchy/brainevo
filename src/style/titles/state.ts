/**
 * Shared with the title layer. `depth` is written by Stage every frame: distance (world units, along the view axis) of
 * the title plane. The rest describes the reading column (CSS px, relative to the canvas), written by App and Caption:
 * its left edge and measure, the caption's bottom edge, and each event's caption height, so a headline set "with the
 * text" sits just above its own caption. `version` bumps whenever any of it changes.
 */
/** window event fired after the caption copies are measured (the band layout sizes itself to the tallest) */
export const CAPTIONS_MEASURED = 'brainevo:captions';

export const titleState = {
  depth: 6, left: 0, measure: 0, canvasH: 1, canvasW: 1,
  /** band layout: fixed last baseline; otherwise 0 and the baseline follows the caption */
  baseline: 0,
  capBottom: 0,
  capHeights: [] as number[],
  version: 0,
};
