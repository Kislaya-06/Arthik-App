# 0018. Payback Review: Choose the Person, Then Confirm

## Status
Accepted (21 October 2026). Canonical rule: `SPL-005` (points 5, 6 and 7).

## Context
1. On the Automatic Logging review sheet, a person who owed money and whose name matched the incoming credit was drawn in the same mint green as a selected option, while the footer button still said "Save as Income · ₹X". Users read the green row as "already selected" and pressed the green footer button, so a friend's payback was saved as income (wrong: it is money back, `SPL-003`).
2. The row itself was not a selection: tapping it settled immediately, with no confirmation and no way to undo a wrong tap.
3. When more money arrived than was owed, the footer said "Saving <person>'s payback · ₹700" even though only ₹500 is money back and ₹200 stays income (`SPL-004`).
4. "Remember this preference" saved "income" for a sender. The next credit from that sender was written straight in as income, even when the sender was a person who still owed money, so a second payback counted as income until someone noticed.

## Decision
1. **Choose, then confirm.** Nothing is chosen automatically. A name match only adds a small "Likely match" tag. Tapping a person selects them (tap again to unselect) and the footer button becomes "Settle with <person> · ₹X". The footer button performs the settle (`settleWith`); the row tap no longer saves anything.
2. **Say what will happen.** `src/lib/settleReview.ts` (pure, tested) computes the part that settles (`min(received, owed)`), the extra that stays income and what the person will still owe, and builds the short button text and one-line note. Names are cut to 14 characters, the detail goes into the note, so the button never overflows.
3. **Payback has no category and is never remembered.** While a person is chosen, the category row and "Remember preference" are dimmed. Switching the type to Expense clears the choice.
4. **Remembered income is held back for people who owe money.** `shouldHoldCreditForPayback` (pure) + `engine.paybackHoldQuestion` send a credit to review (reason `type`) when the sender's saved preference is "income" AND the sender matches a person who still owes money. The review notification asks the settle question. Salary / interest / refund credits and people who owe nothing keep the automatic behaviour.

## Consequences
- Pressing Save as Income is always an explicit income decision; a settle is always an explicit settle.
- The income's detail screen ("Yes, settle it" → `MoneyBackSheet`) already confirms before saving and is unchanged.
- The hold (4) needs the app's data to know who owes money; with the app closed the credit is logged as before and the question stays on the detail screen.
- No money calculation changed: settlement allocation, excess handling and totals are the existing `SPL-003` / `SPL-004` code paths.

## Verified By
`tests/settleReview.test.ts`, `tests/paybackGuard.test.ts`, `tests/autoLogPaybackHold.test.ts`, `tests/autoLogSettleReview.test.ts`.
