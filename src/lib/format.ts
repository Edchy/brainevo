const nf = (n: number, d = 1) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Compact "years ago" phrase for the live readout; negative years are the future ("In 5 billion years"). */
export function fmtYearsAgo(y: number): string {
  if (Math.abs(y) < 1) return 'Present day';
  const a = Math.abs(y);
  let s: string;
  if (a >= 1e12) s = `${nf(a / 1e12, a >= 1e13 ? 0 : 1)} trillion years`;
  else if (a >= 1e9) s = `${nf(a / 1e9, 2)} billion years`;
  else if (a >= 1e6) s = `${nf(a / 1e6, a >= 1e7 ? 1 : 2)} million years`;
  else if (a >= 1e4) s = `${nf(Math.round(a / 100) * 100, 0)} years`;
  else s = `${nf(Math.round(a), 0)} ${Math.round(a) === 1 ? 'year' : 'years'}`;
  return y > 0 ? `${s} ago` : `In ${s}`;
}

/** Span phrase: "about 40 million years". */
export function fmtSpan(y: number): string {
  if (y >= 1e9) return `${nf(y / 1e9, 1)} billion years`;
  if (y >= 1e6) return `${nf(y / 1e6, y >= 1e7 ? 0 : 1)} million years`;
  if (y >= 1e3) return `${nf(y / 1e3, y >= 1e4 ? 0 : 1)} thousand years`;
  return `${nf(Math.max(0, Math.round(y)), 0)} years`;
}

export function tickLabel(y: number): string {
  if (y === 0) return 'Now';
  if (y >= 1e9) return `${nf(y / 1e9)} Gya`;
  if (y >= 1e6) return `${nf(y / 1e6)} Mya`;
  if (y >= 1e3) return `${nf(y / 1e3)} kya`;
  return `${nf(y)} ya`;
}

/**
 * A caption is the narration line itself. When the line opens with its own date ("Around 60,000 years ago, ..."), that
 * clause is the caption's date (set like one, word for word what the voice says); otherwise the event's date label
 * leads in front of it.
 */
export function captionParts(text: string, label: string): { when: string; lead: boolean; rest: string } {
  const m = /^((?:[^,]|\d,\d{3}){2,60}?(?:\bago|\b\d{4}|\bcenturies)),\s+/.exec(text);
  if (m) return { when: `${m[1]},`, lead: true, rest: text.slice(m[0].length) };
  return { when: fmtWhen(label), lead: false, rest: text };
}

/**
 * A date label as the opening words of a sentence: "~430 million years ago" -> "About 430 million years ago",
 * "~3.5 billion years ago (approx.)" -> "About 3.5 billion years ago", "Now" -> "Today".
 */
export function fmtWhen(label: string): string {
  let s = label.trim().replace(/\s*\(approx\.?\)\s*$/i, '');
  if (/^now$/i.test(s)) return 'Today';
  s = s.replace(/^~\s*/, 'About ').replace(/^about\b/, 'About').replace(/^c\.\s*/, 'Around ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
