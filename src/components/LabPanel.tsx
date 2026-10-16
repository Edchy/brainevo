import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BRUSH_DEF, PALETTES_DEF } from '../style/palettes';
import { BRUSHES, HEADLINES, PALETTES, TEXTS, setSetting, useSettings } from '../style/store';
import type { HeadlinePlace, TextLayout } from '../style/types';
import { recordingCount } from '../audio/narration';

const TEXT_LABEL: Record<TextLayout, [string, string]> = {
  scrim: ['Painted shade', 'The painting darkens under the text'],
  band: ['Text band', 'Text on its own strip below the picture'],
  overlay: ['On the picture', 'Text straight over the scene'],
};
const HEADLINE_LABEL: Record<HeadlinePlace, string> = { text: 'With the text', top: 'Top, placed per scene' };
const SWATCH: Record<string, string> = { prussian: '#262d48', grisaille: '#4a4a4b', umber: '#5a4430', verdigris: '#24473f', oxblood: '#5a3036' };

/** Experiment switcher: oil palettes, brushwork and text layout, live. Hide with ?lab=0. */
export default function LabPanel() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  if (!s.lab) return null;
  return (
    <div className="lab">
      <button type="button" className="lab-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>Lab</button>
      {open && (
        <div className="lab-pop" role="group" aria-label="Look experiments">
          <fieldset>
            <legend>Palette</legend>
            {PALETTES.map((id) => (
              <label key={id} title={PALETTES_DEF[id].blurb}>
                <input type="radio" name="palette" checked={s.palette === id} onChange={() => setSetting('palette', id)} />
                <i className="swatch" style={{ background: SWATCH[id] } as CSSProperties} aria-hidden="true" />
                {PALETTES_DEF[id].name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Brushwork</legend>
            {BRUSHES.map((id) => (
              <label key={id} title={BRUSH_DEF[id].blurb}>
                <input type="radio" name="brush" checked={s.brush === id} onChange={() => setSetting('brush', id)} /> {BRUSH_DEF[id].name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Text</legend>
            {TEXTS.map((id) => (
              <label key={id} title={TEXT_LABEL[id][1]}>
                <input type="radio" name="text" checked={s.text === id} onChange={() => setSetting('text', id)} /> {TEXT_LABEL[id][0]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Headline</legend>
            {HEADLINES.map((id) => (
              <label key={id}>
                <input type="radio" name="headline" checked={s.headline === id} onChange={() => setSetting('headline', id)} /> {HEADLINE_LABEL[id]}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={s.titles} onChange={(e) => setSetting('titles', e.target.checked)} /> Painted into the scene (depth)
            </label>
          </fieldset>
          <label className="lab-check" title={`${recordingCount} recorded narration files found`}>
            <input type="checkbox" checked={s.previewVoice} onChange={(e) => setSetting('previewVoice', e.target.checked)} /> System voice until recordings exist
          </label>
        </div>
      )}
    </div>
  );
}
