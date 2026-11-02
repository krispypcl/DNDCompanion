/**
 * Dates as a person says them: "today", "yesterday", or the day itself, with
 * the year only when it is not this one.
 */
const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function friendlyDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(when)) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return when.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(when.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  });
}

/** The later of several timestamps, ignoring blanks. */
export function latest(...stamps: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const s of stamps) {
    if (!s || Number.isNaN(new Date(s).getTime())) continue;
    if (!best || new Date(s) > new Date(best)) best = s;
  }
  return best;
}
