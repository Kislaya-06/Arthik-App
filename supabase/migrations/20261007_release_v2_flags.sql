-- Arthik v2.0.0 — server-side feature flag for Automatic Logging (Beta).
-- SAFE to run any time (before or after the APK is published). Run once in Supabase → SQL Editor.
--
-- audience:
--   'existing' → only people who used Arthik before v2.0 (Beta paused for new users)  ← start here
--   'all'      → everyone
--   'none'     → hide for anyone who has not set it up yet (kill switch; existing setups keep working)
-- existing_before: accounts created before this moment also count as "existing" (covers reinstalls / new phones).

INSERT INTO public.app_config (key, value)
VALUES (
  'feature_flags',
  jsonb_build_object(
    'autolog', jsonb_build_object(
      'audience', 'existing',
      'existing_before', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  )
)
ON CONFLICT (key) DO NOTHING;
