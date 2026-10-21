import { describe, it, expect } from 'vitest';
import {
  getNavBarMetrics,
  getNavBarTop,
  getNavContentInset,
  layoutNavTabGroup,
  getPurePillWidth,
  expandedTabWidth,
  NAV_TAB_COLLAPSED,
  NAV_TAB_COLLAPSED_MIN,
  NAV_CONTENT_CLEARANCE,
} from '../src/lib/navBarLayout';

describe('navBarLayout — responsive geometry', () => {
  it('keeps the same visible float above any system navigation', () => {
    expect(getNavBarMetrics(390, 0).bottomGap).toBe(20); // no inset (old phones)
    expect(getNavBarMetrics(390, 16).bottomGap).toBe(24); // gesture nav
    expect(getNavBarMetrics(390, 48).bottomGap).toBe(56); // 3-button nav
  });

  it('scales the pill height with the screen, within 60..68', () => {
    expect(getNavBarMetrics(320, 0).barHeight).toBe(60);
    expect(getNavBarMetrics(390, 0).barHeight).toBe(63);
    expect(getNavBarMetrics(480, 0).barHeight).toBe(68);
  });

  it('adds room for large system fonts but caps the label scale', () => {
    const m = getNavBarMetrics(390, 0, 2);
    expect(m.labelScale).toBe(1.2);
    expect(m.barHeight).toBe(67);
  });

  it('caps the bar width on tablets and keeps side margins', () => {
    const phone = getNavBarMetrics(360, 0);
    expect(phone.barWidth).toBe(360 - phone.sideMargin * 2);
    expect(getNavBarMetrics(1024, 0).barWidth).toBe(440);
  });

  it('content inset = bar top + clearance (+ extra)', () => {
    const m = getNavBarMetrics(390, 24);
    expect(getNavBarTop(m)).toBe(32 + 63);
    expect(getNavContentInset(m)).toBe(32 + 63 + NAV_CONTENT_CLEARANCE);
    expect(getNavContentInset(m, 20)).toBe(32 + 63 + NAV_CONTENT_CLEARANCE + 20);
  });

  it('falls back to a sane width when the window is not measured yet', () => {
    expect(getNavBarMetrics(0, 0).barHeight).toBe(63);
  });
});

describe('navBarLayout — tab group layout', () => {
  it('grows only the active tab and keeps every tab inside the group', () => {
    const slots = layoutNavTabGroup(150, [30, 40], 1);
    expect(slots[0].width).toBeLessThanOrEqual(NAV_TAB_COLLAPSED);
    expect(slots[0].width).toBeGreaterThanOrEqual(NAV_TAB_COLLAPSED_MIN);
    expect(slots[0].showLabel).toBe(false);
    expect(slots[1].showLabel).toBe(true);
    const last = slots[slots.length - 1];
    expect(last.x + last.width).toBeLessThanOrEqual(150 + 1e-9);
  });

  it('spaces tabs evenly (equal gaps, edges included)', () => {
    const slots = layoutNavTabGroup(200, [30, 30], 0);
    const g1 = slots[0].x;
    const g2 = slots[1].x - (slots[0].x + slots[0].width);
    const g3 = 200 - (slots[1].x + slots[1].width);
    expect(g1).toBeCloseTo(g2);
    expect(g2).toBeCloseTo(g3);
  });

  it('shortens a long label instead of overflowing', () => {
    const slots = layoutNavTabGroup(140, [20, 80], 1);
    expect(slots[1].showLabel).toBe(true);
    expect(slots[1].labelWidth).toBeLessThan(80);
    expect(slots[1].x + slots[1].width).toBeLessThanOrEqual(140);
  });

  it('fits a full "Insights" label in a 360dp budget wing by tightening neighbours', () => {
    const m = getNavBarMetrics(360, 0);
    const wing = (m.barWidth - 8 - m.centerSlot) / 2;
    const slots = layoutNavTabGroup(wing, [38, 45], 1);
    expect(slots[1].labelWidth).toBe(45);
    expect(slots[1].x + slots[1].width).toBeLessThanOrEqual(wing + 1e-9);
  });

  it('drops the label (icon-only highlight) on very narrow groups', () => {
    const slots = layoutNavTabGroup(110, [20, 48], 1);
    expect(slots[1].showLabel).toBe(false);
    expect(slots[1].width).toBe(NAV_TAB_COLLAPSED);
  });

  it('no active tab → all icon-only', () => {
    const slots = layoutNavTabGroup(200, [30, 30, 30], -1);
    expect(slots.every((s) => !s.showLabel && s.width === NAV_TAB_COLLAPSED)).toBe(true);
  });

  it('pure pill fits the longest label and never collides with the add button', () => {
    const m = getNavBarMetrics(390, 0);
    const w = getPurePillWidth(m, [34, 42, 46]);
    expect(w).toBeGreaterThanOrEqual(2 * NAV_TAB_COLLAPSED + expandedTabWidth(46));
    expect(w + m.fabSize + 10).toBeLessThanOrEqual(m.barWidth);
    const tiny = getNavBarMetrics(300, 0);
    expect(getPurePillWidth(tiny, [200, 200, 200]) + tiny.fabSize + 10).toBeLessThanOrEqual(tiny.barWidth);
  });
});
