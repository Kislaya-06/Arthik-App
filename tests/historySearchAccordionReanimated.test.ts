import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Finding 03 / Motion Audit: HistoryScreen Search Accordion Reanimated', () => {
  const historyPath = path.resolve(__dirname, '../src/screens/HistoryScreen.tsx');
  const source = fs.readFileSync(historyPath, 'utf8');

  it('imports Reanimated primitives including Extrapolation and interpolate', () => {
    expect(source).toContain("from 'react-native-reanimated'");
    expect(source).toContain('Extrapolation');
    expect(source).toContain('interpolate');
    expect(source).toContain('useAnimatedStyle');
    expect(source).toContain('useSharedValue');
  });

  it('consolidates search accordion into a single container height and eliminates per-frame margin thrashing', () => {
    // Single container height animation
    expect(source).toMatch(/const searchContainerAnimatedStyle = useAnimatedStyle\(\(\) => \(\{[\s\S]*?height: searchProgress\.value \* SEARCH_SECTION_HEIGHT,[\s\S]*?overflow: 'hidden'/);
    // Margin animations removed from searchAnimatedStyle
    expect(source).not.toContain('marginTop: searchProgress.value * Spacing.block');
    expect(source).not.toContain('marginBottom: searchProgress.value * Spacing.element');
  });

  it('animates search inner content via GPU hardware-accelerated translateY and opacity', () => {
    expect(source).toMatch(/const searchContentAnimatedStyle = useAnimatedStyle\(\(\) => \(\{[\s\S]*?opacity: searchProgress\.value,[\s\S]*?translateY: interpolate\(searchProgress\.value, \[0, 1\], \[-8, 0\], Extrapolation\.CLAMP\)/);
  });

  it('eliminates abrupt filterWrapperSearchOpen jump so filter pills glide smoothly', () => {
    expect(source).not.toContain('filterWrapperSearchOpen');
    expect(source).toContain('<View style={styles.filterWrapper}>');
  });

  it('defines SEARCH_SECTION_HEIGHT strictly matching total resting spacing', () => {
    expect(source).toContain('const SEARCH_SECTION_HEIGHT = Spacing.block + SEARCH_CONTAINER_HEIGHT + (Spacing.element * 2);');
  });
});
