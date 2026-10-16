const nf = (n: number, d = 1) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Compact "years ago" phrase for the live readout. */
export function fmtYearsAgo(y: number): string {
  if (y < 1) return 'Present day';
  if (y >= 1e9) return `${nf(y / 1e9, 2)} billion years ago`;
  if (y >= 1e6) return `${nf(y / 1e6, y >= 1e7 ? 1 : 2)} million years ago`;
  if (y >= 1e4) return `${nf(Math.round(y / 100) * 100, 0)} years ago`;
  return `${nf(Math.round(y), 0)} years ago`;
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
 * A date label as the opening words of a sentence: "~430 million years ago" -> "About 430 million years ago",
 * "~3.5 billion years ago (approx.)" -> "About 3.5 billion years ago", "Now" -> "Today".
 */
export function fmtWhen(label: string): string {
  let s = label.trim().replace(/\s*\(approx\.?\)\s*$/i, '');
  if (/^now$/i.test(s)) return 'Today';
  s = s.replace(/^~\s*/, 'About ').replace(/^about\b/, 'About').replace(/^c\.\s*/, 'Around ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
