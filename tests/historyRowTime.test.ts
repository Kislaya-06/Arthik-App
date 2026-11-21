import { describe, it, expect } from 'vitest';
import { historyRowTimeLabel } from '../src/lib/historyRows';

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString();

describe('historyRowTimeLabel (History rows sit under a day heading, so they never repeat the date)', () => {
  it('logged on the same day → the time it was logged', () => {
    expect(historyRowTimeLabel('2026-10-23', at(2026, 9, 23, 14, 45))).toBe('2:45 PM');
  });

  it('logged on a different day (back-dated) → nothing, the log time is not when the money moved', () => {
    expect(historyRowTimeLabel('2026-10-23', at(2026, 9, 25, 9, 0))).toBe('');
  });

  it('no or bad created_at → nothing (never the date again, never a crash)', () => {
    expect(historyRowTimeLabel('2026-10-23', undefined)).toBe('');
    expect(historyRowTimeLabel('2026-10-23', 'not a date')).toBe('');
  });
});
