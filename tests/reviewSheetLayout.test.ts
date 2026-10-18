import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('ReviewSheet Layout & UI Invariants', () => {
  const src = read('src/components/autolog/ReviewSheet.tsx');

  it('renders horizontal scroll category chip bar with left and right gradient fades matching ExpenseFormScreen', () => {
    expect(src).toMatch(/categoryScrollContainer:\s*\{[\s\S]*?position:\s*'relative'/);
    expect(src).toMatch(/categoryFadeLeft:\s*\{[\s\S]*?position:\s*'absolute'/);
    expect(src).toMatch(/categoryFadeRight:\s*\{[\s\S]*?position:\s*'absolute'/);
    expect(src).toMatch(/<ScrollView[\s\S]*?horizontal/);
  });

  it('uses uniform 48px stadium pills for Remember Preference, Mark as Self Transfer, and Save and split', () => {
    expect(src).toMatch(/rememberPill:\s*\{[\s\S]*?height:\s*ControlHeight\.standard/);
    expect(src).toMatch(/rememberPill:\s*\{[\s\S]*?borderRadius:\s*BorderRadius\.pill/);
    expect(src).toMatch(/label="Mark as Self Transfer"/);
    expect(src).toMatch(/size="standard"/);
  });

  it('renders compact split-row receipt summary card with zero void space', () => {
    expect(src).toMatch(/summaryCard:\s*\{/);
    expect(src).toMatch(/summarySplitRow:\s*\{/);
    expect(src).toMatch(/accountPill:\s*\{[\s\S]*?borderRadius:\s*BorderRadius\.pill/);
  });

  it('includes Mark as Self Transfer action calling markAsSelfTransfer', () => {
    expect(src).toMatch(/markAsSelfTransfer\(event,\s*remember\)/);
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

  it('provides comfortable 38px touch target and bodySmall typography for secondary bottom actions', () => {
    expect(src).toMatch(/secondaryBtn:\s*\{[\s\S]*?minHeight:\s*38/);
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
