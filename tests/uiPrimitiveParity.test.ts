import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Pins a handful of exact values inside the three shared UI primitives (KeypadGrid, ItemRowShell, AuthFormField) that
 * were accidentally changed when they were extracted from the screens that used to own this code, and have since been
 * restored to match. A plain text match, not a render test: enough to catch the same regression coming back.
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('KeypadGrid: keeps a gap between keys', () => {
  const src = read('src/components/ui/KeypadGrid.tsx');
  it('defaults to an 8px gap and accepts an override', () => {
    expect(src).toMatch(/gap\s*=\s*8/);
    expect(src).toMatch(/gap\??:\s*number/);
  });
  it('Budget Edit asks for the original 6px gap', () => {
    expect(read('src/components/BudgetEditModal.tsx')).toMatch(/<KeypadGrid[\s\S]{0,200}gap=\{6\}/);
  });
});

describe('ItemRowShell: pressed-row radius and clipping', () => {
  const src = read('src/components/ui/ItemRowShell.tsx');
  it('uses the design-token card radius, not a hard-coded number', () => {
    expect(src).toMatch(/pressableContainer:\s*\{\s*borderRadius:\s*BorderRadius\.card/);
  });
  it('clips its content to that radius', () => {
    const m = src.match(/pressableContainer:\s*\{([^}]*)\}/);
    expect(m?.[1]).toMatch(/overflow:\s*'hidden'/);
  });
});

describe('AuthFormField: original field rhythm', () => {
  const src = read('src/components/ui/AuthFormField.tsx');
  it('label uses 0.5 letter-spacing (not the rounder 0.8 of a fresh component)', () => {
    expect(src).toMatch(/label:\s*\{[^}]*letterSpacing:\s*0\.5/);
  });
  it('the input wrapper radius is 18, the inner field uses Spacing.surface padding', () => {
    expect(src).toMatch(/inputWrapper:\s*\{\s*borderRadius:\s*18/);
    expect(src).toMatch(/inputContainer:\s*\{[^}]*paddingHorizontal:\s*Spacing\.surface/);
  });
  it('spacing above a field defaults to 24 (Auth / ProfileSetup) and can be overridden', () => {
    expect(src).toMatch(/topSpacing\s*=\s*24/);
  });
  it('ResetPasswordScreen overrides it to 16, its original rhythm', () => {
    const rp = read('src/screens/ResetPasswordScreen.tsx');
    const count = (rp.match(/topSpacing=\{16\}/g) || []).length;
    expect(count).toBe(2); // both NEW PASSWORD and CONFIRM NEW PASSWORD fields
  });
  it('input specifies includeFontPadding false and textAlignVertical center for Android parity', () => {
    expect(src).toMatch(/includeFontPadding:\s*false/);
    expect(src).toMatch(/textAlignVertical:\s*'center'/);
  });
});

describe('InsightsScreen hero card: bottom clipping & pagination dots clearance invariants', () => {
  const src = read('src/screens/InsightsScreen.tsx');

  it('heroCard paddingBottom uses Spacing.gutter to maintain compact layout without excessive bottom gap', () => {
    expect(src).toMatch(/heroCard:\s*\{[\s\S]*?paddingBottom:\s*Spacing\.gutter/);
  });

  it('heroCard specifies cardLarge radius and hardware clipping', () => {
    expect(src).toMatch(/heroCard:\s*\{[\s\S]*?borderRadius:\s*BorderRadius\.cardLarge/);
    expect(src).toMatch(/heroCard:\s*\{[\s\S]*?overflow:\s*'hidden'/);
  });

  it('heroCard label uses Title Case and bold styling matching BrandedHeroCard', () => {
    expect(src).toMatch(/Total Spent This Month/);
    expect(src).toMatch(/Total Spent This Week/);
    expect(src).toMatch(/Total Spent This Year/);
    expect(src).toMatch(/heroLabel:\s*\{[\s\S]*?fontSize:\s*FontSize\.body/);
    expect(src).toMatch(/heroLabel:\s*\{[\s\S]*?fontFamily:\s*FontFamily\.bold/);
  });

  it('PeriodNavigator dotsRow maintains compact top margin spacing', () => {
    expect(src).toMatch(/dotsRow:\s*\{[\s\S]*?marginTop:\s*Spacing\.element/);
  });
});

describe('BreathingStripShell: unified black capsule with green text styling parity', () => {
  const shellSrc = read('src/components/BreathingStripShell.tsx');
  const weeklySrc = read('src/components/WeeklyBreathingStrip.tsx');
  const monthlySrc = read('src/components/MonthlyBreathingStrip.tsx');
  const yearlySrc = read('src/components/YearlyBreathingStrip.tsx');

  it('BreathingStripShell renders neutral capsule styling with transparent backdrop, border, and green text', () => {
    expect(shellSrc).toMatch(/pillVariant\?:\s*'mint'\s*\|\s*'neutral'/);
    // Neutral pill matches CashFlowChart legend capsule rgba styling
    expect(shellSrc).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.05\)/);
    expect(shellSrc).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.035\)/);
    // Text inside pill is green matching app mint accent
    expect(shellSrc).toMatch(/color:\s*tile\.pillTextColor\s*\|\|\s*\(isDark\s*\?\s*colors\.mintGreen\s*:\s*colors\.mintGreenDark\)/);
  });

  it('Weekly, Monthly and Yearly breathing strips uniformly use neutral pillVariant', () => {
    expect(weeklySrc).toMatch(/pillVariant:\s*'neutral'/);
    expect(monthlySrc).toMatch(/pillVariant:\s*'neutral'/);
    expect(yearlySrc).toMatch(/pillVariant:\s*'neutral'/);
  });
});

describe('HistoryScreen virtualization: initial batch and batch size parity', () => {
  const historySrc = read('src/screens/HistoryScreen.tsx');

  it('SectionList uses initialNumToRender 12 to prevent JS thread stalls on filter transitions', () => {
    expect(historySrc).toMatch(/initialNumToRender=\{12\}/);
  });

  it('SectionList uses maxToRenderPerBatch 10 to batch subsequent offscreen rows smoothly', () => {
    expect(historySrc).toMatch(/maxToRenderPerBatch=\{10\}/);
  });

  it('SectionList preserves windowSize 21 for smooth bidirectional scrolling', () => {
    expect(historySrc).toMatch(/windowSize=\{21\}/);
  });

  it('SectionList uses progressive 4-day section pagination with "See More" button to prevent main thread frame drops', () => {
    expect(historySrc).toMatch(/INITIAL_SECTION_COUNT\s*=\s*4/);
    expect(historySrc).toMatch(/PAGE_SIZE_SECTIONS\s*=\s*4/);
    expect(historySrc).toMatch(/sections=\{displayedSections\}/);
    expect(historySrc).toMatch(/ListFooterComponent=\{renderFooter\}/);
    expect(historySrc).toMatch(/handleSeeMore/);
    expect(historySrc).toMatch(/seeMoreBtn/);
  });
});

describe('SegmentedControl & BouncyCategoryFilter: Reanimated UI-thread worklet parity', () => {
  const segSrc = read('src/components/ui/SegmentedControl.tsx');
  const catSrc = read('src/components/BouncyCategoryFilter.tsx');

  it('SegmentedControl runs on react-native-reanimated with Apple critically damped springs', () => {
    expect(segSrc).toMatch(/from 'react-native-reanimated'/);
    expect(segSrc).toMatch(/useSharedValue/);
    expect(segSrc).toMatch(/stiffness:\s*447\.4/);
    expect(segSrc).toMatch(/damping:\s*49/);
  });

  it('SegmentedControl and BouncyCategoryFilter decouple UI touch from React state via startTransition', () => {
    expect(segSrc).toMatch(/React\.startTransition/);
    expect(catSrc).toMatch(/React\.startTransition/);
  });
});




