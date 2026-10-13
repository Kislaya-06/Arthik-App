# Arthik — Manual Smoke Checklist (Device Verification)

> **Instructions:** Run this checklist on the baseline (`pre-refactor`) build first and take screenshots of each screen. After each refactoring step, run the relevant checks on the same account with the same data to ensure pixel-for-pixel and rupee-for-rupee fidelity.

---

## 1. Screenshot Reference List (Same Account, Same Data)

Capture and archive screenshots before starting refactoring:
- **Home**: Daily Mode (`isBudgetModeEnabled: true`)
- **Home**: Pure Mode (`isBudgetModeEnabled: false`)
- **Insights**: Weekly (`offset: 0` current week, `offset: -1` previous week)
- **Insights**: Monthly (`offset: 0` current month, `offset: -1` previous month)
- **Insights**: Yearly (`offset: 0` current year, `offset: -1` previous year)
- **Savings**: Hero summary card (top)
- **Savings**: Budget Hub & allowance settings card
- **Savings**: History list under all filters (`All`, `This Week`, `This Month`, `Deposits`)
- **Profile**: Full screen scroll (all settings, modals, version pill)
- **Streak Calendar**: Modal open, current month and past month
- **History**: Full transaction list with date separators
- **Expense Detail**: Transaction funding breakdown card, category pill, notes

---

## 2. Functional Checks Matrix

| # | Check | Scope / When Required | Status / Pass Criteria |
|---|---|---|---|
| 1 | Fresh login → Home data loads instantly; no white blank flash or layout flicker | Step 6, 7 | Pending |
| 2 | Expense add (online) → Immediately appears in Home, History, and Insights; Gullak & budget numbers update in real time | Step 6, 7 | Pending |
| 3 | **Airplane mode ON** → Add 2 expenses, edit 1 expense, delete 1 expense → Turn Airplane mode OFF → All offline queue items sync to Supabase cleanly; no duplicates, no lost transactions | **Step 6 (CRITICAL)** | Pending |
| 4 | Offline persistence: Airplane mode ON → force close app → reopen app → Pending badges and queued mutations intact | Step 6 | Pending |
| 5 | Budget Mode toggle (ON/OFF), Cadence switch (Daily → Weekly → Monthly), and same-cadence allowance edit | Step 7 | Pending |
| 6 | Gullak deposit: Add from Income and Add from External Money; Delete deposit with real-time balance restoration | Step 5, 7 | Pending |
| 7 | Day rollover: Yesterday's savings correctly finalized to Gullak; rollover notification triggered if enabled | Step 7 | Pending |
| 8 | Insights: Weekly / Monthly / Yearly numbers match baseline screenshots exactly; period navigation and swipe gestures fluid | Step 3 | Pending |
| 9 | Profile: Name edit modal, budget pause modal, logout, delete account modal trigger and cancel without side effects | Step 4 | Pending |
| 10 | Streak calendar modal: Month navigation, date cell tapping, flame indicator intact | Step 5 | Pending |
| 11 | Theme compatibility: Light, Dark, and AMOLED themes render all typography, borders, and pills cleanly | Step 3, 4, 5 | Pending |
| 12 | Auto Logging: Banner / Setup screen opens cleanly | Every step (Sanity) | Pending |
| 13 | Auto Logging: Activation boundary strictly respected; zero pre-setup SMS/email/notifications retroactively logged | Baseline + Shared store steps | Pending |
| 14 | Auto Logging multi-source reconciliation: Email-only event, late SMS attaching to existing transaction ID without duplicate or re-review | Shared store / Startup steps | Pending |
| 15 | Auto Logging lifecycle: Sign-out, pause, disable, and tracked-account isolation; on-device SQLCipher local database remains intact | Auth / Lifecycle steps | Pending |
| 16 | Split / reimbursement accounting: Partial reimbursement linked to original share, shown as separate history item, never counted as income; own-account transfers neither income nor expense | Expense / Budget / Insights steps | Pending |
| 17 | Pull-to-History: Progressive ring indicator, threshold label, below-threshold spring cancel, qualified release navigation, single haptic; bottom nav remains fixed | HomeScreen / Nav steps | Pending |
| 18 | Notifications: No duplicate or re-opened review alerts after transaction confirmation; delayed source "Why logged" card accurately reflects both sources | Notification / Auto Log steps | Pending |
