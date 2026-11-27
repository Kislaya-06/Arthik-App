# Simple money rules (owner-approved 2026-11-28)

Source: owner interview, 4 rounds. This file is the source of expected values for tests. The owner also gave
permission to change any rule in `docs/ARTHIK_CANONICAL_RULES.md` that these decisions replace.

## Gullak

1. Money enters Gullak only as (a) unspent budget when a budget ends and (b) a manual deposit.
2. A budget ends: daily at midnight, weekly Sunday midnight, monthly last-day midnight, and at the midnight a
   switch takes effect (to Pure Mode, or to another cadence unless the user chose carry forward).
3. Spending order: budget, then income, then Gullak. Gullak never goes below zero.
4. What nothing can cover is a **deficit**. Later income pays it first. Later budget savings never pay it.
   Worked: Pure Mode spends 300 and 700 before any income, then income 2,000 and spend 800: deficit 1,000 is paid
   from that income. Two later saved days of 500 give Gullak **1,000**.
5. Weekly example: saved 600; next week budget 1,000, spent 1,500, no income (500 drawn); next week saved 1,000.
   Gullak = **1,100**.
6. Always true: `total = income left + Gullak + running budget left + carried money still waiting - deficit`.

## Deposits and money back

7. A "new money" deposit is not income. It appears in Recent, History and the All view only.
8. An "from income" deposit moves income into Gullak (total unchanged).
9. Deleting a wrong deposit is allowed as a correction.
10. Money back is never income. It goes back to where the expense was paid from. Spend 200 split with 3 friends at
    50 each: after all pay back, counted spending **50**, income **0**.
11. Editing, adding or deleting on a closed day recalculates that day and Gullak.

## Running short

12. Budget Mode never lets a user action take the balance below zero. Add or edit of an expense shows
    "Add income & log expense". A bank-message expense waits in Review with the same action.
13. Reducing or deleting income that Gullak depends on shows a confirm popup (Gullak drops by the missing part).
    If even Gullak cannot cover it, the user must add income first.
14. Pure Mode never blocks. Returning to Budget Mode while below zero adds a balancing income. The user is told
    in the switch popup and cannot refuse the income (they can still cancel the switch).

## Modes

15. Only two states: Budget (Gullak) Mode and Pure Mode. There is no paused allowance.
16. A mode switch takes effect tomorrow (a new / zero-expense account's first enable takes effect today).
17. Pure Mode Daily / Weekly / Monthly show only that period's income and spending. All shows all money left.
18. Switching to Pure Mode: the running weekly / monthly leftover goes to Gullak at that midnight. The popup says so.
19. Returning to the same cadence in the same week / month gives no new full budget. The moved leftover comes back
    from Gullak, minus whatever Pure Mode drew from Gullak. Example: Gullak 2,000 + moved 3,000; Pure draws 600;
    return gives budget **2,400**, Gullak **2,000**.

## Cadence switch

20. Takes effect tomorrow. The user picks **Save to Gullak** (default) or **Carry forward**.
21. Carry forward means one thing: the leftover funds the new budget first; the user adds only the rest. The new
    budget amount does not grow. Leftover 1,000, new weekly 3,500: budget 3,500, user adds **2,500**.
22. The carried amount is the real leftover at the midnight of the switch, not at the moment of choosing.
23. From daily, only still-unused earlier carry can be carried (today's daily leftover goes to Gullak).
24. A budget closed by a switch does not reopen with a new full amount inside the same period.
24a. Carried money still unused when its plan ends without carrying it on (Pure Mode, Save to Gullak) goes to Gullak.
    Carry 3,500 into daily 500, two days use 1,000, then Pure Mode: 2,500 goes to Gullak (3,500 with the two saved days).

## Starting and changing a budget

25. Starting mid-week / mid-month gives the full amount. If 2 or fewer days (weekly) or 5 or fewer days (monthly)
    remain, counting the start day, an info popup says the leftover will go to Gullak.
26. Amount change: applies now if nothing is spent in the current period, else from the next day / Monday / 1st.
    The new-period popup follows the same rule.

## Absence

27. Budget Mode on: every day's budget counts even if the app was not opened. Unspent money goes to Gullak.
28. Away 1 to 6 days: popup says what was saved, with **OK** and **I spent money**.
29. Away 7 or more days (app not opened AND no expense logged by any means): the absent, fully empty periods are
    not counted until the user chooses:
    - **Save to Gullak**: they count.
    - **Don't count these days**: they never count.
    - **I spent money**: they count once an expense is saved; leaving without saving shows the popup again.
30. One logged expense during the absence: no choice popup; everything counts.
31. Weekly / monthly: the choice covers only periods that fall entirely inside the absence. A period the user
    opened the app in, and the running period, always count.
32. The evening reminder is unchanged (20:30, at most 3 evenings without the app being opened).
32a. Every long break is its own question. A second one never counts or decides an unanswered first one.
32b. An unanswered question and the last opened day are saved with the account (reinstall, second phone).

## Old data

33. History is recalculated once with these rules. If the Gullak number changes, a note says
    "We fixed a calculation" with the old and new amounts.
34. Past budgets already saved for a day or period are kept.
