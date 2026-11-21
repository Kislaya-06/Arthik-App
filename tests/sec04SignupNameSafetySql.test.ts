import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * SEC-04 / OPT-69 server side. The SQL itself was run against a real Postgres on 16 Nov 2026 (39 checks). These
 * tests keep the three copies of the SQL in step, so `schema.sql`
 * (source of truth) can never drift from the migration the owner runs.
 */
const read = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/^﻿/, '');

/** SQL without comments and blank lines, one trimmed statement line per row. */
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
  return normalise(text.slice(from, to));
};

const MIGRATION = 'supabase/migrations/20261116120000_signup_name_safety_and_expense_counter.sql';
const OCT_30 = 'supabase/migrations/20261030145341_performance_sync_version_bootstrap.sql';
const FN_START = 'CREATE OR REPLACE FUNCTION public.handle_new_user()';
const FN_END = 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;';
const COUNTER_START = 'CREATE TABLE IF NOT EXISTS public.expense_sync_versions';
const COUNTER_END = 'GRANT EXECUTE ON FUNCTION public.arthik_expenses_version(UUID) TO authenticated;';

describe('SEC-04: sign-up name safety SQL', () => {
  const migration = read(MIGRATION);
  const schema = read('schema.sql');

  it('schema.sql and the migration define the same handle_new_user()', () => {
    expect(between(schema, FN_START, FN_END)).toBe(between(migration, FN_START, FN_END));
  });

  it('the name is taken from the first non-blank source, trimmed and cut to 50 characters', () => {
    const fn = between(migration, FN_START, FN_END);
    expect(fn).toContain("extracted_name := btrim(left(COALESCE(");
    expect(fn).toContain("NULLIF(btrim(new.raw_user_meta_data->>'first_name'), ''),");
    expect(fn).toContain("NULLIF(btrim(new.raw_user_meta_data->>'full_name'), ''),");
    expect(fn).toContain("NULLIF(btrim(new.raw_user_meta_data->>'name'), ''),");
    expect(fn).toContain("NULLIF(btrim(split_part(new.email, '@', 1)), '')");
    expect(fn).toContain('), 50));');
    expect(fn).toContain("left(new.raw_user_meta_data->>'last_name', 50),");
    // the order of the sources is the same as before the fix
    expect(fn.indexOf("'first_name'")).toBeLessThan(fn.indexOf("'full_name'"));
    expect(fn.indexOf("'full_name'")).toBeLessThan(fn.indexOf("->>'name'"));
    expect(fn.indexOf("->>'name'")).toBeLessThan(fn.indexOf('split_part(new.email'));
  });

  it('the limits match the profile name rules', () => {
    expect(schema).toContain('CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 50)');
    expect(schema).toContain('CHECK (last_name IS NULL OR char_length(last_name) <= 50)');
  });

  it('still seeds the profile, the first plan row and the 12 default categories, and stays private', () => {
    const fn = between(migration, FN_START, FN_END);
    expect(fn).toContain('INSERT INTO public.profiles (');
    expect(fn).toContain('INSERT INTO public.budget_plan_changes (');
    expect(fn.match(/\(new\.id, '[^']+', '[^']+', '#[0-9A-Fa-f]{6}', true, 'expense'\)/g)).toHaveLength(7);
    expect(fn.match(/\(new\.id, '[^']+', '[^']+', '#[0-9A-Fa-f]{6}', true, 'income'\)/g)).toHaveLength(5);
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;');
  });
});

describe('OPT-69: expense change counter SQL', () => {
  it('is the same SQL in the new migration, in schema.sql and in Part B of the 30 Oct migration', () => {
    const fromMigration = between(read(MIGRATION), COUNTER_START, COUNTER_END);
    expect(between(read('schema.sql'), COUNTER_START, COUNTER_END)).toBe(fromMigration);
    expect(between(read(OCT_30), COUNTER_START, COUNTER_END)).toBe(fromMigration);
  });

  it('the function name and argument match what the app calls', () => {
    const probe = read('src/store/expense/versionProbe.ts');
    expect(probe).toContain("supabase.rpc('arthik_expenses_version', { p_user_id: userId })");
    expect(read(MIGRATION)).toContain('CREATE OR REPLACE FUNCTION public.arthik_expenses_version(p_user_id UUID)');
  });

  it('only signed-in users can read, nobody can write, and the trigger covers every write', () => {
    const sql = read(MIGRATION);
    expect(sql).toContain('ALTER TABLE public.expense_sync_versions ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);');
    expect(sql).not.toMatch(/ON public\.expense_sync_versions\s+FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(sql).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.expenses');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.arthik_expenses_version(UUID) FROM PUBLIC, anon;');
  });
});
