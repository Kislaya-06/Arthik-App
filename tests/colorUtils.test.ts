import { describe, it, expect } from 'vitest';
import { tintColor, shadeColor, getBadgeGradientColors } from '../src/lib/colorUtils';

describe('colorUtils', () => {
  describe('tintColor', () => {
    it('lightens color towards white by the given factor', () => {
      // #B8E0C8 -> tint 0.15
      const tinted = tintColor('#B8E0C8', 0.15);
      expect(tinted).toBe('#C3E5D0');
    });

    it('returns #FFFFFF when factor is 1', () => {
      expect(tintColor('#FF857A', 1)).toBe('#FFFFFF');
    });

    it('returns original uppercase hex when factor is 0', () => {
      expect(tintColor('#FF857A', 0)).toBe('#FF857A');
    });

    it('handles 3-character hex shorthand', () => {
      expect(tintColor('#FFF', 0.5)).toBe('#FFFFFF');
      expect(tintColor('#000', 0.5)).toBe('#808080');
    });
  });

  describe('shadeColor', () => {
    it('darkens color towards black by the given factor', () => {
      // #B8E0C8 -> shade 0.10
      const shaded = shadeColor('#B8E0C8', 0.10);
      expect(shaded).toBe('#A6CAB4');
    });

    it('returns #000000 when factor is 1', () => {
      expect(shadeColor('#FF857A', 1)).toBe('#000000');
    });

    it('returns original uppercase hex when factor is 0', () => {
      expect(shadeColor('#FF857A', 0)).toBe('#FF857A');
    });
  });

  describe('getBadgeGradientColors', () => {
    it('produces 3-stop gradient with brand navy icon for light and pastel colors', () => {
      const coralColors = getBadgeGradientColors('#FF857A', true);
      expect(coralColors.startColor).toBe('#FFA097');
      expect(coralColors.midColor).toBe('#FF857A');
      expect(coralColors.endColor).toBe('#DB7269');
      // For light/pastel colors, iconColor is brand navy #1A2B4C
      expect(coralColors.iconColor).toBe('#1A2B4C');
      expect(coralColors.strokeColor).toBe('rgba(255, 255, 255, 0.15)');

      const mintColors = getBadgeGradientColors('#ADEBB3', false);
      expect(mintColors.midColor).toBe('#ADEBB3');
      expect(mintColors.iconColor).toBe('#1A2B4C');
      expect(mintColors.strokeColor).toBe('rgba(0, 0, 0, 0.05)');
    });

    it('uses white iconColor for dark custom category colors', () => {
      const darkColors = getBadgeGradientColors('#1A2B4C', true);
      expect(darkColors.iconColor).toBe('#FFFFFF');
    });

    it('falls back safely when empty or invalid string is provided', () => {
      const fallback = getBadgeGradientColors('');
      expect(fallback.midColor).toBe('#ADEBB3');
      expect(fallback.iconColor).toBe('#1A2B4C');
    });
  });
});
