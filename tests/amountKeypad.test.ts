import { describe, it, expect } from 'vitest';
import {
  applyKeypadPress,
  parseKeypadAmount,
  evaluateExpression,
  formatExpressionWithCommas,
} from '../src/lib/amountKeypad';

describe('amountKeypad', () => {
  describe('single decimal and second dot rejection', () => {
    it('prepends leading zero when dot is pressed on empty input', () => {
      expect(applyKeypadPress('', '.')).toBe('0.');
    });

    it('appends dot when pressed after a non-empty whole number', () => {
      expect(applyKeypadPress('5', '.')).toBe('5.');
      expect(applyKeypadPress('100', '.')).toBe('100.');
    });

    it('rejects a second dot when input already contains a dot', () => {
      expect(applyKeypadPress('5.', '.')).toBe('5.');
      expect(applyKeypadPress('5.2', '.')).toBe('5.2');
      expect(applyKeypadPress('0.', '.')).toBe('0.');
    });
  });

  describe('leading zero handling', () => {
    it('types a single 0 when empty', () => {
      expect(applyKeypadPress('', '0')).toBe('0');
    });

    it('keeps single 0 if 0 is pressed repeatedly when input is "0"', () => {
      expect(applyKeypadPress('0', '0')).toBe('0');
    });

    it('replaces "0" with the new non-zero digit', () => {
      expect(applyKeypadPress('0', '1')).toBe('1');
      expect(applyKeypadPress('0', '7')).toBe('7');
    });

    it('transitions "0" to "0." when dot is pressed', () => {
      expect(applyKeypadPress('0', '.')).toBe('0.');
    });
  });

  describe('2-decimal limit', () => {
    it('allows up to 2 decimal places', () => {
      expect(applyKeypadPress('10.', '5')).toBe('10.5');
      expect(applyKeypadPress('10.5', '6')).toBe('10.56');
    });

    it('blocks a 3rd decimal digit when 2 decimal places already exist', () => {
      expect(applyKeypadPress('10.56', '7')).toBe('10.56');
      expect(applyKeypadPress('0.00', '1')).toBe('0.00');
    });
  });

  describe('ceiling and character length limits (decoupled integer and decimal limits)', () => {
    it('enforces max integer limit of 9 digits and blocks a 10th digit', () => {
      const nineDigits = '123456789';
      // Attempting to append a 10th integer digit is blocked
      expect(applyKeypadPress(nineDigits, '0')).toBe('123456789');
    });

    it('allows adding paise even on maximum integer digits', () => {
      const nineDigits = '123456789';
      const withDot = applyKeypadPress(nineDigits, '.');
      expect(withDot).toBe('123456789.');

      const withFirstPaise = applyKeypadPress(withDot, '5');
      expect(withFirstPaise).toBe('123456789.5');

      const withSecondPaise = applyKeypadPress(withFirstPaise, '0');
      expect(withSecondPaise).toBe('123456789.50');

      // Third decimal digit is blocked by 2-decimal limit
      expect(applyKeypadPress(withSecondPaise, '7')).toBe('123456789.50');
    });

    it('allows typing the largest allowed integer of 9 digits', () => {
      let val = '';
      for (let i = 0; i < 9; i++) {
        val = applyKeypadPress(val, '9');
      }
      expect(val).toBe('999999999');
      expect(val.length).toBe(9);
    });

    it('blocks any digit beyond the 9-digit integer limit', () => {
      const maxInt = '999999999';
      expect(applyKeypadPress(maxInt, '1')).toBe('999999999');
      expect(applyKeypadPress(maxInt, '9')).toBe('999999999');
    });

    it('permits entering full paise on the maximum allowed amount', () => {
      const maxInt = '999999999';
      const withDot = applyKeypadPress(maxInt, '.');
      expect(withDot).toBe('999999999.');
      const withPaise = applyKeypadPress(applyKeypadPress(withDot, '9'), '9');
      expect(withPaise).toBe('999999999.99');
    });

    it('allows entering a decimal point at the 9-digit boundary', () => {
      const boundary = '123456789';
      expect(applyKeypadPress(boundary, '.')).toBe('123456789.');
      // Cannot add a second dot
      expect(applyKeypadPress('123456789.', '.')).toBe('123456789.');
    });

    it('handles prefilled legacy amounts exceeding 9 digits gracefully', () => {
      // Legacy 10-digit amount prefilled in edit mode
      const legacy10Digits = '1234567890';
      // Additional integer digits are blocked
      expect(applyKeypadPress(legacy10Digits, '5')).toBe('1234567890');
      // Backspace deletes the trailing digit back to 9 digits
      expect(applyKeypadPress(legacy10Digits, 'backspace')).toBe('123456789');
      // Adding a decimal point still works
      const withDot = applyKeypadPress(legacy10Digits, '.');
      expect(withDot).toBe('1234567890.');
      // Adding paise on prefilled legacy amount works
      expect(applyKeypadPress(withDot, '5')).toBe('1234567890.5');
    });
  });

  describe('backspace behaviour', () => {
    it('removes the single digit back to empty string', () => {
      expect(applyKeypadPress('5', 'backspace')).toBe('');
    });

    it('handles backspace past empty string safely without error', () => {
      expect(applyKeypadPress('', 'backspace')).toBe('');
    });

    it('removes digits and decimal points one by one', () => {
      expect(applyKeypadPress('12.50', 'backspace')).toBe('12.5');
      expect(applyKeypadPress('12.5', 'backspace')).toBe('12.');
      expect(applyKeypadPress('12.', 'backspace')).toBe('12');
      expect(applyKeypadPress('12', 'backspace')).toBe('1');
      expect(applyKeypadPress('1', 'backspace')).toBe('');
    });
  });

  describe('parseKeypadAmount', () => {
    it('parses whole numbers and decimals correctly', () => {
      expect(parseKeypadAmount('500')).toBe(500);
      expect(parseKeypadAmount('1234.56')).toBe(1234.56);
      expect(parseKeypadAmount('0.75')).toBe(0.75);
    });

    it('returns 0 for empty or incomplete decimal strings', () => {
      expect(parseKeypadAmount('')).toBe(0);
      expect(parseKeypadAmount('0')).toBe(0);
      expect(parseKeypadAmount('0.')).toBe(0);
    });

    it('handles trailing dot on positive numbers correctly', () => {
      expect(parseKeypadAmount('50.')).toBe(50);
    });

    it('evaluates expressions correctly via parseKeypadAmount', () => {
      expect(parseKeypadAmount('350 + 120 + 85')).toBe(555);
      expect(parseKeypadAmount('100 + 50 × 2')).toBe(200);
      expect(parseKeypadAmount('1800 ÷ 3')).toBe(600);
    });
  });

  describe('calculator operators and expression evaluation', () => {
    it('appends operator with spacing and replaces operator on consecutive press', () => {
      let val = '350';
      val = applyKeypadPress(val, '+');
      expect(val).toBe('350 + ');

      // Pressing another operator replaces the previous one
      val = applyKeypadPress(val, '×');
      expect(val).toBe('350 × ');

      val = applyKeypadPress(val, '÷');
      expect(val).toBe('350 ÷ ');

      val = applyKeypadPress(val, '−');
      expect(val).toBe('350 − ');
    });

    it('strips trailing dot when operator is pressed', () => {
      expect(applyKeypadPress('350.', '+')).toBe('350 + ');
    });

    it('removes operator cleanly on backspace', () => {
      expect(applyKeypadPress('350 + ', 'backspace')).toBe('350');
      expect(applyKeypadPress('350 + 1', 'backspace')).toBe('350 + ');
    });

    it('evaluates standard multi-operator calculations with proper precedence', () => {
      const res1 = parseKeypadAmount('350 + 120 + 85');
      expect(res1).toBe(555);

      const res2 = parseKeypadAmount('100 + 50 × 2');
      expect(res2).toBe(200); // 50 * 2 = 100, 100 + 100 = 200

      const res3 = parseKeypadAmount('100 − 30 + 10');
      expect(res3).toBe(80);
    });

    it('detects division by zero and sets isDivisionByZero', () => {
      const divZero = evaluateExpression('100 ÷ 0');
      expect(divZero.isDivisionByZero).toBe(true);
      expect(divZero.result).toBe(0);

      const divZeroDec = evaluateExpression('100 ÷ 0.0');
      expect(divZeroDec.isDivisionByZero).toBe(true);

      const divValidDec = evaluateExpression('100 ÷ 0.5');
      expect(divValidDec.isDivisionByZero).toBe(false);
      expect(divValidDec.result).toBe(200);
    });

    it('formats expressions with Indian commas on all numeric tokens', () => {
      expect(formatExpressionWithCommas('1200 + 350.5')).toBe('1,200 + 350.5');
      expect(formatExpressionWithCommas('100000 × 2')).toBe('1,00,000 × 2');
    });
  });
});
