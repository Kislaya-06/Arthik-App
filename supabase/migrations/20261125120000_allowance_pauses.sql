-- Arthik - Allowance pause history (INS-004). Written 25 Nov 2026.
-- Run ONCE in Supabase -> SQL Editor (or MCP apply_migration). Safe to run again.
--
-- What this does: adds one column, profiles.allowance_pauses, a JSON list of the days the daily allowance was paused
-- ([{"from": "2026-11-04", "to": "2026-11-15"}, {"from": "2026-11-20", "to": null}], "to": null = still paused).
-- Insights reads it so paused days add no budget money. No existing value, row, policy or index changes; the
-- existing "update their own profile" policy already lets each user write only their own row.
--
-- Old app versions keep working: they never read or write the column.
-- The app keeps working BEFORE this file is run: the pause list stays on the phone and is sent once the column exists.
-- Adding a column with a constant default is instant (no table rewrite).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowance_pauses JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_allowance_pauses_is_array;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_allowance_pauses_is_array CHECK (jsonb_typeof(allowance_pauses) = 'array');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_allowance_pauses_small;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_allowance_pauses_small CHECK (jsonb_array_length(allowance_pauses) <= 500);
