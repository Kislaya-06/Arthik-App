import { describe, it, expect } from 'vitest';
import {
  getNavBarMetrics,
  getNavBarTop,
  getNavContentInset,
  NAV_BAR_HEIGHT,
  NAV_CONTENT_CLEARANCE,
  NAV_LABEL_MAX,
  NAV_PURE_BAR_HEIGHT,
  NAV_PURE_FAB_GAP,
  NAV_ACTIVE_PAD_X,
  NAV_ICON_BOX,
  NAV_LABEL_MARGIN,
  NAV_CAPSULE_BORDER,
  NAV_INACTIVE_PAD_X,
} from '../src/lib/navBarLayout';

const activeW = (label: number) =>
  NAV_ACTIVE_PAD_X * 2 + NAV_ICON_BOX + NAV_LABEL_MARGIN + label + NAV_CAPSULE_BORDER * 2;
const inactiveW = NAV_INACTIVE_PAD_X * 2 + NAV_ICON_BOX + NAV_CAPSULE_BORDER * 2;

const WIDTHS = [320, 360, 375, 393, 412, 430, 600, 1024];

describe('navBarLayout — responsive spacing (original look and animation kept)', () => {
  it('keeps the original pill heights', () => {
    const m = getNavBarMetrics(390, 0);
    expect(m.barHeight).toBe(68);
    expect(m.pureBarHeight).toBe(58);
  });

  it('floats the same visible distance above any system navigation', () => {
    expect(getNavBarMetrics(390, 0).bottomGap).toBe(20); // no inset (old phones)
    expect(getNavBarMetrics(390, 16).bottomGap).toBe(24); // gesture nav
    expect(getNavBarMetrics(390, 24).bottomGap).toBe(32);
    expect(getNavBarMetrics(390, 48).bottomGap).toBe(56); // 3-button nav
  });

  it('uses the original 16dp side margin on normal phones, a little less on tiny ones', () => {
    expect(getNavBarMetrics(390, 0).sideMargin).toBe(16);
    expect(getNavBarMetrics(412, 0).sideMargin).toBe(16);
    expect(getNavBarMetrics(300, 0).sideMargin).toBe(12);
  });

  it('caps the bar at 400dp on tablets', () => {
    expect(getNavBarMetrics(1024, 0).barWidth).toBe(400);
  });

  it('normal phones keep the original 68dp center slot, 44dp tabs and 50dp label room', () => {
    const m = getNavBarMetrics(430, 0);
    expect(m.centerSlot).toBe(68);
    expect(m.tabMinWidth).toBe(44);
    expect(m.budgetLabelMax).toBe(NAV_LABEL_MAX);
  });

  it('content inset = bar top + clearance (+ extra)', () => {
    const m = getNavBarMetrics(390, 24);
    expect(getNavBarTop(m)).toBe(32 + NAV_BAR_HEIGHT);
    expect(getNavContentInset(m)).toBe(32 + NAV_BAR_HEIGHT + NAV_CONTENT_CLEARANCE);
    expect(getNavContentInset(m, 20)).toBe(32 + NAV_BAR_HEIGHT + NAV_CONTENT_CLEARANCE + 20);
  });

  it('falls back to a sane width when the window is not measured yet', () => {
    expect(getNavBarMetrics(0, 0).barWidth).toBe(getNavBarMetrics(390, 0).barWidth);
  });

  it.each(WIDTHS)('budget wing never overflows at %idp wide (active tab + icon-only tab fit)', (w) => {
    const m = getNavBarMetrics(w, 24);
    const needed = Math.max(m.tabMinWidth, inactiveW) + activeW(m.budgetLabelMax);
    expect(needed).toBeLessThanOrEqual(m.wingWidth);
    // and a useful label room remains on every real phone
    if (w >= 360) expect(m.budgetLabelMax).toBeGreaterThanOrEqual(40);
  });

  it.each(WIDTHS)('pure pill + add button fit the row at %idp wide', (w) => {
    const m = getNavBarMetrics(w, 24);
    expect(m.purePillWidth + NAV_PURE_FAB_GAP + NAV_PURE_BAR_HEIGHT).toBeLessThanOrEqual(m.barWidth);
    expect(m.pureLabelMax).toBeLessThanOrEqual(NAV_LABEL_MAX);
  });
});
