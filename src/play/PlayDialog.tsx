import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type { Breakthrough } from '../types';
import { BREAKTHROUGH_BY_ID, BREAKTHROUGH_COUNT } from '../lib/breakthroughs';
import { openPlay, usePlay } from './kit';
import Steer from './Steer';
import Reinforce from './Reinforce';
import Simulate from './Simulate';
import Mentalize from './Mentalize';
import Speak from './Speak';

const TOYS: Record<Breakthrough, ComponentType> = { steering: Steer, reinforcing: Reinforce, simulating: Simulate, mentalizing: Mentalize, speaking: Speak };

/** "Try it yourself": the open breakthrough's toy, over the story; Escape or Close returns to it */
export default function PlayDialog() {
  const open = usePlay();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const b = open ? BREAKTHROUGH_BY_ID[open] : null;
  const Toy = open ? TOYS[open] : null;
  return (
    <dialog ref={ref} className="play" aria-labelledby="play-title" onClose={() => openPlay(null)}>
      {b && Toy && (
        <>
          <header className="play-head">
            <p className="play-kicker">Breakthrough {b.number} of {BREAKTHROUGH_COUNT}</p>
            <h2 id="play-title">{b.name}: try it yourself</h2>
            <button type="button" className="btn-quiet play-close" onClick={() => openPlay(null)}>Close</button>
          </header>
          {/* keyed, so reopening starts fresh */}
          <div className="play-body" key={open}><Toy /></div>
        </>
      )}
    </dialog>
  );
}
