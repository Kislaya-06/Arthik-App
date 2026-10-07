# Arthik --- Email Notification Auto-Logging Product Specification

**Feature:** Email Notification Parsing for Automatic Transaction
Logging\
**Platform:** Android\
**Scope:** Product behavior only --- WHAT the product should do, not HOW
it should be implemented.

------------------------------------------------------------------------

## 1. Feature Overview

Arthik already supports automatic transaction detection from Bank SMS
and UPI/payment-app notifications.

This feature adds **Email Notifications** as a third transaction source.

Email must not become a separate transaction system. It must blend into
the existing Auto-Logging pipeline as another source of transaction
evidence.

> **A transaction may have multiple sources, but it must exist only once
> in Arthik.**

------------------------------------------------------------------------

## 2. Why Email Parsing Is Needed

Some banks and financial services do not reliably send transaction SMS
messages.

For example, a provider may send a transaction email or app notification
but no SMS.

``` text
SMS:              Not received
Notification:     Not received
Email:            ₹500 spent at Zomato
                    ↓
              Arthik detects it
                    ↓
               Auto-logs ₹500
```

SMS must therefore **not** be mandatory for automatic logging.

------------------------------------------------------------------------

## 3. Unified Auto-Logging Architecture

``` text
                 ┌── Bank SMS
                 │
                 ├── UPI/App Notification
                 │
                 └── Email Notification
                         ↓
                   Source Parsers
                         ↓
                Common Transaction
                         ↓
                 Identity + Dedupe
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
       High Confidence        Low Confidence
              ↓                     ↓
          Auto-log             Pending Review
```

All sources must eventually enter the same common transaction and dedupe
system.

------------------------------------------------------------------------

## 4. Email Notification Scope

The initial feature focuses on financial emails surfaced through
supported email applications such as Gmail or Outlook.

Relevant email types include:

-   debit alerts
-   credit alerts
-   payment confirmations
-   UPI transaction confirmations
-   card transaction alerts
-   bank transaction alerts
-   account debit/credit notifications

Arthik should not treat every email as financial data.

------------------------------------------------------------------------

## 5. Relevant Financial Emails

Examples:

-   "₹500 has been debited"
-   "Payment of ₹1,250 was successful"
-   "₹3,000 has been credited"
-   "Your account was debited for ₹799"
-   "UPI transaction of ₹450 completed"

Useful transaction details may include:

-   amount
-   Expense / Income direction
-   merchant
-   account/card last four digits
-   transaction reference
-   UPI reference/RRN
-   transaction date/time
-   bank/provider
-   payment method

------------------------------------------------------------------------

## 6. Emails That Must Not Become Transactions

Do not automatically create transactions from:

-   OTP emails
-   login/security alerts
-   password-reset emails
-   promotional emails
-   offers/cashback advertisements
-   credit-card payment reminders
-   future debit reminders
-   mandate reminders
-   collect requests
-   failed/declined transactions
-   balance-only emails
-   generic account notifications
-   informational emails without an actual completed financial event

If an email looks financial but cannot be confidently interpreted, it
should go to review rather than silently become a transaction.

------------------------------------------------------------------------

## 7. Email-Only Transactions

An email can create a transaction even when no SMS or app notification
exists.

``` text
SMS:              ❌
Notification:     ❌
Email:            ✓
                  ↓
              Parse + Validate
                  ↓
           Confidence Evaluation
                  ↓
          Auto-log / Review
```

If the email contains enough reliable evidence, it can be automatically
logged.

------------------------------------------------------------------------

## 8. Email + Notification

If both describe the same transaction, create only one transaction.

``` text
Notification:
₹500 paid to Zomato

Email:
₹500 payment to Zomato confirmed
```

Result:

``` text
ONE transaction

₹500 — Zomato

Sources:
✓ App notification
✓ Email
```

The second source strengthens or enriches the existing transaction.

------------------------------------------------------------------------

## 9. Email + SMS

``` text
SMS:
₹500 debited from XX1234
UPI Ref: 8392019283

Email:
₹500 debited from XX1234
UPI Ref: 8392019283
```

Result:

``` text
ONE transaction

Sources:
✓ SMS
✓ Email
```

------------------------------------------------------------------------

## 10. SMS + Notification + Email

All three may represent one event.

``` text
10:30 — UPI notification
10:34 — Bank SMS
11:20 — Bank email
```

Result:

``` text
ONE transaction

₹500 — Zomato

Sources:
✓ UPI notification
✓ Bank SMS
✓ Bank email
```

------------------------------------------------------------------------

## 11. Common Transaction

Every detected financial event should ultimately become one common
transaction.

Conceptually:

``` text
Transaction
├── Amount
├── Expense / Income
├── Account
├── Transaction date/time
├── Merchant / Description
├── Reference ID if available
├── Confidence
└── Sources
      ├── SMS
      ├── Notification
      └── Email
```

A transaction can have one source or multiple sources.

------------------------------------------------------------------------

## 12. Source Transparency

Users should be able to see where an automatically logged transaction
came from.

Example:

``` text
₹500
Zomato
Expense

Detected from:
• Bank email
```

Multiple sources:

``` text
Detected from:
• GPay notification
• Bank SMS
• Bank email
```

------------------------------------------------------------------------

## 13. "Why Was This Logged?"

Automatically logged email transactions should support an explanation.

Example:

``` text
Why was this logged?

✓ Financial email detected
✓ Amount: ₹500
✓ Expense confirmed
✓ Account: XX1234
✓ Merchant: Zomato
✓ Transaction reference matched
```

Multi-source example:

``` text
Why was this logged?

✓ GPay notification matched
✓ Bank SMS matched
✓ Bank email matched
✓ Same transaction reference
```

------------------------------------------------------------------------

## 14. Dedupe Is Source-Agnostic

The system must ask:

> "Does this new financial event represent an existing transaction?"

It must not only ask:

> "Have I already seen this exact message?"

A new email may represent an existing SMS transaction.

A new SMS may represent an existing notification transaction.

A new notification may represent an existing email transaction.

------------------------------------------------------------------------

## 15. Strongest Identity --- Transaction Reference

Reliable transaction identifiers are the strongest matching evidence.

Examples:

-   UPI Reference Number
-   RRN
-   bank transaction ID
-   provider transaction reference

If two sources contain the same reliable identifier, they should be
treated as the same transaction even when they arrive far apart.

``` text
Notification:
₹500
Ref: 8392019283
10:30 AM

SMS:
₹500
Ref: 8392019283
11:45 AM

Email:
₹500
Ref: 8392019283
1:20 PM
```

Result:

``` text
ONE transaction
```

------------------------------------------------------------------------

## 16. Delayed SMS / Email Problem

Network issues can cause messages to arrive much later than the actual
transaction.

Example:

``` text
Actual transaction: 10:30 AM
Notification:       10:31 AM
SMS:                11:45 AM
Email:              1:20 PM
```

All can still represent the same transaction.

Therefore:

> **Arrival time must not be treated as transaction identity.**

------------------------------------------------------------------------

## 17. Transaction Time vs Arrival Time

The product should distinguish conceptually between:

**Transaction time** --- when the financial transaction happened.

**Arrival time** --- when Arthik received/observed the source.

Example:

``` text
Transaction time: 10:30 AM
SMS received:     11:45 AM
Email received:   1:20 PM
```

The transaction remains at **10:30 AM**.

------------------------------------------------------------------------

## 18. Matching Without a Reference ID

If a reference ID is unavailable, compare multiple transaction details:

-   amount
-   Expense / Income direction
-   account
-   merchant
-   transaction date
-   transaction context
-   payment method
-   provider
-   other transaction details

The more independent fields match, the stronger the candidate match.

------------------------------------------------------------------------

## 19. Time Is Supporting Evidence

Time should help matching but should not be the only identity.

Example:

``` text
Notification:
₹500 — Zomato — 10:30 AM

Email:
₹500 — Zomato — 12:15 PM
```

If other details strongly match, the delayed email may still represent
the same transaction.

A rigid short time window must not create duplicates solely because a
message arrived late.

------------------------------------------------------------------------

## 20. Same Amount Is Never Enough

Do not merge transactions merely because their amounts are identical.

``` text
10:00 AM → ₹500 → Zomato
6:00 PM  → ₹500 → Zomato
```

These may be two genuine transactions.

A later ₹500 Zomato email must not be arbitrarily attached to either one
if reliable identity is unavailable.

------------------------------------------------------------------------

## 21. Multiple Possible Matches

If a new email could match more than one existing transaction:

``` text
Existing:
₹500 Zomato — 10:00 AM
₹500 Zomato — 6:00 PM

New email:
₹500 Zomato
```

Result:

``` text
Do NOT auto-merge.

→ Pending Review
```

User confirmation is safer than corrupting transaction history.

------------------------------------------------------------------------

## 22. Cross-Source Matching

Different source types can provide independent evidence.

Example:

``` text
Notification:
₹500 Zomato

Email:
₹500 Zomato
```

They may be merged when supporting transaction details agree.

Source diversity should improve confidence, but it must not override
contradictory details.

------------------------------------------------------------------------

## 23. Same-Source Protection

Do not fuzzy-merge two messages from the same source merely because
amount, merchant, and date are similar.

``` text
Notification 1:
₹20 paid to Rahul

Notification 2:
₹20 paid to Rahul
```

These may be two genuine payments.

Unless a reliable identifier proves they are the same, keep them
separate.

------------------------------------------------------------------------

## 24. Confidence Evaluation

Conceptually:

``` text
Strong reference match
        ↓
Very High Confidence

Multiple matching transaction fields
        ↓
High Confidence

Some matching evidence
        ↓
Medium Confidence

Ambiguous/conflicting evidence
        ↓
Low Confidence
```

The exact confidence calculation should remain internal.

------------------------------------------------------------------------

## 25. High-Confidence Email Transaction

``` text
Email
 ↓
Parse
 ↓
Validate
 ↓
No duplicate
 ↓
High confidence
 ↓
Auto-log
```

The user should not have to manually approve normal, high-confidence
transactions.

------------------------------------------------------------------------

## 26. Low-Confidence Email Transaction

Financial-looking but ambiguous email:

``` text
Email
 ↓
Financial-looking
 ↓
Ambiguous
 ↓
Pending Review
```

Example:

> ₹2,000 received from Rahul

User can choose:

``` text
Expense
Income
```

The existing confirmation step should prevent accidental classification.

------------------------------------------------------------------------

## 27. Email as Confirmation / Enrichment

Email may add information to an already detected transaction.

``` text
Notification:
₹799 paid

Later email:
₹799 paid to Amazon
Order ID: XXXXX
Account: XX1234
```

Result:

``` text
₹799
Amazon
Expense

Sources:
✓ Notification
✓ Email

Account:
XX1234
```

No duplicate is created.

------------------------------------------------------------------------

## 28. Email as the Only Source

``` text
SMS:              ❌
Notification:     ❌
Email:            ✓
```

If reliable:

``` text
₹500 — Zomato
Expense
Account XX1234

Source:
✓ Email

Status:
Automatically logged
```

------------------------------------------------------------------------

## 29. Historical Discovery

Historical discovery may learn:

-   sender/domain
-   financial email formats
-   transaction wording
-   amount patterns
-   account/card identifiers
-   reference formats
-   user accept/reject/correction behavior

Historical discovery remains discovery only.

> **Old emails must never silently become old transactions.**

------------------------------------------------------------------------

## 30. Learning From User Feedback

User corrections can improve future email detection.

Examples:

``` text
“This email is a transaction.”
→ Similar future emails become easier to recognize.

“This is not a transaction.”
→ Similar email formats can be ignored.

User chooses Expense.
→ Similar transaction emails can receive stronger Expense classification.
```

Learning should remain specific to sender/template/context.

------------------------------------------------------------------------

## 31. Ignore Rules Must Be Specific

Never learn rules such as:

``` text
Ignore all ₹500 transactions
```

Prefer:

``` text
Ignore this promotional email format
from this sender/context.
```

Rules must not be based only on amount.

------------------------------------------------------------------------

## 32. Sender Recognition

Email sources may be:

-   recognized bank/payment sender
-   promotional sender
-   unrelated sender
-   unknown sender

Unknown financial-looking emails should receive lower confidence until
enough evidence exists.

------------------------------------------------------------------------

## 33. Account Filtering

If an email clearly identifies an account/card that is not selected for
Auto-Logging, it should not automatically be logged into the user's
tracked accounts.

Example:

``` text
Email:
Account ending 5678

Tracked:
XX1234
XX9012
```

If XX5678 is not tracked:

``` text
Do not automatically create a transaction for it.
```

------------------------------------------------------------------------

## 34. Multiple Tracked Accounts

Email parsing must support multiple tracked accounts.

The system should associate the email with the correct tracked account
whenever reliable account information exists.

It must not silently assign a transaction to the wrong account.

------------------------------------------------------------------------

## 35. Privacy

Email processing should follow the same privacy philosophy as SMS
processing.

Users should understand:

-   supported email notifications are used for financial transaction
    detection
-   non-financial emails are not transaction inputs
-   OTP/security emails are not transaction inputs
-   processing is designed to remain on-device where supported
-   email content is not uploaded for normal transaction detection
-   only necessary transaction information becomes part of the
    transaction record

------------------------------------------------------------------------

## 36. Privacy Center

The Auto-Logging Privacy Center should show email as an active source.

Example:

``` text
Auto-Logging

SMS access                 ✓
Notification access       ✓
Email notification access ✓
Tracked accounts          2
Last checked              Today

Processing:
✓ On this device
✓ Financial transaction detection
✓ Non-financial emails excluded
```

------------------------------------------------------------------------

## 37. Email Access Explanation

Before enabling email detection, clearly explain:

> Arthik uses supported email notifications to detect financial
> transactions automatically. Only relevant financial notifications are
> considered for transaction detection. Personal and unrelated emails
> are not transaction inputs.

Avoid vague wording such as:

> "We need access to your emails."

------------------------------------------------------------------------

## 38. Email Access Unavailable

If email access is unavailable:

``` text
SMS                     ✓
UPI Notifications       ✓
Email Notifications     ⚠
```

Arthik should continue using the available sources.

Email failure must not break SMS or notification-based Auto-Logging.

------------------------------------------------------------------------

## 39. Independent Source Failures

Examples:

``` text
Email unavailable
→ SMS continues
→ Notifications continue
```

or:

``` text
SMS unavailable
→ Email continues
→ Notifications continue
```

Each source should be independently useful.

------------------------------------------------------------------------

## 40. Complete Deduplication Flow

``` text
                    SMS
                     │
                     ↓
              ┌─────────────┐
Notification →│ Common Event│← Email
              └──────┬──────┘
                     ↓
              Identity Check
                     ↓
             Existing match?
               ↙          ↘
             YES           NO
              ↓             ↓
            MERGE        New Event
              ↓             ↓
        Add source       Confidence
                            ↓
                     Auto-log / Review
```

------------------------------------------------------------------------

## 41. Delayed Sources --- Example

Actual transaction:

``` text
10:30 AM
₹500 Zomato
```

Notification:

``` text
10:31 AM
```

SMS after network recovery:

``` text
11:47 AM
```

Email:

``` text
1:20 PM
```

Final Arthik state:

``` text
₹500
Zomato
Expense
10:30 AM

Sources:
✓ Notification
✓ SMS
✓ Email
```

There must be **one transaction only**.

------------------------------------------------------------------------

## 42. Email-Only Example

``` text
Slice transaction

SMS:          ❌
Notification: ❌
Email:        ✓

Email:
₹500 spent at Zomato
Account XX1234
Reference 8392019283
```

Result:

``` text
₹500 — Zomato
Expense
Account XX1234

Source:
✓ Email

Status:
Automatically logged
```

------------------------------------------------------------------------

## 43. Email + Notification Example

``` text
Notification:
₹500 paid to Zomato

Email:
₹500 payment successful
```

Result:

``` text
ONE transaction

Sources:
✓ Notification
✓ Email
```

------------------------------------------------------------------------

## 44. Identical Amounts Example

Existing:

``` text
10:00 AM — ₹500 — Zomato
6:00 PM  — ₹500 — Zomato
```

New email:

``` text
₹500 — Zomato
```

No reliable reference.

Result:

``` text
Do NOT auto-merge.
→ Pending Review
```

------------------------------------------------------------------------

## 45. Same Reference After Long Delay

``` text
Notification:
₹500
Ref 8392019283
10:30 AM

Email:
₹500
Ref 8392019283
4:15 PM
```

Result:

``` text
ONE transaction
```

The arrival gap must not create a duplicate.

------------------------------------------------------------------------

## 46. User Experience

Normal automatically logged email transaction:

``` text
₹500
Zomato

Expense
Today • 10:30 AM

Automatically logged
```

Optional explanation:

``` text
Why was this logged?

Detected from:
✓ Bank email
```

Multi-source:

``` text
Detected from:
✓ GPay notification
✓ Bank SMS
✓ Bank email
```

------------------------------------------------------------------------

## 47. Pending Review

Example:

``` text
Unrecognized financial activity

₹2,000 received from Rahul

What is this?

[ Expense ]
[ Income ]

[ Ignore ]
```

Classification should follow the existing confirmation flow before
finalizing.

------------------------------------------------------------------------

## 48. Incorrect Email Detection

Users should be able to report:

-   Wrong amount
-   Wrong transaction type
-   Duplicate
-   Wrong account
-   Should not have been detected
-   Other

Feedback should improve future email detection where appropriate.

------------------------------------------------------------------------

## 49. No Silent Data Loss

A financial-looking email that cannot be confidently parsed should not
simply disappear.

Possible states:

``` text
High confidence
→ Auto-log

Medium/low confidence
→ Pending Review

Clearly irrelevant
→ Ignore

Unrecognized financial-looking email
→ Review / Ignore this type
```

------------------------------------------------------------------------

## 50. Email Notification vs Direct Inbox Integration

This specification covers **email notification parsing**.

It does not require direct access to the complete Gmail/Outlook inbox.

Direct email-provider integrations can be considered separately in the
future.

The product should keep the source model flexible enough for future
direct email-provider sources to use the same common transaction and
dedupe pipeline.

------------------------------------------------------------------------

## 51. Future Compatibility

Future sources may include:

``` text
SMS
Notification
Email Notification
Direct Email Provider
Bank Statement Import
Manual Import
```

All should converge into:

``` text
Common Transaction
        ↓
Identity
        ↓
Dedupe
        ↓
Confidence
        ↓
Final Transaction
```

Adding a new source must not create a separate duplicate-detection
system.

------------------------------------------------------------------------

## 52. Core Product Rules

1.  Email is a transaction source, not a separate transaction system.
2.  SMS is not mandatory for transaction detection.
3.  Email-only transactions are valid.
4.  Multiple sources can represent one transaction.
5.  One transaction must exist only once.
6.  Transaction reference IDs are the strongest identity.
7.  Arrival time must not define transaction identity.
8.  Delayed SMS/email must still be able to merge with the original
    transaction.
9.  Same amount alone must never cause a merge.
10. Same-source fuzzy merging should be avoided.
11. Multiple possible matches should go to review.
12. Email can enrich an existing transaction.
13. Email can independently create a transaction.
14. Uncertain financial emails should go to Pending Review.
15. Non-financial emails should not become transactions.
16. User corrections should improve future email detection.
17. Account filtering must be respected.
18. Email access failure must not break other Auto-Logging sources.
19. Privacy and source transparency must be visible.
20. Historical email discovery must never silently import old
    transactions.

------------------------------------------------------------------------

## 53. Complete Email Auto-Logging Journey

``` text
User enables Email Auto-Logging
            ↓
Permission / access explanation
            ↓
Email notification access ready
            ↓
Financial email detected
            ↓
Email parser identifies transaction
            ↓
Validate account + transaction type
            ↓
Search existing transactions
            ↓
 ┌──────────────────────────────┐
 │ Existing transaction match?  │
 └──────────────┬───────────────┘
            YES ↓        ↓ NO
                ↓        ↓
             MERGE     New candidate
                ↓        ↓
        Add Email source  ↓
                ↓       Confidence
                ↓        ↓
                └──────→ Decision
                          ↓
                 ┌────────┴────────┐
                 ↓                 ↓
          High Confidence      Low Confidence
                 ↓                 ↓
             Auto-log        Pending Review
```

------------------------------------------------------------------------

## 54. North-Star Experience

The user should never have to think:

> "Did Arthik get the SMS?"

Instead:

> **"Arthik will recognize my transaction regardless of which supported
> financial source reports it."**

Whether a transaction arrives through SMS, UPI notification,
bank/payment email, multiple sources, or delayed sources, Arthik should
turn the available evidence into **one trustworthy transaction**.

### Final Product Principle

> **Multiple sources. One transaction. No unnecessary duplicates. Clear
> evidence. Minimal user effort.**
