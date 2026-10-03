# Arthik — Design System Specification & Usage Guide

> **Document Type:** Canonical Human & AI Agent Design System Specification  
> **Target Framework:** React Native 0.86 + Expo SDK 57 (Android-first, Quicksand Typography)  
> **Status:** Approved Source of Truth  
> **Last Updated:** October 2026

---

## 1. Sources of Truth & Governance

The Arthik Design System is governed by three layers of authority. **Read them in this order before any UI work:**

1. **Design Contract:** [`docs/ARTHIK_DESIGN_SYSTEM.md`](file:///d:/Arthik-App/docs/ARTHIK_DESIGN_SYSTEM.md)  
   Human-readable design rules: core principles, semantic roles, financial-number hierarchy, typography guidance, governance, and the audit checklist. **Read this first.** It is the design contract, not optional documentation.
2. **Runtime Token Source of Truth:** [`src/config/theme.ts`](file:///d:/Arthik-App/src/config/theme.ts)  
   Every numeric spacing, radius, font size, control height, and color value lives strictly in `src/config/theme.ts`. No other file may hardcode alternative design values.
3. **Usage Guide & Component Specs:** [`docs/design-system.md`](file:///d:/Arthik-App/docs/design-system.md) (This Document)  
   Token tables, component anatomy, allowed exceptions, correct/incorrect usage examples, and the token governance process.

### How Future Agents Must Introduce or Modify Tokens
- **Never add numeric duplicates:** Do not create a new token if an existing semantic token satisfies the role.
- **Rule of Semantic Role:** If a new design requirement emerges, evaluate it against the 7-question criteria (Single role? Not numeric coincidence? Understandable? Frequent? Future-proof? Component vs Token? Local geometry?).
- **Token Registration Process:**
  1. Add the token to `src/config/theme.ts` under its proper semantic object.
  2. Document the semantic purpose, allowed exceptions, and examples in `docs/design-system.md`.
  3. Run `npm test` and `npx tsc --noEmit` to verify type safety across consumers.

---

## 2. Spacing System & Spatial Rhythm

Arthik enforces a strict **4/8-point spatial grid**. Numeric values reflect recurring spatial functions, not ad-hoc pixel nudging.

### Spacing Tokens (`Spacing` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage | Allowed Exceptions |
| :--- | :--- | :--- | :--- | :--- |
| `Spacing.nano` | `2px` | Optical Leading Offset | Micro vertical nudges between tightly stacked title/subtitle texts | None |
| `Spacing.micro` | `4px` | Micro Element Gap | Badge internal padding, chart track gaps, indicator dot margins | None |
| `Spacing.element` | `8px` | Adjacent Related Items | Icon-to-text gap, input-label margin, compact chip spacing | None |
| `Spacing.group` | `12px` | Sibling Cluster Gap | Modal action button gaps, card internal sub-group spacing | None |
| `Spacing.block` | `16px` | Container & Block Gap | Vertical rhythm between cards, standard form input spacing | None |
| `Spacing.surface` | `20px` | Card Internal Padding | Standard content card padding, dialog internal padding | Compact cards (16px) |
| `Spacing.gutter` | `24px` | Screen Gutter & Hero Pad | Canonical screen horizontal padding (`paddingHorizontal: 24`), Hero card padding | None |
| `Spacing.section` | `32px` | Section Boundary | Separation between major screen sections, bottom scroll buffer | Small screens (<360dp width) |

### Correct vs Incorrect Spacing Examples
- **Correct:** `paddingHorizontal: Spacing.gutter` (24px screen boundary).
- **Correct:** `marginBottom: Spacing.element` (8px label-to-input gap).
- **Incorrect:** `paddingHorizontal: 22` or `marginVertical: 14` (arbitrary non-token values).
- **Incorrect:** Using `Spacing.gutter` for an icon-to-label gap (violates semantic role).

---

## 3. Typography Scale & Font Architecture

Typography is set exclusively in **Quicksand** via `@expo-google-fonts/quicksand`. The scale is purely role-based. Component-bound font tokens (such as the legacy `FontSize.cta`) are retired.

### Typography Tokens (`FontSize` & `FontFamily` in `src/config/theme.ts`)

| Token Name | Size | Weight (`FontFamily`) | Line Height | Semantic Role & Intended Usage |
| :--- | :--- | :--- | :--- | :--- |
| `FontSize.display` | `34px` | `bold` (`700`) | `42px` | **Hero Screen Headers**: Home screen balance/greeting, Auth welcome |
| `FontSize.titleLarge` | `28px` | `bold` (`700`) | `34px` | **Screen Navigation Headers**: `History`, `Savings`, `Insights`, `Profile` |
| `FontSize.titleMedium` | `20px` | `bold` (`700`) | `26px` | **Section & Modal Titles**: Card group headers, bottom-sheet headers |
| `FontSize.titleSmall` | `18px` | `semibold` (`600`) | `24px` | **Sub-section & Prominent Titles**: Sub-card headers, prominent alert titles |
| `FontSize.body` | `16px` | `medium` (`500`) / `regular` (`400`) | `22px` | **Primary Reading & Input Text**: Row titles, input values, primary labels |
| `FontSize.bodySmall` | `14px` | `medium` (`500`) / `regular` (`400`) | `18px` | **Secondary Context & Metadata**: Subtitles, category labels, input helper text |
| `FontSize.caption` | `12px` | `semibold` (`600`) / `medium` (`500`) | `16px` | **Status Tags & Micro Notes**: Uppercase section tags, badge text, timestamps |
| `FontSize.micro` | `11px` | `medium` (`500`) | `14px` | **Analytical Dense Ticks**: Chart X/Y axis labels, compact calendar dates |

### Font Weights (`FontFamily`)
- `FontFamily.regular`: `'Quicksand_400Regular'` (long-form explanatory body text)
- `FontFamily.medium`: `'Quicksand_500Medium'` (default body, input fields, labels)
- `FontFamily.semibold`: `'Quicksand_600SemiBold'` (list row titles, sub-headers, interactive buttons)
- `FontFamily.bold`: `'Quicksand_700Bold'` (screen titles, hero headers, financial numbers, status tags)

---

## 4. Semantic Financial-Number Hierarchy & `<AmountText />`

Under the **Real-Money Invariant** (AGENTS.md §8), every rupee tracked is real user capital. Financial figures must be scannable, weighted by urgency, and never ambiguous.

### Financial Amount Roles

| Amount Role | Size / Weight | Line Height | Intended Usage | Formatting & Visual Treatment |
| :--- | :--- | :--- | :--- | :--- |
| **`hero`** | `36px` Bold | `44px` | Primary dashboard focal point (Remaining Today, Total Gullak Balance) | `formatCurrency(val)` (Indian grouping, no decimals). Currency symbol `₹` optically aligned at 30px with `alignItems: 'center'`. Dominant focal point. |
| **`primary`** | `24px` Bold | `30px` | Summary KPI cards, monthly Inflow/Outflow headers, Keypad display | `formatCurrency(val)`. Color-coded if representing net balance (mint = safe, coral/danger = deficit). |
| **`row`** | `16px` SemiBold | `22px` | Transaction list items, daily breakdown items, period allocation rows | Explicit signed prefix: `+₹` (mint green) for income/savings; `-₹` (coral/primary) for expenses. Right-aligned. |
| **`compact`** | `14px` SemiBold | `18px` | Progress bar bounds (`₹500 / ₹1,000`), breakdown card subtitles | Compact `formatCurrency(val)`. Muted secondary color (`textSecondary`). |
| **`metric`** | `12px` / `14px` Bold | `16px` / `18px` | % change metrics (`+12.4%`), streak count, budget ratio (`85%`) | Enclosed in stadium pill (`StatusBadge`) with directional indicator. |

### Canonical `<AmountText />` Component Standard
To prevent disparate string slicing, raw `.toLocaleString()`, and misaligned `₹` symbols, all financial figures are rendered through `<AmountText />`:

```tsx
<AmountText
  value={amount}
  role="hero" | "primary" | "row" | "compact" | "metric"
  direction="expense" | "income" | "neutral"
  signed?: boolean
  showDecimals?: boolean
  style?: TextStyle
/>
```
- **Rules Centrally Handled by `<AmountText />`:**
  - Indian grouping: `₹1,25,000` via `formatCurrency`.
  - Never raw `.toLocaleString()`.
  - Negative values rendered as `-₹500` (symbol placed after minus sign), not `₹-500`.
  - Optical baseline symbol alignment on `hero` and `primary` roles without vertical layout shift.
  - Accessibility: Automatically injects `accessibilityLabel="positive 1,500 rupees"` or `"expense 420 rupees"` for screen readers.

---

## 5. Radius System & Surface Hierarchy

### Radius Tokens (`BorderRadius` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage | Allowed Exceptions |
| :--- | :--- | :--- | :--- | :--- |
| `BorderRadius.input` | `16px` | Interactive Controls & Sub-Tiles | Text inputs, dropdown selectors, nested metric breakdown tiles | None |
| `BorderRadius.card` | `24px` | Standard Surface Card | Content cards, transaction containers, settings cards, dialogs | None |
| `BorderRadius.cardLarge`| `28px` | Hero Cards & Sheets | `BrandedHeroCard`, Gullak hero milestone, bottom-sheet top corners | None |
| `BorderRadius.pill` | `9999px` | Stadium Action Controls | Interactive buttons, segmented controls, status badges, chips | None |

### Non-Tokenized Local Geometry Invariant
- **Circle geometry is local:** Any circular icon container or avatar must use `borderRadius: size / 2` (e.g. `borderRadius: 24` for 48x48 icon). **Never** force-fit circle radii into `BorderRadius` tokens.

### Surface Roles
- **Hero Surface:** `BorderRadius.cardLarge` (28px) + branded gradient background (`gradientStart` to `gradientEnd` or mint tint) + `Spacing.gutter` (24px) internal padding.
- **Standard Card Surface:** `BorderRadius.card` (24px) + solid `card` background (`#FFFFFF` light / `#131D2F` dark) + `Spacing.surface` (20px) internal padding.
- **Nested Tile Surface:** `BorderRadius.input` (16px) + `cardSubtle` background (`#F5F6F9` light / `#1A263B` dark) + `Spacing.block` (16px) internal padding.

---

## 6. Component Architecture & UI Primitives

### 6.1 Button Architecture (`<AppButton />`)
Buttons must not be written as unmanaged raw `Pressable` styles. Use `<AppButton />`:

- **Heights (`ControlHeight`):**
  - `cta`: `60px` (`ControlHeight.cta`) — Full-width primary action buttons on screens (e.g., "Add Expense", "Save Changes"). Radius: `BorderRadius.pill`.
  - `standard`: `48px` (`ControlHeight.standard`) — Modal action buttons, dialog confirmations. Radius: `BorderRadius.pill`.
  - `compact`: `36px` (`ControlHeight.compact`) — In-card action chips, filter buttons. Radius: `BorderRadius.pill`.
- **Variants:**
  - `primary`: Background `mintGreenDark`, text `#1A2B4C`, bold.
  - `secondary`: Background `cardSubtle` (or `mintGreenSoft`), text `textPrimary`, subtle border.
  - `outline`: Background transparent, 1px border `border`, text `textPrimary`.
  - `danger`: Background `danger` (destructive primary) or `peachSoft` with danger text (destructive secondary).
  - `ghost`: Background transparent, no border, text `textSecondary` or `mintDark`.
- **Interactive Feedback:** Spring scale animation on press (`0.97` scale, tension 70, friction 8).

### 6.2 Input Architecture (`<AppInput />`)
- **Standard Input:** Height `56px` (`ControlHeight.row`), background `inputBg`, radius `BorderRadius.input` (16px), padding horizontal `Spacing.block` (16px), text `FontSize.body` (16px).
- **Search Input:** Height `48px` (`ControlHeight.standard`), background `inputBg`, radius `BorderRadius.pill`, search icon prefix, clear button suffix.
- **Selector Trigger:** Height `56px`, background `card`, radius `BorderRadius.input`, pressable row with right chevron.

### 6.3 Iconography & `GradientIconBadge` Invariant (AGENTS.md §9.9)
- **Sizes:**
  - `micro`: `16px` (Inline trend arrows, timestamps)
  - `standard`: `20px` (Input icons, button icons, modal close icons)
  - `action`: `24px` (Navigation bar headers, floating bottom capsule icons)
- **`GradientIconBadge` Standard:**
  - All category, Gullak, and transaction icons **must** use `GradientIconBadge` (`size: 44px` or `48px`, dynamic `iconColor`).
  - Gullak deposits and milestone headers **must** use `GradientIconBadge` with `color="#ADEBB3"` and `PiggyBankCoinIcon`.
  - **Never use plain flat circles** (`backgroundColor: iconBg`, `borderRadius: width / 2`) for transactional or feature icons.

### 6.4 Transaction Row Standard (`<TransactionRow />`)
All transaction list items across `HomeScreen`, `HistoryScreen`, and `ExpenseDetailScreen` must use `<TransactionRow />`:
- **Left:** `GradientIconBadge` (44x44) with category icon.
- **Center:** Vertical stack of Title (`FontSize.body`, SemiBold) and Category / Timestamp (`FontSize.bodySmall`, Regular, `textSecondary`).
- **Right:** `<AmountText role="row" value={amount} direction={type} signed={true} />`.
- **Spacing:** Padding vertical `12px`, padding horizontal `0` (or `Spacing.block` in standalone cards).

### 6.5 Segmented Controls (`<SegmentedControl />`)
- Standardizes all cadence, filter, and form-level segmented switches (`Expense/Income`, `Paid Via`, `Day/Week/Month`, `All/Expense/Income`, `Overview/Breakdown`).
- **Container Heights:**
  - **Form-Level Controls (`BouncyTypeToggle`, `BouncyPaymentToggle`):** Must strictly use `ControlHeight.row` (`56px`) matching the Date Picker trigger button (`datePickerButton`) and standard input container heights.
  - **Screen / Tab / Modal Filters (`BouncyFilterToggle`, `BouncyCategoryFilter`, `BudgetEditModal`, `SavingsScreen`, `InsightsScreen`, `ProfileScreen`):** Must strictly and uniformly use `ControlHeight.standard` (`48px`) across the entire app. Never use legacy 44px or arbitrary heights.
- **Scrollable Category Filters (`BouncyCategoryFilter`):** Outer pill height is strictly `ControlHeight.standard` (`48px`). The sliding highlight uses Apple Dual-Edge Liquid Morph (`tension: 100, friction: 16`, direction-aware stretch & squish). Crucially, manual user scrolling is preserved: tapping a category NEVER triggers automatic `scrollTo`, giving the user complete direct-manipulation agency while the pill glides fluidly to the tapped option.
- **Container Styling:** Background strictly `cardSubtle` (or `inputBg` in form contexts), padding `Spacing.micro` (4px), radius `BorderRadius.pill`, border `borderSubtle`, `overflow: 'hidden'`. **Never use `colors.card` or raw black for pill containers; all pills across the app must maintain a unified, elevated grayish surface across all themes.**
- **Sliding pill:** Background `colors.mintGreen` or `colors.peachCoral`, radius `BorderRadius.pill`, elevation shadow `(0, 1.5, 0.12, 3)`.
- **Active text:** Must always use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold` on both `mintGreen` and `peachCoral` active pills. **Never use `colors.coral`, `textPrimary`, or foreground matching the active pill background.**
- **Inactive text:** Strictly `colors.textSecondary` + `FontFamily.medium` across all pills.
- **Slide animation (Apple Dual-Edge Liquid Morph):** Standardized canonical motion for all segmented pills in Arthik. Uses Apple WWDC fluid physics:
  - **Primary Slide:** Apple-calibrated critically damped spring (`tension: 100, friction: 16`, `useNativeDriver: true`) — zero overshoot outside container bounds.
  - **Leading-Edge Liquid Morph:** Direction-aware forward pull (`leadAnim`) + distance-scaled horizontal stretch (`scaleX: 1.08–1.28`) and subtle vertical volume squish (`scaleY: 0.96–0.88`) during flight, snapping smoothly into resting stadium geometry upon arrival.
  - **Strict Track Clipping:** Inner slider track enforces `overflow: 'hidden'` with container radius, ensuring the sliding pill is physically contained within the border at all times without clipping top badges.
- **Press animation & Touch Model:** Per-item scale `0.94` on `onPressIn`, spring back `friction: 4` on `onPressOut`. Selection is strictly triggered on `onPress` (touch-up). No speculative `selectOnPressIn` or touch hijacking refs. Outer edges have generous hitSlop (`left: 16` on option 0, `right: 16` on last option) with zero horizontal overlap between neighboring buttons, accompanied by `pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}` so micro-slides from cross-screen thumb reach do not cancel presses. ScrollViews hosting the control must use `keyboardShouldPersistTaps="handled"`.

### 6.6 Status Badges (`<StatusBadge />`)
- Height `26px`, padding horizontal `10px`, radius `BorderRadius.pill`.
- Typography: `FontSize.caption` (`12px`), `Quicksand_700Bold`.
- Variants:
  - `success`: `mintGreenSoft` bg, `mintDark` / `forestGreen` text.
  - `warning` / `spending`: `peachSoft` bg, `peachCoral` text.
  - `danger`: `rgba(239, 68, 68, 0.15)` bg, `danger` text.
  - `neutral`: `cardSubtle` bg, `textSecondary` text.
  - `gullak`: Amber/gold gradient (`moneyBadgeGradStart` to `End`), `#1A2B4C` text.

---

## 7. Modals, Bottom Sheets & Feedback States

### Modal & Bottom Sheet Standard
- Container: Surface `card`, top corners `BorderRadius.cardLarge` (28px).
- Header Title: `FontSize.titleMedium` (20px), `Quicksand_700Bold`.
- Body Text: `FontSize.bodySmall` (14px) or `FontSize.body` (16px), `textSecondary`.
- Content Padding: Horizontal `Spacing.gutter` (24px).
- Safe Insets: Always use `useSafeAreaInsets` (`paddingBottom: insets.bottom + Spacing.block`). Never hardcode bottom margins.

### Feedback States
- **Loading:** Skeleton placeholder matching surface card radius (`24px`) or centered `ActivityIndicator` in theme accent.
- **Empty States:** Centered container with 64x64 `GradientIconBadge`, `FontSize.titleMedium` header, `FontSize.bodySmall` explanation, and an `<AppButton size="standard" />`.
- **Error States:** Offline/sync failure banners (`OfflineBanner`, `SyncFailedBanner`) at the top of the viewport.
- **Motion Invariant:** All interactive springs use `tension: 70, friction: 8`, `extrapolate: 'clamp'`.

---

## 8. Themes: Light, Dark & AMOLED

All colors must be referenced through `useThemeStore().colors`. No raw hex codes are permitted in screen styles.

- **Light Mode:** Off-white background (`#F8F9FB`), elevated crisp white cards (`#FFFFFF`), dark navy text (`#1A2B4C`).
- **Dark Mode:** Deep midnight navy background (`#0B111E`), elevated navy cards (`#131D2F`), light slate text (`#F8FAFC`).
- **AMOLED Mode:** Pitch black base (`#000000`), elevated charcoal cards (`#121212`), high-contrast crisp text (`#FFFFFF`) for maximum OLED battery savings.

---

## 9. Design System Status

The token-and-primitive migration across all screens is **complete** (October 2026). All screens now consume `src/config/theme.ts` tokens and `src/components/ui/` primitives.

**For future UI work — do not re-run the migration plan above.** Instead:
1. Read [`docs/ARTHIK_DESIGN_SYSTEM.md`](file:///d:/Arthik-App/docs/ARTHIK_DESIGN_SYSTEM.md) before making any UI changes.
2. Reuse existing shared components and tokens.
3. If a new requirement falls outside the current system, follow the **Design Gap Protocol** in `AGENTS.md §9.0` — identify the gap, propose a solution, and ask for approval before introducing new values.

*Invariant: Run `npm test` and `npx tsc --noEmit` after any UI change. No regressions permitted.*
