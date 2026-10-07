# Release Process — Arthik (har APK release ke liye)

> Upar se neeche **order me** karo. Har phase ke end me ✅ check hai — fail ho to aage mat badho.
> Is doc me `X.Y.Z` = naya version (jaise `2.1.0`), tag `vX.Y.Z` (jaise `v2.1.0`).
> Sabse risky step (force update) sabse last hai; rollback ek SQL line.

---

## 0. Samjho: update users tak kaise pahunchta hai

**Problem:** Arthik Play Store pe nahi hai, to apne aap update nahi hota. GitHub pe APK daal dena kaafi nahi — log dekhte hi nahi.

**Hal:** app khulte hi (aur foreground me aate hi) Supabase `app_config` ki `version_control` row padhti hai:
```json
{ "min_supported_version": "X.Y.Z", "force_update_enabled": true,
  "release_url": "<direct .apk link>", "apk_url": "<direct .apk link>",
  "update_title": "...", "update_highlights": ["...", "..."] }
```
User ka version chhota ho → **Update Required** screen, **koi skip nahi**.

| User ke paas | Kya hota hai |
|---|---|
| v2.0.0+ | App ke andar download (progress) → Android ka **Update** box apne aap khulta hai |
| v1.2.3 / v1.2.4 | Sirf `release_url` padhte hain → browser seedha APK download → notification tap → **Update** |
| Offline | App chalti hai (fail-open); net aate hi screen |
| v1.2.2 ya purana | Version check hi nahi tha → message bhej ke batana padega |

Android kabhi bina user ke "Update" dabaye install nahi karne deta — hum dialog tak le jaate hain.

**Signing key:** naya APK **usi keystore** se bana ho jisse purana tha, warna "App not installed / package conflicts" aur user ko uninstall karna padega. Phase 3 isko pakadta hai.

### Asset naming (fixed rule)
Har GitHub release (tag `vX.Y.Z`) me **do assets** (same file):
| Asset | Kis kaam ka |
|---|---|
| **`Arthik-vX.Y.Z.apk`** | Zaroori. Force-update links isi pe: `releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk` |
| **`Arthik.apk`** | Copy. Permanent "hamesha latest" link: `releases/latest/download/Arthik.apk` (README / WhatsApp) |

❌ Kabhi mat use karo: `releases/latest/download/Arthik-vX.Y.Z.apk` — agla release aate hi 404.

### APK vs OTA
| Kya badla | Kaise bhejna |
|---|---|
| Sirf `src/**` (JS/TS) | `eas update --branch preview --message "…"` — sirf same app version wale phones |
| `modules/**` (Kotlin), `app.json` plugins/permissions, nayi native library | Naya APK + version bump (yeh doc) |

---

## Phase 1 — Code final (laptop)
```powershell
cd D:\Arthik-App
git status                          # koi 'deleted' nahi
npm install
npx expo install --check            # Dependencies are up to date
npm run typecheck                   # 0 errors
npm test                            # sab pass
Select-String '"version"' app.json, package.json   # dono me X.Y.Z
```
`CHANGELOG.md` me `[X.Y.Z]` entry ho. Phir:
```powershell
git add -A
git commit -m "vX.Y.Z: <short summary>"
git push
```
✅ typecheck 0, tests green, push done.

| Error | Fix |
|---|---|
| `expo install --check` mismatch | `npx expo install --fix` → tests dobara |
| Tests fail | Release mat karo |
| Push rejected | `git pull --rebase` → `git push` |

---

## Phase 2 — Release APK build
```powershell
eas whoami
eas credentials -p android          # wahi keystore jo pichhle release me tha
eas build:version:get -p android    # versionCode; preview me autoIncrement hai (+1)
eas build -p android --profile preview
```
Build link se APK download → naam **`Arthik-vX.Y.Z.apk`** → ek copy **`Arthik.apk`**.

| Error | Fix |
|---|---|
| "Generate a new keystore?" | **No / ruk jao** — galat project/account |
| Gradle / Kotlin error | expo.dev → build → Logs → lal error |
| Queue me der | Free plan pe normal |

✅ Dono files laptop pe, size tens of MB.

---

## Phase 3 — Upgrade test (sabse zaroori)
Ek phone jisme **pichhla release** (GitHub wala, dev build nahi) installed + login hai:
1. `Arthik-vX.Y.Z.apk` phone pe bhejo → tap → **"Update"** dikhna chahiye.
2. App kholo.

✅ Check:
- [ ] "Update" hua, uninstall nahi maanga (= same keystore)
- [ ] Login, transactions, Gullak, streak, Automatic Logging setup — sab safe
- [ ] Profile me naya version
- [ ] Naya feature chal raha hai; purane (SMS / UPI / budget) waise hi

Fresh install test (doosra phone / emulator, naya account) bhi ek baar.

| Error | Matlab | Fix |
|---|---|---|
| "App not installed as package conflicts…" | Keystore alag | Release rok do → Phase 2 |
| "App not installed" | Dev build installed / versionCode chhota | Release wale phone pe test |

---

## Phase 4 — VirusTotal (README badge)
1. virustotal.com → **File** → `Arthik-vX.Y.Z.apk` → scan.
2. Result URL (`.../gui/file/<hash>`) → README ke VirusTotal badge me lagao.
3. Screenshot → `assets/virustotal-scan.png` replace.
4. README ka download link `vX.Y.Z` / `Arthik-vX.Y.Z.apk` pe update.
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
4. Description: `CHANGELOG.md` ka `[X.Y.Z]` section
5. Assets: **`Arthik-vX.Y.Z.apk`** + **`Arthik.apk`**
6. ✔ **Set as the latest release** → **Publish**

### 5.1 Links check (phone browser)
```
https://github.com/Kislaya-06/Arthik-App/releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk
https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```
✅ Dono pe seedha download.

| Error | Fix |
|---|---|
| 404 | Asset naam / tag galat → release edit → sahi naam se upload |
| Release page khulta hai | `/releases/download/...` wala link use karo |

---

## Phase 6 — Supabase (sirf agar release me nayi migration ho)
`supabase/migrations/` me naya file ho to SQL Editor me run. Check:
```sql
SELECT key, value FROM public.app_config ORDER BY key;
```

---

## Phase 7 — Force update ON 🚦
Pehle apne ek phone ko purane version pe rakho (test ke liye).
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
`release_url` bhi direct APK — v1.x phones sirf wahi padhte hain.

Apne purane-version phone pe: app band karke kholo → Update Required → **Download & install** → progress → **Update** (pehli baar "Install unknown apps → Allow from this source").

| Problem | Fix |
|---|---|
| Screen nahi aayi | Internet? App poora band karke kholo. `SELECT` me `force_update_enabled: true`? |
| Download failed | 5.1 wala link phone browser me chalao |
| Installer nahi khula | Screen pe "Open Install unknown apps setting" → Allow → "Install update" |

---

## Phase 8 — Rollback
**Force update band:**
```sql
UPDATE public.app_config
SET value = value || '{"force_update_enabled": false}'::jsonb, updated_at = NOW()
WHERE key = 'version_control';
```
**JS bug:** fix → tests → `eas update --branch preview --message "Fix: …"`
**Native bug:** `X.Y.(Z+1)` → Phase 1 se.
**Automatic Logging Beta band (jinhone setup nahi kiya):**
```sql
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,audience}', '"none"'), updated_at = NOW()
WHERE key = 'feature_flags';
```

---

## Phase 9 — Beta rollout control (bina APK)
```sql
-- sabke liye kholna
UPDATE public.app_config SET value = jsonb_set(value, '{autolog,audience}', '"all"'), updated_at = NOW() WHERE key = 'feature_flags';
-- "existing user" cutoff = abhi
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,existing_before}', to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), updated_at = NOW()
WHERE key = 'feature_flags';
-- kitne log use kar rahe
SELECT count(*) FILTER (WHERE enabled) AS active, count(*) AS ever_set_up FROM public.autolog_profiles;
```
Audience: `existing` (sirf purane users) · `all` · `none` (kill switch; jinhone setup kiya unka chalta rahega).

---

## Phase 10 — Users ko message (template)
```
Arthik X.Y aa gaya 🎉
<1–2 lines: kya naya hai>

Update: Arthik kholo → "Download & install" → "Update"
(Pehli baar phone "Install unknown apps" bole → Allow)
Data safe hai.
Link: https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```

---

## Har release ka checklist
```
[ ] version bump: app.json + package.json (X.Y.Z) + CHANGELOG [X.Y.Z]
[ ] npm run typecheck · npm test
[ ] eas build preview (same keystore) → Arthik-vX.Y.Z.apk + copy Arthik.apk
[ ] purane release ke upar "Update" test, data safe
[ ] VirusTotal → README badge/screenshot + download link → push
[ ] GitHub Release vX.Y.Z, dono assets, latest ✔, links check
[ ] (agar ho) Supabase migration
[ ] version_control SQL → apne purane phone pe poora flow
[ ] users ko message
```
