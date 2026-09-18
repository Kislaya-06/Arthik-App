import { describe, it, expect } from 'vitest';
import { applyKeypadPress, parseKeypadAmount } from '../src/lib/amountKeypad';

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

  describe('ceiling and character length limits (characterizing current quirks)', () => {
    it('allows appending up to 10 characters due to > 9 check', () => {
      // 9 characters long
      const nineDigits = '123456789';
      // > 9 check is false when length is 9, so 10th character is accepted
      const tenDigits = applyKeypadPress(nineDigits, '0');
      expect(tenDigits).toBe('1234567890');
      expect(tenDigits.length).toBe(10);

      // Once length is 10, > 9 check is true, blocking further digits
      expect(applyKeypadPress(tenDigits, '5')).toBe('1234567890');
    });

    it('blocks adding decimals if total string length including dot already exceeds 9', () => {
      // Quirk: key === '.' does not check current.length > 9, so dot is appended
      const tenDigits = '1234567890';
      const withDot = applyKeypadPress(tenDigits, '.');
      expect(withDot).toBe('1234567890.');

      // But next digit press sees withDot.length (11) > 9, so it blocks adding any decimal digit!
      expect(applyKeypadPress(withDot, '5')).toBe('1234567890.');
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
  });
});
