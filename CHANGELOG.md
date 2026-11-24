# Changelog

User-facing changes to **Arthik**, newest first. Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
versions: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Kept short on purpose (condensed on 21 Nov 2026). The full per-change detail — files, tests, rule IDs — is in git
history; performance / offline-safety / security work is recorded in [`docs/optimisation.md`](docs/optimisation.md),
design decisions in [`docs/adr/`](docs/adr/), money rules in
[`docs/ARTHIK_CANONICAL_RULES.md`](docs/ARTHIK_CANONICAL_RULES.md).

Each entry says whether it ships by **OTA** (JS only) or needs a **new APK**.

## [Unreleased] — OTA updates on 2.1.0 (JS only, no new APK)

### Added
- **Add again (OTA)**: press and hold + (either tab bar) to see your last few plain spends; pick one and Add Transaction
  opens filled in for today (amount, category, note, payment). Splits and money back are never offered.
- **Category pre-pick on Add (OTA)**: a new entry starts on the category you used most at this time of day in the last
  60 days (3+ entries, more than half of them); edits and repeats are never changed.
- **Letter avatars (OTA)**: each row shows the first letter of its note (Z for Zomato) in the category badge; money
  back rows and rows with no note keep the category icon.
- **"What's new" tour (OTA)**: shown once after this update to people who already have entries. Each Next opens the
  screen where the feature lives, dims everything else and explains it in a card; Skip or Back ends it.
- **Twelve new Insights (OTA)** (`INS-007..INS-011`), in three new sections:
  - *Where you're heading* (right under the summary, the cards to act on): week / month-end spending estimate with the
    daily cut needed (`INS-007`), money runway in days (`INS-008`), next Gullak milestone ETA (`INS-009`).
  - *Your habits*: no-spend days with the longest run, small spends under ₹200 that add up, when you spend (time of
    day, from entries added on the same day), categories far above or below your own average (a big rise reads "4x"),
    top places from your notes (places you went 2+ times, most visits first; a one-time buy is not a place).
  - *Money with others & Gullak*: money still owed to you leads, then paid for others / came back / refunds (opens the
    Ledger); where Gullak money came from (`INS-010`, one sentence when it all came from one source), best month and the month with least money left (`INS-011`).
  - *Your <year> in Arthik*: a tap-through year story on the Yearly tab (years with 30+ days of entries).
- **Split expenses and money back** (`SPL-001..006`): split with friends, see who owes what in the new Ledger (Owes
  you / Settled groups, tally bars, Mark as paid, Settle all). A friend paying back is never income; refunds go back to
  their expense. Payback review asks "Is this their payment?" and lets you choose the person, then confirm.
- **Income categories** (Salary, Freelance, Interest, Gift, Other Income) and an Expense | Income switch on Add
  Transaction. Review requires a category, so an auto-logged item can no longer loop back to review.
- **Home card breakdown**: tap the Home card for budget, money in and Gullak; swipe down to close.
- **Welcome Back savings** (`ROL-004`): after days with no activity, one tap saves the unspent budget to Gullak.
- **Automatic Logging**: choose a category or Undo right from the notification; categories learned from your own
  history (`AUT-007`); alerts without an account number go to your only account at that bank (`AUT-006`); only real
  bank accounts are listed, "Not my account" hides one for good (`AUT-005`); account names; a weekly summary; steps to
  keep it running on Xiaomi, OPPO, vivo and Samsung; more bank SMS formats (Bank of Baroda, Union Bank, Indian Bank,
  Axis UPI, EMI debits, more card spends).
- **Spending guard top-up**: add money inside the guard sheet when the balance is ₹0, without losing the typed amount.
- **Notices**: "Carried money has run out" (`CAR-001`, `NOT-001`); money-waterfall limit alerts.
- **Animated streak flame**: a layered fire in the original colours (red tips, yellow base, white-hot centre) whose
  flames lick, dance and throw small sparks; it grows with the streak and stays still with reduce motion.
- **Tactile saves**: a soft success buzz when you save an expense, deposit to Gullak or change your budget.

### Changed
- **Amount colours (OTA)**: spending amounts are plain text colour; only money coming in is green (warnings still pass
  their own coral).
- **Others category (OTA)**: a grey ₹ icon and its own grey colour (old DollarSign / mint rows are migrated on load).
- **Savings streak at 0 (OTA)**: says "Start a streak today" without a flame.
- **Refactor (no visible change, OTA)**: the Home card and the Savings allowance card get their numbers from one
  place, the Money Scope module (`src/money/scopeMoney.ts`, ADR 0022). Every figure is the same as before.
- **Refactor (no visible change, OTA)**: one transaction classifier (`classifyTransaction`, ADR 0023). Whether a row
  is income or spending comes from its type only; the unused category-name fallback (`TXN-002`) is retired. Every
  stored transaction is counted exactly as before.
- **Refactor (no visible change, OTA)**: "weeks start on Monday" is defined once (`WEEK_OPTIONS`,
  `src/money/dateKeys.ts`) and used by every week calculation.
- **Automatic Logging reads only bank SMS and bank emails**: payment-app notifications (Google Pay, PhonePe …) are no
  longer used, because they miss the account number and caused duplicate reviews.
- **Budget modes**: switching between Pure Mode and Budget Mode takes effect at midnight; switching back the same day
  cancels it (`PUR-003`). Weekly / Monthly targets support carry-over by allocation (`CAR-001`). One monthly rate based
  on real calendar days (`BUD-009`). Budget changes apply today when nothing is spent yet.
- **Home**: the ring shows your real number (for example 184 % when over budget, `UX-004`) and no longer replays on
  every visit; the card says each thing once; "Available" replaces "Income" for budget money; one offline message at
  a time.
- **Add Transaction**: calmer layout — date, split, between-my-own-accounts and note in one card; the amount shows red
  for spending and green for income; every category has its own coloured icon; the Save button shows what you will
  save ("Save ₹250") and keeps its size; "Yes, always" for own-account transfers asks for a short note to remember.
- **One consistent look** (ADR 0020 / 0021): centred page titles with one header and back button, tap feedback
  everywhere, three button sizes by role, one dimmed backdrop, one empty-state design, switches that fill with colour,
  pills that glide without stutter, deeper green / coral text in Light theme.
- **Lists and screens**: History rows show the time, savings history is grouped by week with totals, notifications
  are grouped into Today / Yesterday / This week (daily Gullak savings fold into one row), Profile settings in clear
  groups, Help Centre style FAQ, text wraps instead of being cut off.
- **Savings and Insights** keep their vivid purple and coral cards. Insights: today counts as an active day for the
  safe daily pace (`INS-001`), weekly / monthly savings follow period rollovers, "last week" instead of "prev week".
- **Money text**: paise always show two digits (₹13,834.50); spending exactly the budget no longer says "₹0 over".
- **Faster and smoother**: opens from the data on the phone, even offline (`OFL-001`); refresh skips the download when
  nothing changed; less work after every save; animations on the UI thread; History on a recycling list.

### Fixed
- **Insights count only real budget days (OTA)** (`INS-004`, `INS-006`): the Weekly / Monthly budget pool and the
  Yearly inflow no longer add the daily allowance for days you were in Pure Mode or had the allowance paused. Each day
  uses the rate that was set that day, and past budget days still count after you switch to Pure Mode. Pauses are now
  remembered (new `profiles.allowance_pauses` column, owner runs
  `supabase/migrations/20261125120000_allowance_pauses.sql`), so a paused day counts no budget even with nothing spent.
- **Streak follows past changes (OTA)** (`ROL-002`): adding, editing or getting money back on a past day's spending
  now also updates the best streak, not only the current one.
- **Savings card switch (OTA)**: the Budget Mode switch on the purple Savings card turns white when on, instead of green.
- **Nothing lost offline**: every save is queued on the phone before it is sent; budget changes, Gullak deposits,
  categories and remembered transfer notes made offline always reach the server.
- **Budget Mode start**: a scheduled switch to Budget Mode no longer leaves the first day's allowance at ₹0.
- **Money correctness**: yearly inflow no longer double-counts Gullak income (`GUL-004`); scheduled plans activate
  after a multi-day break (`BPR-002`, `ROL-001`); Home "All" and the account total agree on a carry gap week
  (`CAR-001`, `BAL-001`); a friend's payback no longer comes back for review; self-transfers are never spending or
  income (`TXN-003`).
- **Reliability**: no false "You are offline" banner on slow networks; a deleted category no longer drops an offline
  expense; no double delete on a double tap; no blink on pull-to-refresh, tab switch or swipe-to-delete.

### Security
- Login session stored encrypted on the phone (SEC-02); Log Out removes this phone's copy of your data but keeps
  unsynced changes (SEC-01); app updates download only from Arthik's own GitHub releases (SEC-03).
- **Security audit fixes (22 Nov 2026, OTA)**: sign-in links work only with a one-time code, so a link from another
  app can no longer sign you into a different account (SEC-05); switching accounts without Log Out never mixes one
  account's spending into another's savings (SEC-06); App Lock now stays on after the splash, covers open sheets and no
  longer shows an error screen when it locks (SEC-07); notification Undo / category buttons do nothing while Arthik is
  locked (SEC-08, `AUT-007`); Log Out clears your notifications so the next account never sees them (SEC-09); payment
  app emails (Paytm, CRED…) go to Review instead of being logged, as anyone can use that name (SEC-10, `AUT-001`);
  update links accept only Arthik's release files (SEC-03).
- **Hardening (22 Nov 2026, OTA)**: deleting your account no longer erases another account's unsynced changes on the
  same phone and stops Automatic Logging capture (SEC-12); a new password can be set only after opening a real reset
  link (SEC-13); Automatic Logging notifications hide amounts on the lock screen on new installs (SEC-14).

### Database (owner runs the SQL once; app code ships by OTA)
- Split expenses columns; income categories migration; expenses list index (OPT-65); sign-up name safety + expense
  change counter (SEC-04, `supabase/migrations/20261116120000_signup_name_safety_and_expense_counter.sql`).
- Rows may only point at your own rows (transfer rule, money-back share, category; a share only on your own
  expense), Automatic Logging profile rules for signed-in users only, sign-up trigger with an empty search path
  (SEC-11, `supabase/migrations/20261122120000_rls_reference_ownership.sql`).

## [2.1.0] — 2026-10-07 — Bank emails in Automatic Logging (new APK)

### Added
- Bank / payment alert emails (Gmail, Outlook, Samsung Email, Yahoo Mail and others) as an optional third Automatic
  Logging source, off by default, with its own screen; only the alert text on the phone is read, nothing leaves it.

### Changed
- A shared transaction reference now matches an SMS and a payment notification at any delay (was 15 minutes).

## [2.0.0] — 2026-10-06 — Automatic Logging (Beta) and in-app updates (new APK)

### Added
- **Automatic Logging (Beta, Android)**: bank SMS and payment-app notifications (Google Pay, PhonePe, Paytm and
  others) become transactions. Setup wizard with Discovery, Automatic Logging Center, Pending Review inbox ("Remember
  Zomato → Food?"), "Why was this logged?", Welcome Back recovery of missed transactions, encrypted on-phone database.
  Rolled out from the server (`app_config.feature_flags.autolog`); a one-time "New in Arthik 2.0" screen for existing
  users.
- **In-app mandatory updates**: Update Required screen that downloads and installs the new APK inside the app.
- **Budget modes**: Pure Mode, and Daily / Weekly / Monthly budgets with next-day cadence switching, carry-forward
  choice, period renewal sheet, Digital Vault spending guard and no proration (ADR 0010–0012).
- **Insights redesign**: Weekly, Monthly and Yearly views with fair day-matched comparisons, cash flow charts,
  behavioural insights and Gullak milestones.
- AMOLED theme with a three-way theme picker; money explainer badges; smart notifications (one policy, evening nudge
  only on days with no expense, Gullak morning reward, weekly and monthly recaps, four Android channels).

### Fixed
- One-tap Google sign-in (PKCE); "Auto-save unspent to Gullak" stays off when you turn it off.

## [1.2.4 OTA] — 2026-10-03

### Added
- Pull up on Home to open History, with a countdown ring; one pull-to-refresh animation across the app.
- Offline-first app: opens without internet; categories, Gullak deposits, profile and budget changes work offline
  and sync later.
- Gullak deposits from income or new money, a deposit detail screen, and a calculator keypad.
- FAQ / Help Centre, biometric App Lock, note suggestions, animated splash, themed update popup.

### Changed
- Design system unified (one set of tokens and UI primitives); English-only app text.
- Overspending is covered by income first, then Gullak.

### Fixed
- Daily budget settings no longer reset on launch; ₹0 allowance turns Budget Mode off; paise kept on every card.

## [1.2.4] — 2026-09-19
- **Added**: Update Required screen with remote version control.
- **Security**: deep link session takeover guard, Android auto-backup off, category isolation in row-level security,
  database bounds checks.
- **Fixed**: changing the daily budget no longer rewrites past days; zero-spend days kept on sync; streaks count only
  days after sign-up; paise on large amounts; correct nightly savings notification; midnight refresh on return.

## [1.2.3] — 2026-09-16
- **Fixed**: new users start with the daily limit off; budgets corrupted to ₹500 by an old default heal themselves;
  phantom days removed.
- **Security**: full account and data deletion (Edge Function), hardened row-level security, PKCE sign-in.
- **Reliability**: client-made IDs (no duplicate inserts), offline queue flushed on launch, 1,000+ expenses paged,
  Sync Failed banner with retry.

## [1.2.2] — 2026-09-16
- **Added**: offline-first sync with optimistic updates, offline banner, app-wide error screen, overspending taken
  from Gullak savings.

## [1.2.1] — 2026-09-14
- **Added**: daily allowance linked to the Home summary card; long names scale to fit.
- **Fixed**: crash on Log Out; time-zone-safe date filters; equal form control heights.

## [1.2.0] — 2026-09-13
- **Added**: floating bottom navigation bar; daily budget with rollover, savings streak and Gullak.

## [1.0.0] — 2026-09-10
- First release: email and Google sign-in, expenses with categories and payment modes (Cash, UPI, Card), notes,
  custom keypad and calendar, category and monthly charts, Light and Dark themes.
