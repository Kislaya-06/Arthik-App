import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// categoryStore pulls in Supabase / AsyncStorage; only its pure helpers are tested here.
vi.mock('../src/config/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: () => ({ user: null }) },
  registerStoreResetCallback: () => {},
}));
vi.mock('../src/store/networkStore', () => ({ useNetworkStore: { getState: () => ({ isOffline: false }) } }));

import { categoryKindOf, categoriesOfKind, FALLBACK_INCOME_CATEGORY_NAME } from '../src/store/categoryStore';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('Income categories (CAT-004)', () => {
  it('a category without a kind is an expense category (old rows, old cache)', () => {
    expect(categoryKindOf({})).toBe('expense');
    expect(categoryKindOf(null)).toBe('expense');
    expect(categoryKindOf({ kind: 'expense' })).toBe('expense');
    expect(categoryKindOf({ kind: 'income' })).toBe('income');
    expect(categoryKindOf({ kind: 'weird' })).toBe('expense');
  });

  it('categoriesOfKind keeps only one side, in order', () => {
    const cats = [
      { id: 'a' },
      { id: 'b', kind: 'income' },
      { id: 'c', kind: 'expense' },
      { id: 'd', kind: 'income' },
    ];
    expect(categoriesOfKind(cats, 'expense').map((c) => c.id)).toEqual(['a', 'c']);
    expect(categoriesOfKind(cats, 'income').map((c) => c.id)).toEqual(['b', 'd']);
  });

  it('the fallback income category is "Other Income" and is seeded by the migration and schema', () => {
    expect(FALLBACK_INCOME_CATEGORY_NAME).toBe('Other Income');
    const mig = read('supabase/migrations/20261022120000_income_categories.sql');
    const schema = read('schema.sql');
    for (const src of [mig, schema]) {
      expect(src).toMatch(/ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense'/);
      expect(src).toMatch(/CHECK \(kind IN \('expense', 'income'\)\)/);
      for (const name of ['Salary', 'Freelance', 'Interest', 'Gift', 'Other Income']) {
        expect(src).toContain(`'${name}'`);
      }
    }
    // Existing users are seeded only once (safe to run twice).
    expect(mig).toMatch(/WHERE NOT EXISTS \([\s\S]*?c\.kind = 'income'/);
  });

  it('category deletion protection is unchanged (CAT-002): a used category cannot be deleted', () => {
    const src = read('src/screens/ManageCategoriesScreen.tsx');
    expect(src).toMatch(/if \(count > 0\) \{[\s\S]*?"Cannot Delete"/);
  });

  it('Manage Categories shows one side at a time with an Expense | Income toggle', () => {
    const src = read('src/screens/ManageCategoriesScreen.tsx');
    expect(src).toMatch(/<SegmentedControl/);
    expect(src).toMatch(/data=\{visibleCategories\}/);
    expect(src).toMatch(/navigate\('AddEditCategory', \{ kind \}\)/);
  });

  it('a new category is saved with the side it was added from', () => {
    const src = read('src/screens/AddEditCategoryScreen.tsx');
    expect(src).toMatch(/addCategory\(name\.trim\(\), selectedIcon, selectedColor, kind\)/);
  });
});

describe('Review sheet category rules', () => {
  const src = read('src/components/autolog/ReviewSheet.tsx');

  it('has no "None" chip, so a review can always be finished', () => {
    expect(src).not.toMatch(/NoneChipItem/);
    expect(src).not.toMatch(/CircleOff/);
  });

  it('Save stays disabled until a category is chosen (except settle with a person / teach format)', () => {
    expect(src).toMatch(/disabled=\{busy \|\| \(needsAmount && !amount\) \|\| \(!discovery && !categoryId && !pickedPerson\)\}/);
    expect(src).toMatch(/if \(!discovery && !categoryId\) \{\s*setError\('Please select a category\.'\)/);
  });

  it('shows only categories of the chosen side and clears the choice when the side changes', () => {
    expect(src).toMatch(/categoriesOfKind\(categories\.filter\(\(c\) => !c\.isPlaceholder\), type\)/);
    expect(src).toMatch(/if \(k !== type\) setCategoryId\(null\);/);
  });
});
