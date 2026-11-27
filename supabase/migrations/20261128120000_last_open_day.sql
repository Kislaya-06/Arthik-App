-- Arthik - Last day the app was opened (ROL-004). Written 28 Nov 2026.
-- Applied to the live project on 2026-11-28 (Supabase connector, owner request). Safe to run again.
--
-- What this does: adds one column, profiles.last_open_day. It lets the "you were away" question survive a reinstall
-- and stops it from appearing when the account was in use on another phone. No existing value, row, policy or index
-- changes; the existing "update their own profile" policy already lets each user write only their own row.
--
-- Old app versions keep working: they never read or write the column.
-- The app keeps working BEFORE this file is run: the day is then remembered on the phone only.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_open_day DATE;
