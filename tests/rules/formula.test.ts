import { describe, expect, test } from 'vitest';
import { FormulaError, evaluateFormula, type FormulaContext } from '$lib/rules/formula';

// Loka at level 5: proficiency +3, DEX 18 (+4), CHA 18 (+4), INT 9 (-1).
const ctx: FormulaContext = {
  level: 5,
  classlevel: 5, prof: 3,
  str: 1,
  dex: 4,
  con: 3,
  int: -1,
  wis: 2,
  cha: 4
};

describe('evaluateFormula', () => {
  test('a plain number passes through', () => {
    expect(evaluateFormula(4, ctx)).toBe(4);
  });

  test('a numeric string parses', () => {
    expect(evaluateFormula('4', ctx)).toBe(4);
  });

  test('level resolves', () => {
    expect(evaluateFormula('level', ctx)).toBe(5);
  });

  test('prof resolves', () => {
    expect(evaluateFormula('prof', ctx)).toBe(3);
  });

  test('an ability resolves to its modifier', () => {
    expect(evaluateFormula('cha', ctx)).toBe(4);
    expect(evaluateFormula('int', ctx)).toBe(-1);
  });

  test('addition', () => {
    expect(evaluateFormula('prof+1', ctx)).toBe(4);
  });

  test('subtraction', () => {
    expect(evaluateFormula('level-1', ctx)).toBe(4);
  });

  test('division floors', () => {
    expect(evaluateFormula('level/2', ctx)).toBe(2);
  });

  test('division binds tighter than addition', () => {
    expect(evaluateFormula('level/2+1', ctx)).toBe(3);
  });

  test('whitespace is ignored', () => {
    expect(evaluateFormula('  prof + 1 ', ctx)).toBe(4);
  });

  test('a negative result is preserved', () => {
    expect(evaluateFormula('int', ctx)).toBe(-1);
  });

  test('unknown identifier throws FormulaError', () => {
    expect(() => evaluateFormula('wisdom', ctx)).toThrow(FormulaError);
  });

  test.each(['level +', '', '2++2', '/2', 'level 2', '2/'])(
    'malformed input %j throws FormulaError',
    (expr) => {
      expect(() => evaluateFormula(expr, ctx)).toThrow(FormulaError);
    }
  );
});
