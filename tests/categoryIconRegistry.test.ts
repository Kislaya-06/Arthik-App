import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'android', select: (objs: any) => objs.android || objs.default },
}));

import { CATEGORY_ICONS } from '../src/lib/categoryIconRegistry';
import { getCategoryIcon } from '../src/lib/iconUtils';

// Mirror of ICONS_GRID in AddEditCategoryScreen.tsx — must stay in sync with category picker
const ICONS_GRID = [
  'Coffee', 'Truck', 'ShoppingBag', 'Video', 'Activity',
  'FileText', 'GraduationCap', 'Send', 'Home', 'ShoppingCart',
  'Move', 'Gift', 'CupSoda', 'Music', 'Users', 'DollarSign',
  'MoreHorizontal'
];

// Mirror of INCOME_ICONS_GRID in AddEditCategoryScreen.tsx — must stay in sync with category picker
const INCOME_ICONS_GRID = [
  'Briefcase', 'Laptop', 'Percent', 'Gift', 'Wallet',
  'TrendingUp', 'Landmark', 'Banknote', 'PiggyBank', 'HandCoins',
  'Coins', 'Store', 'Award', 'Home', 'Users', 'DollarSign',
  'MoreHorizontal'
];

describe('categoryIconRegistry', () => {
  it('resolves every icon in ICONS_GRID to a valid component', () => {
    for (const name of ICONS_GRID) {
      const icon = CATEGORY_ICONS[name];
      expect(icon, `Icon "${name}" from ICONS_GRID must be registered in CATEGORY_ICONS`).toBeDefined();
      expect(typeof icon === 'function' || typeof icon === 'object').toBe(true);
    }
  });

  it('resolves every icon in INCOME_ICONS_GRID to a valid component', () => {
    for (const name of INCOME_ICONS_GRID) {
      const icon = CATEGORY_ICONS[name];
      expect(icon, `Icon "${name}" from INCOME_ICONS_GRID must be registered in CATEGORY_ICONS`).toBeDefined();
      expect(typeof icon === 'function' || typeof icon === 'object').toBe(true);
    }
  });

  it('resolves every seeded and live database category icon to a valid component', () => {
    const dbIcons = [
      'DollarSign',
      'Car',
      'ShoppingBag',
      'Briefcase',
      'Utensils',
      'Gift',
      'Film',
      'Wallet',
      'Percent',
      'Laptop',
      'FileText',
      'HeartPulse',
      'Users',
      'Send',
    ];

    for (const name of dbIcons) {
      const icon = CATEGORY_ICONS[name];
      expect(icon, `Icon "${name}" from database must be registered in CATEGORY_ICONS`).toBeDefined();
    }
  });

  it('getCategoryIcon returns the registered icon or falls back to HelpCircle', () => {
    const utensils = getCategoryIcon('Utensils');
    expect(utensils).toBe(CATEGORY_ICONS.Utensils);

    const fallback = getCategoryIcon('UnknownIconThatDoesNotExist');
    expect(fallback).toBe(CATEGORY_ICONS.HelpCircle);
  });
});
