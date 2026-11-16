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

/** A day written out in full, month first: 11/16/2026. */
export function numericDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getMonth() + 1)}/${two(d.getDate())}/${d.getFullYear()}`;
}

/**
 * When the next session is, for a campaign: the day and time ("Sat, Nov 22,
 * 7:00 PM") and how far off it is ("today", "tomorrow", "in 5 days"; "now"
 * within its first hours, and nothing once it is well past).
 */
export function sessionWhen(iso: string | null | undefined, now: Date = new Date()): { when: string; until: string; past: boolean } | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const when = at.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ms = at.getTime() - now.getTime();
  // A session runs a few hours: it is "now" from its start until then.
  if (ms < 0) return ms > -4 * 3_600_000 ? { when, until: 'now', past: false } : { when, until: 'past', past: true };
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  const until = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return { when, until, past: false };
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
