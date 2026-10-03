import { describe, it, expect } from 'vitest';
import {
  ROLL_EXTRA_CYCLES,
  WHEEL_BASE,
  parseText,
  planRoll,
  stepsBetween,
  wheelStart,
  wheelEnd,
  digitAt,
  splitRollingStyles,
} from '../src/lib/rollingText';
import {
  getAdvanceEm,
  getMaxDigitEm,
  measureTextWidth,
  METRIC_CHARS,
  QUICKSAND_ADVANCES,
} from '../src/lib/quicksandMetrics';

describe('rollingText', () => {
  describe('parseText', () => {
    it('splits sentences into static text and number groups', () => {
      const p = parseText('Spent ₹1,250 of ₹10,000');
      expect(p.groups.map((g) => g.raw)).toEqual(['1,250', '10,000']);
      expect(p.statics).toEqual(['Spent ₹', ' of ₹', '']);
    });
    it('keeps decimals inside the group', () => {
      expect(parseText('₹10.50').groups.map((g) => g.raw)).toEqual(['10.50']);
    });
    it('text without digits has no groups', () => {
      expect(parseText('Over limit').groups).toEqual([]);
    });
  });

  describe('stepsBetween', () => {
    it('counts wheel steps in each direction', () => {
      expect(stepsBetween(2, 0, -1)).toBe(2);
      expect(stepsBetween(0, 2, -1)).toBe(8);
      expect(stepsBetween(8, 1, 1)).toBe(3);
      expect(stepsBetween(4, 4, 1)).toBe(0);
    });
  });

  describe('planRoll — the reference example: $1,250 -> $1,050', () => {
    const plan = planRoll('₹1,250', '₹1,050')!;
    const idx = (n: number) => plan.rolls[n];

    it('rolls every digit, including the ones that did not change', () => {
      // text: ₹ 1 , 0 5 0   -> digit indexes 1, 3, 4, 5
      expect(Object.keys(plan.rolls).map(Number)).toEqual([1, 3, 4, 5]);
    });

    it('goes DOWN because the number decreased', () => {
      for (const i of [1, 3, 4, 5]) expect(idx(i).dir).toBe(-1);
    });

    it('unchanged digits make one full extra revolution; changed ones also move to their target', () => {
      expect(idx(1)).toMatchObject({ from: 1, to: 1, travel: 10 * ROLL_EXTRA_CYCLES });
      expect(idx(3)).toMatchObject({ from: 2, to: 0, travel: 2 + 10 * ROLL_EXTRA_CYCLES });
      expect(idx(4)).toMatchObject({ from: 5, to: 5, travel: 10 * ROLL_EXTRA_CYCLES });
      expect(idx(5)).toMatchObject({ from: 0, to: 0, travel: 10 * ROLL_EXTRA_CYCLES });
    });

    it('never touches symbols or commas', () => {
      expect(idx(0)).toBeUndefined(); // ₹
      expect(idx(2)).toBeUndefined(); // ,
    });
  });

  describe('planRoll — direction and edge cases', () => {
    it('goes UP when the number increases', () => {
      const plan = planRoll('₹250', '₹320')!;
      for (const r of Object.values(plan.rolls)) expect(r.dir).toBe(1);
    });

    it('right-aligns digits when the number gains a digit (999 -> 1,000)', () => {
      const plan = planRoll('₹999', '₹1,000')!;
      // ₹ 1 , 0 0 0  -> digits at 1,3,4,5 ; the leading 1 is new
      expect(plan.rolls[1]).toMatchObject({ to: 1, isNew: true, from: 0 });
      expect(plan.rolls[3]).toMatchObject({ from: 9, to: 0, isNew: false });
      expect(plan.rolls[5]).toMatchObject({ from: 9, to: 0 });
    });

    it('returns null when nothing changed', () => {
      expect(planRoll('₹250', '₹250')).toBeNull();
    });

    it('returns null when the sentence around the number changes (it is just swapped)', () => {
      expect(planRoll('Spent ₹1,000 of ₹5,000', 'to stay within ₹5,000 monthly budget')).toBeNull();
      expect(planRoll('₹250 left', '₹250 saved')).toBeNull();
    });

    it('returns null when the amount of numbers differs', () => {
      expect(planRoll('₹250', '₹250 of ₹500')).toBeNull();
    });

    it('rolls only the number that changed inside a sentence', () => {
      const plan = planRoll('Spent ₹1,000 of ₹5,000', 'Spent ₹1,200 of ₹5,000')!;
      const idxs = Object.keys(plan.rolls).map(Number);
      const text = 'Spent ₹1,200 of ₹5,000';
      for (const i of idxs) expect(i).toBeLessThan(text.indexOf(' of')); // only the first number
      expect(idxs.length).toBe(4);
    });

    it('works for percentages and signed values', () => {
      expect(planRoll('5%', '12%')).not.toBeNull();
      expect(planRoll('−₹80', '−₹160')).not.toBeNull();
      expect(planRoll('+₹1,000', '+₹1,000')).toBeNull();
    });

    it('from zero to something and back', () => {
      expect(planRoll('₹0', '₹250')).not.toBeNull();
      expect(planRoll('₹250', '₹0')).not.toBeNull();
    });
  });

  describe('wheel math lands exactly on the target digit', () => {
    it('for every from/to/direction the wheel ends on `to`', () => {
      for (let from = 0; from <= 9; from++) {
        for (let to = 0; to <= 9; to++) {
          for (const dir of [1, -1] as const) {
            const base = stepsBetween(from, to, dir);
            const roll = { from, to, dir, travel: base + 10 * ROLL_EXTRA_CYCLES, isNew: false };
            expect(wheelStart(roll)).toBe(WHEEL_BASE + from);
            expect(digitAt(wheelStart(roll))).toBe(from);
            expect(digitAt(wheelEnd(roll))).toBe(to);
            // positions stay positive for the whole roll (so the native modulo never sees a negative)
            expect(Math.min(wheelStart(roll), wheelEnd(roll))).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});

describe('quicksandMetrics', () => {
  it('has one advance per covered character for every weight', () => {
    for (const fam of Object.keys(QUICKSAND_ADVANCES)) {
      expect(QUICKSAND_ADVANCES[fam].length).toBe(METRIC_CHARS.length);
    }
  });

  it('digits are proportional: a 1 is narrower than a 0', () => {
    expect(getAdvanceEm('Quicksand_700Bold', '1')).toBeLessThan(getAdvanceEm('Quicksand_700Bold', '0'));
    expect(getMaxDigitEm('Quicksand_700Bold')).toBeCloseTo(0.614, 3);
  });

  it('measures text by summing advances', () => {
    const w = measureTextWidth('₹1,250', 'Quicksand_700Bold', 30);
    const expected =
      (getAdvanceEm('Quicksand_700Bold', '₹') +
        getAdvanceEm('Quicksand_700Bold', '1') +
        getAdvanceEm('Quicksand_700Bold', ',') +
        getAdvanceEm('Quicksand_700Bold', '2') +
        getAdvanceEm('Quicksand_700Bold', '5') +
        getAdvanceEm('Quicksand_700Bold', '0')) * 30;
    expect(w).toBeCloseTo(expected, 6);
    expect(w).toBeGreaterThan(60);
    expect(w).toBeLessThan(120);
  });

  it('unknown family / character fall back safely', () => {
    expect(getAdvanceEm(undefined, '5')).toBeGreaterThan(0);
    expect(getAdvanceEm('Nope', '5')).toBeGreaterThan(0);
    expect(getAdvanceEm('Quicksand_700Bold', '€€')).toBeGreaterThan(0);
  });
});

describe('splitRollingStyles — wheel strip pitch preservation', () => {
  it('extracts marginTop: 1 to containerStyle so digit wheel pitch is not corrupted', () => {
    const input = {
      fontSize: 30,
      fontFamily: 'Quicksand_700Bold',
      marginTop: 1,
      includeFontPadding: false,
      fontVariant: ['tabular-nums'],
      color: '#1A2B4C',
    };

    const { containerStyle, textStyle } = splitRollingStyles(input);

    // Container gets outer layout margin
    expect(containerStyle).toEqual({ marginTop: 1 });

    // Text style retains typography but strips out marginTop and forces zero margins
    expect(textStyle.fontSize).toBe(30);
    expect(textStyle.fontFamily).toBe('Quicksand_700Bold');
    expect(textStyle.color).toBe('#1A2B4C');
    expect(textStyle.includeFontPadding).toBe(false);
    expect(textStyle.fontVariant).toEqual(['tabular-nums']);

    expect(textStyle.marginTop).toBe(0);
    expect(textStyle.marginBottom).toBe(0);
    expect(textStyle.margin).toBe(0);
    expect(textStyle.padding).toBe(0);
  });

  it('safely handles empty or undefined style input', () => {
    const emptyResult = splitRollingStyles({});
    expect(emptyResult.containerStyle).toEqual({});
    expect(emptyResult.textStyle.margin).toBe(0);

    const undefinedResult = splitRollingStyles(undefined);
    expect(undefinedResult.containerStyle).toEqual({});
    expect(undefinedResult.textStyle.margin).toBe(0);
  });

  it('separates all margins and paddings from text styles', () => {
    const complexInput = {
      marginHorizontal: 12,
      marginBottom: 8,
      paddingTop: 4,
      alignSelf: 'center',
      fontSize: 20,
      color: '#000000',
    };

    const { containerStyle, textStyle } = splitRollingStyles(complexInput);

    expect(containerStyle).toEqual({
      marginHorizontal: 12,
      marginBottom: 8,
      paddingTop: 4,
      alignSelf: 'center',
    });
    expect(textStyle.fontSize).toBe(20);
    expect(textStyle.color).toBe('#000000');
    expect(textStyle.marginHorizontal).toBe(0);
    expect(textStyle.marginBottom).toBe(0);
    expect(textStyle.paddingTop).toBe(0);
  });
});

