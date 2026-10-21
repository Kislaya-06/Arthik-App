# Arthik — Unified Design System & UI Specification

> **Document Type:** Canonical Human & AI Agent Design System Specification (Contract & Usage Guide)  
> **Target Framework:** React Native 0.86 + Expo SDK 57 (Android-first, Quicksand Typography)  
> **Status:** Single Approved Source of Truth for all UI, Styling, and Interaction Design  
> **Last Updated:** October 2026 (v2.1.0)

---

## 1. Sources of Truth & Governance

The Arthik Design System is governed by two complementary layers of authority:

1. **Runtime Token Source of Truth:** [`src/config/theme.ts`](file:///d:/Arthik-App/src/config/theme.ts)  
   Every numeric spacing, radius, font size, control height, and color value lives strictly in `src/config/theme.ts`. No file may hardcode alternative or ad-hoc design numbers.
2. **Canonical Design Specification & Contract:** [`docs/design-system.md`](file:///d:/Arthik-App/docs/design-system.md) (This Document)  
   Contains the human & AI design contract, core principles, token reference tables, component anatomy, motion physics, financial amount hierarchy, anti-patterns, and the audit checklist.

### Token Governance & Adding New Tokens
- **Never add numeric duplicates:** Do not create a new token if an existing semantic token satisfies the role.
- **Rule of Semantic Role:** If a new design requirement emerges, evaluate it against the 7-question criteria (Single role? Not numeric coincidence? Understandable? Frequent? Future-proof? Component vs Token? Local geometry?).
- **Token Registration Process:**
  1. Add the token to `src/config/theme.ts` under its proper semantic object.
  2. Document the semantic purpose, allowed exceptions, and examples in this document.
  3. Verify with `npm test` and `npx tsc --noEmit`.

---

## 2. Core Design Principles

1. **Consistency over one-off polish:** The same semantic role must look and behave identically everywhere.
2. **Semantic tokens, not magic numbers:** Use role-based spacing, type, radius, control height, color, icon, and motion tokens.
3. **Financial hierarchy first:** The most important amount gets the strongest visual emphasis; supporting numbers step down systematically.
4. **Premium, not boxy:** Use generous whitespace, crisp typography, precise alignment, subtle surfaces, and progressive disclosure before adding another card or border.
5. **One visual language across themes:** Light, Dark, and AMOLED change colors and contrast, never layout hierarchy or component anatomy.
6. **Reusable primitives before screen-specific styles:** Recurring patterns belong in shared components (`src/components/ui/`) rather than ad-hoc inline styles.
7. **Accessibility is foundational:** Minimum 44dp touch targets, readable contrast in all 3 themes, scalable text, and clear feedback states.

---

## 3. Spacing System & Spatial Rhythm

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

### Screen Layout & Gutters
- **Canonical Gutter:** All standard screens use `Spacing.gutter` (`24px`) for outer horizontal padding. Full-bleed visuals are explicit exceptions.
- **Section Anatomy:** Standard section follows: `section heading -> optional helper/action -> content -> Spacing.section`.
- **Do not double-pad:** Never apply card-level padding to a container and then duplicate that padding on its child contents.

---

## 4. Typography Scale & Font Architecture

Typography is set exclusively in **Quicksand** via `@expo-google-fonts/quicksand`. The scale is strictly role-based.

### Typography Tokens (`FontSize` & `FontFamily` in `src/config/theme.ts`)

| Token Name | Size | Line Height | Letter Spacing | Font Family | Semantic Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FontSize.display` | `32px` | `38px` | `-0.5px` | `FontFamily.bold` | Hero metric amounts, primary banner figures |
| `FontSize.title` | `24px` | `30px` | `-0.3px` | `FontFamily.bold` | Screen titles, hero titles |
| `FontSize.cardTitle` | `18px` | `24px` | `-0.2px` | `FontFamily.semiBold` | Major card headings, modal titles |
| `FontSize.subheader` | `16px` | `22px` | `0px` | `FontFamily.semiBold` | Section headers, prominent form labels |
| `FontSize.body` | `14px` | `20px` | `0px` | `FontFamily.regular` | Standard body text, primary row text |
| `FontSize.caption` | `12px` | `16px` | `+0.2px` | `FontFamily.medium` | Timestamps, metadata, secondary helper labels |
| `FontSize.micro` | `10px` | `14px` | `+0.3px` | `FontFamily.medium` | Badge text, micro pill indicators |

---

## 5. Financial Number Hierarchy

Every financial figure in Arthik represents **real money**. Numbers must be clearly prioritised so the user's eye immediately grasps their financial state.

### Amount Tiers
- **Tier A — Hero Financial Amount (`FontSize.display` / `32px`):**
  - Used for: Current Day's Allowance, Total Balance, Period Total Spent, Gullak Accumulated Savings.
  - Exactly one Tier A amount dominates any given viewport/hero card.
- **Tier B — Primary Contextual Amount (`FontSize.title` / `24px` or `20px`):**
  - Used for: Remaining budget in a major card, monthly/weekly recap headers, net cash flow.
- **Tier C — Row & Analytical Amount (`FontSize.subheader` or `FontSize.body` / `16px`–`14px`):**
  - Used for: Transaction list amounts, category breakdown sums, insight list rows.
- **Tier D — Compact Supporting Amount (`FontSize.caption` or `FontSize.micro` / `12px`–`10px`):**
  - Used for: Percentage changes, chart axis annotations, mini comparison tags.

### Formatting & Currency Alignment
- Always use `formatCurrency` or `formatAmountWithCommas` from `src/lib/formatters.ts` (Indian numbering: ₹1,50,000).
- Hide redundant `.00` on whole numbers; retain meaningful paise where entered or calculated.
- Align currency symbol: Wrap amount and `₹` in `flexDirection: 'row'` with `alignItems: 'center'`.
- Never abbreviate financial figures (`1.2K`, `3.5L`) unless explicitly specified in compact chart tags.
- Positive inflows use consistent `+₹` styling; expense outflows use `-₹` or unadorned `₹`.

---

## 6. Radius Scale & Shape Architecture

Corner radii reflect surface elevation and interaction roles.

### Radius Tokens (`BorderRadius` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage | Allowed Exceptions |
| :--- | :--- | :--- | :--- | :--- |
| `BorderRadius.xs` | `4px` | Micro Accent Radius | Badge corners, tiny status dots, progress track caps | None |
| `BorderRadius.sm` | `8px` | Component Accent Radius | Compact action buttons, toast notifications, small chips | None |
| `BorderRadius.md` | `12px` | Control & Container Radius | Text inputs, dropdown menus, secondary cards | None |
| `BorderRadius.lg` | `16px` | Surface & Sheet Radius | Primary content cards, alert dialogs, modal sheets | None |
| `BorderRadius.hero` | `24px` | Hero Surface Radius | Branded hero cards, large surface cards | None |
| `BorderRadius.pill` | `9999px` | Stadium Pill Radius | Segmented controls, filter toggle pills, floating capsule bar | None |

> **Circle Geometry Exception:** Circles (such as icon buttons or avatars) use literal `borderRadius: size / 2` (e.g., width 40 $\to$ radius 20). Never use radius tokens for circles.

---

## 7. Control Dimensions & Touch Target Anatomy

### Control Heights (`ControlHeight` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage |
| :--- | :--- | :--- | :--- |
| `ControlHeight.compact` | `36px` | Compact Control Height | Compact filter chips, mini action buttons |
| `ControlHeight.standard` | `48px` | Standard Touch Target | Secondary modal buttons, Segmented controls, tabs, search bars |
| `ControlHeight.row` | `56px` | Row & Form Field Height | Standard text inputs, form toggle rows, date picker trigger |
| `ControlHeight.cta` | `60px` | Full-Width Primary CTA | Primary bottom action buttons (Add Expense, Continue, Done, Got It) |

- **Minimum Hit Area:** Every interactive element must provide at least a **44dp $\times$ 44dp** touch target (`hitSlop`).
- **Filter Containers:** Screen, Tab, and Modal Segmented Controls must strictly use `ControlHeight.standard` (`48px`). Form-level toggles (e.g. Type, Payment Mode) strictly use `ControlHeight.row` (`56px`).

---

## 8. Surfaces, Elevation & Theme Architecture

Arthik supports three distinct themes: **Light**, **Dark**, and true obsidian **AMOLED**.

### Theme Tokens (`src/config/theme.ts`)
- **Light:** Clean white and light gray surfaces (`#FFFFFF`, `#F8FAFC`, subtle card borders `#E2E8F0`).
- **Dark:** Deep navy/slate charcoal surfaces (`#0B1528`, cards `#132238`, cardSubtle `#1A263B`).
- **AMOLED:** True pure black obsidian background (`#000000`, cards `#0A0A0A`, cardSubtle `#121212`, borders `#1E1E1E`).

### Pill & Container Surface Rule
- **Segmented Control Containers:** Strictly use `colors.cardSubtle` with border `colors.borderSubtle`. Never use raw card background or pitch-black for pill tracks; tracks must maintain an elevated, subtle surface across all themes.
- **Active Pill Contrast:** Active pill background uses `colors.mintGreen` or `colors.peachCoral`. Active label text must strictly use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold`. **Never use white or matching light text on an active pill.**

---

## 9. Reusable Component Specifications

### Canonical UI Primitives (`src/components/ui/`)
1. **`<AppButton />`**:
   - Variants: `primary`, `secondary`, `destructive`, `outline`, `ghost`.
   - Standard height `ControlHeight.standard` (`48px`), pill or `BorderRadius.md` geometry, haptic feedback on press.
2. **`<AppInput />`**:
   - Height `ControlHeight.row` (`56px`), `BorderRadius.md` (`12px`), background `colors.inputBg`, clear label hierarchy.
3. **`<AmountText />`**:
   - Shared wrapper ensuring consistent `₹` symbol placement, font sizing, and optional rolling digit animations.
4. **`<SegmentedControl />`**:
   - Container height 48px, deep text contrast.
   - **Liquid pill** (`src/lib/segmentedMotion.ts`): the pill's left and right edges ride two springs on the UI thread. The edge in the direction of travel uses `LEADING_EDGE_SPRING` (`stiffness 700, damping 46`), the back edge `trailingSpringFor(slots)` (`stiffness 420 + 80 per extra slot`, 0.97 of critical damping), so the pill stretches while it moves and lands at its exact width (under 1px overshoot). The trailing edge is distance-aware on purpose: with one fixed spring an All -> Monthly jump stretched the pill to 1.56x (a blob); now it is about 19% / 28% / 29% for 1 / 2 / 3 slots and every jump lands in about 285ms. Width is animated, never `scaleX`, so the round corners never squash.
   - **Label colour follows the pill**: each label is drawn twice (inactive colour + active colour on top). The top copy's *opacity* follows the pill's live centre (`labelActiveProgress`). Opacity on a View is a cheap GPU property, so this does not bring back the per-frame `setTextColor` cost removed in FIN-13.
   - **Geometry**: slot width comes from `optionWidthFor` (border excluded). Ignoring the border made the pill drift up to ~1.5px off the labels on the last option.
   - **Labels**: each label is drawn twice; the inactive-colour copy fades out (`inactiveLabelOpacity`) as the active copy fades in, so no grey fringe shows around the active text.
   - **Haptics**: selection tick only when the selection really changes (like `UISegmentedControl`); on iOS also a soft impact when the pill lands. Android gets the single tick only (no double buzz). Honours OS reduce-motion (snap, no stretch, no wait).
   - **`commitOnSettle`**: heavy screens (Home, Insights, Savings history) receive `onChange` at `PILL_COMMIT_MS` (200ms) after the last tap when the pill is 95%+ arrived, seamlessly overlapping the pill's soft deceleration with screen content transitions (rolling numbers, card layout). Soft landing tick fires at `PILL_SETTLE_MS` (320ms). Rapid taps debounce clean. Cheap forms (Cash/UPI, Profile) report at once.
5. **`<GradientIconBadge />`**:
   - Mandatory for all category icons, feature badges, and Gullak/PiggyBank symbols. Pre-configured gradient pairs.
6. **`<RollingText />`**:
   - Vertical odometer-style digit rolling animations on amount updates and screen focus across Home, Savings, and Insights.
   - Zero-flash planning: rolls are planned synchronously during render on frame 0, mounting `DigitWheel`s immediately from the old value to the new value with zero frames of static new text leaking to the display.
   - Feel (`src/lib/rollingText.ts`): `ROLL_DURATION_MS` 460, `ROLL_EASING` `(0.22, 1, 0.36, 1)` long soft landing, `ROLL_STAGGER_MS` 18 (left-to-right ripple). No per-glyph opacity animation on purpose: it would add hundreds of animated nodes per roll on Home.
7. **`<AnimatedToggle />`** (the only on/off switch; no native `<Switch />` anywhere):
   - "Squish" motion from `src/lib/toggleMotion.ts`, all on the UI thread (Reanimated): fast and fluid slide (`SLIDE_SPRING` stiffness 720, damping 44) with subtle press cushion (`PRESS_STRETCH_FACTOR` 0.25) so the thumb does not awkwardly elongate in place before moving. During the slide the thumb is longest mid-trip (front edge leads, back edge lags, `sin(pi * progress)`), then lands with a tiny squash.
   - One clamped slide spring (`SLIDE_SPRING`), so the thumb never pokes past the track end. The resting edge stays on the track end while pressed, so the stretch always grows toward the middle.
   - Thumb and ON/OFF text cross-fade over `colorDuration` (200ms) using layer **opacity**, never per-frame colour interpolation (FIN-13 rule). Selection haptic on every change. Honours OS reduce-motion (instant, no stretch).
   - Resting look is unchanged (1px border, 2.5/3px padding, same thumb size and travel for 50x26, 52x26 and 58x30). Public props unchanged; optional `stretch`, `colorDuration`, `pressScale`, `haptics`.
   - Controlled: the thumb moves only when `value` changes, so a handler that refuses the change keeps the switch where it was.
8. **`<BouncyCategoryFilter />`**:
   - Horizontal category filter pill bar for `HistoryScreen`.
   - UI-thread `react-native-reanimated` worklets (`useSharedValue`, `useAnimatedStyle`, `withSpring`, `cancelAnimation`).
   - Hardware-accelerated transform-only animation (`transform: [{ translateX: pillX.value }]`, static `left: 0`), preventing per-frame Android native relayout passes.
   - Apple-calibrated critically damped spring slide (`stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true`) preserving pure stadium pill geometry (`BorderRadius.pill`) with zero scale distortion.
   - Synchronous touch-driven dispatch (`handleSelect` launches animation immediately on touch before `onChange` state updates).
   - Zero-shift typography architecture: invisible bold placeholder (`hiddenPlaceholder` with `opacity: 0`, `FontFamily.bold`) locks tab width across medium/bold active weight transitions.
   - Fixed outer container height `ControlHeight.standard` (`48px`), stadium pill geometry (`BorderRadius.pill`), with clipping `overflow: 'hidden'` preserving rounded ends.

### Home Card Details Sheet & Hero Card Geometry (`BrandedHeroCard`)
- `HeroDetailsSheet` is a `BottomSheetModal` (with `swipeToDismiss`: grab handle 40×5, drag follows the finger, backdrop lightens with the drag, closes past 28% of the sheet height or on a flick > 900pt/s, otherwise springs back) with `colors.cardSubtle` section cards (`BorderRadius.input`, `Spacing.block`), caption section labels and `FontSize.bodySmall` rows. No new tokens.
- Home rings (`DualRingChart`, `DonutChart`) sweep on the UI thread via `useRingSweep` and are emptied after the screen is left, never on return, so coming back to Home never blinks.
- Splash: entrance/exit are single Reanimated clocks; the bloom is a full-screen centred layer above all splash content; handoff goes through the mint `SplashCover` (above the navigator, below the app-lock overlay). The Home card is a `Pressable` and keeps exactly one primary chip.
- **Hero Card Subtext Chips Boundary Enclosure**: In `BrandedHeroCard`, `subtextContainer` is nested inside `topSection`, sharing the exact `paddingRight: podSize + GAP + 6` constraint to prevent chips from protruding into the top-right circular chart pod and SVG socket cutout.
- **Fintech Gullak Alert Badges**: When money is drawn from Gullak, it renders as a dedicated alert badge (`gullakSpendingBadge`) with a `PiggyBankCoinIcon`, bold red typography (`#DC2626`), and `maxWidth: '100%'` with text truncation protection. If remaining income is zero, redundant `+₹0 income` chips are discarded in favor of the standalone Gullak chip.

### Split & Money Back Components (`src/components/split/`)
Built only from existing tokens and primitives (no new tokens): `SplitExtras` (switch row + name field + share field + suggestion pills, same anatomy as `TransferExtras`), `MoneyBackExtras` (mode pills + person / expense option rows), `MoneyBackSheet` (`BottomSheetModal` with `AppButton` footer), `SplitDetailCard` (detail-screen card, `BorderRadius.card`, `Spacing.surface`). Pills use `BorderRadius.pill`; the active pill uses `colors.mintGreen` with `colors.forestGreen` text.

### AutoLog Review Sheet Specifications (`src/components/autolog/ReviewSheet.tsx`)
- **Compact Split-Row Receipt Card**: Top summary card employs a balanced split row (`summarySplitRow`): large amount (26px, `FontFamily.bold`) and merchant title on the left; compact account pill (`accountPill`, `BorderRadius.pill`) and date/source on the right. Raw SMS text is condensed into a 1-line italic quote box (`summaryQuoteBox`), eliminating 30% vertical height and right-side void space.
- **Horizontal Category Chip Scroll with Edge Fades**: Matches `ExpenseFormScreen.tsx` with horizontal chip scrolling (`categoryList`), left/right SVG LinearGradient edge faders (`reviewCategoryFadeLeft`, `reviewCategoryFadeRight`), animated scale press feedback, and category SVG gradient fills (`getCategoryChipGradient`). Includes a standardized "None" chip with `CircleOff` icon in full review mode.
- **Uniform 48px Stadium Pills**: "Remember preference", "Mark as Self Transfer", and "Save and split with friends" strictly share uniform 48px stadium pill height (`ControlHeight.standard`, `BorderRadius.pill`).
- **Self Transfer Action & Invariant**: "Mark as Self Transfer" confirms and purges any pre-logged expense, updates status to `'transfer'`, registers the transfer rule in `self_transfer_rules`, and persists merchant preference to automatically route future transfers as non-expenses.
- **Bottom Action Hierarchy**: 52px primary Save CTA with comfortable 38px touch targets for secondary actions ("Not a transaction" · "Delete transaction" / "Discard review").

---

## 10. Animation & Motion Physics

- **Apple WWDC-Calibrated Springs:** `BouncyCategoryFilter` uses a critically damped spring (`stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true`). `SegmentedControl` uses the two-edge liquid pill springs from `src/lib/segmentedMotion.ts` (see `<SegmentedControl />` above).
- **Never animate a screen while its pill glides:** heavy re-renders wait for the pill to land (`commitOnSettle`, `PILL_SETTLE_MS`).
- **Hardware-Accelerated Transform Sliding:** Sliding highlight pills animate exclusively via `translateX` (anchored at `left: 0`) and width, avoiding layout properties (`left`, `top`, `margin`) to guarantee 60/120fps motion without native Yoga relayout passes.
- **Tactile Press Feedback:** Interactive items scale to `0.93–0.94` on `onPressIn`, springing back with `friction: 4` (`damping: 12, stiffness: 200`) on `onPressOut`, accompanied by light haptics (`expo-haptics`).
- **Reduced Motion:** When `useReduceMotion()` is true, disable animations and use immediate snapping.

---

## 11. Empty, Loading, and Error States

Every data surface must cleanly handle 4 foundational states:
1. **Loading State:** Subtle shimmering skeletons or spinners using `colors.cardSubtle`; avoid full-screen blocking spinners where partial skeleton UI is possible.
2. **Empty State:** Friendly vector icon (`GradientIconBadge`), clear headline, single-line explanation, and a prominent CTA button.
3. **Error State:** Non-intrusive alert banner or inline card with retry action.
4. **Offline State:** Persistent non-blocking banner (`OfflineBanner`); all cached items remain readable and interactive.

---

## 12. Strict Anti-Patterns (10 "NEVER" Rules)

1. **NEVER hardcode numeric spacing or font sizes:** Do not use `padding: 17`, `margin: 22`, or `fontSize: 19`.
2. **NEVER use ad-hoc hex colors in screens:** All colors must resolve from `useTheme()` / `src/config/theme.ts`.
3. **NEVER use low-contrast text on pills:** Never put white text on a mint green or peach pill; use `forestGreen`.
4. **NEVER invent new button heights:** Do not use 40px, 44px, or 52px buttons; stick to 48px (standard) or 56px (row).
5. **NEVER create boxes-inside-boxes:** Avoid wrapping cards inside cards unless representing a distinctly nested interactive modal.
6. **NEVER use radius tokens on circles:** For circular avatars or icon buttons, strictly use `borderRadius = size / 2`.
7. **NEVER abbreviate real money:** Do not show `₹1.5K` for `₹1,500` on primary account balance or allowance cards.
8. **NEVER trigger auto-scroll on chip tap:** In horizontal category filter bars (`BouncyCategoryFilter`), user maintains full touch agency.
9. **NEVER use flat icon circles when `GradientIconBadge` exists:** Icon badges must use the gradient badge primitive.
10. **NEVER break cross-theme layout parity:** A screen in Dark or AMOLED mode must have the exact same padding, alignment, and hierarchy as Light mode.

---

## 13. Design Audit Checklist

Before declaring any UI task done, verify:
- [ ] Outer horizontal padding is strictly `Spacing.gutter` (`24px`).
- [ ] Typography uses semantic roles from `FontSize` & `FontFamily`.
- [ ] Financial amounts follow Tier A/B/C/D rules with `formatCurrency`.
- [ ] Buttons and inputs use `ControlHeight.standard` or `ControlHeight.row`.
- [ ] Colors come from `useTheme()` and look sharp in **Light, Dark, and AMOLED**.
- [ ] Interactive touch targets are $\ge 44\text{dp}$.
- [ ] Sliding controls use `SegmentedControl` with proper contrast.
- [ ] No regression or visual glitches on small screens ($< 360\text{dp}$).

### Bottom Navigation (`BottomNavBar`)
- Floating pill navigation bar with elevated center quick-add button and balanced layout.
- Tabs: Expanding in-place capsule (`CapsuleTabItem`) with label reveal (`0 -> 50` width, `180ms` cubic ease-out) and dual-layer cross-fading icon (`textSecondary` to `mintGreen`).
- Press feedback: `0.92` spring scale on press-in, springs back to `1.0` on release with light haptics.
