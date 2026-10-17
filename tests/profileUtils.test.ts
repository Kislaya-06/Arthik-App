import { describe, it, expect } from 'vitest';
import {
  MAX_PROFILE_NAME_LENGTH,
  calculateNameLength,
  getDisplayName,
  clampNameInput,
  validateProfileName,
} from '../src/lib/profileUtils';

describe('profileUtils (Name & Guardrails)', () => {
  it('has benchmark maximum length of 15 matching "Kislaya Agarwal"', () => {
    expect(MAX_PROFILE_NAME_LENGTH).toBe(15);
    expect('Kislaya Agarwal'.length).toBe(15);
  });

  describe('calculateNameLength', () => {
    it('calculates length with both first and last name including the single separator space', () => {
      expect(calculateNameLength('Kislaya', 'Agarwal')).toBe(15);
      expect(calculateNameLength('  Kislaya  ', '  Agarwal  ')).toBe(15);
    });

    it('calculates length when only first name is present', () => {
      expect(calculateNameLength('Kislaya', '')).toBe(7);
      expect(calculateNameLength('Kislaya', null)).toBe(7);
    });

    it('calculates length when only last name is present', () => {
      expect(calculateNameLength('', 'Agarwal')).toBe(7);
      expect(calculateNameLength(null, 'Agarwal')).toBe(7);
    });

    it('returns 0 when both are empty or whitespace', () => {
      expect(calculateNameLength('', '')).toBe(0);
      expect(calculateNameLength('   ', '   ')).toBe(0);
    });
  });

  describe('getDisplayName', () => {
    it('returns full name from profile when both first and last name are present', () => {
      const profile = { first_name: 'Kislaya', last_name: 'Agarwal' };
      expect(getDisplayName(profile)).toBe('Kislaya Agarwal');
    });

    it('returns only first name when last name is absent or empty', () => {
      expect(getDisplayName({ first_name: 'Kislaya', last_name: '' })).toBe('Kislaya');
      expect(getDisplayName({ first_name: 'Kislaya', last_name: null })).toBe('Kislaya');
    });

    it('falls back to user metadata when profile is missing or has default "User"', () => {
      const meta = { full_name: 'Kislaya Agarwal' };
      expect(getDisplayName({ first_name: 'User', last_name: '' }, meta)).toBe('Kislaya Agarwal');
      expect(getDisplayName(null, meta)).toBe('Kislaya Agarwal');
    });

    it('falls back to email prefix when metadata is absent', () => {
      expect(getDisplayName(null, null, 'iamkislayaagarwal@gmail.com')).toBe('iamkislayaagarwal');
    });

    it('falls back to "User" when no name or email is present', () => {
      expect(getDisplayName(null, null, null)).toBe('User');
    });
  });

  describe('clampNameInput', () => {
    it('allows text when total length is strictly within 15 characters', () => {
      const res = clampNameInput('Agarwal', 'Kislaya', 'last');
      expect(res.text).toBe('Agarwal');
      expect(res.limitReached).toBe(false);
    });

    it('clamps text and reports limitReached when user attempts to exceed 15 characters in last name', () => {
      // First is "Kislaya" (7 chars). Space is 1 char. Max allowed for last is 15 - 8 = 7 chars.
      const res = clampNameInput('Agarwala', 'Kislaya', 'last');
      expect(res.text).toBe('Agarwal');
      expect(res.limitReached).toBe(true);
    });

    it('clamps text and reports limitReached when user attempts to exceed 15 characters in first name', () => {
      // Last is "Agarwal" (7 chars). Space is 1 char. Max allowed for first is 15 - 8 = 7 chars.
      const res = clampNameInput('Kislayas', 'Agarwal', 'first');
      expect(res.text).toBe('Kislaya');
      expect(res.limitReached).toBe(true);
    });

    it('allows single name up to 15 characters when other field is empty', () => {
      const res = clampNameInput('123456789012345', '', 'first');
      expect(res.text).toBe('123456789012345');
      expect(res.limitReached).toBe(false);

      const overflow = clampNameInput('1234567890123456', '', 'first');
      expect(overflow.text).toBe('123456789012345');
      expect(overflow.limitReached).toBe(true);
    });

    it('disallows adding any last name when first name already consumes all 15 characters', () => {
      const res = clampNameInput('A', '123456789012345', 'last');
      expect(res.text).toBe('');
      expect(res.limitReached).toBe(true);
    });
  });

  describe('validateProfileName', () => {
    it('validates benchmark name "Kislaya Agarwal" successfully', () => {
      const res = validateProfileName('Kislaya', 'Agarwal');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
    });

    it('rejects empty first name', () => {
      const res = validateProfileName('', 'Agarwal');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('First name is required.');
    });

    it('rejects name exceeding 15 characters', () => {
      const res = validateProfileName('Kislaya', 'Agarwalji');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Maximum 15 characters allowed');
    });
  });
});
