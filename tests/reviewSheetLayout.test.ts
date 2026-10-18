import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('ReviewSheet Layout & UI Invariants', () => {
  const src = read('src/components/autolog/ReviewSheet.tsx');

  it('calculates equal-width 2-column grid for category pills', () => {
    expect(src).toMatch(/const availableWidth = Math\.max\(windowWidth - Spacing\.gutter \* 2, 280\);/);
    expect(src).toMatch(/const chipWidth = Math\.floor\(\(availableWidth - GRID_GAP\) \/ 2\);/);
    expect(src).toMatch(/width:\s*chipWidth/);
  });

  it('uses standard 48px touch target height and stadium pill radius for category chips', () => {
    expect(src).toMatch(/catChip:\s*\{[\s\S]*?height:\s*48/);
    expect(src).toMatch(/catChip:\s*\{[\s\S]*?borderRadius:\s*BorderRadius\.pill/);
  });

  it('does NOT contain cramped nested categoryScroll with 120px max height', () => {
    expect(src).not.toMatch(/categoryScroll:\s*\{\s*maxHeight:\s*120\s*\}/);
  });

  it('elevates sheet container height to ~86% of window height', () => {
    expect(src).toMatch(/const sheetHeight = Math\.min\(Math\.round\(windowHeight \* 0\.86\), 740\);/);
    expect(src).toMatch(/containerStyle=\{\[styles\.modalContainer,\s*\{\s*height:\s*sheetHeight\s*\}\]\}/);
  });

  it('uses size="standard" with Users icon for "Save and split with friends"', () => {
    expect(src).toMatch(/label="Save and split with friends"/);
    expect(src).toMatch(/size="standard"/);
    expect(src).toMatch(/icon=\{<Users size=\{16\}/);
  });

  it('provides comfortable touch target and bodySmall typography for secondary bottom actions', () => {
    expect(src).toMatch(/secondaryBtn:\s*\{[\s\S]*?minHeight:\s*36/);
    expect(src).toMatch(/secondaryText:\s*\{[\s\S]*?fontSize:\s*FontSize\.bodySmall/);
  });
});

describe('BottomSheetModal Slide Animation Invariant', () => {
  const bsmSrc = read('src/components/ui/BottomSheetModal.tsx');

  it('uses windowHeight-aware initialSlide instead of a hardcoded 500 so tall sheets animate cleanly offscreen', () => {
    expect(bsmSrc).toMatch(/const initialSlide = Math\.max\(windowHeight \|\| 800, 600\);/);
    expect(bsmSrc).toMatch(/const slideAnim = useAnimatedValue\(initialSlide\);/);
    expect(bsmSrc).toMatch(/toValue:\s*initialSlide/);
  });
});
