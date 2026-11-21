# Release Process — Arthik (every APK release)

> Work **top to bottom, in order**. Each phase ends with a ✅ check — if it fails, do not go on.
> In this doc `X.Y.Z` = the new version (e.g. `2.1.1` or `2.2.0`), tag `vX.Y.Z` (e.g. `v2.1.1`).
> The riskiest step (force update) is last; rollback is one SQL statement.
> The agent never builds, uploads releases, runs SQL or publishes OTA updates on its own (AGENTS.md); these are
> owner steps unless the owner explicitly asks the agent to run one.

---

## Quick summary

### Rule 1: Do you really need a new APK?
- **Only screens, styling, calculations or UI logic changed (`src/**`)** → **no new APK.** Publish an OTA update:
  ```bash
  eas update --branch preview --environment preview --message "feature: short description"
  ```
  Users get it silently the next time they open the app; the "What's new" popup shows the `app.json`
  `expo.extra.otaUpdate` highlights (keep them and `src/store/otaStore.ts` fallback highlights current).
  > `--environment preview` is required (recent eas-cli asks for it in `--non-interactive` mode, otherwise the update
  > fails). The `preview` environment has no EAS variables, so the Supabase config is bundled from `app.json` → `extra`.
- **Native Kotlin code (`modules/**`), `app.json` permissions / plugins, or a native library changed** → a new APK is
  mandatory (the rest of this doc).

Before any OTA, check that `app.json` / `package.json` `version` did not change (AGENTS.md §11.4): an OTA under a bumped
version never reaches phones on the previous APK.

### Rule 2: A new APK is three steps
1. **Build:** `eas build -p android --profile preview`, download the APK from the build page.
2. **Upload to GitHub:** release with tag `vX.Y.Z` and two files (`Arthik-vX.Y.Z.apk` and a copy `Arthik.apk`).
3. **Tell Supabase:** run the Phase 7 SQL with the new version. Older phones then show "Update Required" and update
   in one tap.

> **⚠️ Keystore rule:** if the terminal asks *"Generate a new keystore?"* — **always answer No**. The keystore is the
> app's signature; a new one makes every installed phone reject the update.

---

## 0. How an update reaches users

**Problem:** Arthik is not on the Play Store, so nothing updates by itself, and people do not check GitHub.

**Answer:** on open (and on returning to the foreground) the app reads the Supabase `app_config` row `version_control`:
```json
{ "min_supported_version": "X.Y.Z", "force_update_enabled": true,
  "release_url": "<direct .apk link>", "apk_url": "<direct .apk link>",
  "update_title": "...", "update_highlights": ["...", "..."] }
```
If the user's version is lower → **Update Required** screen, **no skip**.

| User has | What happens |
|---|---|
| v2.0.0+ | Download inside the app (progress) → Android's **Update** dialog opens |
| v1.2.3 / v1.2.4 | Reads only `release_url` → the browser downloads the APK → tap the notification → **Update** |
| Offline | The app keeps working (fail-open); the screen appears once online |
| v1.2.2 or older | No version check; the user must be messaged |

Android never installs without the user pressing "Update" — the app takes them to that dialog.

**Signing key:** the new APK must use **the same keystore** as the previous one, otherwise "App not installed / package
conflicts" and the user would have to uninstall. Phase 3 catches this.

### Asset naming (fixed rule)
Every GitHub release (tag `vX.Y.Z`) has **two assets** (the same file):
| Asset | Used for |
|---|---|
| **`Arthik-vX.Y.Z.apk`** | Required. Force-update links point here: `releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk` |
| **`Arthik.apk`** | Copy. Permanent always-latest link: `releases/latest/download/Arthik.apk` (README, messages) |

❌ Never use `releases/latest/download/Arthik-vX.Y.Z.apk` — it 404s as soon as the next release is out.

### APK vs OTA
| What changed | How to ship |
|---|---|
| Only `src/**` (JS / TS) | `eas update --branch preview --environment preview --message "…"` — reaches phones on the same app version only |
| `modules/**` (Kotlin), `app.json` plugins / permissions, a new native library | New APK + version bump (this doc) |

---

## Phase 1 — Final code (laptop)
```powershell
cd D:\Arthik-App
git status                          # nothing 'deleted' by accident
npm install
npx expo install --check            # Dependencies are up to date
npm run typecheck                   # 0 errors
npm test                            # all pass
npm run test:native                 # Automatic Logging Kotlin tests (needs a JDK)
Select-String '"version"' app.json, package.json   # both X.Y.Z
```
`CHANGELOG.md` has an `[X.Y.Z]` entry. Then:
```powershell
git add -A
git commit -m "vX.Y.Z: <short summary>"
git push
```
✅ typecheck 0, tests green, pushed.

| Error | Fix |
|---|---|
| `expo install --check` mismatch | `npx expo install --fix` → run the tests again |
| Tests fail | Do not release |
| Push rejected | `git pull --rebase` → `git push` |

---

## Phase 2 — Release APK build
```powershell
eas whoami
eas credentials -p android          # the same keystore as the previous release
eas build:version:get -p android    # versionCode; preview has autoIncrement (+1)
eas build -p android --profile preview
```
Download the APK from the build link → name it **`Arthik-vX.Y.Z.apk`** → make a copy **`Arthik.apk`**.

| Error | Fix |
|---|---|
| "Generate a new keystore?" | **No — stop**: wrong project or account |
| Gradle / Kotlin error | expo.dev → build → Logs → the red error |
| Long queue | Normal on the free plan |

✅ Both files on the laptop, tens of MB each.

---

## Phase 3 — Upgrade test (most important)
On a phone with the **previous release** installed (the GitHub one, not a dev build) and signed in:
1. Send `Arthik-vX.Y.Z.apk` to the phone → tap → it must say **"Update"**.
2. Open the app.

✅ Check:
- [ ] It updated without asking to uninstall (= same keystore)
- [ ] Sign-in, transactions, Gullak, streak, Automatic Logging setup — all intact
- [ ] Profile shows the new version
- [ ] The new feature works; existing ones (bank SMS / email logging, budget) behave as before

Also do one fresh install (another phone / emulator, new account).

| Error | Meaning | Fix |
|---|---|---|
| "App not installed as package conflicts…" | Different keystore | Stop the release → Phase 2 |
| "App not installed" | Dev build installed / lower versionCode | Test on a phone with the release build |

### 3.1 Pre-release device smoke test

| # | Flow | Scenario | Pass criteria |
|---|---|---|---|
| 1 | **Cold launch** | Fresh sign-in or cold start | Opens from saved data at once (`OFL-001`); no white flash or layout tear |
| 2 | **Online expense lifecycle** | Add, edit, delete an expense | Home, History and Insights update live; Gullak and budget follow |
| 3 | **Offline sync** | Airplane mode ON → 2 adds, 1 edit, 1 delete → OFF | Every offline change reaches Supabase; nothing lost, no duplicates |
| 4 | **Offline crash** | Airplane mode ON → add → force-kill → reopen | Pending badge and queued changes are still there |
| 5 | **Budget Mode & cadence** | Budget Mode ON / OFF, Daily → Weekly → Monthly | Switch scheduled for midnight (`PUR-003`); tabs animate; allowance correct |
| 6 | **Gullak deposits** | Add and delete "from Income" and "new money" deposits | Balance restores at once; no phantom Gullak |
| 7 | **Midnight rollover** | Cross a day boundary / an unfinalized past day | Yesterday's unspent budget goes to Gullak; morning notification |
| 8 | **Insights** | Weekly, Monthly, Yearly navigation | Numbers match history; swipe and date navigation smooth |
| 9 | **Profile modals** | Edit name, pause budget, log out, delete-account dialog | Open and cancel cleanly with no side effects |
| 10 | **Streak calendar** | Month navigation, day tap, flame | Paused days neutral, saved days highlighted, streak count right |
| 11 | **Themes** | Light, Dark, AMOLED | Readable contrast, no clipped text, token colours only |
| 12 | **Automatic Logging setup** | Setup and permission cards | Renders cleanly; permission state detected |
| 13 | **Live boundary** | Finish first-time setup | Old SMS / emails are never logged retroactively |
| 14 | **SMS ↔ email match** | Bank SMS + bank email for one payment | One transaction (reference or strong match); no duplicate |
| 15 | **Spending guard in Automatic Logging** | Auto-logged expense with no funds | Goes to review (`exceeds_liquidity`); no silent negative balance |
| 16 | **Split & money back** | Split with a friend, then payback or refund | Money-back row, income unchanged, original expense reduced on its own day, budget / income / Gullak restored (`SPL-001..006`); self-transfer never income or expense (`TXN-003`) |
| 17 | **Pull to History** | Pull up on the Home list | Label, ring progress, one haptic, History opens on release |
| 18 | **Notification dedupe** | Evening recap, morning reward, limit alert | No repeated alerts for the same event |
| 19 | **Carry allocation (`CAR-001` Mode B)** | Monthly → Weekly with unspent carry (e.g. ₹15k unspent, ₹5k weekly) | Periods 1–3 fully funded; All pill equals the spending-guard total on the gap week; period-start notice; exactly ONE "Carried money has run out" notice, then silence |
| 20 | **Pure deficit switch (`PUR-001`, `PUR-002`)** | Overspend in Pure Mode (R < 0), then turn Budget Mode on | One auto-balance income ₹D; R = 0, Gullak = 0; inbox notification; not in the Home budget chip |

---

## Phase 4 — VirusTotal (README badge)
1. virustotal.com → **File** → `Arthik-vX.Y.Z.apk` → scan.
2. Put the result URL (`.../gui/file/<hash>`) in the README VirusTotal badge.
3. Replace the screenshot `assets/virustotal-scan.png`.
4. Update the README download link to `vX.Y.Z` / `Arthik-vX.Y.Z.apk`.
```powershell
git add README.md assets/virustotal-scan.png
git commit -m "docs: vX.Y.Z download link + VirusTotal scan"
git push
```

---

## Phase 5 — GitHub Release
1. Releases → **Draft a new release**
2. Tag **`vX.Y.Z`** (new tag on publish) · target `main`
3. Title: `Arthik X.Y — <feature>`
4. Description: the `[X.Y.Z]` section of `CHANGELOG.md`
5. Assets: **`Arthik-vX.Y.Z.apk`** + **`Arthik.apk`**
6. ✔ **Set as the latest release** → **Publish**

### 5.1 Link check (phone browser)
```
https://github.com/Kislaya-06/Arthik-App/releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk
https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```
✅ Both download directly.

| Error | Fix |
|---|---|
| 404 | Wrong asset name / tag → edit the release → upload with the right name |
| Release page opens instead | Use the `/releases/download/...` link |

---

## Phase 6 — Supabase (only if the release has a new migration)
Run each new file from `supabase/migrations/` in the SQL Editor. Check:
```sql
SELECT key, value FROM public.app_config ORDER BY key;
```

---

## Phase 7 — Force update ON 🚦
Keep one of your phones on the old version first (to test).
```sql
UPDATE public.app_config
SET value = jsonb_build_object(
      'min_supported_version', 'X.Y.Z',
      'force_update_enabled', true,
      'release_url', 'https://github.com/Kislaya-06/Arthik-App/releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk',
      'apk_url',     'https://github.com/Kislaya-06/Arthik-App/releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk',
      'update_title', 'Arthik X.Y is here',
      'update_highlights', jsonb_build_array('Point 1', 'Point 2', 'Point 3')
    ),
    updated_at = NOW()
WHERE key = 'version_control';

SELECT value FROM public.app_config WHERE key = 'version_control';
```
`release_url` must also be a direct APK link — v1.x phones read only that one.

> **Only Arthik's own GitHub repository (SEC-03):** `apk_url` and `release_url` must both be links inside
> `https://github.com/Kislaya-06/Arthik-App/` (both formats above are correct). Any other link is not downloaded; the
> app opens the official release page in the browser instead. To host the APK elsewhere, first change
> `TRUSTED_RELEASE_PREFIX` in `src/lib/versionCheck.ts` and ship that by OTA.

On the old-version phone: close and reopen the app → Update Required → **Download & install** → progress → **Update**
(the first time: "Install unknown apps → Allow from this source").

| Problem | Fix |
|---|---|
| Screen does not appear | Internet on? Fully close and reopen. Does the `SELECT` show `force_update_enabled: true`? |
| Download failed | Open the 5.1 link in the phone browser |
| Installer does not open | On the screen: "Open Install unknown apps setting" → Allow → "Install update" |

---

## Phase 8 — Rollback
**Turn force update off:**
```sql
UPDATE public.app_config
SET value = value || '{"force_update_enabled": false}'::jsonb, updated_at = NOW()
WHERE key = 'version_control';
```
**JS bug:** fix → tests → `eas update --branch preview --environment preview --message "Fix: …"`
**Native bug:** `X.Y.(Z+1)` → start again at Phase 1.
**Turn the Automatic Logging Beta off (for people who have not set it up):**
```sql
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,audience}', '"none"'), updated_at = NOW()
WHERE key = 'feature_flags';
```

---

## Phase 9 — Beta rollout control (no APK)
```sql
-- open to everyone
UPDATE public.app_config SET value = jsonb_set(value, '{autolog,audience}', '"all"'), updated_at = NOW() WHERE key = 'feature_flags';
-- "existing user" cutoff = now
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,existing_before}', to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), updated_at = NOW()
WHERE key = 'feature_flags';
-- how many people use it
SELECT count(*) FILTER (WHERE enabled) AS active, count(*) AS ever_set_up FROM public.autolog_profiles;
```
Audience: `existing` (older users only) · `all` · `none` (kill switch; people who already set it up keep it).

---

## Phase 10 — Message to users (template)
```
Arthik X.Y is here 🎉
<1–2 lines: what's new>

Update: open Arthik → "Download & install" → "Update"
(If the phone says "Install unknown apps" the first time → Allow)
Your data is safe.
Link: https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```

---

## Checklist for every release
```
[ ] version bump: app.json + package.json (X.Y.Z) + CHANGELOG [X.Y.Z]
[ ] npm run typecheck · npm test · npm run test:native
[ ] eas build preview (same keystore) → Arthik-vX.Y.Z.apk + copy Arthik.apk
[ ] "Update" over the previous release, data safe
[ ] VirusTotal → README badge / screenshot + download link → push
[ ] GitHub Release vX.Y.Z, both assets, latest ✔, links checked
[ ] (if any) Supabase migration
[ ] version_control SQL → full flow on your old-version phone
[ ] message to users
```
