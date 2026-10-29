/**
 * Tracker formula evaluation.
 *
 * A tracker's maximum may be a number or a tiny expression so it follows the
 * character instead of being retyped every level-up: a monk's ki is "level",
 * bardic inspiration is "cha".
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := factor ('/' factor)*          -- floor division
 *   factor := integer | identifier
 *
 * Ability identifiers resolve to MODIFIERS, not scores. `level` is the whole
 * character; `classlevel` is the level of the class the tracker belongs to,
 * which is what a class feature actually scales with. Deliberately a real
 * parser and never `eval`: these strings come from user input.
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export type FormulaContext = {
  level: number;
  /** The level of the class a tracker belongs to; the total when it has none. */
  classlevel: number;
  prof: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  /** Lookup used to scope `classlevel` per tracker; not an identifier itself. */
  classLevels?: Record<string, number>;
};

const IDENTIFIERS = [
  'level',
  'classlevel',
  'prof',
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha'
] as const;

type Token = { kind: 'number'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: '+' | '-' | '/' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === '+' || ch === '-' || ch === '/') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
    } else if (/[0-9]/.test(ch)) {
      let digits = '';
      while (i < input.length && /[0-9]/.test(input[i])) digits += input[i++];
      tokens.push({ kind: 'number', value: Number(digits) });
    } else if (/[a-z]/i.test(ch)) {
      let name = '';
      while (i < input.length && /[a-z]/i.test(input[i])) name += input[i++];
      tokens.push({ kind: 'name', value: name.toLowerCase() });
    } else {
      throw new FormulaError(`Unexpected character ${JSON.stringify(ch)}`);
    }
  }
  return tokens;
}

export function evaluateFormula(expr: string | number, ctx: FormulaContext): number {
  if (typeof expr === 'number') {
    if (!Number.isFinite(expr)) throw new FormulaError('Not a finite number');
    return Math.trunc(expr);
  }

  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new FormulaError('Empty formula');

  let pos = 0;
  const peek = () => tokens[pos];

  function factor(): number {
    const token = peek();
    if (!token) throw new FormulaError('Unexpected end of formula');
    pos += 1;
    if (token.kind === 'number') return token.value;
    if (token.kind === 'name') {
      if (!(IDENTIFIERS as readonly string[]).includes(token.value)) {
        throw new FormulaError(`Unknown identifier ${JSON.stringify(token.value)}`);
      }
      return ctx[token.value as (typeof IDENTIFIERS)[number]];
    }
    throw new FormulaError(`Unexpected operator ${JSON.stringify(token.value)}`);
  }

  function term(): number {
    let value = factor();
    let token = peek();
    while (token?.kind === 'op' && token.value === '/') {
      pos += 1;
      const divisor = factor();
      if (divisor === 0) throw new FormulaError('Division by zero');
      value = Math.floor(value / divisor);
      token = peek();
    }
    return value;
  }

  function expression(): number {
    let value = term();
    let token = peek();
    while (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
      const op = token.value;
      pos += 1;
      const rhs = term();
      value = op === '+' ? value + rhs : value - rhs;
      token = peek();
    }
    return value;
  }

  const result = expression();
  if (pos !== tokens.length) {
    throw new FormulaError(`Unexpected trailing input in ${JSON.stringify(expr)}`);
  }
  return result;
}
