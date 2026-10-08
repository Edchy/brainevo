import { useRef } from 'react';

/** Native modal <dialog>: focus is trapped, Esc closes, focus returns to the button. */
export default function AboutDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn-about" onClick={() => ref.current?.showModal()} aria-haspopup="dialog">About</button>
      <dialog
        ref={ref}
        className="about"
        aria-labelledby="about-title"
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      >
        <h2 id="about-title">About this timeline</h2>
        <p>
          The story is organised around the five &ldquo;breakthroughs&rdquo; framework from Max Bennett&rsquo;s book
          {' '}<em>A Brief History of Intelligence</em> (2023). Any mistakes in the retelling are ours, not his.
        </p>
        <p>All images and audio narration here are placeholders. Real artwork and recordings will replace them later.</p>
        <p className="about-keys">Keys: left and right arrows move between events, Shift plus arrow scrolls further, Home and End jump to the ends.</p>
        <button type="button" className="btn-begin about-close" onClick={() => ref.current?.close()} autoFocus>Close</button>
      </dialog>
    </>
  );
}
