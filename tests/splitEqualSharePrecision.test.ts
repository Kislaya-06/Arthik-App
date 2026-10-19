import { describe, it, expect } from 'vitest';
import { round2 } from '../src/lib/formatters';

function simulateSplitEqually(evaluatedAmount: number, memberCount: number) {
  const count = memberCount + 1;
  const totalPaise = Math.round(evaluatedAmount * 100);
  const basePaise = Math.floor(totalPaise / count);
  const remainderPaise = totalPaise % count;
  let extraForMembers = remainderPaise > 0 ? remainderPaise - 1 : 0;

  const shares = [];
  for (let i = 0; i < memberCount; i++) {
    const extra = extraForMembers > 0 ? 1 : 0;
    if (extraForMembers > 0) extraForMembers--;
    const share = round2((basePaise + extra) / 100);
    shares.push(share);
  }
  const totalMemberShare = round2(shares.reduce((s, x) => s + x, 0));
  const userShare = round2(evaluatedAmount - totalMemberShare);
  return { shares, totalMemberShare, userShare };
}

describe('FIN-07: Split Equally Precision and Remainder Absorption', () => {
  it('handles small/odd numbers without exceeding evaluatedAmount (e.g. 0.02 across 4 participants)', () => {
    const res = simulateSplitEqually(0.02, 3);
    expect(res.totalMemberShare).toBeLessThanOrEqual(0.02);
    expect(res.userShare).toBeGreaterThanOrEqual(0);
    expect(round2(res.userShare + res.totalMemberShare)).toBe(0.02);
    expect(res.shares).toEqual([0.01, 0, 0]);
  });

  it('handles ₹10 split equally among 3 participants without rounding lockout', () => {
    const res = simulateSplitEqually(10, 2);
    expect(res.totalMemberShare).toBeLessThanOrEqual(10);
    expect(res.shares).toEqual([3.33, 3.33]);
    expect(res.userShare).toBe(3.34);
    expect(round2(res.userShare + res.totalMemberShare)).toBe(10);
  });

  it('handles ₹100 split equally among 6 participants', () => {
    const res = simulateSplitEqually(100, 5);
    expect(res.totalMemberShare).toBeLessThanOrEqual(100);
    expect(round2(res.userShare + res.totalMemberShare)).toBe(100);
    expect(res.shares).toEqual([16.67, 16.67, 16.67, 16.66, 16.66]);
    expect(res.userShare).toBe(16.67);
  });
});
