/**
 * Tracker formula evaluation.
 *
 * A tracker's maximum may be a number or a tiny expression so it follows the
 * character instead of being retyped every level-up: a monk's ki is "level",
 * bardic inspiration is "cha".
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('/' | '*') factor)*  -- '/' is floor division
 *   factor := integer | identifier | call | '(' expr ')'
 *   call   := name '(' expr (',' expr)* ')'
 *
 * The calls are what the ready-made trackers are written in, so they read
 * like the class tables they come from:
 *
 *   at(1, 2, 3, 3, 6, 4)   by class level: 2 from 1st, 3 from 3rd, 4 from 6th
 *   full(3)                3rd-level slots for a full caster at its class level
 *   half(2), third(1)      the same for half casters (2024) and third casters
 *   pact()                 a warlock's Pact Magic slots
 *   min(a, b), max(a, b)
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

type Op = '+' | '-' | '/' | '*' | '(' | ')' | ',';
type Token = { kind: 'number'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: Op };

/** Spell slots by caster level (rows) and spell level (columns 1–9). */
const FULL_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
];
/** Slots of one spell level for a given caster level (0 for none). */
export function slotsAt(casterLevel: number, spellLevel: number): number {
  if (casterLevel < 1 || spellLevel < 1 || spellLevel > 9) return 0;
  return FULL_SLOTS[Math.min(20, casterLevel) - 1][spellLevel - 1] ?? 0;
}
const ceilDiv = (a: number, b: number) => Math.floor((a + b - 1) / b);

const FUNCTIONS: Record<string, (args: number[], ctx: FormulaContext) => number> = {
  /** Breakpoints by class level: at(level, value, level, value, ...). */
  at: (args, ctx) => {
    if (args.length < 2 || args.length % 2) throw new FormulaError('at() takes pairs: a level, then its value');
    let value = 0;
    for (let i = 0; i < args.length; i += 2) if (ctx.classlevel >= args[i]) value = args[i + 1];
    return value;
  },
  full: ([n], ctx) => slotsAt(ctx.classlevel, n),
  // 2024 half casters (paladin, ranger) have slots from 1st level.
  half: ([n], ctx) => slotsAt(ceilDiv(ctx.classlevel, 2), n),
  // Eldritch Knight and Arcane Trickster: from 3rd level.
  third: ([n], ctx) => (ctx.classlevel < 3 ? 0 : slotsAt(ceilDiv(ctx.classlevel, 3), n)),
  pact: (_args, ctx) => (ctx.classlevel < 1 ? 0 : ctx.classlevel < 2 ? 1 : ctx.classlevel < 11 ? 2 : ctx.classlevel < 17 ? 3 : 4),
  min: (args) => {
    if (!args.length) throw new FormulaError('min() needs a value');
    return Math.min(...args);
  },
  max: (args) => {
    if (!args.length) throw new FormulaError('max() needs a value');
    return Math.max(...args);
  }
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if ('+-/*(),'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch as Op });
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
    if (token.kind === 'op' && token.value === '(') {
      const inner = expression();
      expect(')');
      return inner;
    }
    if (token.kind === 'name' && peek()?.kind === 'op' && peek()!.value === '(') {
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new FormulaError(`Unknown function ${JSON.stringify(token.value)}`);
      pos += 1;
      const args: number[] = [];
      if (!(peek()?.kind === 'op' && peek()!.value === ')')) {
        args.push(expression());
        while (peek()?.kind === 'op' && peek()!.value === ',') {
          pos += 1;
          args.push(expression());
        }
      }
      expect(')');
      return fn(args, ctx);
    }
    if (token.kind === 'name') {
      if (!(IDENTIFIERS as readonly string[]).includes(token.value)) {
        throw new FormulaError(`Unknown identifier ${JSON.stringify(token.value)}`);
      }
      return ctx[token.value as (typeof IDENTIFIERS)[number]];
    }
    throw new FormulaError(`Unexpected operator ${JSON.stringify(token.value)}`);
  }

  function expect(op: Op) {
    const token = peek();
    if (!(token?.kind === 'op' && token.value === op)) throw new FormulaError(`Expected ${JSON.stringify(op)}`);
    pos += 1;
  }

  function term(): number {
    let value = factor();
    let token = peek();
    while (token?.kind === 'op' && (token.value === '/' || token.value === '*')) {
      pos += 1;
      const rhs = factor();
      if (token.value === '*') value *= rhs;
      else {
        if (rhs === 0) throw new FormulaError('Division by zero');
        value = Math.floor(value / rhs);
      }
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
