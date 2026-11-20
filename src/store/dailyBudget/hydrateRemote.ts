import { supabase } from '../../config/supabase';
import { withTimeout } from '../../lib/networkUtils';
import type { GullakDeposit } from './types';
import { fetchAllPages } from '../../lib/supabasePaging';
import type { RemoteSavingsLogEntry } from './selfHealing';

export interface RemoteProfileData {
  daily_budget: number | null;
  is_auto_renew: boolean | null;
  is_budget_mode_enabled: boolean | null;
  budget_cadence: string | null;
  weekly_budget: number | null;
  monthly_budget: number | null;
}

export interface RemotePlanChangeEntry {
  id: string;
  effective_from: string;
  is_enabled: boolean;
  cadence: string;
  amount: number | string;
  carry_mode?: 'additive' | 'allocation';
  carried_over_amount?: number | string | null;
  created_at?: string;
}

export interface RemoteBudgetPeriodEntry {
  id: string;
  cadence: string;
  period_start: string;
  period_end: string;
  active_start: string;
  active_end: string;
  budget_amount: number | string;
  spent_amount: number | string;
  amount_saved: number | string;
  status: string;
  is_prorated: boolean;
  carry_mode?: 'additive' | 'allocation';
  carried_over_amount?: number | string | null;
  created_at?: string;
}

export type SupabaseMaybeResult<T> = { data: T | null };

export type RemoteBudgetDataResults = [
  SupabaseMaybeResult<RemoteProfileData>,
  SupabaseMaybeResult<RemoteSavingsLogEntry[]>,
  SupabaseMaybeResult<RemotePlanChangeEntry[]>,
  SupabaseMaybeResult<RemoteBudgetPeriodEntry[]>
];

export interface RemoteBudgetData {
  profileData: RemoteProfileData | null | undefined;
  logsData: RemoteSavingsLogEntry[] | null | undefined;
  plansData: RemotePlanChangeEntry[] | null | undefined;
  periodsData: RemoteBudgetPeriodEntry[] | null | undefined;
}

export async function fetchRemoteBudgetData(userId: string): Promise<RemoteBudgetData> {
  const [profileRes, logsRes, plansRes, periodsRes] = await Promise.race<RemoteBudgetDataResults>([
    Promise.all([
      supabase
        .from('profiles')
        .select('daily_budget, is_auto_renew, is_budget_mode_enabled, budget_cadence, weekly_budget, monthly_budget')
        .eq('id', userId)
        .maybeSingle(),
      // OPT-64: same queries, but never silently cut at 1,000 rows (one identical request below 1,000).
      fetchAllPages(
        () =>
          supabase
            .from('daily_savings_log')
            .select('date, amount_saved, spent_amount, status, budget_amount')
            .eq('user_id', userId)
            .order('date', { ascending: true }) as never
      ),
      fetchAllPages(
        () =>
          supabase
            .from('budget_plan_changes')
            .select('id, effective_from, is_enabled, cadence, amount, carry_mode, carried_over_amount, created_at')
            .eq('user_id', userId)
            .order('effective_from', { ascending: true }) as never
      ),
      fetchAllPages(
        () =>
          supabase
            .from('budget_periods')
            .select('id, cadence, period_start, period_end, active_start, active_end, budget_amount, spent_amount, amount_saved, status, is_prorated, carry_mode, carried_over_amount, created_at')
            .eq('user_id', userId)
            .order('active_start', { ascending: true }) as never,
        { tieBreaker: 'id' }
      ),
    ]) as Promise<RemoteBudgetDataResults>,
    new Promise<RemoteBudgetDataResults>((r) =>
      setTimeout(() => r([{ data: null }, { data: null }, { data: null }, { data: null }]), 3500)
    ),
  ]);

  return {
    profileData: profileRes?.data,
    logsData: logsRes?.data,
    plansData: plansRes?.data,
    periodsData: periodsRes?.data,
  };
}

/** Network part only. Same query, same 3.5 s timeout. */
export function fetchGullakDepositsRaw(userId: string) {
  return withTimeout(
    // OPT-64: never silently cut at 1,000 rows (one identical request below 1,000).
    fetchAllPages<{ id: string; amount: number | string; date: string; note?: string | null; source?: string | null; created_at?: string }>(
      () =>
        supabase
          .from('gullak_deposits')
          .select('id, amount, date, note, source, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }) as never,
      { tieBreaker: 'id' }
    ),
    3500,
    { data: null, error: new Error('timeout') }
  );
}

/** Merge part: EXACTLY the old body of hydrateGullakDeposits after the await, unchanged. */
export async function mergeGullakDeposits(
  userId: string,
  localDeposits: GullakDeposit[],
  raw: Awaited<ReturnType<typeof fetchGullakDepositsRaw>>
): Promise<GullakDeposit[]> {
  let resolvedDeposits = localDeposits || [];
  try {
    const { data: depData, error: depError } = raw;

    if (!depError && depData) {
      const serverDeposits: GullakDeposit[] = (depData as Array<{
        id: string;
        amount: number | string;
        date: string;
        note?: string | null;
        source?: string | null;
        created_at?: string;
      }>).map((d) => ({
        id: d.id,
        amount: Number(d.amount) || 0,
        date: d.date,
        note: d.note || undefined,
        source: (d.source === 'income' || d.source === 'external') ? d.source : 'external',
        created_at: d.created_at || new Date().toISOString(),
      }));

      const serverIdSet = new Set(serverDeposits.map((d) => d.id));
      const missingOnServer = (localDeposits || []).filter((d) => !serverIdSet.has(d.id));

      if (missingOnServer.length > 0) {
        missingOnServer.forEach((m) => {
          supabase
            .from('gullak_deposits')
            .insert({
              id: m.id,
              user_id: userId,
              amount: m.amount,
              date: m.date,
              note: m.note || null,
              source: m.source || 'external',
              created_at: m.created_at,
            })
            .then(() => {});
        });
      }

      resolvedDeposits = [...serverDeposits, ...missingOnServer].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
  } catch (depErr) {
    if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
  }
  return resolvedDeposits;
}

/** Kept for any other caller: same behaviour as before. */
export async function hydrateGullakDeposits(
  userId: string,
  localDeposits: GullakDeposit[]
): Promise<GullakDeposit[]> {
  try {
    return await mergeGullakDeposits(userId, localDeposits, await fetchGullakDepositsRaw(userId));
  } catch (depErr) {
    if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
    return localDeposits || [];
  }
}
