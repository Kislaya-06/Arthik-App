# Arthik — Email Notification Auto-Logging Product Specification

**Feature:** Email Notification Parsing for Automatic Transaction Logging  
**Platform:** Android  
**Architecture:** Authoritative Dual-Core Bank Sources (Option A: Bank SMS & Bank Email Alerts)  
**Scope:** Product behavior only — WHAT the product does, not HOW it is implemented.

---

## 1. Feature Overview

Arthik provides automatic transaction detection to eliminate manual UPI and cash tracking overhead. 

Under the **Authoritative Dual-Core Architecture (Option A)**, Automatic Logging relies strictly on two trusted, first-class bank sources:
1. **Bank SMS** (via Android SMS Receiver)
2. **Bank Transaction Emails** (via Android Notification Listener for supported email apps: Gmail, Outlook, etc.)

Intermediary payment-app notifications (GPay, PhonePe, Paytm, etc.) are **explicitly excluded** because they lack bank account last-4 digits, frequently mask merchant VPAs, and create false-positive duplicate review prompts.

Email is **not** an auxiliary or subordinate "third source." It is an **Authoritative Tier-1 Bank Source** alongside Bank SMS. Both sources carry confirmed bank debit/credit data, exact account digits, and authentic bank reference IDs.

> **A transaction may have multiple sources, but it must exist only once in Arthik.**

---

## 2. Why Email Parsing Is Essential

Many Indian banks, credit card issuers, and fintechs no longer reliably send SMS for every financial transaction:
- Several banks (e.g. HDFC, ICICI, Amex, Axis) do not send SMS for small-ticket UPI transactions or international subscriptions, but send immediate email alerts.
- Users frequently experience delayed or lost SMS due to cellular network outages or DND filters.
- Some credit cards and digital banks communicate account activity primarily or exclusively over email alerts.

```text
SMS:              Not received (delayed / unsent by bank)
Bank Email:       ₹500 debited from HDFC Bank A/c XX1234 for Zomato
                    ↓
              Arthik detects email notification
                    ↓
               Auto-logs ₹500 immediately
```

Bank SMS is therefore **not mandatory** for automatic logging. Email operates as a completely independent, authoritative transaction source.

---

## 3. Unified Dual-Core Architecture

```text
       Bank SMS (SmsReceiver)        Bank Email Notification (Listener)
                 │                                  │
                 └────────────────┬─────────────────┘
                                  ▼
                         Source Parsers
                                  ▼
                      Common Transaction Object
                                  ▼
                    Identity & Cross-Source Dedupe
                                  ▼
                     ┌────────────┴────────────┐
                     ▼                         ▼
              High Confidence            Low Confidence / Vault Guard
                     ▼                         ▼
            Directly Auto-Logged         Pending Review Queue
```

All transaction events flow through the same common transaction normalization, deduplication engine, and on-device encrypted ledger.

---

## 4. Email Notification Scope

Detection focuses strictly on financial transaction alerts surfaced as notifications by supported Android email applications:
- **Gmail** (`com.google.android.gm`)
- **Microsoft Outlook** (`com.microsoft.office.outlook`)
- **Samsung Email** (`com.samsung.android.email.provider`)
- **Yahoo Mail** (`com.yahoo.mobile.client.android.mail`)
- **Proton Mail** (`ch.protonmail.android`)
- **Spark** (`com.readdle.spark`)
- **Zoho Mail** (`com.zoho.mail`)

Relevant email notification types:
- Account debit alerts
- Account credit alerts
- UPI transaction confirmations
- Credit card swipe / e-commerce alerts
- NetBanking / IMPS / NEFT / RTGS transfers

Arthik inspects only the notification payload (sender title + notification text/bigText) on-device. It never connects to or scans the user's private email inbox.

---

## 5. Relevant Financial Emails

Examples of valid financial email notifications:
- *"HDFC Bank: ₹500.00 debited from a/c **1234 on 16-OCT-26 info VPA Zomato"*
- *"ICICI Bank: Payment of ₹1,250.00 was successful on Card ending 4091 at Swiggy"*
- *"SBI: ₹3,000.00 credited to your a/c **9876 via IMPS Ref 8392019283"*
- *"Axis Bank: Alert! Your A/c **4321 is debited for ₹799.00 on 16-10-26"*
- *"CRED / Card: Transaction of ₹450 completed at Starbucks on Card XX5678"*

Key extracted attributes:
- **Amount**
- **Direction** (Expense / Income / Self-Transfer)
- **Account / Card Last 4 Digits**
- **Merchant / Counterparty Description**
- **Transaction Reference ID / UPI RRN / UTR**
- **Transaction Date / Timestamp**
- **Bank / Provider Name**

---

## 6. Emails That Must Never Become Transactions

Native pre-filters (`FinancialFilter.kt`) and parser regex drop non-transactional emails before they can enter the ledger:
- OTP and 2-step verification codes
- Login / security alerts / password reset confirmations
- Promotional offers, cashback marketing, discount codes
- Credit card bill payment reminders and statements
- Future debit reminders, upcoming mandate notifications
- UPI collect requests (payment requests sent by third parties)
- Failed, cancelled, or declined transaction alerts
- Account balance summaries and statement downloads
- Generic account status updates without an actual debit or credit event

If an email notification appears financial but cannot be confidently interpreted, it routes to **Pending Review** rather than silently creating an expense.

---

## 7. Email-Only Transactions

An email notification creates a transaction independently when no Bank SMS arrives:

```text
Bank SMS:         ❌ (Not received)
Bank Email:       ✓ (Received)
                  ↓
           Parse & Validate
                  ↓
          Confidence Evaluation
                  ↓
      Auto-Logged to Ledger (High Confidence)
```

If the email contains high-confidence evidence (confirmed debit on tracked account with valid amount and bank sender), it auto-logs without requiring manual approval.

---

## 8. Dual-Source Cross-Reconciliation (SMS ↔ Email)

When a transaction triggers both a Bank SMS and a Bank Email alert, Arthik creates **only one transaction**:

```text
Bank SMS (10:30:10):
₹500 debited from HDFC Bank A/c XX1234
Ref: 8392019283

Bank Email (10:30:45):
Payment of ₹500 from A/c XX1234 to Zomato confirmed
Ref: 8392019283
```

Result:

```text
ONE Transaction:
₹500 — Zomato
Account: HDFC Bank **1234

Sources:
✓ Bank SMS
✓ Bank Email
```

The second source reinforces and enriches the existing record (adding clean merchant names or matching reference IDs) without creating a duplicate expense.

---

## 9. SMS First vs Email First (Arrival Agnostic)

Deduplication works bidirectionally regardless of which source arrives first:

### Scenario A: SMS arrives first, Email follows
1. Bank SMS arrives at 10:30 $\to$ Transaction logged immediately as `₹500 (Ref: 8392019283)`.
2. Bank Email arrives at 10:32 $\to$ Match found via Reference ID $\to$ Email merged into existing transaction (`status = 'merged'`).

### Scenario B: Email arrives first, SMS follows
1. Bank Email arrives at 14:15 $\to$ Transaction logged immediately with clean merchant name.
2. Bank SMS arrives at 14:25 (delayed by cell carrier) $\to$ Match found via Reference ID/Amount/Account $\to$ SMS merged into existing transaction.

---

## 10. Multi-Account Dual-Core Protection

In multi-card or multi-account setups, transactions are cleanly isolated by account last 4 digits:

```text
10:00 AM — Bank SMS:   ₹1,000 debited from HDFC A/c **1234
10:00 AM — Bank Email: ₹1,000 debited from ICICI Card **5678
```

Result:
```text
TWO Distinct Transactions:
1. ₹1,000 (HDFC Bank **1234)
2. ₹1,000 (ICICI Card **5678)
```

Cross-source merging strictly enforces account matching. A debit on Card A will never merge with an email for Account B, even if amounts and timestamps match.

---

## 11. Common Transaction Schema

Every detected financial event normalizes into an authoritative `CommonTransaction`:

```text
CommonTransaction
├── id (UUID)
├── amount (number)
├── type ('expense' | 'income')
├── account_last4 (string)
├── bank_name (string)
├── occurred_at (timestamp)
├── merchant (string | null)
├── reference_id (string | null)
├── confidence ('high' | 'medium' | 'low')
└── sources
      ├── sms (present if verified by SMS)
      └── email (present if verified by Email)
```

---

## 12. Source Transparency

Users can inspect the exact origin of every automatically logged transaction in the UI:

### Single-Source Badge:
```text
₹500.00 — Zomato
Today, 10:30 AM • HDFC Bank **1234

Source:
• Bank Email (Gmail)
```

### Multi-Source Reconciliation Badge:
```text
₹500.00 — Zomato
Today, 10:30 AM • HDFC Bank **1234

Sources:
✓ Bank SMS
✓ Bank Email (Gmail)
```

---

## 13. "Why Was This Logged?" Transparency Card

The transaction detail screen provides a plain-language explanation of why and how the transaction was logged:

```text
Why was this logged?

✓ Authoritative Bank Email detected from alerts@hdfcbank.net
✓ Amount: ₹500.00 confirmed
✓ Expense direction verified (debited)
✓ Account: HDFC Bank ending in 1234 (Tracked)
✓ Merchant identified: Zomato
✓ Reconciled with Bank SMS (Ref: 8392019283)
```

---

## 14. Dedupe Is Source-Agnostic

The deduplication engine asks:
> *"Does this new financial alert represent an existing transaction already recorded in the ledger?"*

It evaluates:
- An incoming Email against existing SMS transactions
- An incoming SMS against existing Email transactions
- An incoming Email against existing manual user entries (lookalike detection)

---

## 15. Strongest Identity — Transaction Reference ID

Reliable financial identifiers serve as the gold standard for matching:
- **UPI Reference Number / RRN** (12 digits)
- **Bank Transaction ID / UTR**
- **Credit Card Authorization Code**

When two sources share an authentic reference ID, they are merged with 100% certainty, even across multi-hour arrival delays.

---

## 16. Delayed Delivery Handling

Cellular SMS delivery and email push alerts can be delayed by minutes or hours:

```text
Actual payment: 10:30 AM
Bank SMS:       10:30 AM (immediate)
Bank Email:     01:15 PM (delivered 2h 45m late due to battery-saver sync)
```

Both represent the same real-money transaction. Because the reference ID and account match, the delayed email is safely reconciled without creating a second expense.

---

## 17. Transaction Time vs Arrival Time

The system strictly distinguishes between:
- **Transaction Time**: When the payment actually took place (parsed from the message text, e.g. "on 16-Oct-2026 at 10:30 AM").
- **Arrival Time**: When the device received the notification.

The transaction record always preserves the true transaction time.

---

## 18. Matching Without a Reference ID

When a bank email or SMS omits the reference ID, matching relies on a 4-factor multi-attribute score:
1. **Exact Amount Match** (`Math.abs(e1.amount - e2.amount) < 0.01`)
2. **Exact Account Match** (Same bank + same last 4 digits)
3. **Same Financial Direction** (Both debits or both credits)
4. **Time Window** (Occurred within a 15-minute sliding window)
5. **Merchant Token Similarity** (Clean merchant names agree or one is a substring of the other)

---

## 19. Time Is Supporting Evidence, Not Identity

Time proximity alone does not prove identity. Conversely, a modest time discrepancy does not disprove identity if account and reference match.

---

## 20. Same Amount Is Never Enough

Arthik never merges two events based solely on identical amounts:

```text
10:00 AM — ₹150 Chai at Tea Stall (HDFC **1234)
04:30 PM — ₹150 Snacks at Bakery (HDFC **1234)
```

These are two genuine, separate real-money expenses. Because timestamps and counterparty details differ, both are logged distinctly.

---

## 21. Ambiguous Matches Route to Review

If an incoming bank email could match more than one existing transaction:

```text
Existing Transactions:
1. ₹500 — Zomato — 10:00 AM
2. ₹500 — Zomato — 06:00 PM

Incoming Email:
"₹500 debited for Zomato" (Missing timestamp / reference)
```

Result:
- The engine does **not** guess or arbitrarily attach the email to one of the transactions.
- The event routes to **Pending Review** for 1-tap user confirmation.

---

## 22. Cross-Source Matching Windows

- **Reference Match**: Up to 7 days (accommodates batch email statements or delayed weekend alerts).
- **Attribute Match (No Ref ID)**: 15-minute sliding window (`TRANSFER_WINDOW_MS = 15 * 60 * 1000`).

---

## 23. Same-Source Repeat Protection

If a bank sends two separate email alerts for two identical rapid transactions (e.g. two ₹20 payments to a vendor within 2 minutes):
- Repeat payments carry distinct notification IDs or timestamps.
- Only exact identical texts posted within 2 seconds (`SAME_MESSAGE_WINDOW_MS = 2_000`) are treated as Android notification re-posts. Genuine successive transactions are both preserved in the ledger.

---

## 24. Confidence Scoring Tiers

Every parsed email event is evaluated into one of three confidence tiers:
- **Tier 1 (High Confidence)**: Known bank sender + clear debit/credit word + exact amount + tracked account $\to$ **Auto-Logs Immediately**.
- **Tier 2 (Medium / Needs Category)**: Known bank transaction on tracked account, but merchant category is unknown $\to$ **Logs immediately** and flags with `needs_category = 1` for 1-tap category assignment.
- **Tier 3 (Low Confidence / Ambiguous)**: Ambiguous direction, untracked bank account, possible transfer, or conflicting match $\to$ **Enters Pending Review**.

---

## 25. High-Confidence Auto-Logging Flow

```text
Bank Email Notification
         ↓
Parse (Amount, Date, Merchant, Last4, Ref)
         ↓
Verify Tracked Account = Active
         ↓
Check Vault Spending Guard Liquidity
         ↓
Check Duplicates / Cross-Source Matches
         ↓
Auto-Log into Ledger (Zustand store / Supabase sync)
         ↓
Cancel Tonight's 20:30 Scheduled Nudge
```

---

## 26. Low-Confidence & Pending Review Scenarios

An event routes to Pending Review when:
- **Untracked Account**: The email identifies a bank account not yet toggled ON by the user.
- **Ambiguous Direction**: Text says "transfer of ₹2,000" without clarifying credit or debit.
- **Possible Self-Transfer**: Debited ₹5,000 from Account A and credited ₹5,000 to Account B.
- **Split Repayment Match**: An incoming credit matches an open debt owed by a friend in Split Expenses / Shares.
- **Vault Liquidity Breach**: Spending exceeds total available vault funds.

---

## 27. Vault Spending Guard (ADR 0011 Liquidity Check)

In accordance with the foundational **Real-Money Invariant**:
- If an auto-logged expense would exceed total available account liquidity (`availableIncome === 0`, `totalGullakSavings === 0`, and amount exceeds active daily/weekly/monthly allowance):
- Automatic logging **blocks silent deficit creation**.
- The event is flagged for review with `reviewReason: 'exceeds_liquidity'` and alerts the user to confirm funding.

---

## 28. Standalone Email Authority

When Bank SMS is absent (international roaming, card e-commerce, DND active), Email acts as the primary authoritative source. It does not wait for an SMS confirmation.

---

## 29. Historical Account Discovery

During initial onboarding / setup:
- Arthik scans past messages on-device up to 30–90 days to discover bank accounts (last 4 digits), banks, and formats.
- **Strict Invariant**: Historical discovery is strictly for learning account profiles. Historical emails or SMS are **never silently imported as historical past expenses**.

---

## 30. User Feedback & Machine Learning on Device

When a user edits an auto-logged transaction or confirms an item in Pending Review:
- User-assigned categories for a merchant are saved to on-device rules (`rules` table).
- Future transactions from the same merchant automatically inherit the preferred category.
- Rules are strictly merchant/template-specific; never amount-specific.

---

## 31. Narrow Ignore Rules

Users can tap "Ignore transactions like this":
- Creates an exact template / sender fingerprint rule.
- Broad, destructive rules like "Ignore all ₹500 transactions" are strictly disallowed.

---

## 32. Recognized Bank Senders & Allow-List

Native modules and regex recognize canonical Indian bank alert sender domains and addresses:
- HDFC Bank (`alerts@hdfcbank.net`, `alerts@hdfcbank.com`)
- ICICI Bank (`ibk.alert@icicibank.com`, `credit_cards@icicibank.com`)
- State Bank of India (`alerts@sbi.co.in`, `sbicard.com`)
- Axis Bank (`alerts@axisbank.com`)
- Kotak Mahindra Bank (`alerts@kotak.com`)
- American Express (`alerts@americanexpress.com`)
- Standard Chartered, Yes Bank, IndusInd, PNB, Bank of Baroda, IDFC FIRST, Federal Bank, slice, Jupiter, Fi Money.

Emails from unrecognized personal senders or non-whitelisted domains are ignored or routed to review with `reviewReason: 'unknown_sender'`.

---

## 33. Account Filtering Sovereignty

- Users have complete control over which accounts are tracked via `AutoLogAccountsScreen`.
- If an account is toggled OFF (e.g. a corporate card or parent's account), all emails matching that account are dropped silently.

---

## 34. Multi-Tracked Account Management

Arthik seamlessly tracks multiple savings accounts, salary accounts, credit cards, and digital wallets simultaneously. Each transaction is attributed to its exact source account.

---

## 35. 100% On-Device Privacy Architecture

- **Zero Cloud Communication Reading**: Raw email notification text and SMS bodies are parsed strictly in local memory on the Android device.
- **Zero Remote Storage**: Communication content is never sent to Supabase, Anthropic, Google, or any remote server.
- **Hardware-Encrypted Database**: The local AutoLog database is encrypted with **SQLCipher** via `expo-sqlite`, with a 256-bit encryption key stored in Android hardware Keystore via `expo-secure-store`.
- **Minimal Metadata Sync**: Only lightweight account metadata (`autolog_profiles`: enabled status, tracked account numbers, last-4 digits) syncs to Supabase for multi-device profile restoration; never email text.

---

## 36. Privacy Center & Transparency UI

The Privacy Center (`AutoLogInfoScreen`) provides users full visibility:
- **SMS Access**: Granted / Denied
- **Email Notification Access**: Granted / Denied (Listener active for Gmail / Outlook)
- **Tracked Accounts Count**: e.g., 2 accounts tracked
- **On-Device Cryptography Status**: SQLCipher Active
- **Clear Database & Reset Button**: Allows immediate on-device database wiping.

---

## 37. User Permission Onboarding Protocol

When requesting Android Notification Listener access for email detection, the app uses clear, transparent copy:
> *"Arthik listens only for financial transaction notifications from your email apps (Gmail, Outlook) to detect payments when bank SMS fails. Personal emails, newsletters, and OTPs are ignored natively and never leave your phone."*

---

## 38. Graceful Degradation on Permission Revocation

If a user revokes Notification Access for email apps:
- Bank SMS processing continues without interruption.
- The app never crashes or blocks navigation.
- `AutoLogCenterScreen` displays a non-intrusive warning card with a 1-tap shortcut to re-enable permissions.

---

## 39. Fault-Isolated Dual Processors

The failure, crash, or permission revocation of the Email pipeline has zero blast radius on the SMS pipeline, and vice versa. Each source operates inside independent try-catch transaction wrappers.

---

## 40. Deduplication State Machine

```text
Incoming Event (SMS or Email)
               │
               ▼
   Extract Fingerprint & Ref ID
               │
               ▼
   Does matching transaction exist in Ledger?
         ├── YES (Same Ref ID OR Amount+Account+Time Match)
         │     └── Status = 'merged' (Attach second source, enrich merchant)
         └── NO
               └── Evaluate Confidence Tier
                     ├── High Confidence → Status = 'logged'
                     └── Low / Ambiguous → Status = 'pending' (Review Queue)
```

---

## 41. Real-World Scenario: Delayed Email Reconciled with SMS

1. **10:30:00 AM**: User buys lunch for ₹350 at Subway using HDFC Debit Card.
2. **10:30:15 AM**: Bank SMS arrives: *"HDFC Bank: ₹350.00 debited from a/c **1234 on 16-OCT-26 at Subway. Ref 839210"*.
   - Auto-logged immediately as an expense.
3. **11:15:00 AM** (45 mins later): Phone reconnects to Wi-Fi; Gmail posts notification: *"HDFC Bank Alert: Transaction of INR 350.00 on A/c **1234 at Subway. Ref 839210"*.
   - Engine matches Ref `839210` $\to$ Merges with existing expense $\to$ Sources updated to `[Bank SMS, Bank Email]`.
   - **Zero double-counting; zero user notification spam.**

---

## 42. Real-World Scenario: International Card Payment (Email-Only)

1. User pays $10 (₹840) on GitHub using an ICICI Credit Card.
2. No SMS is delivered by the cellular carrier.
3. Outlook posts alert: *"ICICI Bank Credit Card ending 4091 spent USD 10.00 (INR 840.00) at GITHUB"*.
4. Arthik parses INR 840.00, Card **4091, Merchant "GITHUB" $\to$ Auto-logs ₹840.00 under "Subscription" category.

---

## 43. Real-World Scenario: Same-Day Identical Amount Protection

1. **09:00 AM**: User pays ₹50 for metro ticket (Bank SMS arrives).
2. **05:30 PM**: User pays ₹50 for return metro ticket (Bank Email arrives).
3. Both have identical ₹50 amounts, same bank, same merchant.
4. **Resolution**: Timestamps differ by 8.5 hours and references are distinct $\to$ Engine logs two separate ₹50 expenses accurately.

---

## 44. Real-World Scenario: Manual Lookalike Detection

1. User manually logs an expense: *"₹1,200 at D-Mart"* at 04:00 PM.
2. At 04:05 PM, an email alert arrives: *"HDFC Bank: ₹1,200 debited for D-MART"*.
3. Instead of logging a duplicate ₹1,200 expense, the engine detects the manual entry, flags it as a `possible_duplicate`, and prompts the user in Pending Review: *"Did you already log this manually?"*.

---

## 45. Real-World Scenario: Self-Transfer Between Own Accounts

1. User transfers ₹10,000 from HDFC Bank to ICICI Bank.
2. Email 1: *"₹10,000 debited from HDFC A/c **1234"*.
3. Email 2 (1 minute later): *"₹10,000 credited to ICICI A/c **5678"*.
4. Both accounts are user-tracked accounts.
5. Engine identifies matching pair within `TRANSFER_WINDOW_MS` $\to$ Marks as internal transfer $\to$ Excluded from Outflow expenses and Gullak deduction.

---

## 46. User Experience & Non-Intrusive Design

- **Silent Operation**: High-confidence transactions auto-log silently in the background without noisy popups or ringtones.
- **Evening Nudge Synchronization**: When an expense is auto-logged, tonight's scheduled 20:30 reminder nudge is immediately cancelled from the Android alarm scheduler (`cancelTonightNudge`), sparing the user unnecessary reminders.
- **Review Pill & Badge**: If an item needs review, a subtle badge appears on the Auto-Log header and Home banner.

---

## 47. Pending Review Sheet (`AutoLogReviewSheet`)

The review interface offers rapid, 1-tap resolution:
- **Accept as Expense** (with optional category chip selection)
- **Classify as Income**
- **Mark as Transfer**
- **Ignore / Delete**
- **"Always remember this category for [Merchant]"** checkbox

---

## 48. Correction & Undo Architecture

- Users can tap any auto-logged transaction in `HistoryScreen` or `ExpenseDetailScreen` to edit or delete it.
- Deleting an auto-logged transaction offers:
  1. *"Delete expense only"*
  2. *"Delete and ignore future alerts from this sender/format"*

---

## 49. No Silent Data Loss

Every parsed communication event is stored in the local encrypted `events` table with its exact processing state:
- `'logged'` — Auto-logged into user expenses
- `'merged'` — Reconciled into an existing transaction
- `'pending'` — Awaiting user review
- `'ignored'` — Filtered out by rule / user
- `'transfer'` — Internal account transfer

Nothing is dropped or lost invisibly.

---

## 50. Email Notification Listener vs Full Inbox Integration

| Metric | Android Notification Listener (Shipped) | Full Inbox IMAP / OAuth Integration (Rejected) |
|---|---|---|
| **Privacy** | 100% On-Device. Only alert text is parsed. | Requires cloud servers or reading full private inbox emails. |
| **Battery Life** | Zero drain; passive event-driven wakeup. | Continuous background polling drains battery. |
| **Security Risk** | Zero credential storage. | Requires OAuth tokens or email passwords. |
| **Permissions** | Standard Android Notification Access. | Intrusive full email read permissions. |
| **Speed** | Instant (processed within 1 second of alert). | Delayed by polling intervals. |

The event-driven notification listener architecture is strictly superior for user privacy and battery performance.

---

## 51. Future Extensibility

The `CommonTransaction` pipeline is engineered to accept future automated sources (such as Open Banking / Account Aggregator feeds or statement imports) through the identical deduplication and confidence engine without breaking changes.

---

## 52. Core Product Laws of Automatic Logging

1. **Dual-Core Authority**: Bank SMS and Bank Email alerts are the two authoritative transaction inputs; payment app intermediaries are excluded.
2. **Never Double-Count**: Multiple alerts for the same financial event must collapse into exactly one transaction.
3. **Never Guess**: Ambiguity, missing directions, or untracked accounts always route to Pending Review.
4. **Real-Money Invariant**: Every rupee logged impacts real spending balances, budget allowances, and Gullak savings.
5. **Zero Cloud Leakage**: All parsing and event storage remain 100% on the local Android device under hardware SQLCipher encryption.
6. **No Phantom History**: Historical discovery scans past messages for account profiles only; it never backdates past expenses.
7. **Human Sovereignty**: The user can override, edit, or ignore any auto-logged transaction at any time.

---

## 53. Complete Lifecycle State Machine

```text
User Enables AutoLog
        ↓
Discover Accounts & Senders (Historical Scan)
        ↓
User Selects Tracked Accounts (e.g. HDFC **1234)
        ↓
Live Boundary Established (`meta.live_since`)
        ↓
[LIVE EVENT: Bank SMS or Bank Email]
        ↓
Native Financial Filter (Drop non-financial, OTP, personal)
        ↓
Encrypted EventQueue (JSONL) → AutoLogHeadlessService
        ↓
Parser → Account Check → Deduplication Matching
        ├── Found Existing Match? → Merge (`status = 'merged'`)
        └── New Event?
              ├── Tracked Account & High Confidence? → Log (`status = 'logged'`)
              └── Untracked / Ambiguous / Vault Exceeded? → Queue (`status = 'pending'`)
```

---

## 54. North-Star Vision

> **"Arthik effortlessly captures every rupee you spend from your bank alerts, guarantees zero duplicate entries, guards your real money with complete on-device privacy, and never pesters you with unnecessary manual chores."**
