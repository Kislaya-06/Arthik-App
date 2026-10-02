# Arthik Design System & Fintech UI Consistency Rules

> Purpose: keep every Arthik screen visually and behaviorally consistent while preserving the app's existing premium, calm, non-boxy design language.
>
> Source of truth should be centralized in `src/config/theme.ts` and reusable primitives/components. This document explains semantic usage; it should not duplicate values that can drift unless intentionally documented.

## 1. Core Principles

1. **Consistency over one-off polish** — the same role must look and behave the same everywhere.
2. **Semantic tokens, not magic numbers** — use role-based spacing, type, radius, control, color, icon, and motion tokens.
3. **Financial hierarchy first** — the most important amount gets the strongest emphasis; supporting values step down consistently.
4. **Premium, not boxy** — use whitespace, typography, alignment, subtle surfaces, and progressive disclosure before adding another card/border.
5. **One visual language across themes** — Light, Dark, and AMOLED may change colors, never hierarchy or component anatomy.
6. **Reusable primitives before screen-specific styles** — recurring patterns belong in shared components/tokens.
7. **Accessibility is part of the design system** — minimum 44dp touch targets, readable contrast, scalable text, clear states.

## 2. Screen Layout System

### Screen gutters
- All standard screens use one canonical horizontal gutter token.
- Full-bleed visuals are explicit exceptions.
- Nested sections must not invent new left/right padding unless the component has a documented inset role.

### Vertical rhythm
Use semantic spacing roles consistently:
- micro gaps: icon/label or tightly related metadata
- element gaps: related inline items
- group gaps: items belonging to the same block
- block gaps: form or content blocks
- section gaps: major screen sections

Rules:
- The same relationship uses the same spacing role across all screens.
- Avoid arbitrary values such as 17, 19, 23 unless geometry genuinely requires them.
- Do not double-pad a card and its child content unnecessarily.

### Section anatomy
A standard section should follow:
`section heading -> optional helper/action -> content -> section spacing`

Section headers should align to the same screen gutter and baseline rules.

## 3. Typography System

Use semantic text roles instead of choosing font sizes per screen.

Recommended roles:
- `displayAmount` — hero balance / total spent / major financial outcome
- `primaryAmount` — important card value / remaining budget / total saved
- `secondaryAmount` — row totals / category amounts / supporting financial values
- `compactAmount` — small summaries, badges, chart annotations
- `screenTitle`
- `sectionTitle`
- `cardTitle`
- `body`
- `bodySmall`
- `label`
- `caption`
- `micro`

### Weight rules
- Amount emphasis comes from role + size first; avoid using bold everywhere.
- Screen and section hierarchy must be predictable.
- Secondary/meta text should not compete with primary financial values.

### Line-height rules
Every semantic text role should define font size, line height, and weight together.
Do not rely on platform-default line heights for high-frequency UI roles.

## 4. Financial Number Hierarchy

Financial digits must follow consistent roles across the entire app.

### Tier A — Hero financial amount
Use for:
- total balance
- total spent in selected period
- total savings / Gullak total
- primary financial outcome on a screen

Only one Tier A amount should normally dominate a viewport/hero region.

### Tier B — Primary contextual amount
Use for:
- remaining budget
- available balance in a major card
- monthly/weekly summary values
- net cash flow

### Tier C — Row / analytical amount
Use for:
- transaction amounts
- category totals
- income/outflow breakdowns
- insight values

### Tier D — Compact supporting amount
Use for:
- percentage change
- chart labels
- dates paired with amounts
- small badges / helper metrics

### Currency formatting
- Always use the shared formatter (`formatCurrency` / `formatAmountWithCommas`).
- Keep Indian digit grouping consistent.
- Define one rule for decimals: hide unnecessary `.00`; retain meaningful paise where entered/calculated.
- Negative values use a single canonical sign format.
- Positive inflows use a consistent optional `+` convention.
- Currency symbol and digits must use one alignment rule everywhere.
- Never abbreviate values (`1.2K`, `2.3L`) unless a dedicated compact-display rule is explicitly approved.

### Numeric alignment
- Where numbers are compared vertically (tables, analytics, transaction columns), use end alignment.
- Prefer tabular numerals where the active font/platform supports them reliably.
- Never mix different number font sizes for the same semantic role across screens.

## 5. Buttons & Interactive Controls

Define and reuse button variants:
- Primary
- Secondary
- Tertiary / text
- Destructive
- Icon-only
- Segmented-control item / pill

For each variant centralize:
- height
- horizontal padding
- radius
- typography
- icon size
- icon-to-label gap
- pressed state
- disabled state
- loading state

Rules:
- Primary CTA height must be identical everywhere unless a documented compact variant is used.
- Do not create screen-specific button heights.
- Icon-only controls must have at least a 44dp hit area even if the visual icon is smaller.
- Destructive actions use a consistent confirmation and color language.

## 6. Inputs & Forms

Standardize:
- field height
- border/radius
- internal horizontal padding
- label spacing
- helper/error spacing
- prefix/suffix placement
- focus state
- error state
- disabled state
- amount-input typography

Amount inputs should use the same numeric hierarchy and formatter behavior throughout the app.

## 7. Cards, Surfaces & Containers

Define surface roles:
- Hero surface
- Standard card
- Subtle grouped surface
- Bottom sheet / modal surface
- Inline highlight surface

Rules:
- Do not wrap every section in a card.
- Avoid cards-inside-cards unless the nested surface represents a distinct interaction/state.
- Borders and shadows are semantic, not decorative.
- Card padding must come from tokens.
- Corner radius is role-based, not chosen per screen.
- Dark/AMOLED surfaces should maintain hierarchy without relying on heavy borders.

## 8. Icons & Badges

Standardize icon roles:
- micro/status icon
- row icon
- feature icon
- hero icon
- navigation icon

Rules:
- Use `GradientIconBadge` for category, feature, transaction and Gullak icon badges where existing app rules require it.
- Maintain one icon-size scale.
- Maintain one icon-to-text gap scale.
- Do not create ad-hoc flat icon circles when a shared badge exists.
- Semantic colors (income, expense, warning, danger, success) must be consistent.

## 9. Navigation & Segmented Controls

### 9.1 Canonical Primitives
- `<SegmentedControl />` (`src/components/ui/SegmentedControl.tsx`): Standard fixed-count toggle across screens, modals, and form rows.
- `<BouncyCategoryFilter />` (`src/components/BouncyCategoryFilter.tsx`): Horizontal scrollable category chip filter with direct-manipulation scroll agency.

### 9.2 Container Heights (Design Language Invariant)
- **Screen / Tab / Modal Filters (`HistoryScreen`, `SavingsScreen`, `InsightsScreen`, `ProfileScreen`, `BudgetEditModal`, `BouncyFilterToggle`):** Must strictly and uniformly use `ControlHeight.standard` (`48px`) across the entire application. Legacy 44px or arbitrary heights are strictly prohibited.
- **Form-Level Controls (`BouncyTypeToggle`, `BouncyPaymentToggle`):** Must strictly use `ControlHeight.row` (`56px`), precisely matching standard input container heights and the Date Picker trigger button.

### 9.3 Surface & Border Consistency
- **Container Styling:** Strictly uses `colors.cardSubtle` (`#1A263B` in Dark, `#121212` in AMOLED, `#F1F5F9` in Light) with border `colors.borderSubtle`. Never use `colors.card` or raw pitch-black for pill containers; pills must maintain a unified, elevated grayish surface across all themes. In form contexts, use `colors.inputBg`.
- **Container Radius & Clipping:** Radius `BorderRadius.pill`, padding `Spacing.micro` (4px), inner track `overflow: 'hidden'` to guarantee the sliding highlight never bleeds outside the container bounds.

### 9.4 Text & Active Pill Contrast
- **Active Pill Background:** `colors.mintGreen` (default) or `colors.peachCoral`.
- **Active Text:** Must always use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold` on both mint and peach pills. **Never use `colors.coral`, `textPrimary`, or foreground matching the active pill background.**
- **Inactive Text:** Strictly `colors.textSecondary` + `FontFamily.medium`.

### 9.5 Apple Dual-Edge Liquid Morph Animation
- **Primary Slide:** Apple WWDC-calibrated critically damped spring (`tension: 100, friction: 16`) — zero overshoot outside container bounds.
- **Leading-Edge Liquid Morph:** Direction-aware forward pull (`leadAnim`) + distance-scaled horizontal stretch (`scaleX: 1.08–1.28`) and subtle vertical volume squish (`scaleY: 0.96–0.88`) during flight, snapping smoothly into resting stadium geometry upon arrival.
- **Press Animation:** Per-item scale `0.93–0.94` on `onPressIn`, spring back `friction: 4` on `onPressOut`.

### 9.6 Direct-Manipulation Touch Agency
- In scrollable filters (`BouncyCategoryFilter`), tapping a category item must NEVER trigger automatic `scrollTo`. The user retains complete direct-manipulation agency to scroll manually, while the highlight pill glides fluidly to the tapped option.

## 10. Charts & Analytics

Standardize:
- chart track color
- stroke widths
- bar widths/radii
- legend typography
- legend spacing
- tooltip anatomy
- axis label typography
- positive/negative colors
- empty states
- selected state

Rules:
- Same category color = same category everywhere.
- Same semantic direction color everywhere (income/positive vs expense/negative).
- Charts must not invent local typography.
- Chart labels follow compact financial-number roles.
- Avoid chart decoration that does not communicate information.

## 11. Status, Feedback & Semantic Colors

Define consistent semantic roles:
- positive / success
- expense / negative
- warning
- danger
- neutral
- informational
- disabled

Use the same semantic meaning everywhere; do not reuse a warning color decoratively.

Standardize:
- success feedback
- error messages
- inline warnings
- budget exceeded state
- budget safe/within-range state
- loading skeletons/spinners
- empty states

## 12. Modals, Bottom Sheets & Confirmations

Standardize:
- sheet radius
- internal padding
- title role
- body role
- action spacing
- drag handle
- backdrop
- button ordering

Use the least intrusive pattern:
- inline text for small explanations
- info sheet for contextual education
- confirmation dialog/sheet only for consequential actions

## 13. Lists & Transaction Rows

Standardize:
- row minimum height
- vertical padding
- leading icon size
- title/subtitle gap
- amount alignment
- divider inset
- date grouping
- swipe/action behavior

Transaction amount typography should not change from Home to History to Details unless the semantic role changes.

## 14. Empty, Loading, Error & Offline States

Every reusable data surface should define:
- loading
- empty
- partial-data
- error
- offline/stale-data

Typography, icon scale, action style, and spacing should be shared.

## 15. Motion

Centralize:
- standard duration(s)
- easing / spring presets
- enter/exit patterns
- press feedback
- chart transitions
- sheet/modal transitions

Rules:
- motion communicates state or hierarchy; it is not decoration.
- respect reduced-motion preferences where supported.

## 16. Accessibility

- Touch targets >= 44dp.
- Test text scaling / dynamic font where supported.
- Ensure readable contrast in Light, Dark, AMOLED.
- Do not communicate financial meaning by color alone.
- Use accessible labels for icon-only actions.
- Charts should expose meaningful textual summaries.

## 17. Component Primitives to Prefer

Create/reuse shared primitives when a pattern appears repeatedly:
- `ScreenContainer`
- `SectionHeader`
- `AppText` / semantic typography variants
- `AmountText` with semantic amount variants
- `AppButton`
- `IconButton`
- `AppInput`
- `SegmentedControl`
- `Surface` / `Card`
- `StatusBadge`
- `GradientIconBadge`
- `EmptyState`
- `FeedbackBanner`
- standardized sheet/modal shell

Do not build wrappers solely for abstraction; create primitives only for truly repeated semantic patterns.

## 18. Token Governance

`src/config/theme.ts` is the runtime source of truth.

Before introducing a new literal:
1. Search for an existing semantic token.
2. If the same role appears repeatedly, add or rename a semantic token.
3. If it is one-off geometry, keep it local and document why if non-obvious.

Never add a token only because two unrelated values happen to share the same number.

When token names are misleading, perform a semantic migration rather than a mechanical rename.

## 19. Design-System Definition of Done

A screen/change is complete only when:
- no unjustified spacing literals were introduced
- typography uses semantic roles
- financial values use approved amount tiers
- buttons/inputs use shared variants
- colors come from theme/semantic tokens
- chart/category colors are consistent
- Light, Dark, AMOLED are checked
- 44dp hit targets are respected
- no unnecessary new card/container was added
- existing shared components were reused where appropriate
- no visually equivalent components use different dimensions without a documented reason

## 20. Audit Checklist

For each screen, inventory and compare:
- screen gutter
- section spacing
- card padding/radius
- button height/radius/type
- input height/radius/type
- screen title / section title / body / caption roles
- Tier A/B/C/D financial amounts
- currency formatting
- icon size + badge size
- segmented controls
- row anatomy
- chart typography and legend
- modal/sheet anatomy
- semantic colors
- loading/empty/error states
- accessibility hit areas
- light/dark/AMOLED behavior

Any deviation must be either fixed or recorded as an intentional exception.
