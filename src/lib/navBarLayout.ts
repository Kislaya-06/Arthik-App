/**
 * Floating bottom nav bar — responsive geometry (pure, unit-tested).
 *
 * Every size of the nav bar is derived here from the phone: screen width, bottom safe-area inset and the user's
 * font scale. The bar, the screens' bottom padding and Home's pull-to-history clip line all read the SAME
 * numbers, so nothing is ever hidden behind the bar and nothing leaves a random gap.
 *
 * Tab layout: inside a pill, inactive tabs are icon-only slots (TAB_COLLAPSED wide) and the active tab grows to
 * fit its label. Widths and positions are computed here up front, so the bar can animate positions with
 * transforms on the UI thread and never re-run layout (no pushing / jitter of neighbours).
 */

export const NAV_TAB_COLLAPSED = 40; // icon-only tab (touch target is extended with hitSlop)
/** Icon-only tabs may tighten down to this so the active label fits on narrow phones. */
export const NAV_TAB_COLLAPSED_MIN = 34;
export const NAV_TAB_PAD_X = 10; // capsule padding left/right of its content
export const NAV_ICON_SIZE = 20;
export const NAV_ICON_LABEL_GAP = 4;
export const NAV_LABEL_FONT_SIZE = 11.5;
/** Labels never scale past this, so a large system font can not break the bar. */
export const NAV_LABEL_MAX_FONT_SCALE = 1.2;
/** Below this many points of room the label is dropped and the active tab is highlighted icon-only. */
export const NAV_MIN_LABEL_WIDTH = 26;
export const NAV_MIN_GAP = 3;
export const NAV_PILL_PAD_X = 4;
export const NAV_MAX_BAR_WIDTH = 440;
/** Gap between the pure-mode tab pill and its round add button. */
export const NAV_PURE_FAB_GAP = 10;
/** Extra breathing room between the last content row and the top of the bar. */
export const NAV_CONTENT_CLEARANCE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface NavBarMetrics {
  /** Height of the pill (both modes use the same height, so switching mode never jumps). */
  barHeight: number;
  /** Distance from the bottom of the screen to the bottom of the pill. */
  bottomGap: number;
  /** Left/right margin of the bar. */
  sideMargin: number;
  /** Width of the budget-mode pill / the whole pure-mode row. */
  barWidth: number;
  /** Highlight capsule height inside the pill. */
  capsuleHeight: number;
  /** Center add button (budget mode). */
  addSize: number;
  /** Width reserved for the center add button (budget mode). */
  centerSlot: number;
  /** Round add button next to the pill (pure mode). */
  fabSize: number;
  /** Label font scale actually used (system font scale, capped). */
  labelScale: number;
}

export function getNavBarMetrics(windowWidth: number, insetBottom: number, fontScale = 1): NavBarMetrics {
  const width = windowWidth > 0 ? windowWidth : 390;
  const labelScale = clamp(fontScale || 1, 1, NAV_LABEL_MAX_FONT_SCALE);
  const sideMargin = clamp(Math.round(width * 0.035), 10, 18);
  const barHeight = clamp(Math.round(width * 0.162), 60, 68) + (labelScale > 1.1 ? 4 : 0);
  // Gesture-nav phones report a small inset, 3-button phones a big one, older phones 0.
  // Always the same visible float above whatever the system draws.
  const bottomGap = Math.max(insetBottom || 0, 12) + 8;
  const barWidth = Math.min(width - sideMargin * 2, NAV_MAX_BAR_WIDTH);
  const capsuleHeight = barHeight - 22;
  const addSize = barHeight - 18;
  return {
    barHeight,
    bottomGap,
    sideMargin,
    barWidth,
    capsuleHeight,
    addSize,
    centerSlot: addSize + 12,
    fabSize: barHeight,
    labelScale,
  };
}

/** Distance from the bottom of the screen to the TOP edge of the bar. */
export function getNavBarTop(m: NavBarMetrics): number {
  return m.bottomGap + m.barHeight;
}

/** Bottom padding a scrolling screen needs so its last row clears the bar. */
export function getNavContentInset(m: NavBarMetrics, extra = 0): number {
  return getNavBarTop(m) + NAV_CONTENT_CLEARANCE + extra;
}

/** Full width of an active tab whose label is `labelWidth` wide. */
export function expandedTabWidth(labelWidth: number): number {
  return NAV_TAB_PAD_X * 2 + NAV_ICON_SIZE + NAV_ICON_LABEL_GAP + labelWidth;
}

/** Fallback label width until the real text has been measured. */
export function estimateLabelWidth(label: string, labelScale = 1): number {
  return Math.ceil(label.length * 6.6 * labelScale);
}

export interface NavTabSlot {
  /** Left edge inside the group. */
  x: number;
  width: number;
  showLabel: boolean;
  /** Room given to the label (0 when hidden). */
  labelWidth: number;
}

/**
 * Lays out a group of tabs inside `groupWidth`: the active one grows to fit its label, the others stay icon-only,
 * and the free space is shared as equal gaps (space-evenly). If the label does not fit, it is shortened; if even
 * a short label does not fit, the active tab is highlighted icon-only.
 */
export function layoutNavTabGroup(groupWidth: number, labelWidths: number[], activeIndex: number): NavTabSlot[] {
  const n = labelWidths.length;
  if (n === 0) return [];
  const fixed = NAV_TAB_PAD_X * 2 + NAV_ICON_SIZE + NAV_ICON_LABEL_GAP;
  let collapsed = NAV_TAB_COLLAPSED;
  const labels = labelWidths.map(() => 0);
  let activeWidth = collapsed;

  if (activeIndex >= 0 && activeIndex < n) {
    const want = Math.max(0, labelWidths[activeIndex]);
    const gaps = (n + 1) * NAV_MIN_GAP;
    // Tighten the icon-only neighbours (never below NAV_TAB_COLLAPSED_MIN) if that lets the full label fit.
    if (n > 1) {
      const fitCollapsed = (groupWidth - gaps - fixed - want) / (n - 1);
      collapsed = clamp(Math.floor(fitCollapsed), NAV_TAB_COLLAPSED_MIN, NAV_TAB_COLLAPSED);
    }
    const room = Math.max(0, groupWidth - (n - 1) * collapsed - gaps - fixed);
    if (want > 0 && room >= Math.min(want, NAV_MIN_LABEL_WIDTH)) {
      labels[activeIndex] = Math.min(want, room);
      activeWidth = fixed + labels[activeIndex];
    } else {
      collapsed = NAV_TAB_COLLAPSED; // no label: plain icon-only highlight, normal spacing
      activeWidth = collapsed;
    }
  }

  const widths = labelWidths.map((_, i) => (i === activeIndex ? activeWidth : collapsed));
  const used = widths.reduce((a, b) => a + b, 0);
  const gap = Math.max(0, (groupWidth - used) / (n + 1));
  const slots: NavTabSlot[] = [];
  let x = gap;
  for (let i = 0; i < n; i++) {
    slots.push({ x, width: widths[i], showLabel: labels[i] > 0, labelWidth: labels[i] });
    x += widths[i] + gap;
  }
  return slots;
}

/**
 * Width of the pure-mode tab pill: wide enough for the longest label as the active tab (so the pill never changes
 * size when you switch tabs), never wider than the row allows next to the add button.
 */
export function getPurePillWidth(m: NavBarMetrics, labelWidths: number[]): number {
  const longest = labelWidths.length ? Math.max(...labelWidths) : 0;
  const n = labelWidths.length;
  const ideal = (n - 1) * NAV_TAB_COLLAPSED + expandedTabWidth(longest) + (n + 1) * 8 + NAV_PILL_PAD_X * 2;
  const max = m.barWidth - m.fabSize - NAV_PURE_FAB_GAP;
  return Math.round(Math.min(ideal, max));
}
