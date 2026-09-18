# Timezone handling in `bestStreak` corrupts intermediate date gap-check for negative UTC offsets

Status: needs-triage

## Description

In `src/store/dailyBudgetStore.ts`, the `bestStreak` algorithm in `calculateSavingsMetrics` checks whether days between non-consecutive saved records are `'unknown'`. To step through the intermediate calendar days, it constructs a `Date` object from an ISO date-only string and applies local `.getDate()` / `.setDate()` arithmetic.

Because ECMAScript specifies that date-only strings (`'yyyy-MM-dd'`) parse as UTC midnight, calling local `.getDate()` on that date object returns the previous calendar day in any timezone west of UTC (UTC-1 to UTC-12). This causes the intermediate day check to inspect the wrong dates, prematurely resetting `currentRun` and corrupting the `bestStreak` calculation.

---

## Code Location

```typescript
// src/store/dailyBudgetStore.ts:115-137
const prevDate = new Date(finalizedSavedRecords[i - 1].date);
const curDate = new Date(rec.date);
const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
if (diffDays === 1) {
  currentRun++;
} else {
  // Check if all days in between are 'unknown' — an unknown day should neither extend nor break a streak
  let allIntermediateUnknown = true;
  for (let step = 1; step < diffDays; step++) {
    const intermediateDate = new Date(prevDate);
    intermediateDate.setDate(prevDate.getDate() + step);
    const intermediateStr = format(intermediateDate, 'yyyy-MM-dd');
    if (records[intermediateStr]?.status !== 'unknown') {
      allIntermediateUnknown = false;
      break;
    }
  }
  if (allIntermediateUnknown) {
    currentRun++;
  } else {
    currentRun = 1;
  }
}
```

---

## Detailed Mechanism

1. **UTC Midnight Parsing (line 115)**:
   `prevDate = new Date(finalizedSavedRecords[i - 1].date)`
   Per ECMAScript specification for date-only ISO-8601 strings (e.g. `'2026-09-15'`), the date string is parsed at UTC midnight:
   `2026-09-15T00:00:00.000Z`.

2. **Local Day-of-Month Invocation (line 125)**:
   `intermediateDate.setDate(prevDate.getDate() + step)`
   The `.getDate()` and `.setDate()` methods operate in the device's local timezone.

3. **Behavior in Negative UTC Offsets (UTC-1 to UTC-12)**:
   In any timezone behind UTC (e.g. Eastern Time UTC-5 / UTC-4, Pacific Time UTC-8 / UTC-7, Hawaii UTC-10):
   - UTC midnight `2026-09-15T00:00:00.000Z` falls on the evening of the **previous** day in local time (e.g. 8:00 PM on September 14 in EDT).
   - `prevDate.getDate()` returns **`14`**, not `15`.
   - On the first iteration where `step = 1`, `prevDate.getDate() + step` evaluates to `14 + 1 = 15`.
   - `intermediateDate.setDate(15)` sets the date to September 15 at 8:00 PM local time.
   - Line 126 formats this with `format(intermediateDate, 'yyyy-MM-dd')`, which outputs **`'2026-09-15'`**.
   - Instead of checking the first intermediate day (e.g. `'2026-09-16'`), it checks `records['2026-09-15']`.
   - Because `'2026-09-15'` is the saved day from which the step originated, `records['2026-09-15'].status` is `'saved'`.
   - Line 127 evaluates `records['2026-09-15']?.status !== 'unknown'` $\rightarrow$ **`true`**.
   - Line 128 sets `allIntermediateUnknown = false`.
   - Line 135 resets `currentRun = 1`.

---

## Severity & Affected Timezones

- **Affected Timezones**: All timezones with negative UTC offset (UTC-1 through UTC-12). This includes North America, South America, and Pacific territories (e.g. EDT, CDT, MDT, PDT, AKDT, HST). In these regions, legitimate historical gaps bridged by `'unknown'` days fail the check and reset `currentRun` to 1.
- **Unaffected Timezones**: Timezones with UTC offset $\ge 0$ (UTC through UTC+14), including Western Europe (UTC+0 / UTC+1), Eastern Europe (UTC+2 / UTC+3), India (UTC+5:30), and East Asia (UTC+8 / UTC+9). In these regions, UTC midnight falls on the same calendar day, so `prevDate.getDate()` returns `15` and the loop inspects the correct forward dates.
- **Priority**: **Low**. Arthik's current production user base operates in India (IST, UTC+5:30), where this defect is dormant. It represents a lurking latent bug if the app is used globally or by users traveling westward.
