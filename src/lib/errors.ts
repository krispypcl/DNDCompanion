/**
 * What the reader is told when something goes wrong. Errors are written to
 * be light-hearted — an exclamation, a wink at the table — without being
 * vague: each still says what happened and what to do about it.
 *
 * Supabase and the browser have their own wording ("Invalid login
 * credentials", "Failed to fetch"), which is translated here; anything not
 * recognised falls back to the caller's own message.
 */

const KNOWN: [RegExp, string][] = [
  [/invalid login credentials/i, "That email and password don't match! Check both and roll again."],
  [/email not confirmed/i, 'Your email isn’t confirmed yet! Open the link we sent you first.'],
  [/user already registered|already been registered/i, 'That email already has an account! Try signing in instead.'],
  [/password should be at least/i, 'That password is too short! Use at least 8 characters.'],
  [/new password should be different/i, 'That’s the password you already have! Pick a new one.'],
  [/rate limit|too many requests|security purposes/i, 'Whoa, too many tries at once! Take a short rest and try again in a minute.'],
  [/failed to fetch|networkerror|network request failed|load failed/i, 'Couldn’t reach the server! Check your connection and try again.'],
  [/jwt expired|session.*(missing|expired)|not authenticated/i, 'Your session ran out! Sign in again to carry on.']
];

export function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  for (const [pattern, text] of KNOWN) if (pattern.test(raw)) return text;
  return fallback;
}
