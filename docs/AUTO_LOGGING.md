# Automatic Logging — Architecture (v2.0)

Product spec: `Arthik_Auto_Logging_Final_Product_Spec`. This file explains **how the code implements it**.

## 1. The problem, in one line
Typing every UPI payment is tedious. Bank SMS and bank transaction emails already describe every confirmed payment with exact account numbers and amounts. By focusing strictly on these **two authoritative bank sources** (Bank SMS + Bank Email alerts), Arthik turns real bank transactions into expenses automatically while eliminating phantom duplicate reviews from payment-app intermediaries (Option A).

## 2. Three modes (never mix them)
| Mode | What it does | Creates transactions? |
|---|---|---|
| **Discovery** | Learns banks, accounts (last 4), message formats from old SMS | **Never** |
| **Recovery** | Re-checks the signed-out / paused gap through the normal rules | Yes (normal rules + review) |
| **Live** | New SMS / bank emails after the *live boundary* | Yes |

The **live boundary** is `meta.live_since`, written when setup completes. Queue events older than it are dropped.

## 3. Data flow
```
Bank SMS ────► SmsReceiver.kt ─┐  (native privacy gate: FinancialFilter.kt
Bank Email ──► Listener.kt ────┤   drops personal senders, OTPs, non-money text;
(via notif)                    │   payment-app notifications are skipped)
                               ▼
                   EventQueue (app-private jsonl file)
                               │  AutoLogHeadlessService wakes JS
                               ▼  (+ periodic expo-background-task, + app open)
               service.processQueue()  ── serialised, one job at a time
                               ▼
                     engine.processSms / processEmail
       parse → noise filter → user rules → tracked-account filter → dedupe
       → card bill / own transfer → cross-source match (SMS ↔ Email) → confidence
                               ▼
            logged  |  pending (Pending Review)  |  ignored / transfer / merged
                               ▼
            ledger.createTransaction() → expenseStore (app open) or Supabase (headless)
```

## 4. Files
| Path | Role |
|---|---|
| `modules/arthik-autolog/` | Local Expo module (Kotlin): SMS read/receive, email notification listener, queue, headless service, settings intents. Autolinked from `./modules`. |
| `src/features/autoLog/parser.ts` | Pure SMS + email parsers, templates, masking. Unit-tested. |
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
| `src/screens/autolog/*` | Center, Setup, Welcome Back, Pending Review, Accounts, Info/Privacy, Email. |
| `src/components/autolog/*` | Shared UI, ReviewSheet, WhyLoggedCard, HomeBanner, Gate, EmailSourceInfo. |

## 5. Key rules → where they live
| Rule (spec §) | Code |
|---|---|
| Balance never an amount (§39) | `parser.extractAmount` + `RE_BALANCE_BEFORE` |
| Future / mandate / collect / failed ≠ txn (§39) | `parser.RE_FUTURE`, `RE_FAILED` |
| Never fuzzy-merge same source (§38.2) | `matching.isSameSourceDuplicate` (ref or identical text ≤2s only) |
| SMS & Email Dual-Core Priority (§16, §40) | Bank SMS and Bank Email are Tier-1 authoritative sources. Confirmed transactions on tracked accounts auto-log immediately; unknown category logs with `needs_category = 1` for 1-tap review. On the review sheet a category is required to save (there is no "None" option) and only categories of the chosen side are shown (`CAT-004`), so a reviewed transaction never comes back asking for a category. |
| Cross-Source Reconciliation (SMS ↔ Email) | When a payment generates both an SMS and an Email (or vice versa), they link together under "Why Logged" as a single transaction (`status = 'merged'`). |
| Repeat Transactions Protected (§38.2) | Real separate payments (e.g. ₹25 spent again 20 min later) have distinct timestamps/references and are ALWAYS logged as separate expenses; never falsely deduplicated. |
| Payment Apps Excluded (Option A) | Payment app push notifications (GPay/PhonePe) are skipped natively and in `service.processQueue` to prevent false duplicate reviews caused by missing bank account digits. |
| Legacy Previews Quietly Resolved | `engine.sweepAwaiting` gracefully reconciles any lingering `awaiting_sms` events with confirmed SMS/Email, or sets them to `ignored` without generating phantom review alerts. |
| Own transfer / card bill not expense (§38.4) | `engine.processSms` / `processEmail` transfer block, `isOwnTransferPair` |
| Only tracked accounts (§7, trust rule 4) | new accounts inserted with `tracked = 0`, shown as "New account found" |
| Narrow ignore rules (§11) | `rules` table: exact fingerprint or exact template; never amount-based |
| Unknown merchant → ask category (§17) | logged with `needs_category = 1` → appears in Pending Review |
| Money back from a person (`SPL-005`) | A logged credit can be a friend paying back. `ledger.moneyBackQuestionFor` (name + amount first, then name only) adds "X owes you ₹Y. Is this their payment?" to the notification while the app data is loaded; `ReviewSheet` lists everyone who owes money ("Paid back by someone?", name matches first) and `ExpenseDetailScreen` / `MoneyBackSheet` ask the same question for any logged income. Arthik only asks, never settles by itself. Tapping a person only CHOOSES them (nothing is chosen by itself; a likely match just gets a "Likely match" tag) and the footer button becomes "Settle with <person> · ₹X"; pressing it completes the review without asking for a category (SPL-005 points 5–6, ADR 0017 and 0018). More money than owed: a note says the extra stays income. A remembered "income" preference does not auto-log a credit from a person who still owes money: `engine.paybackHoldQuestion` + `paybackGuard.shouldHoldCreditForPayback` send it to review with the settle question (SPL-005 point 7). A debit review also has "Expense, split with someone" (`SPL-001`). |
| Manual entry look-alike | `ledger.findManualLookalike` → `possible_duplicate` |
| Review Dismissal & Swipe Delete | `AutoLogReviewScreen.tsx` + `reviews.discardEvent`: swipe-to-reveal delete button with UI-thread spring and layout animation, plus header Clear All action; removes pre-logged ledger items and marks event as ignored without losing deduplication hash. |
| Concise Review Sheet & Direct Discard | `ReviewSheet.tsx`: 1-page concise bottom sheet combining compact fintech split-row receipt card, horizontal scrollable category chips with left/right SVG fade gradients (matching `ExpenseFormScreen`), 48px stadium pills for Remember Preference, Mark as Self Transfer (automating `self_transfer_rules` and `merchant_prefs` transfer routing), and Save & split, with 52px primary Save CTA and comfortable 38px secondary escape hatches. |
| Reset Learned Rules | `AutoLogCenterScreen.tsx` + `db.resetLearnedRules`: clears `merchant_prefs` and `rules` back to factory clean slate without touching tracked accounts or past transaction ledger history. |
| Vault Spending Guard (ADR 0011) | `ledger.isExceedingVaultLiquidity` → `exceeds_liquidity` review (zero funds in Income & Gullak with amount > budget blocks silent deficit creation) |
| Data loss ≠ silent restore (§30–36) | `service.evaluateEntry`: no local DB + `autolog_profiles.enabled` → re-setup |
| Account Deletion Factory Wipe | `authStore.deleteAccount`: physically unlinks encrypted SQLite DB (`deleteLocalData(userId)`), purges SecureStore encryption keys, and executes `AsyncStorage.clear()`. |
| Clear cache keeps state (§36) | DB lives in app data, not cache |

## 6. Storage
- **On device (encrypted):** events (masked text for review), accounts, rules, templates, merchant prefs, feedback. Old noise pruned after 180 days.
- **Server:** `autolog_profiles` — enabled, setup/last-active/signed-out timestamps, tracked accounts as `{bank, bankCode, last4, kind}`.

## 7. Limits and constants (`matching.ts`)
Discovery: last 90 days, max 5,000 SMS. Recovery: gaps up to 30 days (longer → Learn only). Cross-source window 15 min. Notification wait 20 min. Transfer window 15 min.

## 8. Tests
- `tests/autoLogEmail.test.ts` — email source: parser, identity scoring, every multi-source scenario from the email spec.
- `tests/autoLogParser.test.ts` — pure parser + matching rules.
- `tests/autoLogFlows.test.ts` — the real `db.ts`, `engine.ts`, `service.ts`, `reviews.ts` running against Node's built-in SQLite (`node:sqlite`, Node 22+). Native module, ledger, server and notifications are test doubles from `tests/helpers/autoLogTestEnv.ts`. Every trust rule in spec §47 has a test.
- Not unit-tested: the Kotlin module and the React screens — test those on a device (see `MANUAL_STEPS.md`). In dev builds the Center screen has **Developer test tools** that push fake events through the real pipeline.

## 9. Email notifications (v2.1)

**Why:** some banks / cards send an email but no SMS. SMS must not be mandatory.

**How it works:** email apps (Gmail, Outlook, Samsung Email, Yahoo Mail, Proton Mail, Spark, Zoho Mail) show a notification for each new email. The existing notification listener reads those notifications — sender, subject, preview — only when the user turned on email detection (`meta.email_enabled` + native `email_enabled`). No inbox access, no history.

```
Email app notification ─► PaymentNotificationListener.onEmailNotification
   (email switch ON? group summary? FinancialFilter.isFinancialEmail)
        ─► queue {type:'email'} ─► service.processQueue ─► engine.processEmail
             parseEmail (advice sentences like "never share your OTP" removed first)
             ─► noise filter ─► rules ─► account (bank: exact key · provider/unknown: tracked last 4 if unique)
             ─► findIdentity(sms + notification + email)
                   match ─► merge as a source (or take over a waiting notification / pending item)
                   ambiguous / weak ─► Pending Review "Might be a duplicate"
                   none ─► unknown sender? review · no account? review · type rules ─► log
```

**Identity scoring** (`matching.ts`): same reference → 100 (any delay ≤ 30 days). Otherwise: amount + direction = 1, same last 4 = +2, same merchant = +2, same day = +1, within 30 min = +1, window 48 h. Different last 4 / merchant / reference → never. Same source → never (without reference). Score ≥ 3 with exactly one candidate → merge. Two or more ≥ 3 → ambiguous. Only weaker candidates → review (no silent duplicate, no arbitrary merge).

**SMS and notifications also check emails:** a bank SMS that arrives after an email joins that transaction; a payment notification matching an email is merged into it.

| File | Email part |
|---|---|
| `FinancialFilter.kt` | `EMAIL_APPS`, `isFinancialEmail` |
| `PaymentNotificationListener.kt` | `onEmailNotification` |
| `EventQueue.kt`, `ArthikAutoLogModule.kt` | `email_enabled` switch |
| `parser.ts` | `parseEmail`, `resolveEmailSender`, `extractTxnTime` |
| `matching.ts` | `identityScore`, `decideIdentity`, `IDENTITY_WINDOW_MS` |
| `engine.ts` | `processEmail`, `findIdentity`, email checks in `processSms` |
| `service.ts` | `setEmailEnabled`, `isEmailEnabled`, `emailSupported`, queue type `email` |
| `screens/autolog/AutoLogEmailScreen.tsx`, `components/autolog/EmailSourceInfo.tsx` | UI |
| `tests/autoLogEmail.test.ts` | 32 tests |

**Limits:** only what the email notification shows (long emails are cut by the email app); emails whose notifications are muted are not seen; no historical email discovery (old emails are never read).

## 10. Known limitations (MVP)
- Android only. iOS has no SMS access.
- Bank SMS formats vary; unknown formats go to review and are learned from user answers.
- Transfers are detected only when both accounts are tracked.
- Some OEMs (Xiaomi, Oppo, Vivo, Realme) also need "Autostart" enabled; the app shows Background ⚠ but cannot open that OEM screen directly.
- Feedback ("Report a problem") is stored on device only; no upload.
