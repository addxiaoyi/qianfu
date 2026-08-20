import { describe, expect, it } from 'vitest';

import {
  fenToYuanNumber,
  fenToYuanText,
  formatCnyFromFen,
  parseYuanToFen,
} from '../../qianfu-liandeng/src/utils/money';

describe('marketplace money contract', () => {
  it('formats integer fen as Chinese yuan', () => {
    expect(fenToYuanNumber(700)).toBe(7);
    expect(fenToYuanText(700)).toBe('7.00');
    expect(formatCnyFromFen(700)).toBe('¥7.00');
    expect(formatCnyFromFen(1)).toBe('¥0.01');
  });

  it('parses yuan input without floating-point rounding', () => {
    expect(parseYuanToFen('7')).toBe(700);
    expect(parseYuanToFen('7.5')).toBe(750);
    expect(parseYuanToFen('7.50')).toBe(750);
    expect(parseYuanToFen('0.01')).toBe(1);
  });

  it('rejects unsupported precision and unsafe values', () => {
    expect(parseYuanToFen('7.005')).toBeNull();
    expect(parseYuanToFen('-1')).toBeNull();
    expect(parseYuanToFen('abc')).toBeNull();
    expect(parseYuanToFen('')).toBeNull();
    expect(fenToYuanNumber(Number.NaN)).toBe(0);
  });
});
