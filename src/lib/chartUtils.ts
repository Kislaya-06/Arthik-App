import { format, parseISO, addDays, isAfter } from 'date-fns';

export interface SegmentInterpolation {
  inputRange: number[];
  outputRange: number[];
}

/**
 * Calculates strictly monotonically increasing inputRange and corresponding outputRange
 * for animating an individual segment's strokeDashoffset during a continuous circle sweep (0 to 1).
 *
 * @param startFraction Fraction where the segment begins (0 to 1)
 * @param endFraction Fraction where the segment ends (0 to 1)
 * @param arcLength Total pixel length of the segment's arc
 */
export function buildSegmentInterpolation(
  startFraction: number,
  endFraction: number,
  arcLength: number
): SegmentInterpolation {
  if (arcLength <= 0 || endFraction <= startFraction) {
    return {
      inputRange: [0, 1],
      outputRange: [0, 0],
    };
  }

  const s = Math.max(0, Math.min(1, startFraction));
  const e = Math.max(s + 0.0001, Math.min(1, endFraction));

  // Case 1: Full circle single segment
  if (s <= 0.0001 && e >= 0.9999) {
    return {
      inputRange: [0, 1],
      outputRange: [arcLength, 0],
    };
  }

  // Case 2: First segment starting at 0
  if (s <= 0.0001 && e < 0.9999) {
    const safeEnd = Math.max(0.001, Math.min(0.999, Number(e.toFixed(4))));
    return {
      inputRange: [0, safeEnd, 1],
      outputRange: [arcLength, 0, 0],
    };
  }

  // Case 3: Final segment ending at 1
  if (s > 0.0001 && e >= 0.9999) {
    const safeStart = Math.max(0.001, Math.min(0.999, Number(s.toFixed(4))));
    return {
      inputRange: [0, safeStart, 1],
      outputRange: [arcLength, arcLength, 0],
    };
  }

  // Case 4: Intermediate segment (0 < s < e < 1)
  const safeS = Math.max(0.001, Math.min(0.998, Number(s.toFixed(4))));
  let safeE = Math.max(safeS + 0.001, Math.min(0.999, Number(e.toFixed(4))));

  return {
    inputRange: [0, safeS, safeE, 1],
    outputRange: [arcLength, arcLength, 0, 0],
  };
}

export interface PreparedSegment {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  fraction: number;
  arcLength: number;
  startAngle: number;
  strokeDasharray: string;
  transform: string;
  interpolation: SegmentInterpolation;
}

/**
 * Prepares geometry, rotation angles, and sweep offsets for all donut segments.
 */
export function prepareCategorySegments(
  categories: Array<{ id: string; name: string; amount: number; percentage: number }>,
  totalAmount: number,
  palette: string[],
  size: number,
  strokeWidth: number
): PreparedSegment[] {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativeFraction = 0;

  return categories.map((cat, index) => {
    const fraction = totalAmount > 0 ? cat.amount / totalAmount : 0;
    const arcLength = fraction * circumference;
    const startFraction = cumulativeFraction;
    const endFraction = cumulativeFraction + fraction;
    const startAngle = -90 + startFraction * 360;

    cumulativeFraction += fraction;

    const interpolation = buildSegmentInterpolation(startFraction, endFraction, arcLength);

    return {
      ...cat,
      color: palette[index % palette.length],
      fraction,
      arcLength,
      startAngle,
      strokeDasharray: `${arcLength} ${circumference}`,
      transform: `rotate(${startAngle}, ${center}, ${center})`,
      interpolation,
    };
  });
}

/**
 * Computes the fill height of a vertical capsule pill based on spend ratio.
 * Ensures zero amounts yield zero height, while non-zero amounts maintain
 * at least minFillHeight so the pill dome remains visible.
 */
export function calculatePillFillHeight(
  amount: number,
  maxAmount: number,
  trackHeight: number = 130,
  minFillHeight: number = 28
): number {
  if (amount <= 0 || maxAmount <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, amount / maxAmount));
  return Math.min(
    trackHeight,
    Math.round(minFillHeight + ratio * (trackHeight - minFillHeight))
  );
}

/**
 * Computes tint green highlight fill color based on spend ratio and highlight state.
 * Days with lower spend receive softer/deeper tint, while peak/selected days receive
 * vibrant, fully illuminated tint green.
 */
export function getSpendingFlowFillColor(
  ratio: number,
  isHighlighted: boolean,
  isDark: boolean,
  mintGreen: string = '#B8E0C8',
  mintGreenDark: string = '#7FB896'
): string {
  if (isDark) {
    if (isHighlighted) {
      return mintGreen;
    }
    const alpha = Math.min(0.85, Math.max(0.28, 0.22 + ratio * 0.65));
    return `rgba(184, 224, 200, ${alpha.toFixed(2)})`;
  } else {
    if (isHighlighted) {
      return mintGreenDark;
    }
    const alpha = Math.min(0.85, Math.max(0.32, 0.25 + ratio * 0.60));
    return `rgba(127, 184, 150, ${alpha.toFixed(2)})`;
  }
}

export interface MonthlyWeekSpending {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  dateStr: string; // 'yyyy-MM-dd' (earliest date in week with spending, or start date if none)
  startDate: string; // 'yyyy-MM-dd'
  endDate: string; // 'yyyy-MM-dd'
  amount: number;
  subLabel: string; // e.g. '1–7', '8–14', '15–21', '22–30'
}

/**
 * Splits a calendar month into exactly 4 consecutive weeks (W1–W4)
 * and calculates total non-income spending for each week.
 *
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (e.g. 22–30, 22–31, or 22–28)
 *
 * If userCreatedAtStr is provided, any weeks ending before user registration
 * or expenses prior to registration date are excluded (0 spending).
 */
export function computeMonthlyWeeksData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; category_id?: string | null }>,
  isIncomeCheck?: (expense: any) => boolean,
  userCreatedAtStr?: string
): { weeks: MonthlyWeekSpending[]; maxWeek: MonthlyWeekSpending | null } {
  const weeks: MonthlyWeekSpending[] = [];
  const endDay = monthEnd.getDate(); // 28, 29, 30, or 31

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    // If the entire week range ended strictly before account registration, amount is strictly 0
    if (userCreatedAtStr && endStr < userCreatedAtStr) {
      weeks.push({
        day: range.label,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
        amount: 0,
        subLabel: `${range.startDay}–${range.endDay}`,
      });
      continue;
    }

    let sum = 0;
    for (const exp of expenses) {
      if (isIncomeCheck && isIncomeCheck(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      // Exclude expenses before account registration
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        sum += exp.amount;
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that actually has spending (ascending order)
    let firstSpendingDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExpense = expenses.some((exp) => {
        if (isIncomeCheck && isIncomeCheck(exp)) return false;
        const cleanDate = exp.expense_date?.split('T')[0]?.trim();
        if (!cleanDate) return false;
        if (userCreatedAtStr && cleanDate < userCreatedAtStr) return false;
        return cleanDate === curStr && exp.amount > 0;
      });

      if (hasExpense) {
        firstSpendingDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    weeks.push({
      day: range.label,
      dateStr: firstSpendingDate || startStr,
      startDate: startStr,
      endDate: endStr,
      amount: sum,
      subLabel: `${range.startDay}–${range.endDay}`,
    });
  }

  const maxWeek = weeks.reduce((max, w) => (w.amount > max.amount ? w : max), weeks[0]);
  return { weeks, maxWeek: maxWeek.amount > 0 ? maxWeek : null };
}

export interface MonthlyCashFlowWeek {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  subLabel: string; // '1–7', '8–14', '15–21', '22–30'
  income: number;
  spent: number;
  dateStr: string; // earliest date in week with transaction, or startStr
  startDate: string;
  endDate: string;
}

export interface MonthlyCashFlowData {
  weeks: MonthlyCashFlowWeek[];
  totalIncome: number;
  totalSpent: number;
  maxAmount: number;
}

/**
 * Computes 4-week dual-bar cash flow breakdown (Income vs Spent) for a calendar month.
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (22–30, 22–31, etc.)
 */
export function computeMonthlyCashFlowData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; type?: string; category_id?: string | null }>,
  gullakDeposits: Array<{ date: string; amount: number; source?: string }>,
  isIncomeCheck?: (expense: any) => boolean,
  userCreatedAtStr?: string
): MonthlyCashFlowData {
  const weeks: MonthlyCashFlowWeek[] = [];
  const endDay = monthEnd.getDate();

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  let totalIncome = 0;
  let totalSpent = 0;

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    if (userCreatedAtStr && endStr < userCreatedAtStr) {
      weeks.push({
        day: range.label,
        subLabel: `${range.startDay}–${range.endDay}`,
        income: 0,
        spent: 0,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
      });
      continue;
    }

    let weekIncome = 0;
    let weekSpent = 0;

    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        const isIncome = isIncomeCheck ? isIncomeCheck(exp) : exp.type === 'income';
        if (isIncome) {
          weekIncome += exp.amount;
        } else {
          weekSpent += exp.amount;
        }
      }
    }

    for (const dep of gullakDeposits) {
      const cleanDate = dep.date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        if (dep.source === 'external') {
          weekIncome += dep.amount;
        }
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that has an event (ascending order)
    let firstEventDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExp = expenses.some((exp) => {
        const c = exp.expense_date?.split('T')[0]?.trim();
        return c === curStr && (!userCreatedAtStr || c >= userCreatedAtStr) && exp.amount > 0;
      });
      const hasDep = gullakDeposits.some((dep) => {
        const c = dep.date?.split('T')[0]?.trim();
        return c === curStr && (!userCreatedAtStr || c >= userCreatedAtStr) && dep.amount > 0;
      });

      if (hasExp || hasDep) {
        firstEventDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    totalIncome += weekIncome;
    totalSpent += weekSpent;

    weeks.push({
      day: range.label,
      subLabel: `${range.startDay}–${range.endDay}`,
      income: weekIncome,
      spent: weekSpent,
      dateStr: firstEventDate || startStr,
      startDate: startStr,
      endDate: endStr,
    });
  }

  const maxAmount = Math.max(
    ...weeks.map((w) => Math.max(w.income, w.spent)),
    0
  );

  return {
    weeks,
    totalIncome,
    totalSpent,
    maxAmount,
  };
}

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
  milestone: GullakMilestoneProgress;
}

const MILESTONES = [
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
  allTimeGullakSavings: number
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

  for (const r of sortedRecords) {
    if (r.status === 'saved' && r.saved > 0) {
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
    milestone: {
      currentTierName,
      nextTierName,
      nextTierAmount,
      progressRatio,
      remainingAmount,
    },
  };
}

