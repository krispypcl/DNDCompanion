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

describe('formula calls', () => {
  const at = (classlevel: number) => ({ level: classlevel, classlevel, prof: 2, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 3 });
  test('at() steps by class level', () => {
    const rage = 'at(1, 2, 3, 3, 6, 4, 12, 5, 17, 6)';
    expect([1, 2, 3, 5, 6, 11, 12, 17, 20].map((l) => evaluateFormula(rage, at(l)))).toEqual([2, 2, 3, 3, 4, 4, 5, 6, 6]);
    expect(evaluateFormula('at(2, 1)', at(1))).toBe(0);
  });
  test('spell slots for full, half and third casters, and pact magic', () => {
    expect(evaluateFormula('full(1)', at(1))).toBe(2);
    expect(evaluateFormula('full(3)', at(5))).toBe(2);
    expect(evaluateFormula('full(9)', at(17))).toBe(1);
    expect(evaluateFormula('full(9)', at(16))).toBe(0);
    expect(evaluateFormula('half(1)', at(1))).toBe(2);
    expect(evaluateFormula('half(2)', at(5))).toBe(2);
    expect(evaluateFormula('third(1)', at(2))).toBe(0);
    expect(evaluateFormula('third(1)', at(3))).toBe(2);
    expect(evaluateFormula('third(2)', at(7))).toBe(2);
    expect([1, 2, 11, 17].map((l) => evaluateFormula('pact()', at(l)))).toEqual([1, 2, 3, 4]);
  });
  test('multiplies, groups, and takes min and max', () => {
    expect(evaluateFormula('classlevel * 5', at(4))).toBe(20);
    expect(evaluateFormula('(classlevel + 1) / 2', at(5))).toBe(3);
    expect(evaluateFormula('max(1, cha)', at(1))).toBe(3);
    expect(evaluateFormula('min(classlevel, at(2, 20))', at(1))).toBe(0);
    expect(evaluateFormula('min(classlevel, at(2, 20))', at(7))).toBe(7);
  });
  test('refuses what it does not know', () => {
    expect(() => evaluateFormula('nope(1)', at(1))).toThrow(/Unknown function/);
    expect(() => evaluateFormula('at(1)', at(1))).toThrow(/pairs/);
    expect(() => evaluateFormula('(1 + 2', at(1))).toThrow();
  });
});
