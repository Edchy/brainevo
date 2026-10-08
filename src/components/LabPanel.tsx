import { useState } from 'react';
import { STYLE_DEFS } from '../style/registry';
import { STYLES, UIS, setSetting, useSettings } from '../style/store';
import type { StyleId, UiVariant } from '../style/types';

const UI_LABEL: Record<UiVariant, string> = { minimal: 'Minimal', hud: 'Light HUD', tidy: 'Tidy' };

/** Experiment switcher: compare art styles, UI chrome and depth titles live. Remove (or hide with ?lab=0) when a direction is chosen. */
export default function LabPanel() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  if (!s.lab) return null;
  return (
    <div className="lab">
      <button type="button" className="lab-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>Lab</button>
      {open && (
        <div className="lab-pop" role="group" aria-label="Style experiments">
          <fieldset>
            <legend>Style</legend>
            {STYLES.map((id: StyleId) => (
              <label key={id} title={STYLE_DEFS[id].blurb}>
                <input type="radio" name="style" checked={s.style === id} onChange={() => setSetting('style', id)} /> {STYLE_DEFS[id].name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Interface</legend>
            {UIS.map((id) => (
              <label key={id}>
                <input type="radio" name="ui" checked={s.ui === id} onChange={() => setSetting('ui', id)} /> {UI_LABEL[id]}
              </label>
            ))}
          </fieldset>
          <label className="lab-check">
            <input type="checkbox" checked={s.titles} onChange={(e) => setSetting('titles', e.target.checked)} /> Headlines in depth
          </label>
        </div>
      )}
    </div>
  );
}
