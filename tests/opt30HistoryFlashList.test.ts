import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('OPT-30/31: FlashList is JS-only and OTA-safe', () => {
  const pkgDir = join(root, 'node_modules/@shopify/flash-list');
  const installed = existsSync(pkgDir);

  it.skipIf(!installed)('installed FlashList has no native android/ios folder', () => {
    expect(existsSync(join(pkgDir, 'android'))).toBe(false);
    expect(existsSync(join(pkgDir, 'ios'))).toBe(false);
  });

  it('FlashList stays pinned as a normal dependency (no new native package added)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies['@shopify/flash-list']).toBe('2.0.2');
  });
});

describe('OPT-30: HistoryScreen behaviour kept after SectionList to FlashList', () => {
  const src = read('src/screens/HistoryScreen.tsx');

  it('scroll-to-top on tab re-tap uses scrollToOffset 0 animated', () => {
    expect(src).toMatch(/listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: true \}\)/);
  });

  it('date jump scrolls to the day header row, animated, view position 0', () => {
    expect(src).toMatch(/scrollToIndex\(\{ index: rowIndex, animated: true, viewPosition: 0 \}\)/);
  });

  it('date jump waits for the day to be mounted, then finishes when rows change', () => {
    expect(src).toMatch(/pendingScrollSectionRef/);
    expect(src).toMatch(/rowIndex >= rowsRef\.current\.length/);
    expect(src).toMatch(/\}, \[rows, tryPendingScroll\]\)/);
    expect(src).toMatch(/Math\.max\(prev, targetIndex \+ 5\)/);
    // a jump that cannot finish is dropped instead of firing later by surprise
    expect(src).toMatch(/pendingScrollExpiresAtRef/);
  });

  it('empty state keeps its full-height, centred layout without flexGrow', () => {
    expect(src).not.toMatch(/flexGrow:\s*1/);
    expect(src).toMatch(/minHeight: Math\.max\(0, listHeight - navBarInset - EMPTY_STATE_TOP_MARGIN\)/);
    expect(src).toMatch(/EMPTY_STATE_TOP_MARGIN = 64/);
    expect(src).toMatch(/marginTop: EMPTY_STATE_TOP_MARGIN/);
    expect(src).toMatch(/onLayout=\{handleListLayout\}/);
  });

  it('re-renders rows when theme or categories change', () => {
    expect(src).toMatch(/extraData=\{listExtraData\}/);
    expect(src).toMatch(/\{ colors, isDark, categoryMap \}/);
  });

  it('keeps bottom padding for the nav bar and the nav-bar scroll hook', () => {
    expect(src).toMatch(/contentContainerStyle=\{\{ paddingBottom: navBarInset \}\}/);
    expect(src).toMatch(/onScroll=\{handleScroll\}/);
  });

  it('still reads rows from the same stores and keeps search, filter and Gullak logic untouched', () => {
    expect(src).toMatch(/debouncedQuery/);
    expect(src).toMatch(/selectedCategoryId/);
    expect(src).toMatch(/isBudgetModeEnabled/);
    expect(src).toMatch(/GullakRowItem/);
  });
});

describe('OPT-31: CategoryDetailScreen uses FlashList', () => {
  const src = read('src/screens/CategoryDetailScreen.tsx');

  it('replaced FlatList with FlashList and keeps the same keys and renderItem', () => {
    expect(src).toMatch(/from '@shopify\/flash-list'/);
    expect(src).toMatch(/<FlashList/);
    expect(src).not.toMatch(/FlatList/);
    expect(src).toMatch(/keyExtractor=\{categoryExpenseKey\}/);
    expect(src).toMatch(/renderItem=\{renderItem\}/);
  });

  it('keeps bottom padding and does not shift when a row is added at the top', () => {
    expect(src).toMatch(/Math\.max\(insets\.bottom, Spacing\.block\) \+ Spacing\.section/);
    expect(src).toMatch(/maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  });

  it('keeps the empty state outside the list and re-renders rows on theme/category change', () => {
    expect(src).toMatch(/categoryExpenses\.length === 0 \?/);
    expect(src).toMatch(/extraData=\{listExtraData\}/);
  });
});
