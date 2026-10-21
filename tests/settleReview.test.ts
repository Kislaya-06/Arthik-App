import { describe, it, expect } from 'vitest';
import {
  SETTLE_BUTTON_NAME_MAX,
  settleButtonLabel,
  settleNote,
  settlingButtonLabel,
  shortPersonName,
  summarizeSettle,
} from '../src/lib/settleReview';

const money = (n: number | null | undefined) => (n == null ? '—' : `₹${n}`);

describe('summarizeSettle (what the Settle button will do with the money)', () => {
  it('exactly what is owed: all of it settles, nothing extra, nothing left', () => {
    expect(summarizeSettle(500, 500)).toEqual({ settles: 500, extra: 0, stillOwes: 0 });
  });

  it('more than owed (SPL-004): the owed part settles, the rest stays income', () => {
    expect(summarizeSettle(500, 700)).toEqual({ settles: 500, extra: 200, stillOwes: 0 });
  });

  it('less than owed: the person still owes the rest', () => {
    expect(summarizeSettle(500, 200)).toEqual({ settles: 200, extra: 0, stillOwes: 300 });
  });

  it('never produces floating-point dust', () => {
    const s = summarizeSettle(0.1 + 0.2, 0.3);
    expect(s).toEqual({ settles: 0.3, extra: 0, stillOwes: 0 });
    expect(summarizeSettle(100.1, 100.35)).toEqual({ settles: 100.1, extra: 0.25, stillOwes: 0 });
  });

  it('missing / invalid amounts settle nothing and never go negative', () => {
    expect(summarizeSettle(500, null)).toEqual({ settles: 0, extra: 0, stillOwes: 500 });
    expect(summarizeSettle(500, undefined)).toEqual({ settles: 0, extra: 0, stillOwes: 500 });
    expect(summarizeSettle(-5, 100)).toEqual({ settles: 0, extra: 100, stillOwes: 0 });
    expect(summarizeSettle(500, NaN)).toEqual({ settles: 0, extra: 0, stillOwes: 500 });
  });
});

describe('shortPersonName (the footer button must never overflow)', () => {
  it('keeps short names as they are', () => {
    expect(shortPersonName('Rahul')).toBe('Rahul');
    expect(shortPersonName('  Rahul   K  ')).toBe('Rahul K');
  });

  it('cuts long names with an ellipsis and never exceeds the limit', () => {
    const long = 'Venkata Subrahmanyam Iyer';
    const out = shortPersonName(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(SETTLE_BUTTON_NAME_MAX);
  });

  it('a name exactly at the limit is not cut', () => {
    const n = 'A'.repeat(SETTLE_BUTTON_NAME_MAX);
    expect(shortPersonName(n)).toBe(n);
  });

  it('empty name gives an empty string, not a crash', () => {
    expect(shortPersonName('')).toBe('');
  });
});

describe('settleButtonLabel / settlingButtonLabel', () => {
  it('reads "Settle with Rahul · ₹500"', () => {
    expect(settleButtonLabel('Rahul', 500, money)).toBe('Settle with Rahul · ₹500');
  });

  it('drops the amount when it is not known yet (amount still to be entered)', () => {
    expect(settleButtonLabel('Rahul', 0, money)).toBe('Settle with Rahul');
    expect(settleButtonLabel('Rahul', null, money)).toBe('Settle with Rahul');
  });

  it('a very long name plus a big amount still fits in a short label', () => {
    const label = settleButtonLabel('Venkata Subrahmanyam Iyer', 1234567.5, money);
    // "Settle with " (12) + name (<= 14) + " · " (3) + amount text
    expect(label.length).toBeLessThanOrEqual(12 + SETTLE_BUTTON_NAME_MAX + 3 + '₹1234567.5'.length);
    expect(label.startsWith('Settle with ')).toBe(true);
  });

  it('keeps the canonical saving text (SPL-005)', () => {
    expect(settlingButtonLabel('Rahul', 500, money)).toBe("Saving Rahul's payback · ₹500");
    expect(settlingButtonLabel('Rahul', null, money)).toBe("Saving Rahul's payback");
  });
});

describe('settleNote (the one line above the button)', () => {
  it('more than owed → says the extra stays income', () => {
    expect(settleNote('Rahul', summarizeSettle(500, 700), money)).toBe('₹200 extra stays as income');
  });

  it('less than owed → says what they still owe', () => {
    expect(settleNote('Rahul', summarizeSettle(500, 200), money)).toBe('Rahul will still owe ₹300');
  });

  it('exactly owed → no note', () => {
    expect(settleNote('Rahul', summarizeSettle(500, 500), money)).toBeNull();
  });

  it('a long name is shortened in the note too', () => {
    const note = settleNote('Venkata Subrahmanyam Iyer', summarizeSettle(500, 200), money)!;
    expect(note).toContain('…');
    expect(note.endsWith('will still owe ₹300')).toBe(true);
  });
});
