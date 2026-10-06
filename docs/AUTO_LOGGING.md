# Automatic Logging — Architecture (v2.0)

Product spec: `Arthik_Auto_Logging_Final_Product_Spec`. This file explains **how the code implements it**.

## 1. The problem, in one line
Typing every UPI payment is tedious. Bank SMS and payment-app notifications already describe every payment. So: read them on the phone, turn the safe ones into transactions, and ask the user about the rest.

## 2. Three modes (never mix them)
| Mode | What it does | Creates transactions? |
|---|---|---|
| **Discovery** | Learns banks, accounts (last 4), message formats from old SMS | **Never** |
| **Recovery** | Re-checks the signed-out / paused gap through the normal rules | Yes (normal rules + review) |
| **Live** | New SMS / notifications after the *live boundary* | Yes |

The **live boundary** is `meta.live_since`, written when setup completes. Queue events older than it are dropped.

## 3. Data flow
```
Bank SMS ──► SmsReceiver.kt ─┐  (native privacy gate: FinancialFilter.kt
Payment notif ► Listener.kt ─┤   drops phone-number senders, OTPs, non-money text)
                             ▼
                 EventQueue (app-private jsonl file)
                             │  AutoLogHeadlessService wakes JS
                             ▼  (+ periodic expo-background-task, + app open)
             service.processQueue()  ── serialised, one job at a time
                             ▼
   engine.processSms / processNotification
     parse → noise filter → user rules → tracked-account filter → same-source dedupe
     → card bill / own transfer → cross-source match → confidence
                             ▼
          logged  |  pending (Pending Review)  |  ignored / transfer / merged
                             ▼
          ledger.createTransaction() → expenseStore (app open) or Supabase (headless)
```

## 4. Files
| Path | Role |
|---|---|
| `modules/arthik-autolog/` | Local Expo module (Kotlin): SMS read/receive, notification listener, queue, headless service, settings intents. Autolinked from `./modules`. |
| `src/features/autoLog/parser.ts` | Pure SMS + notification parsers, templates, masking. Unit-tested. |
| `src/features/autoLog/matching.ts` | Pure matching rules + time windows. Unit-tested. |
| `src/features/autoLog/db.ts` | Encrypted SQLite (SQLCipher) per user. Key in SecureStore. |
| `src/features/autoLog/engine.ts` | The decision pipeline. |
| `src/features/autoLog/reviews.ts` | User decisions: classify, category, ignore, report problem. |
| `src/features/autoLog/service.ts` | Lifecycle: entry decision, setup, discovery, recovery, pause, sign-out, turn off. |
| `src/features/autoLog/ledger.ts` | Bridge into `expenseStore` / Supabase. |
| `src/features/autoLog/background.ts` | Headless task + periodic task. Imported in `index.ts`. |
| `src/features/autoLog/store.ts` | Zustand UI snapshot (not persisted). |
| `src/features/autoLog/remote.ts` | `autolog_profiles` table (no message content). |
| `src/features/autoLog/rollout.ts` | Beta rollout: `app_config.feature_flags.autolog` audience, existing-user detection, one-time intro. |
| `src/screens/autolog/*` | Center, Setup, Welcome Back, Pending Review, Accounts, Info/Privacy. |
| `src/components/autolog/*` | Shared UI, ReviewSheet, WhyLoggedCard, HomeBanner, Gate. |

## 5. Key rules → where they live
| Rule (spec §) | Code |
|---|---|
| Balance never an amount (§39) | `parser.extractAmount` + `RE_BALANCE_BEFORE` |
| Future / mandate / collect / failed ≠ txn (§39) | `parser.RE_FUTURE`, `RE_FAILED`, notif `RE_N_IGNORE` |
| Never fuzzy-merge same source (§38.2) | `matching.isSameSourceDuplicate` (ref or identical text ≤5 min only) |
| Notification + SMS = one txn (§16, §38.1) | `matching.isCrossSourceMatch` (amount, direction, ±15 min, refs must not differ) |
| Notification alone never logs | `engine.processNotification` → `awaiting_sms` → after 20 min `pending/notification_only` |
| Own transfer / card bill not expense (§38.4) | `engine.processSms` transfer block, `isOwnTransferPair` |
| Only tracked accounts (§7, trust rule 4) | new accounts inserted with `tracked = 0`, shown as "New account found" |
| Narrow ignore rules (§11) | `rules` table: exact fingerprint or exact template; never amount-based |
| Unknown merchant → ask category (§17) | logged with `needs_category = 1` → appears in Pending Review |
| Manual entry look-alike | `ledger.findManualLookalike` → `possible_duplicate` |
| Data loss ≠ silent restore (§30–36) | `service.evaluateEntry`: no local DB + `autolog_profiles.enabled` → re-setup |
| Clear cache keeps state (§36) | DB lives in app data, not cache |

## 6. Storage
- **On device (encrypted):** events (masked text for review), accounts, rules, templates, merchant prefs, feedback. Old noise pruned after 180 days.
- **Server:** `autolog_profiles` — enabled, setup/last-active/signed-out timestamps, tracked accounts as `{bank, bankCode, last4, kind}`.

## 7. Limits and constants (`matching.ts`)
Discovery: last 90 days, max 5,000 SMS. Recovery: gaps up to 30 days (longer → Learn only). Cross-source window 15 min. Notification wait 20 min. Transfer window 15 min.

## 8. Tests
- `tests/autoLogParser.test.ts` — pure parser + matching rules.
- `tests/autoLogFlows.test.ts` — the real `db.ts`, `engine.ts`, `service.ts`, `reviews.ts` running against Node's built-in SQLite (`node:sqlite`, Node 22+). Native module, ledger, server and notifications are test doubles from `tests/helpers/autoLogTestEnv.ts`. Every trust rule in spec §47 has a test.
- Not unit-tested: the Kotlin module and the React screens — test those on a device (see `MANUAL_STEPS.md`). In dev builds the Center screen has **Developer test tools** that push fake events through the real pipeline.

## 9. Known limitations (MVP)
- Android only. iOS has no SMS access.
- Bank SMS formats vary; unknown formats go to review and are learned from user answers.
- Transfers are detected only when both accounts are tracked.
- Some OEMs (Xiaomi, Oppo, Vivo, Realme) also need "Autostart" enabled; the app shows Background ⚠ but cannot open that OEM screen directly.
- Feedback ("Report a problem") is stored on device only; no upload.
