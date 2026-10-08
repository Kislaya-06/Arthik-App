# Arthik --- Budget, Gullak, Email Source & Login UI Fixes

## Implementation Specification

**Scope:** Targeted fixes only. Preserve the existing Arthik design
language, navigation, transaction model, Auto-Logging architecture, and
existing behavior outside the items below.

------------------------------------------------------------------------

## 1. Fix Gullak Calculation --- Daily / Weekly / Monthly

### Current problem

Arthik has: - Scheduled budget: Daily / Weekly / Monthly - Additional
legitimate incoming money: salary, friend reimbursement, refund, etc.

Current Gullak logic appears to use only:

`Budget - Expenses`

This is incorrect when additional income is received during the cycle.

### Example

-   Daily budget: ₹100
-   Additional income: +₹25
-   Expense: -₹50
-   Correct remaining: **₹75**
-   Correct Gullak deposit: **₹75**

The calculation must be:

``` text
cycleSpendable =
    scheduledBudget
    + eligibleIncomingMoney
    + eligibleRefundsOrReimbursements

cycleRemaining =
    cycleSpendable
    - eligibleExpenses

gullakDeposit =
    max(0, cycleRemaining)
```

Use the **same calculation for Daily, Weekly and Monthly**.

### Important rule

The final cycle's **Remaining to Spend** and the Gullak deposit must
never disagree.

If the UI says:

> Remaining to Spend = ₹75

then at cycle end:

> Gullak Deposit = ₹75

Prefer deriving both values from the same cycle-level financial state
rather than maintaining separate formulas.

------------------------------------------------------------------------

## 2. Income / Transfer Classification

Not every incoming transaction should increase spendable money.

### Eligible incoming money

Examples: - Friend paying the user back - Salary - Genuine external
credit - Genuine refund/reimbursement - Manual income entry

### Do NOT count as additional income

Examples: - Transfer between the user's own tracked accounts - Internal
account movement - Duplicate source of an existing transaction -
Non-transaction balance adjustments

Example:

``` text
Bank A → Bank B
₹5,000
```

must not increase the user's spendable amount by ₹5,000.

------------------------------------------------------------------------

## 3. Reimbursement Example

If the user pays ₹50 for a shared expense and a friend returns ₹25:

``` text
Budget:          ₹100
Expense:         -₹50
Reimbursement:   +₹25
----------------------
Remaining:        ₹75

Gullak:           ₹75
```

The ₹25 must restore available cycle money.

Apply this consistently to Daily, Weekly and Monthly cycles.

------------------------------------------------------------------------

## 4. Dashboard Card --- Move Income Below Budget

### Current issue

The Income value/chip currently appears beside the Budget information
near the top of the dashboard card, making the hierarchy crowded.

### Required change

Keep the current card design and visual language. Do **not** redesign
it.

Only change the hierarchy:

``` text
Remaining to Spend
₹75

₹100 budget

Daily Income          Daily Expense
+₹125                 -₹50

₹50 rolls over to Gullak tonight
```

The intended hierarchy is:

> **Budget = primary planning value**\
> **Income = supporting financial information**

Do not remove or change the underlying income logic. Only move its
visual placement below the budget.

Apply consistently to Daily / Weekly / Monthly cards.

------------------------------------------------------------------------

# 5. Bank Email Should Be a Strong Confirmation Source

### Current problem

The Auto-Logging flow can wait for a bank SMS after detecting a
transaction.

This fails for banks/accounts where:

-   Bank email arrives
-   Bank SMS never arrives

The transaction can remain stuck waiting for confirmation even though
the bank itself already sent a valid transaction email.

### Required change

Remove the **mandatory bank-SMS confirmation dependency**.

Use source confidence instead.

``` text
Bank SMS
       ↓
CONFIRMED

Verified Bank Email
       ↓
CONFIRMED

UPI / Payment-App Notification
       ↓
PROVISIONAL
```

A verified bank email should be sufficient to confirm and auto-log a
transaction. Do not wait indefinitely for an SMS that may never arrive.

------------------------------------------------------------------------

## 6. Email-Only Transaction

This must work:

``` text
UPI Notification: none
Bank SMS:         none
Bank Email:       ₹500 debited
```

Expected:

``` text
Bank Email
    ↓
Parse
    ↓
Validate
    ↓
High confidence
    ↓
Auto-log ₹500
```

The transaction must not remain in a "waiting for bank confirmation"
state.

The bank email itself is the confirmation.

------------------------------------------------------------------------

## 7. Trusted Bank Email Rules

Do not trust an email merely because it contains a rupee amount.

A bank email should be treated as strong evidence when applicable
existing email-source rules confirm things such as:

-   Supported/verified bank sender or domain
-   Known transaction-alert template
-   Clear debit/credit wording
-   Clearly labelled amount
-   Account/card identifier where available
-   Transaction ID / UTR / RRN where available
-   Transaction date/time where available
-   Merchant/payee where available
-   Completed financial event

Do not create transactions from:

-   OTP emails
-   Login/security alerts
-   Password-reset emails
-   Promotional emails
-   Cashback/offer emails
-   Future debit reminders
-   Mandate reminders
-   Collect requests
-   Failed/declined transactions
-   Balance-only emails
-   Generic account notifications
-   Emails without an actual completed financial event

If an email looks financial but confidence is insufficient:

> **Pending Review**

Never silently discard it.

------------------------------------------------------------------------

# 8. Multi-Source Deduplication Must Remain

Removing mandatory SMS confirmation must **not** remove deduplication.

One transaction may have:

``` text
₹500 · XYZ

Sources:
✓ Bank Email
✓ Bank SMS
✓ UPI Notification
```

This must remain **one transaction**, not three.

Continue using the existing identity/deduplication rules, with strong
identifiers such as UTR/RRN/transaction ID preferred.

Cross-source matching can use the existing amount + direction +
time/context rules.

Do not use loose amount/time fuzzy deduplication between two events from
the same source.

------------------------------------------------------------------------

## 9. Source Confidence Flow

Use:

``` text
Bank SMS ───────────────┐
                        │
Verified Bank Email ────┼──→ Strong Evidence
                        │
UPI Notification ───────┘
             ↓
      Common Transaction
             ↓
     Identity + Dedupe
             ↓
    ┌────────┴────────┐
    ↓                 ↓
High Confidence   Low Confidence
    ↓                 ↓
Auto-log         Pending Review
```

If a verified bank email arrives first:

> Confirm immediately. Do not wait for SMS.

If UPI notification arrives first:

> Treat as provisional and reconcile with a stronger source when
> available.

If a stronger source never arrives, follow the existing configured UPI
confidence/review behavior. Do not create an indefinite waiting state.

------------------------------------------------------------------------

# 10. "Why Was This Logged?" --- Email Source

If an email is the confirming source, transaction evidence should say
so.

Example:

``` text
Why was this logged?

₹500 · XYZ

Arthik detected:
• Bank Email
• Amount: ₹500
• Debit transaction
• Tracked account: ••••1234

Source confidence:
Confirmed
```

If multiple sources match:

``` text
Matched sources:
• Bank Email
• Bank SMS
• UPI Notification

All sources referred to the same transaction.
```

------------------------------------------------------------------------

# 11. Login Password Field --- Fix Character Clipping

### Current problem

On the login screen, the password input can clip/cut the lower part of
entered characters, especially with longer input such as 8+ characters.

### Required behavior

The password field must:

-   Show every character completely
-   Never clip the bottom of characters
-   Keep text vertically centered
-   Have sufficient vertical padding
-   Work with the existing font
-   Work across Android screen sizes and densities
-   Work with keyboard open and closed
-   Work in supported themes
-   Never overlap the border
-   Remain correct with 8+ characters

### Do not use a device-specific hack

Do not add a hard-coded offset that only fixes one phone.

Inspect and fix the actual layout cause, including where relevant:

-   `lineHeight`
-   `paddingVertical`
-   Input `height` / `minHeight`
-   Text vertical alignment
-   Font metrics
-   Parent alignment
-   Border width/radius
-   Keyboard resize behavior
-   Safe Area handling

The fix must be responsive.

------------------------------------------------------------------------

# 12. Password Field Acceptance Tests

Test at minimum:

``` text
1 character
4 characters
8 characters
12+ characters
```

And:

``` text
Keyboard open
Keyboard closed
Different Android screen sizes
Different display densities
```

No character should be clipped or partially hidden.

Do not break: - Login button - Password visibility toggle -
Authentication - Keyboard behavior - Existing login UI - Existing
typography - Safe-area behavior

------------------------------------------------------------------------

# 13. Regression / Testing Requirements

Before implementation:

1.  Inspect the existing cycle/budget calculation.
2.  Find the exact Gullak deposit calculation.
3.  Find Income classification.
4.  Find internal-transfer handling.
5.  Find the existing "wait for bank confirmation" logic.
6.  Find email parsing/source validation.
7.  Find the login password input and styles.

Then:

8.  Make the smallest clean changes.
9.  Reuse existing types/utilities.
10. Do not duplicate business logic.
11. Add regression tests for:

-   Budget + income - expense = remaining
-   Gullak equals final cycle remaining
-   Reimbursements affect remaining
-   Internal transfers do not inflate income
-   Bank email can independently confirm
-   Email-only transaction can be logged
-   Email + SMS + UPI become one transaction
-   Uncertain email goes to review

12. Run the existing test suite and TypeScript checks.

------------------------------------------------------------------------

# 14. Final Acceptance Checklist

## Budget / Gullak

-   [ ] Daily uses budget + eligible income - expenses
-   [ ] Weekly uses the same logic
-   [ ] Monthly uses the same logic
-   [ ] Reimbursements restore cycle money
-   [ ] Internal transfers do not inflate income
-   [ ] Gullak receives final cycle remaining
-   [ ] Remaining and Gullak never disagree

## Dashboard Card

-   [ ] Budget remains primary
-   [ ] Income moves below Budget
-   [ ] Existing card design is preserved
-   [ ] No unnecessary redesign

## Automatic Logging

-   [ ] Bank SMS = strong confirmation
-   [ ] Verified bank email = strong confirmation
-   [ ] UPI notification = provisional/fast source where appropriate
-   [ ] Email-only transactions can be auto-logged
-   [ ] No indefinite SMS wait
-   [ ] Email appears in source evidence
-   [ ] Multi-source deduplication still works
-   [ ] Uncertain email goes to Pending Review
-   [ ] OTP/promotional/reminder/balance-only emails do not become
    transactions

## Login

-   [ ] Password characters never clip
-   [ ] 8+ characters render correctly
-   [ ] Works across Android screen sizes
-   [ ] Works with keyboard open/closed
-   [ ] No device-specific hard-coded fix
-   [ ] Existing authentication remains unchanged

------------------------------------------------------------------------

# 15. Implementation Principle

This is a **targeted correctness + UX fix**, not a redesign.

Preserve the current Arthik design language and architecture.

The final implementation should feel like a natural extension of the
existing system, with one consistent financial calculation and one
unified transaction-source model.
