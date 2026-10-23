/**
 * Floating bottom nav bar — responsive geometry (pure, unit-tested).
 *
 * The bar keeps its original look and animation. This file only decides the SPACING that depends on the phone:
 * the gap above the system navigation, the side margins, the room for the center + button and the room for the
 * active tab's label. The bar, the tab screens' bottom padding and Home's pull-to-history clip line all read the
 * SAME numbers, so nothing is hidden behind the bar and nothing leaves a random gap.
 */

/** Budget-mode pill height (the tallest state; Home's clip line and screen paddings use it). */
export const NAV_BAR_HEIGHT = 68;
/** Pure-mode pill height: same 68dp as budget mode. */
export const NAV_PURE_BAR_HEIGHT = 68;
/** Pure-mode round add button size: same 48dp size as the center add button in budget mode. */
export const NAV_PURE_FAB_SIZE = 48;
export const NAV_PURE_FAB_GAP = 10;
/** Pure-mode 3-tab pill width tailored for 3 tabs (Home, History, Insights). */
export const NAV_PURE_PILL_WIDTH = 216;
export const NAV_MAX_BAR_WIDTH = 400;
/** Padding inside the budget pill (left/right) and the pure pill (both pill styles use 6dp). */
export const NAV_BUDGET_PAD_X = 4;
export const NAV_PURE_PAD_X = 6;
/** Pill border (1dp each side). */
export const NAV_PILL_BORDER = 1;
/** Tab pieces (original design): capsule padding 6 (8 when active), icon 20, gap 4, border 1. */
export const NAV_ICON_BOX = 20;
export const NAV_CAPSULE_BORDER = 1;
export const NAV_INACTIVE_PAD_X = 6;
export const NAV_ACTIVE_PAD_X = 8;
export const NAV_LABEL_MARGIN = 4;
/** Longest label room used by the original design. */
export const NAV_LABEL_MAX = 54;
/** Largest system font scale the labels follow. */
export const NAV_LABEL_MAX_FONT_SCALE = 1.15;
/** Extra breathing room between the last content row and the top of the bar. */
export const NAV_CONTENT_CLEARANCE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface NavBarMetrics {
  barHeight: number;
  pureBarHeight: number;
  /** Distance from the bottom of the screen to the bottom of the pill. */
  bottomGap: number;
  /** Left/right margin of the bar. */
  sideMargin: number;
  /** Outer width of the budget-mode pill. */
  barWidth: number;
  /** Width reserved for the center + button (budget mode). */
  centerSlot: number;
  /** Width of one wing (two tabs) in the budget pill. */
  wingWidth: number;
  /** Minimum width of one tab slot (icon-only). */
  tabMinWidth: number;
  /** Room for the active tab's label in the budget pill / in the pure pill. */
  budgetLabelMax: number;
  pureLabelMax: number;
  /** Width of the pure-mode pill: the whole row minus the round add button and the gap. */
  purePillWidth: number;
}

/** Width a tab takes while active, for a label of `label` points. */
const activeTabWidth = (label: number) =>
  NAV_ACTIVE_PAD_X * 2 + NAV_ICON_BOX + NAV_LABEL_MARGIN + label + NAV_CAPSULE_BORDER * 2;
const inactiveTabWidth = () => NAV_INACTIVE_PAD_X * 2 + NAV_ICON_BOX + NAV_CAPSULE_BORDER * 2;

export function getNavBarMetrics(windowWidth: number, insetBottom: number): NavBarMetrics {
  const width = windowWidth > 0 ? windowWidth : 390;

  // Gesture-nav phones report a small inset, 3-button phones a big one, older phones 0:
  // always the same visible float above whatever the system draws.
  const bottomGap = Math.max(insetBottom || 0, 12) + 8;
  // 16 on normal phones (original), a little less on very small ones.
  const sideMargin = clamp(Math.round(width * 0.04), 12, 16);
  const barWidth = Math.min(width - sideMargin * 2, NAV_MAX_BAR_WIDTH);

  // ── Budget pill: [wing] [center +] [wing] ──
  const content = barWidth - NAV_PILL_BORDER * 2 - NAV_BUDGET_PAD_X * 2;
  // Original 68; narrower phones give the + slot a little less so the wings keep room for the labels.
  const centerSlot = clamp(Math.round(width * 0.16), 56, 68);
  const wingWidth = (content - centerSlot) / 2;
  const SAFETY = 8; // minimum free space around the two tabs of a wing
  // Original icon-only slot is 44 wide; tighten to the capsule's own width when the wing is short.
  let tabMinWidth = 44;
  let budgetLabelMax = wingWidth - tabMinWidth - activeTabWidth(0) - SAFETY;
  if (budgetLabelMax < NAV_LABEL_MAX) {
    tabMinWidth = inactiveTabWidth();
    budgetLabelMax = wingWidth - tabMinWidth - activeTabWidth(0) - SAFETY + 2;
  }
  budgetLabelMax = clamp(Math.floor(budgetLabelMax), 0, NAV_LABEL_MAX);

  // ── Pure pill: three tabs (same 68dp height and tab styling as budget pill) + 48dp round + button ──
  const purePillWidth = Math.round(
    Math.min(NAV_PURE_PILL_WIDTH, barWidth - NAV_PURE_FAB_SIZE - NAV_PURE_FAB_GAP)
  );
  const pureContent = purePillWidth - NAV_PILL_BORDER * 2 - NAV_PURE_PAD_X * 2;
  const pureLabelMax = clamp(
    Math.floor(pureContent - 2 * tabMinWidth - activeTabWidth(0) - 2),
    0,
    NAV_LABEL_MAX
  );

  return {
    barHeight: NAV_BAR_HEIGHT,
    pureBarHeight: NAV_PURE_BAR_HEIGHT,
    bottomGap,
    sideMargin,
    barWidth,
    centerSlot,
    wingWidth,
    tabMinWidth,
    budgetLabelMax,
    pureLabelMax,
    purePillWidth,
  };
}

/** Distance from the bottom of the screen to the TOP edge of the bar (tallest state). */
export function getNavBarTop(m: NavBarMetrics): number {
  return m.bottomGap + m.barHeight;
}

/** Bottom padding a scrolling screen needs so its last row clears the bar. */
export function getNavContentInset(m: NavBarMetrics, extra = 0): number {
  return getNavBarTop(m) + NAV_CONTENT_CLEARANCE + extra;
}
