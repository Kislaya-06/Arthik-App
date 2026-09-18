# Issue 04: Type-scale review and font size token naming (FontSize.cta and FontSize.sectionTitle)

Status: needs-triage
Type: task

## Description
During the token migration across all screens and components, two typography tokens were identified as reading oddly at several call sites:
- `FontSize.cta` (18): While named for primary CTA buttons (`height: 60`, `fontSize: 18`, `Quicksand_700Bold`), it is also used for modal sheet titles and dialog headers (e.g., `CustomDatePickerModal`, `StreakCalendarModal`, `AddEditCategoryScreen` modal sheet header). Naming a modal header or dialog title `FontSize.cta` is semantically misleading.
- `FontSize.sectionTitle` (20): While named for level-2/section headers, it is actively used as the primary screen title across multiple screens (e.g., `AddEditCategoryScreen`, `CategoryDetailScreen`, `ExpenseFormScreen` header, `NotificationsScreen`). Calling a primary screen title `FontSize.sectionTitle` is a semantic mismatch.

## Unsettled Typography Literals
The current token set also leaves several recurring font sizes as literals across the app:
- `11`: Micro text used for badge counts, helper hints, and timestamps/tab labels. Excluded from tokenization due to multi-role fragmentation.
- `13`: Compact text used for card subtext, tertiary metadata, and compact labels.
- `15`: Intermediate text used for semi-prominent descriptions, dialog body text, and list subtitles.

## Scope & Proposed Action
- Renaming `FontSize.cta` and/or `FontSize.sectionTitle` is a large cross-cutting change touching ~20 files.
- Renaming should **not** be performed as an isolated mechanical find-and-replace.
- Instead, it should be bundled into a comprehensive type-scale review that:
  1. Establishes a coherent semantic hierarchy (e.g., `headline`, `title`, `body`, `label`, or scale-based names) independent of specific UI components like buttons.
  2. Resolves and standardizes the unsettled font size literals (11, 13, 15) across all screens.
