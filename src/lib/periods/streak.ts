import { BudgetCadence, BudgetPeriodStatus } from '../../types';

export interface StreakUnit {
  cadence: BudgetCadence;
  status: BudgetPeriodStatus;
  key: string;
  date?: string;
  amountSaved?: number;
}

/**
 * 8. Computes current streak and best streak by cadence per D6.
 * - Units are chronological finalized units (each with cadence, status, key, amountSaved).
 * - Counts consecutive 'saved' units of the CURRENT cadence walking backwards from latest.
 * - 'unknown' status units neither extend nor break the streak.
 * - Units of a different cadence end the count (cadence switch resets current streak).
 * - Paused ranges are simply absent from units and do NOT break the chain.
 * - Returns currentStreak and bestByCadence record.
 */
export function computeCadenceStreak(
  units: StreakUnit[],
  currentCadence: BudgetCadence
): { currentStreak: number; bestByCadence: Record<BudgetCadence, number> } {
  const bestByCadence: Record<BudgetCadence, number> = {
    daily: 0,
    weekly: 0,
    monthly: 0,
  };

  if (!units || units.length === 0) {
    return { currentStreak: 0, bestByCadence };
  }

  // 1. Calculate bestByCadence for each cadence
  const cadences: BudgetCadence[] = ['daily', 'weekly', 'monthly'];
  for (const cad of cadences) {
    const cadUnits = units.filter((u) => u.cadence === cad);
    let run = 0;
    let maxRun = 0;
    for (const u of cadUnits) {
      if (u.status === 'unknown') {
        continue;
      }
      const isSaved = u.status === 'saved' && (u.amountSaved === undefined || u.amountSaved > 0);
      if (isSaved) {
        run++;
        if (run > maxRun) maxRun = run;
      } else {
        run = 0;
      }
    }
    bestByCadence[cad] = maxRun;
  }

  // 2. Current streak: walking backwards from the latest unit
  let currentStreak = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.cadence !== currentCadence) {
      break;
    }
    if (u.status === 'unknown') {
      continue;
    }
    const isSaved = u.status === 'saved' && (u.amountSaved === undefined || u.amountSaved > 0);
    if (isSaved) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, bestByCadence };
}
