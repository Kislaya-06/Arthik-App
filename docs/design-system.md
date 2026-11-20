# Arthik — Unified Design System & UI Specification

> **Document Type:** Canonical Human & AI Agent Design System Specification (Contract & Usage Guide)  
> **Target Framework:** React Native 0.86 + Expo SDK 57 (Android-first, Quicksand Typography)  
> **Status:** Single Approved Source of Truth for all UI, Styling, and Interaction Design  
> **Last Updated:** November 2026 (v2.1.0, UI consistency pass: token tables re-synced with `theme.ts`, header / press / button / scrim rules)

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
| `Spacing.row` | `14px` | List Row Rhythm | Vertical padding of list rows and dialog rows | None |
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

Font weights: `FontFamily.regular` (400), `FontFamily.medium` (500), `FontFamily.semibold` (600), `FontFamily.bold` (700).

| Token Name | Size | Line Height | Semantic Role |
| :--- | :--- | :--- | :--- |
| `FontSize.micro` | `11px` | `LineHeight.micro` 14 | Chart axis labels, compact calendar cell dates, badge text |
| `FontSize.caption` | `12px` | `LineHeight.caption` 16 | Uppercase section labels, timestamps, compact tags, status pills |
| `FontSize.bodySmall` | `14px` | `LineHeight.bodySmall` 18 | Secondary body text, subtitles, helper notes, compact button labels |
| `FontSize.body` | `16px` | `LineHeight.body` 22 | Body text, input text, row labels, 48px button labels, paired 60px sheet buttons |
| `FontSize.titleSmall` | `18px` | `LineHeight.titleSmall` 24 | Single full-width 60px CTA labels, prominent alert titles |
| `FontSize.titleMedium` | `20px` | `LineHeight.titleMedium` 26 | **Pushed-page header titles**, modal / sheet titles, section titles |
| `FontSize.titleLarge` | `28px` | `LineHeight.titleLarge` 34 | **Main tab titles only** (History, Insights, Savings) and onboarding / update screens |
| `FontSize.display` | `34px` | `LineHeight.display` 42 | Hero amounts, welcome greetings, auth headline |
| `FontSize.cta` | `18px` | — | Deprecated alias of `titleSmall`; do not use in new code |
| `FontSize.sectionTitle` | `20px` | — | Deprecated alias of `titleMedium`; do not use in new code |
| `FontSize.screenTitle` | `30px` | — | Deprecated; use `titleLarge` or `display` |

Intermediate literals (`11`, `13`, `15`) are allowed only where §9.3 of `AGENTS.md` permits (chart and fixed-shape geometry).

### Letter Spacing (`LetterSpacing` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role |
| :--- | :--- | :--- |
| `LetterSpacing.label` | `0.8px` | Every small UPPERCASE label: section labels ("CATEGORY", "EXPENSES"), form field labels, card captions ("TOTAL SPENT", "YOU WILL GET BACK"), sheet section headers |

Weight stays with the label's own role (bold for section labels, medium / semibold for form labels). Badges (`BETA`, pill counts), chart labels and fixed-size strip tiles keep their own tuned spacing: they are fixed shapes and wider tracking could push the text out. `tests/uiConsistency.test.ts` fails if a caption-size uppercase label uses another value.

---

### Large System Font Safety (OPT-42)
- Text in a container that can grow must simply grow: use `minHeight`, not a fixed `height`.
- Text inside a **fixed-size shape** (status badge, segmented/category pill, keypad key, calendar day cell, short fixed-height button) sets `maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}` (`src/lib/fontScale.ts`, `1.3`). At normal and moderately large fonts (up to 1.3x) nothing changes; above that the shape keeps its size and the text stops growing.
- Bottom navigation labels keep their own cap (`NAV_LABEL_MAX_FONT_SCALE`, `1.15`).
- Never use `allowFontScaling={false}` to fix clipping (only the digit layers of `RollingText` do, because they are measured glyph by glyph).
- A pill with an invisible width placeholder (`BouncyCategoryFilter`) puts the SAME cap on the placeholder and the visible label, so the width stays exact.

## 5. Financial Number Hierarchy

Every financial figure in Arthik represents **real money**. Numbers must be clearly prioritised so the user's eye immediately grasps their financial state.

### Amount Tiers
- **Tier A — Hero Financial Amount (`FontSize.display` / `34px`):**
  - Used for: Current Day's Allowance, Total Balance, Period Total Spent, Gullak Accumulated Savings.
  - Exactly one Tier A amount dominates any given viewport/hero card.
- **Tier B — Primary Contextual Amount (`FontSize.titleLarge` / `28px` or `FontSize.titleMedium` / `20px`):**
  - Used for: Remaining budget in a major card, monthly/weekly recap headers, net cash flow.
- **Tier C — Row & Analytical Amount (`FontSize.body` or `FontSize.bodySmall` / `16px`–`14px`):**
  - Used for: Transaction list amounts, category breakdown sums, insight list rows.
- **Tier D — Compact Supporting Amount (`FontSize.caption` or `FontSize.micro` / `12px`–`11px`):**
  - Used for: Percentage changes, chart axis annotations, mini comparison tags.

### Formatting & Currency Alignment
- Always use `formatCurrency` or `formatAmountWithCommas` from `src/lib/formatters.ts` (Indian numbering: ₹1,50,000).
- Hide redundant `.00` on whole numbers; retain meaningful paise where entered or calculated.
- Align currency symbol: Wrap amount and `₹` in `flexDirection: 'row'` with `alignItems: 'center'`.
- Never abbreviate financial figures (`1.2K`, `3.5L`) unless explicitly specified in compact chart tags.
- Positive inflows use consistent `+₹` styling; expense outflows use `-₹` or unadorned `₹`.
- Amount colour comes from `AmountText` `direction`: income = `colors.mintText`, expense = `colors.coralText` (see Text accent tokens). Never colour an amount with `mint` / `mintDark` / `peachCoral` directly: on Light they are 1.4–2.2:1.

---

## 6. Radius Scale & Shape Architecture

Corner radii reflect surface elevation and interaction roles.

### Radius Tokens (`BorderRadius` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage | Allowed Exceptions |
| :--- | :--- | :--- | :--- | :--- |
| `BorderRadius.input` | `16px` | Control & Container Radius | Text inputs, modal inputs, compact containers, section cards inside sheets | None |
| `BorderRadius.card` | `24px` | Surface Radius | Major content cards, alert dialogs, settings cards | None |
| `BorderRadius.cardLarge` | `28px` | Hero & Sheet Radius | Hero / summary cards, modal sheets, date picker, update dialog | None |
| `BorderRadius.pill` | `9999px` | Stadium Pill Radius | Every button, segmented controls, filter pills, chips, floating capsule bar | None |

Small badge corners (`4`–`8`) stay literal where no token fits (§9.3 of `AGENTS.md`).

> **Circle Geometry Exception:** Circles (such as icon buttons or avatars) use literal `borderRadius: size / 2` (e.g., width 40 $\to$ radius 20). Never use radius tokens for circles.

---

## 7. Control Dimensions & Touch Target Anatomy

### Control Heights (`ControlHeight` in `src/config/theme.ts`)

| Token Name | Value | Semantic Role | Intended Usage |
| :--- | :--- | :--- | :--- |
| `ControlHeight.compact` | `36px` | Compact Control Height | In-card action chips, compact filter buttons (never a dialog button) |
| `ControlHeight.standard` | `48px` | Standard Touch Target | **Every button in a centered dialog**, secondary page buttons (Log Out, Delete Account), segmented controls, search bars |
| `ControlHeight.row` | `56px` | Row & Form Field Height | Text inputs (incl. the Gullak amount field), form toggle rows, date picker trigger |
| `ControlHeight.cta` | `60px` | Primary CTA | **Every button in a bottom sheet footer** and every full-width primary action on a page (Save, Continue, Update Now, Got It) |

- **Two-tier button rule (UI consistency pass, Nov 2026):** centered dialogs (alert, date picker, pause budget, edit profile, delete account, Vault guard) use 48. Bottom sheets (budget edit, cadence switch, Gullak deposit, period renewal, money back, review) and full-page primary actions use 60. Nothing in between: 46 / 50 / 52 / 56 are not button heights (`tests/uiConsistency.test.ts`). The only exception is the Add Transaction save button while the keyboard is open (48, so the form keeps its room).
- **CTA labels:** a single full-width 60px CTA uses `FontSize.titleSmall` (18) bold, the same as `AppButton size="cta"`. Two side-by-side 60px sheet buttons use `FontSize.body` (16) bold. 48px buttons use `FontSize.body`.
- **Close (X) buttons** on sheets and dialogs: 36dp circle (`borderRadius: 18`), 18px icon, `hitSlop` 8+ so the touch area is at least 44dp.
- **Minimum Hit Area:** Every interactive element must provide at least a **44dp $\times$ 44dp** touch target (`hitSlop`).
- **Filter Containers:** Screen, Tab, and Modal Segmented Controls must strictly use `ControlHeight.standard` (`48px`). Form-level toggles (e.g. Type, Payment Mode) strictly use `ControlHeight.row` (`56px`).

---

## 8. Surfaces, Elevation & Theme Architecture

Arthik supports three distinct themes: **Light**, **Dark**, and true obsidian **AMOLED**.

### Theme Tokens (`src/config/theme.ts`)
- **Light:** Off-white base `#F8F9FB`, white cards `#FFFFFF`, cardSubtle `#F5F6F9`, borders `#E0E2E8`.
- **Dark:** Midnight navy base `#0B111E`, cards `#131D2F`, cardSubtle `#1A263B`, borders `#243248`.
- **AMOLED:** Pure black base `#000000`, cards `#0A0A0A`, cardSubtle `#121212`, borders `#1F1F1F`.

### Text accent tokens (mint / coral used as text)
| Token | Light | Dark / AMOLED | Use |
| :--- | :--- | :--- | :--- |
| `colors.mintText` | `#2E7A53` (>= 4.8:1 on card, background, cardSubtle) | `#B8E0C8` (brand mint, unchanged) | Income amounts, positive totals, mint links on plain surfaces ("Swipe up or tap", network status) |
| `colors.coralText` | `#B9473A` (>= 4.8:1) | `#F4B8AE` (brand coral, unchanged) | Expense amounts, amounts owed |

Every text (and the icon next to it) uses these tokens, never `mint` / `mintGreen` / `mintDark` / `mintGreenDark` / `coral` / `peachCoral` directly. Where Dark used `mintGreenDark` on purpose, write `colors.isDark ? colors.mintGreenDark : colors.mintText`. The brand fills (`mintGreen`, `peachCoral`) stay for pills, badges, chart segments and backgrounds. `tests/uiConsistency.test.ts` checks the Light contrast and that Dark / AMOLED keep the brand values.

### Scrim (dimmed background behind popups)
Every centered dialog and bottom sheet dims the screen with the same theme value from `src/lib/scrim.ts` (hook: `useScrimColor()`): Light `rgba(15, 23, 42, 0.45)`, Dark `rgba(0, 0, 0, 0.72)`, AMOLED `rgba(0, 0, 0, 0.88)`. Never write a popup's own black overlay.

### Pill & Container Surface Rule
- **Segmented Control Containers:** Strictly use `colors.cardSubtle` with border `colors.borderSubtle`. Never use raw card background or pitch-black for pill tracks; tracks must maintain an elevated, subtle surface across all themes.
- **Active Pill Contrast:** Active pill background uses `colors.mintGreen` or `colors.peachCoral`. Active label text must strictly use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold`. **Never use white or matching light text on an active pill.**

---

## 9. Reusable Component Specifications

### Canonical UI Primitives (`src/components/ui/`)
1. **`<AppButton />`**:
   - Variants: `primary` (mint + navy text), `secondary` (cardSubtle + textPrimary, 1px borderSubtle), `outline`, `danger`, `ghost`.
   - Sizes: `cta` 60 (18px label), `standard` 48 (16px label, default), `compact` 36 (14px label). Always `BorderRadius.pill`. Press = scale 0.97 spring (`Motion.springs.press` / `release`), off with reduce motion. Disabled = 50% opacity. `loading` shows a spinner in the label colour.
   - `danger` uses the alert dialog palette (`alertButtonPalette('destructive', …)`): `#DC2626` + white in Light, soft red + navy text in Dark, soft red + black in AMOLED (all >= 4.5:1). An icon on a danger button must use the same text colour.
   - Use it for every real button (Save, Cancel, Continue, Log Out, Delete Account). Hand-made buttons remain only where the look is special and documented (Add Transaction save, Add Category save, Budget / Cadence / Gullak sheet footers, auth screens).
1b. **`<HeaderBackButton />`** (`src/components/ui/HeaderBackButton.tsx`):
   - The only back button. Plain 24px `ArrowLeft` in `textPrimary`, no circle, `hitSlop` 10 (44dp), dims on press, `accessibilityLabel="Go back"`. Default action: go back if possible; pass `onPress` for a custom one (Reset Password falls back to Auth) and `disabled` while saving.
   - Never draw an `ArrowLeft` back button by hand (the step-back arrows inside the Gullak deposit and period renewal sheets are the only other arrows). Pages with a title use it through `ScreenHeader`; only Auth and Profile Setup (arrow above their own big heading) use it directly.
1b-ii. **`<ScreenHeader />`** (`src/components/ui/ScreenHeader.tsx`) — the title bar of every pushed page:
   - **Header rule:** main tabs (History, Insights, Savings) show a 28px left-aligned title and no back button (iOS large-title pattern). Every pushed page uses `ScreenHeader`: a 48dp bar 4dp below the safe area, back arrow on the left, optional actions on the right (16dp apart, icons 20px with `hitSlop` 12), and a **20px bold title centred on the whole bar** (Apple HIG navigation bar, Material 3 center-aligned top app bar). Content starts 8dp below the bar.
   - The title sits in an absolute layer inset by the same amount on both sides (the wider of back side and measured right side), so it is exactly centred and never jumps when the actions are measured. Long titles shrink to 80% on one line (`adjustsFontSizeToFit`), and the title is announced as a heading (`accessibilityRole="header"`, also on the three tab titles).
   - Props: `title`, `showBack` (default true), `onBack`, `backDisabled`, `right`, `titleAccessory` (e.g. the category badge on Category Detail), `inset` (default true = screen gutter; pass false when the parent already pads), `style` (e.g. `marginTop: insets.top + Spacing.micro` on screens without a safe-area padded container).
1b-iii. **`<EmptyState />`** (`src/components/ui/EmptyState.tsx`): the one empty state; see §11.
1c. **Press feedback** (`src/lib/pressFeedback.ts`):
   - Rows, icon buttons, chips, pills, links and small buttons: `PressableOpacity activeOpacity={PRESS_DIM_OPACITY}` (0.7). Always pass `activeOpacity`: the component's 0.2 default makes the element nearly vanish (`tests/uiConsistency.test.ts`).
   - Real buttons: `AppButton` (scale).
   - Only full-screen backdrops and invisible tap areas may use a raw `Pressable` without feedback (`tests/uiConsistency.test.ts` lists the three exceptions).
2. **`<AmountText />`**:
   - Shared wrapper ensuring consistent `₹` symbol placement, font sizing, and optional rolling digit animations.
3. **`<SegmentedControl />`**:
   - Container height 48px, deep text contrast.
   - **Liquid pill** (`src/lib/segmentedMotion.ts`): the pill's left and right edges ride two springs on the UI thread. The edge in the direction of travel uses `LEADING_EDGE_SPRING` (`stiffness 700, damping 46`), the back edge `trailingSpringFor(slots)` (`stiffness 420 + 80 per extra slot`, 0.97 of critical damping), so the pill stretches while it moves and lands at its exact width (under 1px overshoot). The trailing edge is distance-aware on purpose: with one fixed spring an All -> Monthly jump stretched the pill to 1.56x (a blob); now it is about 19% / 28% / 29% for 1 / 2 / 3 slots and every jump lands in about 285ms.
   - **Transform-only drawing (ADR 0020)**: the pill is two round caps + a flat middle that is scaled + one shadow box (`pillPiecesFor`). `width` is never animated (a layout prop: Yoga + shadow-tree commit every frame), and only the flat middle is scaled, so the round corners never squash. Shadow = `PILL_BOX_SHADOW` on a fill-less box drawn under the pill. Pill colours must be opaque (`isOpaqueColor`; anything else falls back to one scaled box).
   - **Label colour follows the pill**: each label is drawn twice (inactive colour + active colour on top). The top copy's *opacity* follows the pill's live centre (`labelActiveProgress`). Opacity on a View is a cheap GPU property, so this does not bring back the per-frame `setTextColor` cost removed in FIN-13.
   - **Geometry**: slot width comes from `optionWidthFor` (border excluded). Ignoring the border made the pill drift up to ~1.5px off the labels on the last option.
   - **Labels**: each label is drawn twice; the inactive-colour copy fades out (`inactiveLabelOpacity`) as the active copy fades in, so no grey fringe shows around the active text.
   - **Haptics**: selection tick only when the selection really changes (like `UISegmentedControl`); on iOS also a soft impact when the pill lands. Android gets the single tick only (no double buzz). Honours OS reduce-motion (snap, no stretch, no wait).
   - **`commitOnSettle`**: heavy screens (Home, Expense | Income, Insights, Savings history) receive `onChange` only when the pill has LANDED (both edges within 1px; exact per tap from `pillLandingMs`, ~300-350ms). A React commit during the glide pauses Reanimated's UI commits and freezes the pill, so nothing commits mid-glide. `PILL_COMMIT_MS` (= `PILL_SETTLE_MS`, 320ms) is only the fallback before the control is measured. The soft landing tick (iOS) fires at the same landing time. Rapid taps debounce clean. Any other touch delivers the pending value first (touch fence, `selectionCommitFence.ts`), so a form can never save a stale value. Cheap forms (Cash/UPI, Profile) report at once.
4. **`<GradientIconBadge />`**:
   - Mandatory for all category icons, feature badges, and Gullak/PiggyBank symbols. Pre-configured gradient pairs.
5. **`<RollingText />`**:
   - Vertical odometer-style digit rolling animations on amount updates and screen focus across Home, Savings, and Insights.
   - Zero-flash planning: rolls are planned synchronously during render on frame 0, mounting `DigitWheel`s immediately from the old value to the new value with zero frames of static new text leaking to the display.
   - Feel (`src/lib/rollingText.ts`): `ROLL_DURATION_MS` 460, `ROLL_EASING` `(0.22, 1, 0.36, 1)` long soft landing, `ROLL_STAGGER_MS` 18 (left-to-right ripple). No per-glyph opacity animation on purpose: it would add hundreds of animated nodes per roll on Home.
6. **`<AnimatedToggle />`** (the only on/off switch; no native `<Switch />` anywhere):
   - "Squish" motion from `src/lib/toggleMotion.ts`, all on the UI thread (Reanimated): fast and fluid slide (`SLIDE_SPRING` stiffness 720, damping 44) with subtle press cushion (`PRESS_STRETCH_FACTOR` 0.25) so the thumb does not awkwardly elongate in place before moving. During the slide the thumb is longest mid-trip (front edge leads, back edge lags, `sin(pi * progress)`), then lands with a tiny squash.
   - One clamped slide spring (`SLIDE_SPRING`), so the thumb never pokes past the track end. The resting edge stays on the track end while pressed, so the stretch always grows toward the middle.
   - Thumb and ON/OFF text cross-fade over `colorDuration` (200ms) using layer **opacity**, never per-frame colour interpolation (FIN-13 rule). Selection haptic on every change. Honours OS reduce-motion (instant, no stretch).
   - Resting look is unchanged (1px border, 2.5/3px padding, same thumb size and travel for 50x26, 52x26 and 58x30). Public props unchanged; optional `stretch`, `colorDuration`, `pressScale`, `haptics`.
   - Controlled: the thumb moves only when `value` changes, so a handler that refuses the change keeps the switch where it was.
7. **`<BouncyCategoryFilter />`**:
   - Horizontal category filter pill bar for `HistoryScreen`.
   - UI-thread `react-native-reanimated` worklets (`useSharedValue`, `useAnimatedStyle`, `withSpring`, `cancelAnimation`).
   - Hardware-accelerated transform-only animation (`transform: [{ translateX: pillX.value }]`, static `left: 0`), preventing per-frame Android native relayout passes.
   - Apple-calibrated critically damped spring slide (`stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true`) preserving pure stadium pill geometry (`BorderRadius.pill`) with zero scale distortion.
   - Synchronous touch-driven dispatch (`handleSelect` launches animation immediately on touch before `onChange` state updates).
   - Zero-shift typography architecture: invisible bold placeholder (`hiddenPlaceholder` with `opacity: 0`, `FontFamily.bold`) locks tab width across medium/bold active weight transitions.
   - Fixed outer container height `ControlHeight.standard` (`48px`), stadium pill geometry (`BorderRadius.pill`), with clipping `overflow: 'hidden'` preserving rounded ends.

8. **`<Skeleton />`** (`src/components/ui/Skeleton.tsx`, motion numbers in `src/lib/skeletonMotion.ts`):
   - A `colors.cardSubtle` placeholder shape (width, height, radius; default radius `BorderRadius.pill`) for content that is still loading.
   - Gentle opacity pulse on the UI thread (`0.55` to `1`, `700ms` each way, forever). With reduce motion ON it does not pulse and rests at `0.8`.
   - **Rule:** use it only where it replaces a block of content (a list, a card, a grid), shaped like what will replace it. Keep `ActivityIndicator` inside buttons, next to a short label (for example the month label of the streak calendar, "Loading categories..."), and for operations that report progress (scanning, recovering). Never hide data that is already on screen behind a skeleton.
   - The screen that shows a skeleton labels the group for screen readers (`accessibilityLabel`, `accessibilityState={{ busy: true }}`); the shapes themselves are hidden.

9. **`<SwipeableHistoryRow />`** (`src/components/SwipeableHistoryRow.tsx`):
   - Native gesture-driven swipeable container for transaction and Gullak feed items in `HistoryScreen`.
   - Built on `react-native-gesture-handler` (`Gesture.Pan()`) with strict directional activation thresholds (`activeOffsetX([-10, 10])`, `failOffsetY([-8, 8])`) guaranteeing uninterrupted vertical scrolling in `@shopify/flash-list`.
   - Apple Fluid Interfaces architecture: `contextX` tracking to eliminate touch-start jumps, exponential momentum projection (`project(velocityX, 0.992)`), progressive rubber-banding (`rubberband(overshoot, ACTION_WIDTH * 1.4, 0.45)`), and ultra-snappy velocity handoff springs (`mass: 0.6, damping: 22, stiffness: 320`).
   - Dynamic expanding underlay (`Math.max(ACTION_WIDTH, -translateX.value)`) eliminating empty gaps during overswipe, accompanied by choreographed scale/opacity transitions and press compression (`scale: 0.92`).
   - Multi-row coordination (`isOpen`, `onSwipeOpen`, `onSwipeClose`) ensuring at most one row remains revealed at any moment across the feed.
   - Reveals a brand-aligned underlay action button (`colors.peachCoral` / `#F4B8AE` background with high-contrast `colors.forestGreen` / `#1A2B4C` icon and text) with tactile haptic feedback (`Haptics.ImpactFeedbackStyle.Light` on snap open, `Medium` on destructive press) and explicit confirmation dialog, protecting against accidental deletions.

10. **`<AppAlertModal />`** (`src/components/ui/AppAlertModal.tsx`, store in `src/store/alertStore.ts`):
    - Unified, themed replacement for stock white Android `AlertDialog` across Light, Dark, and AMOLED themes.
    - Glassmorphic card styling (`BorderRadius.card`), WCAG AAA text contrast (`colors.textPrimary` bold 18px title, `colors.textSecondary` medium 14.5px message), and the shared scrim from `src/lib/scrim.ts` (`0.45` slate Light, `0.72` Dark, `0.88` AMOLED), the same one every popup uses.
    - Apple-inspired spring physics (`scale: 0.93 -> 1.0`, `opacity: 0 -> 1` with damping 18, stiffness 260) with fast 130ms exit choreography.
    - Tactile pill buttons (`BorderRadius.pill`, 48px height): `0.96` press compression, `expo-haptics` tactile feedback, danger/mint/subtle variant styling from `src/lib/alertButtonPalette.ts`. Every button is >= 4.5:1 in all three themes: destructive is `#DC2626` + white in Light, `colors.danger` + dark text (`#1A2B4C`, AMOLED `#000`) in Dark/AMOLED (white on the soft red was 2.77:1). Button labels are capped at `FIXED_SHAPE_MAX_FONT_SCALE`.
    - Safe lifecycle: the first tap closes the dialog and every later tap is ignored (a double tap on Delete runs it once); the chosen action runs exactly once after the exit, even if the exit animation is interrupted; the entrance plays once per alert (`id`); an alert asked for while another is open is queued, not swapped in (the same title + message is ignored as a duplicate).
    - Edge-to-edge window (`statusBarTranslucent` + `navigationBarTranslucent`), so the scrim also dims the system navigation bar.
    - Defensive UX: automatic keyboard dismissal on trigger so the card is never obscured, and capped message `ScrollView` (`maxHeight: 220`) ensuring long multi-line alerts never push action buttons off-screen.
    - Zero-touch runtime interception: `patchNativeAlert()` routes all legacy `Alert.alert` calls automatically.

### Home Card Details Sheet & Hero Card Geometry (`BrandedHeroCard`)
- `HeroDetailsSheet` is a `BottomSheetModal` (with `swipeToDismiss`: grab handle 40×5, drag follows the finger, backdrop lightens with the drag, closes past 28% of the sheet height or on a flick > 900pt/s, otherwise springs back) with `colors.cardSubtle` section cards (`BorderRadius.input`, `Spacing.block`), caption section labels and `FontSize.bodySmall` rows. No new tokens.
- The Home ring (`DonutChart`, used in BOTH Budget Mode and Pure Mode) sweeps on the UI thread via `useRingSweep` and are emptied after the screen is left, never on return, so coming back to Home never blinks.
- Splash: entrance/exit are single Reanimated clocks; the bloom is a full-screen centred layer above all splash content; handoff goes through the mint `SplashCover` (above the navigator, below the app-lock overlay). The Home card is a `Pressable` and keeps exactly one primary chip.
- **Hero Card Subtext Chips Boundary Enclosure**: In `BrandedHeroCard`, `subtextContainer` is nested inside `topSection`, sharing the exact `paddingRight: podSize + GAP + 6` constraint to prevent chips from protruding into the top-right circular chart pod and SVG socket cutout.
- **Fintech Gullak Alert Badges**: When money is drawn from Gullak, it renders as a dedicated alert badge (`gullakSpendingBadge`) with a `PiggyBankCoinIcon`, bold red typography (`#DC2626`), and `maxWidth: '100%'` with text truncation protection. If remaining income is zero, redundant `+₹0 income` chips are discarded in favor of the standalone Gullak chip.

### Split & Money Back Components (`src/components/split/`)
Built only from existing tokens and primitives (no new tokens): `SplitExtras` (switch row + name field + share field + suggestion pills, same anatomy as `TransferExtras`), `MoneyBackExtras` (mode pills + person / expense option rows), `MoneyBackSheet` (`BottomSheetModal` with `AppButton` footer), `SplitDetailCard` (detail-screen card, `BorderRadius.card`, `Spacing.surface`). Pills use `BorderRadius.pill`; the active pill uses `colors.mintGreen` with `colors.forestGreen` text.

### AutoLog Review Sheet Specifications (`src/components/autolog/ReviewSheet.tsx`)
- **Compact Split-Row Receipt Card**: Top summary card employs a balanced split row (`summarySplitRow`): large amount (26px, `FontFamily.bold`) and merchant title on the left; compact account pill (`accountPill`, `BorderRadius.pill`) and date/source on the right. Raw SMS text is condensed into a 1-line italic quote box (`summaryQuoteBox`), eliminating 30% vertical height and right-side void space.
- **Horizontal Category Chip Scroll with Edge Fades**: Matches `ExpenseFormScreen.tsx` with horizontal chip scrolling (`categoryList`), left/right SVG LinearGradient edge faders (`reviewCategoryFadeLeft`, `reviewCategoryFadeRight`), animated scale press feedback, and category SVG gradient fills (`getCategoryChipGradient`). The chips show only the categories of the chosen side (income categories for income). There is no "None" chip: a category must be picked before the primary Save button turns on (only "Settle with <person>", "Mark as self transfer" and "Teach Format" work without one).
- **Uniform 48px Stadium Pills**: "Remember preference", "Mark as Self Transfer", and "Save and split with friends" strictly share uniform 48px stadium pill height (`ControlHeight.standard`, `BorderRadius.pill`).
- **Self Transfer Action & Invariant**: "Mark as Self Transfer" confirms and purges any pre-logged expense, updates status to `'transfer'`, registers the transfer rule in `self_transfer_rules`, and persists merchant preference to automatically route future transfers as non-expenses.
- **Bottom Action Hierarchy**: 60px primary Save CTA (`AppButton size="cta"`) with 44px touch targets for secondary actions ("Not a transaction" · "Delete transaction" / "Discard review").

---

## 10. Animation & Motion Physics

- **Apple WWDC-Calibrated Springs:** `BouncyCategoryFilter` uses a critically damped spring (`stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true`). Its highlight is drawn transform-only like `SegmentedControl` (caps + scaled middle + shadow box), its labels cross-fade by opacity (never animated Text `color`), and the History list updates when the highlight lands (`categoryPillLandingMs`). `SegmentedControl` uses the two-edge liquid pill springs from `src/lib/segmentedMotion.ts` (see `<SegmentedControl />` above).
- **Create flows open from the bottom:** `AddExpense` and `EditExpense` use `fade_from_bottom` (rises quickly from the bottom and fades in, snappy task entrance like Google Pay and Splitwise); every detail page keeps `slide_from_right`.
- **Never animate a screen while its pill glides:** heavy re-renders wait for the pill to land (`commitOnSettle`, `pillLandingMs` / `categoryPillLandingMs`).
- **Pills animate transform / opacity / backgroundColor only.** Never `width`, `left`, `height` or Text `color` in a pill's animated style (`tests/pillButterySmooth.test.ts` fails if they come back).
- **Hardware-Accelerated Transform Sliding:** Sliding highlight pills animate exclusively via `translateX` (anchored at `left: 0`) and width, avoiding layout properties (`left`, `top`, `margin`) to guarantee 60/120fps motion without native Yoga relayout passes.
- **Fluid Layout Transitions & State Disclosures (Plans 001–006):**
  - **Onboarding Carousel Dots:** Morph between 8px circle and 28px stadium pill via `withSpring(targetWidth, Motion.springs.settle)` and active opacity interpolation.
  - **Ledger tally (Nov 2026):** the Ledger hero shows what is still owed (Tier A) with a static tally bar under it (paid back / shared, `forestGreen` on the mint card, track at 14%), and every person who still owes repeats it in their row (`mintText` fill on `chartTrack`). People are grouped "Owes you" / "Settled"; each has a `PersonInitial` (`GradientIconBadge`, colour from the name, not from list order). "Settle all" is a compact `AppButton`. The bar never animates: it is a reading, not a celebration.
  - **Split Ledger Accordion:** Smooth 180° chevron rotation (`withTiming(..., 180ms)`) combined with `LinearTransition.duration(180)` card expansion and `FadeIn`/`FadeOut` details reveal.
  - **App Lock Dissolve Exit:** Graceful 180ms dissolve (`opacity: 1 -> 0`, `scale: 1.0 -> 1.03`), unmounting cleanly on UI completion while immediately disabling pointer events.
  - **Dynamic Banner Layout Transitions:** Banners like `AutoLogHomeBanner` employ `LinearTransition.duration(240)` and snappy 180ms `FadeIn`/`FadeOut` to avoid jarring hero card displacement.
  - **Empty State Parity:** Screen empty states (e.g. `NotificationsScreen`) coordinate `opacity: 0 -> 1` and `scale: 0.96 -> 1.0` over 180ms (`Motion.duration.snappy`, `curves.easeOut`).
  - **Modal Spring Settle & Error Disclosure:** Profile dialogs settle with `Motion.springs.settle` (`scale: 0.95 -> 1.0`, `translateY: 12 -> 0`, `opacity: 0 -> 1`), and form validation errors reveal smoothly via `LinearTransition.duration(180)` and `FadeIn.duration(160)`.
- **Hand-made bottom sheets (Cadence Switch, Period Renewal, Vault guard):** one shared motion, `runSheetTransition` (`src/lib/sheetTransition.ts`): open = backdrop fade (220 ms; Vault 200 ms) + sheet spring `Motion.springs.sheet` from below; close = backdrop 160 ms + slide 180 ms on the iOS drawer curve `(0.32, 0.72, 0, 1)`, then unmount; reduce motion = instant. Each sheet passes its own off-screen distance (500 / 450 / 400). New hand-made sheets use it; `BottomSheetModal` keeps its own gesture-driven motion.
- **Hidden popups do no work:** a popup that stays mounted while closed reads full-history store values through `useStoreWhileVisible` (last value while hidden, live value on open), so it never re-renders on background store changes.
- **Pull-to-refresh:** one native Material circle for the whole app (`AppRefreshControl`; Home hosts it through `RefreshScrollShell`). It drops once, spins, and slides up once. All four screens use the same `usePullRefresh` handler (`src/hooks/usePullRefresh.ts`), which keeps the circle on for at least 700 ms and never switches it off or re-configures it while it is refreshing; otherwise the native circle vanishes and pops back (blink).
- **Reduced Motion:** When `useReduceMotion()` (`src/hooks/useReduceMotion.ts`) is true, disable animations and use immediate snapping. It is the one app-wide hook: live (follows the OS setting while the app is open), one shared subscription (`src/lib/reduceMotionStore.ts`), and it starts from the value the system had when the app started, so there is no wrong first frame. Reanimated animations (`withTiming`, `withSpring`) already follow the system setting by default (`reduceMotion: ReduceMotion.System`), so no per-animation option is needed. `SegmentedControl`, `AnimatedToggle`, `useRingSweep` and `SplashScreen` still read Reanimated's `useReducedMotion()` (the same system value at startup). All layout transitions and spring effects bypass animation immediately when reduced motion is enabled.

### Haptics map (OPT-44)
Haptics have a fixed meaning. Never add a haptic to scrolling or to every keypad key (the small keypad of the Vault guard keeps the one it has today).

| Event | Haptic |
|---|---|
| Tab change | `impactAsync(Light)` in `BottomNavBar` (deliberate choice, kept) |
| Pill / segment change, toggle, picker or chip step | `selectionAsync()` |
| Primary button press (+ add) | `impactAsync(Medium)` |
| Save success (expense, deposit, budget, setup) | `notificationAsync(Success)` |
| Blocked action, validation error, guard sheet | `notificationAsync(Warning)` or `(Error)` |
| Destructive confirm (delete) | `impactAsync(Heavy)` once, on confirm |
| Swipe reveal | `impactAsync(Light)` |
Every call ends with `.catch(() => {})`. Save success is wired through `saveSuccessHaptic()` (`src/lib/saveFeedback.ts`) in the expense form (both save paths), the Gullak deposit and the budget save.

### Text that must stay readable (no `...` on important text)
- Amounts never end in `...`: they shrink (`adjustsFontSizeToFit`) first.
- Buttons, dialog buttons, sheet titles and badges: 1 line that shrinks to 85% (`minimumFontScale={0.85}`), never cut.
- Row titles and subtitles (transactions, ledger, notifications, categories, Insights categories): up to 2 lines; the row grows.
- Only fixed-size shapes (pills, nav, keypad) stay at 1 line, capped by `FIXED_SHAPE_MAX_FONT_SCALE`; keep their copy short.
- User-facing errors go through `toFriendlyMessage` (`src/lib/friendlyError.ts`): no database, server or code text on screen.
- Splash shows "Just a moment, still loading..." only after 2.5 s.

---

## 11. Empty, Loading, and Error States

Every data surface must cleanly handle 4 foundational states:
1. **Loading State:** `<Skeleton />` shapes (`colors.cardSubtle`, UI-thread pulse) where content is replaced; `ActivityIndicator` only inside buttons, next to a short label, or for progress of an operation. Avoid full-screen blocking spinners where partial skeleton UI is possible.
2. **Empty State:** always the shared `<EmptyState />` (`src/components/ui/EmptyState.tsx`): `GradientIconBadge` (theme mint) with the icon, a bold title, one muted line (`bodySmall`, max 300dp wide, centred) and an optional compact `AppButton` (`secondary` by default; `primary` only when it is THE action of the screen, e.g. "Add Transaction" on Insights).
   - `size="screen"` when the whole page is empty (72dp badge, 20px title): History, Notifications, Ledger, Automatic Logging Review. A screen empty state at the top of a scrolling list starts `EMPTY_STATE_TOP_OFFSET` (64dp) down.
   - `size="section"` when one card or list inside a page is empty (56dp badge, 18px title): FAQ search, Savings history card, Category Detail list, Insights breakdown.
   - It has no motion of its own; a screen that fades its empty state in (History, Notifications) keeps its own animated wrapper. The small inline "No expenses today" line on Home stays a line of text (it sits inside a compact list, not in place of a page).
3. **Error State:** Non-intrusive alert banner or inline card with retry action.
4. **Offline State:** Persistent non-blocking banner (`OfflineBanner`); all cached items remain readable and interactive.

---

## 12. Strict Anti-Patterns (10 "NEVER" Rules)

1. **NEVER hardcode numeric spacing or font sizes:** Do not use `padding: 17`, `margin: 22`, or `fontSize: 19`.
2. **NEVER use ad-hoc hex colors in screens:** All colors must resolve from `useTheme()` / `src/config/theme.ts`.
3. **NEVER use low-contrast text on pills:** Never put white text on a mint green or peach pill; use `forestGreen`.
4. **NEVER invent new button heights:** Do not use 46px, 50px, 52px or 56px buttons; dialog buttons are 48 (`standard`), sheet and page CTAs are 60 (`cta`). Icon-only buttons (32–48 circles) are geometry, not button heights.
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
- [ ] Buttons follow the two-tier rule (48 in centered dialogs, 60 in sheets and page CTAs); inputs use `ControlHeight.row`.
- [ ] Every tappable element gives press feedback (`AppButton` scale or `PRESS_DIM_OPACITY` dim); pushed pages use `ScreenHeader` (centred 20px title); popups use `useScrimColor()`.
- [ ] Colors come from `useTheme()` and look sharp in **Light, Dark, and AMOLED**.
- [ ] Interactive touch targets are $\ge 44\text{dp}$.
- [ ] Every icon-only button has `accessibilityRole="button"` and an `accessibilityLabel` that says what it does ("Go back", "Close", "Delete transaction"). `tests/ux01IconButtonLabels.test.ts` fails on any touchable without text and without a label (UX-01).
- [ ] Text fields set the keyboard correctly: `autoComplete` for name / email / password, `returnKeyType`, Enter moves to the next field and the last field submits (UX-02).
- [ ] A full-screen backdrop behind a sheet / modal has `accessible={false}` and `importantForAccessibility="no"` (it still closes on tap), and every `Modal` has `onRequestClose` (UX-06).
- [ ] No new hard-coded hex in screens / components: `tests/ux05to08Polish.test.ts` holds the count (484) and only lets it go down. `white`, `forestGreen`, `mint`, `coral` are the same in all three themes; use them instead of the literal (UX-08).
- [ ] A list that sits under a text field has `keyboardShouldPersistTaps="handled"` (first tap works) and `keyboardDismissMode="on-drag"` (UX-03).
- [ ] Sliding controls use `SegmentedControl` with proper contrast.
- [ ] No regression or visual glitches on small screens ($< 360\text{dp}$).

### Bottom Navigation (`BottomNavBar`)
- Look and animation are the original: Budget pill 68dp with a center + (48dp), Pure pill 68dp tall (same height, radius 34, padding 6, tab capsule height 48, and animations as the Budget pill, with width 216dp tailored for 3 tabs without stretching across the screen) with a separate 48dp circular + FAB button (exact same 48dp size as the Budget Mode center add button); per-tab capsule (height 48, `rgba(184,224,200,0.22)` light / `0.16` dark) that fades in, label expanding 0 → room over 180ms, icon cross-fade to `mintGreen`, press scale spring (tension 70, friction 8) to 0.92 (tabs) / 0.88 (add).
- Only SPACING is responsive, from `src/lib/navBarLayout.ts`: bottom gap `max(insetBottom, 12) + 8`; side margin `clamp(width × 0.04, 12, 16)`; bar width `min(width − 2 × margin, 400)`; center slot `clamp(width × 0.16, 56, 68)`; icon-only tab 44 (34 when the wing is short); active label room up to 50, reduced on narrow screens so the active capsule always fits its wing; labels follow the system font up to 1.15x and ellipsize.
- Screens never hard-code bottom padding: use `useNavBarContentInset(extra)`.
