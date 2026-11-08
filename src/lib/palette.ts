/**
 * The colours offered for writing and drawing, everywhere: notes and
 * backstory (text colour and pen), and the table's board. Each is a CSS
 * variable with a dark-page and a light-page value (src/app.css, Ink), so
 * whatever is drawn stays readable when the mode changes.
 */
export type Ink = { name: string; c: string };

/** Pens and writing: the page's own text colour first. */
export const INKS: Ink[] = [
  { name: 'Text', c: 'var(--text)' },
  { name: 'Red', c: 'var(--ink-red)' },
  { name: 'Orange', c: 'var(--ink-orange)' },
  { name: 'Gold', c: 'var(--ink-gold)' },
  { name: 'Lime', c: 'var(--ink-lime)' },
  { name: 'Green', c: 'var(--ink-green)' },
  { name: 'Teal', c: 'var(--ink-teal)' },
  { name: 'Blue', c: 'var(--ink-blue)' },
  { name: 'Purple', c: 'var(--ink-purple)' },
  { name: 'Pink', c: 'var(--ink-pink)' },
  { name: 'Brown', c: 'var(--ink-brown)' },
  { name: 'Grey', c: 'var(--ink-grey)' }
];

/** Sticky-note papers: pale in either mode, with dark writing on them. */
export const PAPERS: Ink[] = [
  { name: 'Yellow', c: 'oklch(90% 0.13 95)' },
  { name: 'Orange', c: 'oklch(86% 0.11 60)' },
  { name: 'Pink', c: 'oklch(86% 0.09 350)' },
  { name: 'Purple', c: 'oklch(84% 0.08 300)' },
  { name: 'Blue', c: 'oklch(86% 0.07 235)' },
  { name: 'Teal', c: 'oklch(88% 0.07 190)' },
  { name: 'Green', c: 'oklch(88% 0.1 145)' },
  { name: 'Lime', c: 'oklch(92% 0.12 120)' },
  { name: 'White', c: 'oklch(97% 0.005 286)' },
  { name: 'Grey', c: 'oklch(84% 0.01 286)' }
];
