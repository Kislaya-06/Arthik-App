import { describe, it, expect } from 'vitest';
import {
  MONEY_EXPLAINER_DATA,
  getMoneyExplainerContent,
  MoneyExplainerTopic,
} from '../src/lib/moneyExplainerContent';

describe('moneyExplainerContent', () => {
  const topics: MoneyExplainerTopic[] = [
    'cadence_switch',
    'budget_pause',
    'deposit_sources',
    'rollover_savings',
    'pure_mode_balance',
  ];

  it('provides comprehensive explainer content for all 5 core money topics', () => {
    for (const t of topics) {
      const data = MONEY_EXPLAINER_DATA[t];
      expect(data).toBeDefined();
      expect(data.topic).toBe(t);
      expect(data.title.length).toBeGreaterThan(5);
      expect(data.subtitle.length).toBeGreaterThan(10);
      expect(data.items.length).toBeGreaterThanOrEqual(3);
      expect(data.footerTip.length).toBeGreaterThan(10);

      for (const item of data.items) {
        expect(item.tag.length).toBeGreaterThan(0);
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.iconName).toBeDefined();
      }
    }
  });

  it('getMoneyExplainerContent returns accurate topic data', () => {
    const cadenceContent = getMoneyExplainerContent('cadence_switch');
    expect(cadenceContent.title).toContain('Budget Cycle');

    const sourcesContent = getMoneyExplainerContent('deposit_sources');
    expect(sourcesContent.title).toContain('Deposit Sources');

    const pureContent = getMoneyExplainerContent('pure_mode_balance');
    expect(pureContent.title).toContain('Balance is Calculated');
  });

  it('falls back gracefully to cadence_switch if unknown topic passed', () => {
    // @ts-expect-error testing fallback
    const fallback = getMoneyExplainerContent('unknown_topic');
    expect(fallback).toBeDefined();
    expect(fallback.topic).toBe('cadence_switch');
  });
});
