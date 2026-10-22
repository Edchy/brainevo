/** Colour worlds of the oil painting (ground, cast and grade). See palettes.ts. */
export type PaletteId = 'prussian' | 'grisaille' | 'umber' | 'verdigris' | 'oxblood';
/** Brushwork: 'fine' keeps detail, 'full' paints with broad, heavily loaded strokes. */
export type BrushId = 'fine' | 'full';
/**
 * Where the reading text sits: 'scrim' darkens the painting's lower ground under the caption, 'band' gives the text its
 * own dark strip under the picture, 'overlay' sets it straight on the picture.
 */
export type TextLayout = 'scrim' | 'band' | 'overlay';
/** Where the depth headline sits: just above the reading text (one block, lower left), or art-directed per scene (top). */
export type HeadlinePlace = 'text' | 'top';

export interface Settings {
  palette: PaletteId;
  brush: BrushId;
  text: TextLayout;
  /** depth-sandwiched headlines on/off */
  titles: boolean;
  headline: HeadlinePlace;
  /** show the Lab panel (palette / brush / text experiments) */
  lab: boolean;
  /** master sound switch (narration, music, scene sounds). Off until the visitor turns it on: browsers block audio before a gesture. */
  sound: boolean;
  narration: boolean;
  music: boolean;
  /** the sounds of each scene (sea, wind, fire, neurons...) under the music */
  ambience: boolean;
}
