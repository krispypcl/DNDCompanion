/**
 * How hard a password would be to guess, as a meter for the sign-up form.
 * Not a guarantee — a rough reading that rewards length above all, notices
 * the passwords everyone tries first, and does not count a run of one key
 * or the user's own email as variety.
 */

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string | null };

/** The ones guessed first, in every leaked list. */
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop',
  'qwerty123', '11111111', '00000000', 'iloveyou', 'abc12345', 'abcd1234', 'letmein1',
  'welcome1', 'sunshine', 'princess', 'football', 'baseball', 'dragon12', 'dragons1',
  'monkey12', 'trustno1', 'passw0rd', 'p@ssw0rd', 'qwerty12', 'asdfghjk', 'zxcvbnm1',
  'dungeons', 'dungeon1', 'dungeonsanddragons', 'dndcompanion', 'wizard12', 'master12'
]);

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** The longest stretch of the password that is one key repeated or a keyboard run. */
function predictable(pw: string): number {
  const lower = pw.toLowerCase();
  let worst = 0;
  let run = 1;
  for (let i = 1; i < lower.length; i++) {
    run = lower[i] === lower[i - 1] ? run + 1 : 1;
    worst = Math.max(worst, run);
  }
  for (const seq of SEQUENCES) {
    for (const s of [seq, [...seq].reverse().join('')]) {
      for (let len = lower.length; len >= 3; len--) {
        let found = false;
        for (let i = 0; i + len <= lower.length; i++) {
          if (s.includes(lower.slice(i, i + len))) {
            found = true;
            break;
          }
        }
        if (found) {
          worst = Math.max(worst, len);
          break;
        }
      }
    }
  }
  return worst;
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

export function passwordStrength(pw: string, email = ''): Strength {
  const make = (score: Strength['score'], hint: string | null): Strength => ({ score, label: LABELS[score], hint });
  if (!pw) return make(0, null);
  if (pw.length < 8) return make(0, 'Use at least 8 characters.');

  const lower = pw.toLowerCase();
  const name = email.split('@')[0]?.toLowerCase() ?? '';
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[^a-z0-9]/g, ''))) {
    return make(0, 'That is one of the first passwords anyone tries.');
  }
  if (name.length >= 3 && lower.includes(name)) {
    return make(1, 'Leave your email name out of it.');
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  // Only the unpredictable part counts towards length.
  const effective = pw.length - Math.max(0, predictable(pw) - 2);

  let points = 0;
  if (effective >= 8) points += 1;
  if (effective >= 12) points += 1;
  if (effective >= 16) points += 1;
  if (classes >= 2) points += 1;
  if (classes >= 3) points += 1;
  const score = Math.max(1, Math.min(4, points - 1)) as Strength['score'];

  const hint =
    score >= 4
      ? null
      : effective < 12
        ? 'Longer is stronger: a few unrelated words make a good one.'
        : classes < 3
          ? 'Mix in capitals, numbers or symbols.'
          : null;
  return make(score, hint);
}
