import { describe, it, expect } from 'vitest';
import { overspendFundingBetweenDates } from '../../src/money/overspendFunding';
import { computeMoneyWaterfall } from '../../src/lib/moneyWaterfall';

describe('overspendFundingBetweenDates (who paid the overspend, from the waterfall)', () => {
  // Budget 100 a day. Income 150 arrives on the 11th. On the 12th the user spends 400.
  const waterfall = computeMoneyWaterfall({
    txs: [
      { id: 'inc', date: '2026-10-11', amount: 150, kind: 'income' },
      { id: 'exp', date: '2026-10-12', amount: 400, kind: 'expense' },
    ],
    resolvePool: (date) => ({ key: date, budget: 100 }),
  });

  it('income pays first, Gullak pays the rest', () => {
    expect(overspendFundingBetweenDates(waterfall, '2026-10-12', '2026-10-12')).toEqual({
      coveredByIncome: 150,
      coveredByGullak: 150,
    });
  });

  it('only the asked days count', () => {
    expect(overspendFundingBetweenDates(waterfall, '2026-10-01', '2026-10-11')).toEqual({ coveredByIncome: 0, coveredByGullak: 0 });
    expect(overspendFundingBetweenDates(waterfall, '2026-10-01', '2026-10-31')).toEqual({ coveredByIncome: 150, coveredByGullak: 150 });
  });
});
