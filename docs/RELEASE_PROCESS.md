# Release Process — Arthik (v2.0.0 se, aur aage ke saare APK releases)

> **Abhi ka release: v2.1.0** (bank emails). Neeche ke steps same hain — bas har jagah `2.0.0` / `v2.0.0` ki jagah `2.1.0` / `v2.1.0` likho. Ready-made SQL: Section 9.

> Ye playbook ek baar dhyan se poori padh lo, phir upar se neeche **order me** karo.
> Har phase ke end me ek **✅ Check** hai. Check pass na ho to **aage mat badho**.
> Sabse risky step (sab users ko force update) **sabse last** me hai, aur uska **rollback ek SQL line** hai.

---

## 0. Pehle samjho: update kaise pahunchta hai (kyun aisa design)

**Problem:** Arthik Play Store pe nahi hai. Play Store apps apne aap update hoti hain, hamari nahi. Agar hum bas GitHub pe naya APK daal dein, to 90% users ko pata hi nahi chalega.

**Pehle se kya hai (v1.2.3 se):** app khulte hi Supabase ki `app_config` table me `version_control` row padhti hai:
```json
{ "min_supported_version": "1.2.3", "force_update_enabled": false, "release_url": "https://github.com/.../releases/latest" }
```
Agar `force_update_enabled = true` aur user ka version `min_supported_version` se chhota hai, to **"Update Required"** screen aati hai. Is screen pe **koi skip / back nahi** hai. Button `release_url` ko browser me kholta hai.

**v1.2.4 users ke liye (unke phone ka code hum badal nahi sakte):**
`release_url` ko GitHub release page ki jagah **seedha APK file ka link** bana denge. Tab:
1. App khulti hai → Update Required → **Download** dabaya.
2. Browser seedha APK download karta hai (page pe nahi bhatakna).
3. Download notification pe tap → Android ka **"Do you want to update this app?" → Update**.
Pehli baar Android browser (Chrome) ke liye "Install unknown apps" allow karne ko bol sakta hai.

**v2.0.0 aur aage ke users ke liye (naya code):**
Update screen app ke andar hi download karti hai (progress bar), aur download khatam hote hi **Android ka install dialog apne aap khulta hai**. Skip ka option nahi hai.
⚠️ Koi bhi app **bina user ke "Install" dabaye** khud ko install nahi kar sakti. Ye Android ka security rule hai. Hum dialog tak le aate hain, "Install" user ko dabana hi padta hai.

**Ek aur zaroori cheez — signing key:**
Android update tabhi hone deta hai jab naya APK **usi key** se signed ho jisse purana tha. Key alag hui to error aata hai: *"App not installed as package conflicts with an existing package"*. Tab user ko purana app uninstall karna padega. Isliye **Phase 2 me hum ye pakka verify karenge** kisi bhi user ko bhejne se pehle.

---

## Phase 1 — Code ready hai? (laptop)

```powershell
cd D:\Arthik-App
git status                       # koi 'deleted' file nahi
npm install
npx expo install --check         # "Dependencies are up to date"
npm run typecheck                # 0 errors
npm test                         # 1071 passed (1071)
```

Version check karo:
```powershell
Select-String '"version"' app.json, package.json
```
Dono me **`2.0.0`** hona chahiye.

Commit karo (release ka exact code yaad rahe):
```powershell
git add -A
git commit -m "v2.0.0: Automatic Logging (Beta), in-app updates"
git push
```

✅ **Check:** typecheck 0 errors, tests 1071/1071, git push ho gaya.

| Error | Fix |
|---|---|
| `expo install --check` mismatch dikhaye | `npx expo install --fix` → phir tests dobara |
| Koi test fail | Release mat karo. Error copy karke agent/mujhe bhejo. |

---

## Phase 2 — Release APK banao aur khud test karo (sabse important)

### 2.1 Signing key confirm karo (5 min, bahut zaroori)
v1.2.4 APK kis Expo account/project se bana tha, ye check karo:
```powershell
eas whoami
eas project:info
eas credentials -p android
```
`eas credentials` me **Build Credentials → Keystore** dikhega (SHA-256 fingerprint). Ye wahi project hona chahiye jisse v1.2.4 bana tha (Expo dashboard → Builds me purani v1.2.4 build isi project me dikhni chahiye).

> ⚠️ Agar "No keystore" / naya keystore banane ko pooche → **ruk jao.** Matlab ye project pehle kisi aur keystore se build hua tha. Naya keystore banaya to saare users ko uninstall karna padega. Pehle purana keystore dhoondho.

### 2.2 versionCode check
`eas.json` me `preview` profile pe `autoIncrement: true` hai. Matlab har build pe Android ka internal version number (versionCode) apne aap +1 hoga. Isse Android "naya version" maanta hai.
```powershell
eas build:version:get -p android
```
Jo number aaye, build ke baad wo +1 hoga. Bas dekh lo.

### 2.3 Build
```powershell
eas build -p android --profile preview
```
Build khatam → link → APK laptop pe download karo → naam badal ke **`Arthik.apk`** rakho (exact yahi naam; links isi naam pe tike hain).

| Error | Fix |
|---|---|
| Gradle / Kotlin error | expo.dev → build → Logs → lal error copy karke bhejo |
| Queue me der | Free plan pe normal hai |

### 2.4 Upgrade test — purane v1.2.4 ke upar install (sabse zaroori test)
Ek phone lo jisme **v1.2.4 (GitHub wala) installed hai aur login hai** (tumhara phone, ya kisi dost ka). Dev build wala phone nahi.
1. APK phone pe bhejo (USB / Drive / WhatsApp to self) → tap → **Update** (Install nahi, "Update" likha aana chahiye).
2. App kholo.

✅ **Check (sab hone chahiye):**
- [ ] "Update" hua, uninstall nahi maanga (= signing key same hai)
- [ ] Login bana raha, dobara sign in nahi maanga
- [ ] Purane transactions, Gullak, streak, categories sab dikh rahe
- [ ] Profile → version **2.0.0**
- [ ] ~1 sec baad **"New in Arthik 2.0 · Automatic Logging (BETA)"** screen aayi (existing user ko). *Feature flag SQL (Phase 3) abhi nahi chala to bhi default "existing" hai, isliye aayegi.*
- [ ] "Not now" → Home. App dobara kholo → screen **dobara nahi** aani chahiye.
- [ ] Profile me "Automatic Logging · BETA" row hai
- [ ] Automatic Logging setup → ek ₹1 payment → logged (MANUAL_STEPS Part 5 ka chhota version)

| Error | Matlab | Fix |
|---|---|---|
| "App not installed as package conflicts…" | Signing key alag | **Release rok do.** 2.1 dobara. Sahi keystore se build. |
| "App not installed" (bina conflict) | Phone pe dev build hai, ya versionCode chhota | Dev build uninstall karke test karo / 2.2 check |
| Login chala gaya | Normal nahi | Release rok do, mujhe batao |

### 2.5 Fresh install test (naya user)
Kisi doosre phone / emulator pe Arthik **nahi** hona chahiye. APK install karo → **naya account** banao.

✅ **Check:**
- [ ] "New in Arthik 2.0" screen **nahi** aayi
- [ ] Profile me **Automatic Logging row nahi** dikhi (Beta abhi new users ke liye paused)

> Emulator pe purane account se login karoge to row dikhegi aur intro aayega — kyunki account release se pehle bana tha ("existing user"). Ye sahi behaviour hai.

---

## Phase 3 — Supabase (server) tayyar karo

Supabase Dashboard → **SQL Editor**. Ye dono **abhi** chala sakte ho; inse kisi user ka app nahi badalta.

### 3.1 Automatic Logging table (agar pehle nahi chalaya)
File: `supabase/migrations/20261006_autolog_profiles.sql` → paste → Run.

### 3.2 Beta feature flag
File: `supabase/migrations/20261007_release_v2_flags.sql` → paste → **Run**.
Ye `feature_flags` row banata hai: `audience = 'existing'`, aur `existing_before` = **abhi ka time**. Matlab: abhi tak ke saare accounts "existing" hain.
> 💡 Isse **release wale din** chalao. Agar pehle chala diya aur beech me naye log aa gaye, to `existing_before` dobara set karo (Section 8).

Check:
```sql
SELECT key, value FROM public.app_config ORDER BY key;
```
✅ **Check:** `feature_flags` aur `version_control` dono rows dikh rahi hain. `version_control.force_update_enabled` abhi **false** hai.

---

## Phase 4 — GitHub Release banao

1. GitHub → repo → **Releases → Draft a new release**
2. **Tag:** `v2.0.0` (Create new tag on publish) · **Target:** `main`
3. **Title:** `Arthik 2.0 — Automatic Logging (Beta)`
4. **Description:** `CHANGELOG.md` ka `[2.0.0]` section paste karo
5. **Assets:** `Arthik.apk` upload karo. **Naam exact `Arthik.apk`** (capital A, baaki small).
6. **"Set as the latest release"** ✔ tick
7. **Publish release**

### 4.1 Direct link check (zaroori)
Phone ke browser me ye kholo:
```
https://github.com/Kislaya-06/Arthik-App/releases/download/v2.0.0/Arthik.apk
```
aur ye bhi:
```
https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```
✅ **Check:** dono pe **seedha download** shuru ho (page nahi khulna chahiye). File size tens of MB.

| Error | Fix |
|---|---|
| 404 | Asset ka naam galat (`arthik.apk`, `Arthik (1).apk`…). Release edit → asset delete → sahi naam se upload. Tag `v2.0.0` hai na? |
| Release page khulta hai, download nahi | Galat link copy kiya — `/releases/download/...` wala use karo |

### 4.2 README
Repo ka `README.md` naye wale se replace karo → commit → push.

---

## Phase 5 — Go live: sab users ko force update 🚦

Sirf tab karo jab Phase 2 ke saare checks ✅ hon aur Phase 4.1 ka link chal raha ho.

### 5.1 Pehle sirf apne upar try (recommended)
Apne phone pe v1.2.4 rakho (ya ek doosra phone). Phir 5.2 chalao, us phone pe app kholo, poora flow dekho, aur agar kuch galat lage to turant 6.1 (rollback).

### 5.2 Force update ON
SQL Editor:
```sql
UPDATE public.app_config
SET value = jsonb_build_object(
      'min_supported_version', '2.0.0',
      'force_update_enabled', true,
      'release_url', 'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.0.0/Arthik.apk',
      'apk_url',     'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.0.0/Arthik.apk',
      'update_title', 'Arthik 2.0 is here',
      'update_highlights', jsonb_build_array(
        'Automatic Logging (Beta): log bank SMS and UPI payments without typing',
        'Updates now download and install from inside the app',
        'Security and reliability improvements'
      )
    ),
    updated_at = NOW()
WHERE key = 'version_control';

SELECT value FROM public.app_config WHERE key = 'version_control';
```
`release_url` **bhi** direct APK link hai — kyunki purane (v1.2.4) phone sirf `release_url` padhte hain. `apk_url`, `update_title`, `update_highlights` sirf v2+ padhta hai.

### 5.3 Kya hoga (users ko)
| User ke paas | Kya dikhega |
|---|---|
| v1.2.4 / v1.2.3 | App khulte hi (online ho to) "Update Required" → **Download v2.0.0 APK** → browser me download → notification tap → **Update** |
| v2.0.0 | Kuch nahi, normal app |
| Offline user | App normal chalega (fail-open). Internet aate hi screen aayegi. |
| v1.2.2 ya usse purana | Inme version check hi nahi tha → screen nahi aayegi. Inhe message bhej ke batana padega (Section 7). |

✅ **Check:** apne v1.2.4 phone pe app band karke kholo → Update Required aaye → download → install → v2.0.0 khule.

---

## Phase 6 — Rollback (agar kuch galat ho)

### 6.1 Force update turant band (sabse pehla kadam)
```sql
UPDATE public.app_config
SET value = value || '{"force_update_enabled": false}'::jsonb, updated_at = NOW()
WHERE key = 'version_control';
```
Effect: jo log abhi tak update nahi kiye, unhe screen aana band. (Jo update kar chuke, wo v2 pe hi rahenge.)

### 6.2 Automatic Logging Beta band (sirf jinhone setup nahi kiya)
```sql
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,audience}', '"none"'), updated_at = NOW()
WHERE key = 'feature_flags';
```
Jinhone already setup kar liya, unka chalta rahega (feature unse cheena nahi jaata). Unke liye fix OTA se bhejo (6.3).

### 6.3 JS bug ka fix (bina naya APK)
Code fix → tests → phir:
```powershell
eas update --branch preview --message "Fix: <kya fix kiya>"
```
Sirf **v2.0.0** wale phones ko milega (runtime version = app version). App agli baar khulne pe download, uske agli baar apply.

### 6.4 Native bug (Kotlin / permissions)
Naya APK hi chahiye: version `2.0.1` (app.json + package.json) → Phase 1 → 2 → 4 (tag `v2.0.1`, asset `Arthik.apk`) → 5.2 me `2.0.1` aur naye links.

---

## Phase 7 — Users ko batana (optional, achha rehta hai)

WhatsApp / Telegram message template:
```
Arthik 2.0 aa gaya! 🎉
⚡ Automatic Logging (Beta) — bank SMS aur UPI payments khud log honge, sab aapke phone pe hi process hota hai.

Update kaise karein:
1. Arthik kholo → "Download" dabao
2. Download complete hone pe notification pe tap karo → "Update"
(Pehli baar phone "Install unknown apps" allow karne ko bol sakta hai → Allow)

Aapka saara data safe hai.
Seedha link: https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk
```

---

## Phase 8 — Beta rollout control (bina app update ke)

Abhi: `audience = 'existing'` → sirf purane users ko feature dikhta hai, unhe ek baar "New in Arthik 2.0" screen. Naye users ko kuch nahi dikhta.

**Sab ke liye kholna (jab confident ho):**
```sql
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,audience}', '"all"'), updated_at = NOW()
WHERE key = 'feature_flags';
```
Naye users ko Profile me row dikhne lagegi. "New in 2.0" screen naye users ko **kabhi nahi** aati (design se).

**"Existing" ki cutoff badalna** (jaise release pehle chala diya tha):
```sql
UPDATE public.app_config
SET value = jsonb_set(value, '{autolog,existing_before}', to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), updated_at = NOW()
WHERE key = 'feature_flags';
```

**Kitne log use kar rahe hain:**
```sql
SELECT count(*) FILTER (WHERE enabled) AS active, count(*) AS ever_set_up FROM public.autolog_profiles;
```

App flag ko login ke baad padhti hai (aur last value yaad rakhti hai). Change dikhne ke liye user ko app band karke dobara kholna hoga.

---

## Har aane wale release ka chhota checklist

```
[ ] app.json + package.json version bump (native change ho to zaroori)
[ ] npm run typecheck · npm test
[ ] CHANGELOG.md me entry
[ ] eas build -p android --profile preview
[ ] Purane version ke upar install test (Update, data safe)
[ ] GitHub Release: tag vX.Y.Z, asset Arthik.apk, "latest" ✔
[ ] Direct link phone browser me check
[ ] (Force karna ho to) version_control: min version + dono links vX.Y.Z wale
[ ] Apne phone pe end-to-end
```
Sirf JS change? → APK nahi, bas `eas update --branch preview`.

---

## 9. v2.1.0 (Bank emails) — ready SQL

Phase 5.2 ki jagah ye chalao (Phase 1–4 poore hone ke baad, `v2.1.0` release aur `Arthik.apk` upload ho chuka ho):
```sql
UPDATE public.app_config
SET value = jsonb_build_object(
      'min_supported_version', '2.1.0',
      'force_update_enabled', true,
      'release_url', 'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.1.0/Arthik.apk',
      'apk_url',     'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.1.0/Arthik.apk',
      'update_title', 'Arthik 2.1 — bank emails',
      'update_highlights', jsonb_build_array(
        'Automatic Logging can now read bank and payment emails (optional)',
        'One payment = one transaction across SMS, app notification and email',
        'Unsure matches wait for your review instead of creating duplicates'
      )
    ),
    updated_at = NOW()
WHERE key = 'version_control';
```
Koi naya Supabase table / migration nahi hai is release me. Feature flag (`feature_flags`) wahi rehta hai.

