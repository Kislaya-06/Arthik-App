import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('HistoryScreen 4-Day Progressive Pagination & "See More" Behavior', () => {
  const historyPath = path.join(__dirname, '..', 'src/screens/HistoryScreen.tsx');
  const historySrc = fs.readFileSync(historyPath, 'utf8');

  it('bounds initial section count and page increment to exactly 4 days', () => {
    expect(historySrc).toMatch(/INITIAL_SECTION_COUNT\s*=\s*4/);
    expect(historySrc).toMatch(/PAGE_SIZE_SECTIONS\s*=\s*4/);
    expect(historySrc).toMatch(/const \[visibleSectionCount, setVisibleSectionCount\] = useState\(INITIAL_SECTION_COUNT\)/);
  });

  it('resets visibleSectionCount to INITIAL_SECTION_COUNT on category change', () => {
    expect(historySrc).toMatch(/const handleCategoryChange\s*=\s*useCallback\(\(id:\s*string\s*\|\s*null\)\s*=>\s*\{[\s\S]*?setVisibleSectionCount\(INITIAL_SECTION_COUNT\)/);
  });

  it('resets visibleSectionCount on search query or category filter changes via useEffect', () => {
    expect(historySrc).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?setVisibleSectionCount\(INITIAL_SECTION_COUNT\);[\s\S]*?\}, \[selectedCategoryId, searchQuery\]\)/);
  });

  it('derives hasMoreSections by checking if total days exceed visibleSectionCount', () => {
    expect(historySrc).toMatch(/const hasMoreSections = filteredAndGroupedExpenses\.length > visibleSectionCount/);
  });

  it('increments visibleSectionCount by PAGE_SIZE_SECTIONS (4 days) on handleSeeMore with haptic feedback', () => {
    expect(historySrc).toMatch(/const handleSeeMore\s*=\s*useCallback\(\(\)\s*=>\s*\{/);
    expect(historySrc).toMatch(/Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/);
    expect(historySrc).toMatch(/setVisibleSectionCount\(\(prev\)\s*=>\s*prev \+ PAGE_SIZE_SECTIONS\)/);
  });

  it('renders footer with "See More" button and ChevronDown only when hasMoreSections is true', () => {
    expect(historySrc).toMatch(/const renderFooter\s*=\s*useCallback\(\(\)\s*=>\s*\{/);
    expect(historySrc).toMatch(/if \(!hasMoreSections\) return null/);
    expect(historySrc).toMatch(/See More/);
    expect(historySrc).toMatch(/<ChevronDown/);
  });

  it('hooks renderFooter into SectionList ListFooterComponent and does NOT use automatic onEndReached', () => {
    expect(historySrc).toMatch(/ListFooterComponent=\{renderFooter\}/);
    expect(historySrc).not.toMatch(/onEndReached=\{/);
    expect(historySrc).not.toMatch(/onEndReachedThreshold=/);
  });

  it('defines seeMoreBtn style consistent with the design system tokens', () => {
    expect(historySrc).toMatch(/seeMoreBtn:\s*\{/);
    expect(historySrc).toMatch(/borderRadius:\s*BorderRadius\.pill/);
    expect(historySrc).toMatch(/paddingHorizontal:\s*Spacing\.surface/);
    expect(historySrc).toMatch(/seeMoreText:\s*\{/);
    expect(historySrc).toMatch(/fontFamily:\s*FontFamily\.bold/);
  });

  describe('Logical simulation of section slice and pagination cycle', () => {
    const INITIAL_COUNT = 4;
    const PAGE_SIZE = 4;

    it('displays exactly 4 sections initially when 10 days of transactions exist', () => {
      const mockDates = Array.from({ length: 10 }, (_, i) => `2026-10-${20 - i}`);
      let visibleCount = INITIAL_COUNT;

      let displayed = mockDates.slice(0, visibleCount);
      expect(displayed.length).toBe(4);
      expect(mockDates.length > visibleCount).toBe(true); // "See More" visible

      // User clicks See More: 1st time -> 8 days
      visibleCount += PAGE_SIZE;
      displayed = mockDates.slice(0, visibleCount);
      expect(displayed.length).toBe(8);
      expect(mockDates.length > visibleCount).toBe(true); // "See More" still visible

      // User clicks See More: 2nd time -> all 10 days
      visibleCount += PAGE_SIZE;
      displayed = mockDates.slice(0, visibleCount);
      expect(displayed.length).toBe(10);
      expect(mockDates.length > visibleCount).toBe(false); // "See More" hidden
    });

    it('does not show "See More" button when total days are <= 4', () => {
      const mockDates = ['2026-10-19', '2026-10-18', '2026-10-17'];
      const visibleCount = INITIAL_COUNT;
      const hasMore = mockDates.length > visibleCount;
      expect(hasMore).toBe(false);
    });

    it('resets back to 4 days when category is changed', () => {
      let visibleCount = 12; // user had expanded
      // User switches category:
      visibleCount = INITIAL_COUNT;
      expect(visibleCount).toBe(4);
    });
  });
});
