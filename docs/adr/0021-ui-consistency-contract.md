# ADR 0021: UI Consistency Contract (Back Button, Press Feedback, Button Heights, Scrim)

## Status: Active

## Context

A full code audit of every screen and popup (November 2026) found that the same role looked or felt different from place to place:

- **Back button**: four styles. A plain 24px arrow (most pages), a 28px bold arrow (Profile, FAQ, Automatic Logging), a 26px arrow (Auth, Profile Setup) and a 20px arrow inside a 40px circle (Gullak deposit detail). Titles next to it were 20px on some pushed pages and 28px (the tab title size) on others.
- **Press feedback**: about 90 tappable items (Home header icons, Profile rows, dialog Cancel / Save, date-picker chips, split pills, FAQ cards, header actions) gave no visual response when pressed. `AppButton` scaled, `PressableOpacity` dimmed, the rest did nothing, so taps felt "dead" in some places.
- **Button heights in popups**: 48, 52, 56 and 60. The design document already forbade 52.
- **Danger button**: `AppButton variant="danger"` drew white text on the soft dark-theme red (2.77:1), although the alert dialog had already fixed the same problem.
- **Scrim**: popups dimmed the screen by anything from 0.4 to 0.75, with or without a theme difference.
- **Close (X) buttons**: 32px on six popups, 36px on the bottom sheet.
- **Design document drift**: the token tables in `docs/design-system.md` (FontSize, BorderRadius, theme colours) did not match `src/config/theme.ts` at all (for example `FontSize.title`, `BorderRadius.md` do not exist). New UI built from the document used wrong numbers, which is the root cause of several of the items above.

## Decision

The owner chose the recommended option for each question:

1. **One back button.** `src/components/ui/HeaderBackButton.tsx`: plain 24px `ArrowLeft`, 44dp touch area (`hitSlop` 10), dims on press, `accessibilityLabel="Go back"`, default action "go back if possible". Every pushed page uses it with a 20px bold title (`FontSize.titleMedium`). Main tabs keep their 28px title and have no back button.
2. **One press feedback.** `src/lib/pressFeedback.ts` → `PRESS_DIM_OPACITY = 0.7`. Rows, icon buttons, chips, links and small buttons use `PressableOpacity activeOpacity={PRESS_DIM_OPACITY}`. Real buttons whose look maps onto an `AppButton` variant moved to `AppButton` (scale 0.97): the update popup, Edit Profile, the date picker footer, the Cancel of Delete Account, Log Out and Delete Account on Profile. Only full-screen backdrops and three listed invisible tap areas keep a raw `Pressable`.
3. **Two-tier button heights.** Centered dialogs: 48 (`ControlHeight.standard`). Bottom sheets and full-page primary actions: 60 (`ControlHeight.cta`). Budget edit and cadence switch footers 56 → 60, Gullak deposit 52 → 60 (its amount field 52 → 56, the input height), Vault guard "cancel" 36 → 48, Savings deposit button 46 → 48, Review sheet secondary actions 38 → 44. A single full-width 60px CTA label is 18px (`titleSmall`, same as `AppButton size="cta"`); paired 60px sheet buttons use 16px.
4. **Readable danger button.** `AppButton variant="danger"` uses `alertButtonPalette('destructive', …)`, the same colours as the alert dialog (>= 4.5:1 in all three themes).
5. **One scrim.** `src/lib/scrim.ts` + `useScrimColor()`: Light `rgba(15, 23, 42, 0.45)`, Dark `rgba(0, 0, 0, 0.72)`, AMOLED `rgba(0, 0, 0, 0.88)` (the alert dialog's values) for every dialog and sheet.
6. **One close button.** 36dp circle, 18px icon, `hitSlop` 8+.
7. **The design document follows the code.** `docs/design-system.md` token tables were rewritten from `theme.ts`, and `tests/uiConsistency.test.ts` fails if a token value in the document drifts again.

No money logic, store, navigation route or animation physics changed. No new token was added.

## Consequences

- Visible changes for the user: Profile, FAQ and Automatic Logging titles are 20px instead of 28px; the Gullak deposit detail back button lost its circle; Log Out is a neutral button (its coral text on the peach fill was about 1.6:1 in Light) and Delete Account an outlined button with red text, both 48px pills; sheet footers are 4px taller; popups dim the screen the same amount; every tap gives feedback.
- `tests/uiConsistency.test.ts` guards: no hand-drawn back arrow, no raw `Pressable` without feedback outside the allow-list, no 46 / 50 / 52 button height, danger contrast, no private popup overlay, document = tokens.
- Existing tests updated where they pinned the old values: `ux01IconButtonLabels` (back label now lives in `HeaderBackButton`), `opt41to46Polish` (Delete Account spinner is the button's `loading`; date picker has 2 capped text nodes), `reviewSheetLayout` (44px secondary actions).
- JS-only: ships by OTA, no new APK.

## Not changed on purpose (P3)

- Fractional font sizes inside fixed shapes (toggle 9.5, nav label 13.5, alert message 14.5, a few 10.5 / 12.5 chips): the shapes were tuned to them; moving them by half a pixel gains nothing and risks wrapping on 320dp screens.
- Title alignment (centered on Add Transaction, Notifications, Category / Deposit detail; left elsewhere): both patterns are valid; it was not part of the approved scope.
- Hand-made buttons with a special, documented look (Add Transaction save, Add Category save, Budget / Cadence / Gullak sheet footers, auth screens) keep their look and now have the shared heights and feedback.

## Amendment (November 2026): Centred Titles and One ScreenHeader

The first pass left title alignment out of scope. A re-audit found two more header differences: the title was centred on 4 pages and left-aligned on 11+, and its distance from the status bar (8 / 16 px) and the gap below it (0 / 8 / 16 / 20 px) changed from page to page. The owner chose **centred titles** and **one shared header**:

- `src/components/ui/ScreenHeader.tsx`: 48dp bar, 4dp below the safe area, 8dp to the content. `HeaderBackButton` left, actions right (16dp apart), 20px bold title centred on the whole bar (Apple HIG navigation bar; Material 3 center-aligned top app bar). The title layer is inset by the same amount on both sides (the wider of the back side and the measured right side), so the title is always exactly centred and never jumps; long titles shrink to 80% on one line.
- Used by Add / Edit Category, Category Detail (with its category badge as `titleAccessory`), Expense Detail (edit + delete actions), Add Transaction, FAQ, Deposit Details, Ledger, Manage Categories, Notifications (mark-all-read + clear actions), Profile, Reset Password and every Automatic Logging page (`AutoLogUi.ScreenHeader` now delegates to it). Auth and Profile Setup keep only the arrow above their own big heading.
- Every page title (pushed and the three tab titles) is announced as a heading (`accessibilityRole="header"`); before, none was.
- First content below the header was re-spaced so pages start at the same height (Add Category preview 32 → 16, Manage Categories toggle 16 → 0, Category summary 24 → 16, Expense Detail badge 32 → 24, Add Transaction toggle 16 → 0, Reset Password icon 24 → 16).
- Also found and fixed: 15 `PressableOpacity` without `activeOpacity` fell back to a 0.2 dim (the element nearly vanished on press), now 0.7; the period renewal close / back buttons were 34dp, now 36dp like every close button; the force-update screen had no themed status bar.
- No animation, transition, spring or money logic changed.

## Amendment 3 (November 2026): Readable mint / coral text on Light

Owner-approved. On Light, money amounts used `mintDark` (#7FB896, 2.2:1) for income and `peachCoral` (#F4B8AE, 1.7:1) for expenses, and Home's "Swipe up or tap" used `mintGreen` (1.37:1). Two theme tokens: `mintText` (Light `#2E7A53`) and `coralText` (Light `#B9473A`), both >= 4.8:1 on every light surface; on Dark / AMOLED they equal the brand mint / coral, so nothing changes there. Applied at the root (`AmountText` direction colours, so every amount row in Home, History, Category Detail, Savings and Gullak detail), plus Home's history link and network status, History's income-only day total and the Ledger amounts. Found, not changed (not money, not in the approval): mint / coral used as text in Automatic Logging tags, form error texts (`colors.coral`), the update popup badge.

## Amendment 2 (November 2026): One Empty State and One Label Spacing

The owner approved the two items left over from the re-audit:

- **Empty states**: there were four kinds (icon in a flat grey circle + link button on History and Notifications, bare icon on Ledger / FAQ / Review / Savings history, text only on Category Detail, text + button on Insights). The flat circles also broke design-system §9.9. Now `src/components/ui/EmptyState.tsx` is the only one: `GradientIconBadge` in theme mint, bold title, one muted line, optional compact `AppButton`. `size="screen"` (72dp badge, 20px title) for History, Notifications, Ledger and Review; `size="section"` (56dp, 18px) for FAQ search, the Savings history card (dashed card kept), Category Detail and Insights. A screen empty state at the top of a list starts 64dp down (`EMPTY_STATE_TOP_OFFSET`, History's existing value). The component has no motion; History and Notifications keep their own fade-in wrapper unchanged. Two titles were added where there was only a sentence: Category Detail "No transactions yet" (the line now reads "Transactions in this category will appear here." like History) and Insights "Nothing to show yet".
- **Label spacing**: small uppercase labels used 0, 0.5, 0.6, 0.8 or 1. New token `LetterSpacing.label = 0.8` (theme.ts, approved new token) on all 25 caption-size uppercase labels (section labels, form field labels, card captions, sheet section headers). Badges, chart labels and fixed-size strip tiles keep their tuned spacing (fixed shapes). `uiPrimitiveParity` now pins `AuthFormField` to the token instead of 0.5, since the auth labels it matched moved too.

## What Would Have to Be True to Revisit

- A new design direction for headers (for example collapsing large titles on scroll) approved by the owner.
- A platform change that gives `Pressable` a built-in default press style, which would make `PRESS_DIM_OPACITY` redundant.
