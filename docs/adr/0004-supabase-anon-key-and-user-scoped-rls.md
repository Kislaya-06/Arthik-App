# 0004. Supabase Anon Key and User-Scoped Row-Level Security

## Context
Mobile client binaries are inherently untrusted execution environments: any API key, secret, or URL bundled inside an Android APK can be decompiled or intercepted via network inspection. Without a dedicated middle-tier application server to mediate requests, client-to-database access must be cryptographically protected at the database engine level.

## Decision
We adopted Supabase's zero-trust client access model using the public `anon` key combined with strict Postgres Row Level Security (RLS) policies scoped to `auth.uid()`.

1. **Public Anon Key Only**: The mobile client only receives `SUPABASE_URL` and `SUPABASE_ANON_KEY` (configured via `app.json` extra and `EXPO_PUBLIC_*`). No service-role key or admin credential is ever embedded in client code or build configurations.
2. **Strict RLS Everywhere**: Every table (`profiles`, `categories`, `expenses`, `daily_savings_log`) has RLS enabled with policies checking `(select auth.uid()) = user_id` (or `id` for profiles) on all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations.
3. **Trigger-Based Provisioning**: Privileged initializations (creating default profile settings and default categories on signup) are executed via a `SECURITY DEFINER` trigger function (`handle_new_user()`) in Postgres, with direct execution revoked from public, anon, and authenticated roles.
4. **Privileged Actions via Edge Functions**: Destructive actions requiring administrative access (such as permanent account deletion via `supabase.auth.admin.deleteUser`) are delegated to authenticated Supabase Edge Functions (`delete-user-account`).

## Consequences
- **Positive**: Zero backend server infrastructure to maintain. Users cannot read, tamper with, or delete other users' data even if they extract the anon key and query the REST API directly.
- **Negative**: All mutations from the app must explicitly supply the valid `user_id` matching `auth.uid()`, otherwise Postgres rejects the transaction. Queries cannot perform cross-user aggregations directly from the client.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- Arthik introduces shared household accounts, split-bill groups, or organization workspaces requiring complex multi-tenant authorization rules that exceed standard single-user RLS policies.
- Compliance or enterprise banking regulations require an isolated proxy backend with end-to-end token exchange and strict network perimeter firewalls.
