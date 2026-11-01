/**
 * Notes and backstory are written in pages, like a book. They are stored as
 * one text with a form feed between pages: a character nobody types, so it
 * can never appear in the writing by accident, and a sheet written before
 * pages existed is simply a book of one page.
 */
export const PAGE_BREAK = '\f';

export function splitPages(body: string | null | undefined): string[] {
  return (body ?? '').split(PAGE_BREAK);
}

export function joinPages(pages: string[]): string {
  return (pages.length ? pages : ['']).join(PAGE_BREAK);
}

/** A blank page straight after `at`. */
export function addPage(pages: string[], at: number): string[] {
  const i = Math.min(Math.max(at + 1, 0), pages.length);
  return [...pages.slice(0, i), '', ...pages.slice(i)];
}

/** There is always at least one page, so removing the last empties it. */
export function removePage(pages: string[], at: number): string[] {
  if (pages.length <= 1) return [''];
  return pages.filter((_, i) => i !== at);
}

export function setPage(pages: string[], at: number, text: string): string[] {
  const next = [...pages];
  // Nothing a person types can split a page in two.
  next[at] = text.replaceAll(PAGE_BREAK, '');
  return next;
}

export const isBlank = (pages: string[]) => pages.every((p) => p.trim() === '');
