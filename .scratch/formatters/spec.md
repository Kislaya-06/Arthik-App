# Formatters Quirks & Behavioral Inconsistencies

## Overview
During characterization testing of `src/lib/formatters.ts`, two behavioral quirks were discovered in pure formatting utilities:
1. `cleanAmountString` removes commas only and leaves currency symbols intact (`₹52,000` → `₹52000`).
2. `formatAmountWithCommas` accepts and preserves multiple decimal points (`1000.5.5` → `1,000.5.5`).

## Scope
- Tracking and triage of both formatting quirks.
- Documenting caller audit results and runtime reachability in the existing codebase.
- No code modifications or fixes in this phase (tickets only).

## Tickets
1. `01-clean-amount-string-currency-symbol.md`: `cleanAmountString` does not strip the currency symbol.
2. `02-format-amount-multiple-decimal-points.md`: `formatAmountWithCommas` accepts more than one decimal point.
