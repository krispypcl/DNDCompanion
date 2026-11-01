/**
 * The address anyone can open to read a sheet. It is the sheet's own URL: a
 * sheet is readable by whoever has it, and only its owner can change it.
 */
export function sheetLink(origin: string, base: string, id: string): string {
  const root = origin.replace(/\/+$/, '');
  const path = base ? `/${base.replace(/^\/+|\/+$/g, '')}` : '';
  return `${root}${path}/s/${id}`;
}
