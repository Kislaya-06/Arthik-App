import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * SEC-11 (security audit 22 Nov 2026). Rows may only point at the caller's own rows, and the sign-up trigger runs
 * with an empty search_path. These tests keep schema.sql (source of truth) and the migration the owner runs in step.
 */
const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/^﻿/, '');
const normalise = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from);
  expect(from, `missing: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `missing: ${end}`).toBeGreaterThan(from);
  return normalise(text.slice(from, to + end.length));
};

const MIGRATION = 'supabase/migrations/20261122120000_rls_reference_ownership.sql';
const START = 'DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses; -- SEC-11';
const END = "ALTER FUNCTION public.handle_new_user() SET search_path = '';";

describe('SEC-11: references must point at the caller\'s own rows', () => {
  const migration = read(MIGRATION);
  const schema = read('schema.sql');
  const sql = between(migration, START, END);

  it('schema.sql has the same SQL as the migration, after every referenced table exists', () => {
    expect(between(schema, START, END)).toBe(sql);
    expect(schema.indexOf(START)).toBeGreaterThan(schema.indexOf('expenses_transfer_rule_id_fkey'));
    expect(schema.indexOf(START)).toBeGreaterThan(schema.indexOf('expenses_reimburses_share_id_fkey'));
  });

  it('expenses may only reference the caller\'s own transfer rule, money-back share and category', () => {
    for (const ref of ['expenses.transfer_rule_id', 'expenses.reimburses_share_id', 'expenses.category_id']) {
      expect(sql.split(ref).length - 1, ref).toBe(2); // INSERT and UPDATE
    }
    expect(sql).toContain('FROM public.self_transfer_rules r WHERE r.id = expenses.transfer_rule_id AND r.user_id = (select auth.uid())');
    expect(sql).toContain('FROM public.expense_shares s WHERE s.id = expenses.reimburses_share_id AND s.user_id = (select auth.uid())');
  });

  it('a share may only belong to the caller\'s own expense', () => {
    expect(sql.split('e.id = expense_shares.expense_id AND e.user_id = (select auth.uid())').length - 1).toBe(2);
  });

  it('Automatic Logging profile policies apply to signed-in users only', () => {
    for (const p of ['autolog_select_own', 'autolog_insert_own', 'autolog_update_own', 'autolog_delete_own']) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY "${p}" ON public\\.autolog_profiles\\nFOR \\w+ TO authenticated`));
    }
  });

  it('schema.sql also carries the bootstrap functions of the 30 Oct migration', () => {
    const OCT_30 = 'supabase/migrations/20261030145341_performance_sync_version_bootstrap.sql';
    const s = 'CREATE OR REPLACE FUNCTION public.arthik_budget_bootstrap(p_user_id UUID)';
    const e = 'GRANT EXECUTE ON FUNCTION public.arthik_gullak_deposits(UUID) TO authenticated;';
    expect(between(schema, s, e)).toBe(between(read(OCT_30), s, e));
  });
});
