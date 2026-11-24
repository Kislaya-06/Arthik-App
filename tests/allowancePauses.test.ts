/**
 * INS-004 (owner decision 2026-11-25): the days the allowance was paused are remembered, so Insights can count no
 * budget for them even when nothing was spent that day.
 */
import { describe, it, expect } from 'vitest';
import { recordAutoRenewChange, isPausedOn, parseAllowancePauses } from '../src/lib/allowancePauses';
import { allowanceFromHistory, AllowanceHistory } from '../src/money/budgetAllowance';

describe('recordAutoRenewChange', () => {
  it('pausing opens a pause from today', () => {
    expect(recordAutoRenewChange([], false, '2026-11-04')).toEqual([{ from: '2026-11-04', to: null }]);
  });

  it('resuming closes it on yesterday (today gets its allowance again)', () => {
    const open = [{ from: '2026-11-04', to: null }];
    expect(recordAutoRenewChange(open, true, '2026-11-16')).toEqual([{ from: '2026-11-04', to: '2026-11-15' }]);
  });

  it('pause and resume on the same day leaves nothing', () => {
    const open = [{ from: '2026-11-04', to: null }];
    expect(recordAutoRenewChange(open, true, '2026-11-04')).toEqual([]);
  });

  it('pausing twice keeps one open pause; resuming with nothing open changes nothing', () => {
    const open = [{ from: '2026-11-04', to: null }];
    expect(recordAutoRenewChange(open, false, '2026-11-06')).toBe(open);
    const closed = [{ from: '2026-11-04', to: '2026-11-05' }];
    expect(recordAutoRenewChange(closed, true, '2026-11-10')).toBe(closed);
  });
});

describe('isPausedOn / parseAllowancePauses', () => {
  const pauses = [{ from: '2026-11-04', to: '2026-11-15' }, { from: '2026-11-20', to: null }];
  it('matches days inside a pause, both ends included, open pause runs on', () => {
    expect(isPausedOn(pauses, '2026-11-03')).toBe(false);
    expect(isPausedOn(pauses, '2026-11-04')).toBe(true);
    expect(isPausedOn(pauses, '2026-11-15')).toBe(true);
    expect(isPausedOn(pauses, '2026-11-16')).toBe(false);
    expect(isPausedOn(pauses, '2026-12-01')).toBe(true);
  });
  it('keeps only well-formed entries; anything not a list is null', () => {
    expect(parseAllowancePauses([{ from: '2026-11-04', to: null }, { from: 'x' }, 5, { from: '2026-11-01', to: '2026-11-02' }])).toEqual([
      { from: '2026-11-04', to: null },
      { from: '2026-11-01', to: '2026-11-02' },
    ]);
    expect(parseAllowancePauses(null)).toBeNull();
    expect(parseAllowancePauses('[]')).toBeNull();
  });
});

describe('Insights skip paused days with no activity (INS-004)', () => {
  it('a ₹100/day month with 12 paused, empty days counts 19 days', () => {
    const h: AllowanceHistory = {
      planChanges: [{ id: 'p', userId: 'u', effectiveFrom: '2026-01-01', isEnabled: true, cadence: 'daily', amount: 100 }],
      dailyRecords: {},
      todayKey: '2026-12-05',
      isAutoRenew: true,
      fallbackPlan: null,
      pauses: [{ from: '2026-10-04', to: '2026-10-15' }],
    };
    expect(allowanceFromHistory(h, '2026-10-01', '2026-10-31')).toBe(1900);
  });
});
