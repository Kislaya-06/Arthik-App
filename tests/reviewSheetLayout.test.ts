import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { readSplitSource } from './helpers/readSplitSource';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('ReviewSheet Layout & UI Invariants', () => {
  // ReviewSheet + its split modules (ReviewSheet.styles.ts, autolog/review/*): same assertions.
  const src = readSplitSource('src/components/autolog/ReviewSheet.tsx');

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

  it('provides a 44px touch target and bodySmall typography for secondary bottom actions', () => {
    expect(src).toMatch(/secondaryBtn:\s*\{[\s\S]*?minHeight:\s*44/);
    expect(src).toMatch(/secondaryText:\s*\{[\s\S]*?fontSize:\s*FontSize\.bodySmall/);
  });

  it('renders emoji-free Transaction Type labels and consistent Spacing.element label margins', () => {
    expect(src).toMatch(/\{\s*key:\s*'expense',\s*label:\s*'Expense'\s*\}/);
    expect(src).toMatch(/\{\s*key:\s*'income',\s*label:\s*'Income'\s*\}/);
    expect(src).not.toMatch(/💸/);
    expect(src).not.toMatch(/💰/);
    expect(src).toMatch(/label:\s*\{[\s\S]*?marginBottom:\s*Spacing\.element/);
  });

  it('defaults remember preference to false so user explicitly opts into remembering', () => {
    expect(src).toMatch(/const\s*\[remember,\s*setRemember\]\s*=\s*useState\(false\);/);
    expect(src).toMatch(/setRemember\(false\);/);
  });

  it('renders Mark as Self Transfer for both expense and income when not in discovery mode', () => {
    expect(src).toMatch(/\{!discovery \? \(\s*<View style=\{styles\.actionPillsGroup\}>\s*<AppButton\s*label="Mark as Self Transfer"/);
  });
  it('asks Not a transaction / Discard / Self transfer inside the sheet, never in a dialog stacked on it (two-tap bug)', () => {
    expect(src).not.toMatch(/Alert\.alert/);
    expect(src).not.toMatch(/\bAlert\b[^\n]*from 'react-native'/);
    expect(src).toMatch(/openConfirm\('ignore'\)/);
    expect(src).toMatch(/openConfirm\('discard'\)/);
    expect(src).toMatch(/openConfirm\('transfer'\)/);
  });

  it('runs one action per tap: a synchronous ref blocks a fast second tap', () => {
    expect(src).toMatch(/if \(busyRef\.current\) return;\s*busyRef\.current = true;/);
  });

  it('has an optional note whose placeholder is the payee name saved when it is left empty', () => {
    expect(src).toMatch(/NOTE \(OPTIONAL\)/);
    expect(src).toMatch(/placeholder=\{defaultNote\}/);
    expect(src).toMatch(/const note = noteText\.trim\(\) \|\| undefined;/);
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
