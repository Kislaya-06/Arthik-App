import { describe, it, expect } from 'vitest';
import {
  getVisibleTabs,
  resolveSavingsRoute,
  formatCadenceBudgetSubtitle,
} from '../src/lib/budgetModeUtils';

describe('budgetModeUtils (pure helpers)', () => {
  describe('getVisibleTabs', () => {
    it('returns 3 tabs (Home, History, Insights) when mode is OFF', () => {
      const tabs = getVisibleTabs(false);
      expect(tabs).toEqual(['Home', 'History', 'Insights']);
      expect(tabs).not.toContain('Savings');
    });

    it('returns 4 tabs (Home, History, Savings, Insights) when mode is ON', () => {
      const tabs = getVisibleTabs(true);
      expect(tabs).toEqual(['Home', 'History', 'Savings', 'Insights']);
      expect(tabs).toContain('Savings');
    });
  });

  describe('resolveSavingsRoute', () => {
    it('always routes daily_reminder notification to Home, even when mode is ON', () => {
      expect(resolveSavingsRoute(true, 'daily_reminder')).toBe('Home');
      expect(resolveSavingsRoute(false, 'daily_reminder')).toBe('Home');
    });

    it('routes to Home when mode is OFF for any notification type or undefined', () => {
      expect(resolveSavingsRoute(false)).toBe('Home');
      expect(resolveSavingsRoute(false, 'budget_warning')).toBe('Home');
      expect(resolveSavingsRoute(false, 'budget_exceeded')).toBe('Home');
      expect(resolveSavingsRoute(false, 'savings_rollover')).toBe('Home');
    });

    it('routes to Savings when mode is ON for budget and savings notifications', () => {
      expect(resolveSavingsRoute(true)).toBe('Savings');
      expect(resolveSavingsRoute(true, 'budget_warning')).toBe('Savings');
      expect(resolveSavingsRoute(true, 'budget_exceeded')).toBe('Savings');
      expect(resolveSavingsRoute(true, 'savings_rollover')).toBe('Savings');
    });
  });

  describe('formatCadenceBudgetSubtitle', () => {
    it('returns explanation string when mode is OFF', () => {
      expect(formatCadenceBudgetSubtitle(false, 'daily', 500)).toBe(
        'Track expenses with no limits'
      );
    });

    it('formats cadence and amount correctly when mode is ON', () => {
      expect(formatCadenceBudgetSubtitle(true, 'daily', 500)).toBe('Daily · ₹500');
      expect(formatCadenceBudgetSubtitle(true, 'weekly', 7000)).toBe('Weekly · ₹7,000');
      expect(formatCadenceBudgetSubtitle(true, 'monthly', 30000)).toBe('Monthly · ₹30,000');
    });

    it('returns Set budget when amount is 0 or unconfigured', () => {
      expect(formatCadenceBudgetSubtitle(true, 'weekly', 0)).toBe('Weekly · Set budget');
    });
  });
});
