import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

export interface GullakMilestoneProgress {
  currentTierName: string;
  nextTierName: string;
  nextTierAmount: number;
  progressRatio: number;
  remainingAmount: number;
}

export interface YearlyGullakMetrics {
  totalSavedInYear: number;
  annualRolloverSavings: number;
  annualDirectDeposits: number;
  bestSavingsMonth: { month: string; amount: number };
  bestStreakInYear: number;
  savedDaysCount: number;
  milestone: GullakMilestoneProgress;
}

export const MILESTONES = [
  { amount: 1000, name: 'Starter Piggy' },
  { amount: 5000, name: 'Smart Builder' },
  { amount: 10000, name: 'Silver Vault' },
  { amount: 25000, name: 'Gold Treasury' },
  { amount: 50000, name: 'Diamond Safe' },
  { amount: 100000, name: 'Wealth Champion' },
];

/**
 * Aggregates annual Gullak savings, calculates best savings month,
 * highest savings streak in that year, and evaluates gamified milestone progress.
 */
export function computeYearlyGullakMilestones(
  yearStart: Date,
  yearEnd: Date,
  dailyRecords: Array<{ date: string; saved: number; status: string }>,
  gullakDeposits: Array<{ date: string; amount: number }>,
  allTimeGullakSavings: number,
  budgetPeriods?: Array<{ activeStart: string; amountSaved: number; status: string }>
): YearlyGullakMetrics {
  const startStr = format(yearStart, 'yyyy-MM-dd');
  const endStr = format(yearEnd, 'yyyy-MM-dd');

  let rolloverSum = 0;
  const monthSavings: Record<string, number> = {};

  const sortedRecords = dailyRecords
    .filter((r) => r.date >= startStr && r.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  let currentStreak = 0;
  let bestStreakInYear = 0;
  let savedDaysCount = 0;

  for (const r of sortedRecords) {
    if (r.status === 'saved' && r.saved > 0) {
      savedDaysCount += 1;
      rolloverSum += r.saved;
      currentStreak += 1;
      if (currentStreak > bestStreakInYear) {
        bestStreakInYear = currentStreak;
      }
      const m = format(parseISO(r.date), 'MMMM');
      monthSavings[m] = (monthSavings[m] || 0) + r.saved;
    } else {
      currentStreak = 0;
    }
  }

  // Include weekly and monthly period savings
  if (budgetPeriods && budgetPeriods.length > 0) {
    for (const p of budgetPeriods) {
      if (p.activeStart >= startStr && p.activeStart <= endStr && p.amountSaved > 0) {
        rolloverSum += p.amountSaved;
        const m = format(parseISO(p.activeStart), 'MMMM');
        monthSavings[m] = (monthSavings[m] || 0) + p.amountSaved;
      }
    }
  }

  let depositsSum = 0;
  for (const d of gullakDeposits) {
    if (d.date >= startStr && d.date <= endStr) {
      depositsSum += d.amount;
      const m = format(parseISO(d.date), 'MMMM');
      monthSavings[m] = (monthSavings[m] || 0) + d.amount;
    }
  }

  const totalSavedInYear = rolloverSum + depositsSum;

  let bestMonth = 'None';
  let bestMonthAmount = 0;
  for (const [month, amt] of Object.entries(monthSavings)) {
    if (amt > bestMonthAmount) {
      bestMonthAmount = amt;
      bestMonth = month;
    }
  }

  const effectiveSavings = Math.max(allTimeGullakSavings, totalSavedInYear);
  let currentTierName = 'Seed Saver';
  let nextTierName = MILESTONES[0].name;
  let nextTierAmount = MILESTONES[0].amount;

  for (let i = 0; i < MILESTONES.length; i++) {
    if (effectiveSavings >= MILESTONES[i].amount) {
      currentTierName = MILESTONES[i].name;
      if (i + 1 < MILESTONES.length) {
        nextTierName = MILESTONES[i + 1].name;
        nextTierAmount = MILESTONES[i + 1].amount;
      } else {
        nextTierName = 'Max Milestone Unlocked! 🎉';
        nextTierAmount = MILESTONES[i].amount;
      }
    } else {
      nextTierName = MILESTONES[i].name;
      nextTierAmount = MILESTONES[i].amount;
      break;
    }
  }

  const prevTierAmount =
    effectiveSavings >= nextTierAmount
      ? nextTierAmount
      : MILESTONES.find((m) => m.name === currentTierName)?.amount || 0;

  const rangeSpan = Math.max(1, nextTierAmount - prevTierAmount);
  const progressRatio =
    effectiveSavings >= nextTierAmount
      ? 1
      : Math.min(1, Math.max(0, (effectiveSavings - prevTierAmount) / rangeSpan));
  const remainingAmount = Math.max(0, nextTierAmount - effectiveSavings);

  return {
    totalSavedInYear,
    annualRolloverSavings: rolloverSum,
    annualDirectDeposits: depositsSum,
    bestSavingsMonth: { month: bestMonth, amount: bestMonthAmount },
    bestStreakInYear,
    savedDaysCount,
    milestone: {
      currentTierName,
      nextTierName,
      nextTierAmount,
      progressRatio,
      remainingAmount,
    },
  };
}
