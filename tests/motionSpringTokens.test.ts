import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Motion } from '../src/config/theme';

describe('Motion Design System Tokens (Seam: src/config/theme.ts)', () => {
  it('defines Apple-grade fluid spring tokens with critically damped parameters', () => {
    // Subtle press: 120/10
    expect(Motion.springs.press).toEqual({ tension: 120, friction: 10 });
    // Settle spring: analytically zero-oscillation (damping ratio > 1)
    expect(Motion.springs.settle).toEqual({ stiffness: 447.4, damping: 49, mass: 1 });
    // Bottom sheet glide: classic Apple fluid sheet curve
    expect(Motion.springs.sheet).toEqual({ damping: 24, stiffness: 280, mass: 0.9 });
    // Snappy keypad release
    expect(Motion.springs.keypad).toEqual({ tension: 180, friction: 12 });

    expect(Motion.scale.press).toBe(0.97);
    expect(Motion.scale.chip).toBe(0.96);
  });
});

describe('Finding 05 Invariant: Zero Loose Underdamped Spring Drift in Modals', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('BottomSheetModal uses Motion.springs.sheet for both entry and snap-back', () => {
    const src = readComponent('src/components/ui/BottomSheetModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
    expect(src).toContain('damping: Motion.springs.sheet.damping');
    expect(src).toContain('SNAP_BACK_SPRING = Motion.springs.sheet');
  });

  it('CadenceSwitchModal uses Motion.springs.sheet without hardcoded tension: 70', () => {
    const src = readComponent('src/components/CadenceSwitchModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
  });

  it('PeriodRenewalModal uses Motion.springs.sheet without hardcoded tension: 70', () => {
    const src = readComponent('src/components/PeriodRenewalModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
  });

  it('VaultSpendingGuardModal uses Motion.springs.sheet without hardcoded tension: 70', () => {
    const src = readComponent('src/components/VaultSpendingGuardModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
  });

  it('BudgetEditModal uses Motion.springs.sheet without hardcoded tension: 70', () => {
    const src = readComponent('src/components/BudgetEditModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
  });

  it('DepositGullakModal uses Motion.springs.sheet and Motion.springs.settle', () => {
    const src = readComponent('src/components/DepositGullakModal.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).toContain('stiffness: Motion.springs.sheet.stiffness');
    expect(src).toContain('stiffness: Motion.springs.settle.stiffness');
  });
});

describe('Finding 05 Invariant: Pressable Tactile Feedback Standardization', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('ItemRowShell uses Motion.scale.press and Motion.springs.press with reduceMotion guard', () => {
    const src = readComponent('src/components/ui/ItemRowShell.tsx');
    expect(src).toContain('Motion.scale.press');
    expect(src).toContain('Motion.springs.press.tension');
    expect(src).toContain('useReduceMotion()');
  });

  it('AppButton has reduceMotion guard to prevent animation overhead when reduced motion is preferred', () => {
    const src = readComponent('src/components/ui/AppButton.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toContain('if (reduceMotion) return;');
  });

  it('KeyButton uses Motion.springs.keypad on both press-in and press-out', () => {
    const src = readComponent('src/components/KeyButton.tsx');
    expect(src).not.toContain('tension: 220');
    expect(src).toContain('Motion.springs.keypad.tension');
  });

  it('BrandedHeroCard uses Motion.scale.press and Motion.springs.press', () => {
    const src = readComponent('src/components/BrandedHeroCard.tsx');
    expect(src).toContain('Motion.scale.press');
    expect(src).toContain('Motion.springs.press.tension');
  });

  it('SavingsHeroCard CTA uses Motion.springs.press', () => {
    const src = readComponent('src/components/savings/SavingsHeroCard.tsx');
    expect(src).toContain('Motion.springs.press.tension');
  });

  it('SegmentedControl OptionItem uses Motion.scale.chip and Motion.springs.settle with reducedMotion guard', () => {
    const src = readComponent('src/components/ui/SegmentedControl.tsx');
    expect(src).toContain('Motion.scale.chip');
    expect(src).toContain('Motion.springs.settle');
    expect(src).toContain('useReducedMotion()');
  });
});

describe('Finding 06 Invariant: Zero 1.25+ Balloon Overshoot & Underdamped Jiggle', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('SavingsScreen triggerPiggyBounce pulses to subtle 1.08 with Motion.springs.settle (no 1.25 or friction 6)', () => {
    const src = readComponent('src/screens/SavingsScreen.tsx');
    expect(src).not.toMatch(/toValue:\s*1\.25/);
    expect(src).not.toMatch(/friction:\s*6/);
    expect(src).toMatch(/toValue:\s*1\.08/);
    expect(src).toContain('Motion.springs.settle.stiffness');
    expect(src).toContain('useReduceMotion()');
  });

  it('MoneyExplainerModal MoneyHelpBadge pulses to 1.08 without Easing.back(1.5) wild overshoot', () => {
    const src = readComponent('src/components/MoneyExplainerModal.tsx');
    expect(src).not.toMatch(/Easing\.back\(1\.5\)/);
    expect(src).not.toMatch(/toValue:\s*1\.25/);
    expect(src).toMatch(/toValue:\s*1\.08/);
    expect(src).toContain('Motion.springs.settle.stiffness');
  });

  it('PiggyBankCoinIcon uses subtle 1.08 squash with Motion.springs.settle', () => {
    const src = readComponent('src/components/PiggyBankCoinIcon.tsx');
    expect(src).not.toContain('tension: 70');
    expect(src).not.toContain('friction: 7');
    expect(src).toContain('createSquash(piggyScaleX, 1.08)');
    expect(src).toContain('Motion.springs.settle.stiffness');
  });

  it('BouncyCategoryFilter FilterItem uses Motion.scale.chip and Motion.springs.settle', () => {
    const src = readComponent('src/components/BouncyCategoryFilter.tsx');
    expect(src).not.toMatch(/scale\.value\s*=\s*withSpring\(0\.94/);
    expect(src).toContain('Motion.scale.chip');
    expect(src).toContain('Motion.springs.settle');
    expect(src).toContain('useReducedMotion()');
  });
});

describe('Finding 07 Invariant: Comprehensive Reduced Motion Guards Across Core Components', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('BottomNavBar checks reduceMotion before translating nav bar and switching modes', () => {
    const src = readComponent('src/components/BottomNavBar.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*translateY\.setValue/);
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*modeAnim\.setValue/);
  });

  it('PiggyBankCoinIcon AnimatedPiggyBank bypasses dropAnim when reduceMotion is active', () => {
    const src = readComponent('src/components/PiggyBankCoinIcon.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*onAnimationEnd\?\.\(\);\s*return;\s*\}/);
  });

  it('StreakCalendarModal tooltipAnim bypasses spring when reduceMotion is active', () => {
    const src = readComponent('src/components/StreakCalendarModal.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*tooltipAnim\.setValue\(1\);/);
  });

  it('BudgetEditModal sheetAnim bypasses spring when reduceMotion is active', () => {
    const src = readComponent('src/components/BudgetEditModal.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*sheetAnim\.setValue\(1\);/);
  });

  it('MoneyExplainerModal and MoneyHelpBadge respect reduceMotion', () => {
    const src = readComponent('src/components/MoneyExplainerModal.tsx');
    expect(src).toContain('useReduceMotion()');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*return;/);
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*anim\.setValue\(1\);/);
  });

  it('OfflineBanner and SyncFailedBanner bypass translateY slide when reduceMotion is active', () => {
    const offlineSrc = readComponent('src/components/OfflineBanner.tsx');
    expect(offlineSrc).toContain('useReduceMotion()');
    expect(offlineSrc).toMatch(/if\s*\(reduceMotion\)\s*\{/);

    const syncSrc = readComponent('src/components/SyncFailedBanner.tsx');
    expect(syncSrc).toContain('useReduceMotion()');
    expect(syncSrc).toMatch(/if\s*\(reduceMotion\)\s*\{/);
  });

  it('BouncyCategoryFilter pillX and pillWidth bypass spring sliding when reduceMotion is active', () => {
    const src = readComponent('src/components/BouncyCategoryFilter.tsx');
    expect(src).toMatch(/if\s*\(reduceMotion\)\s*\{\s*pillX\.value\s*=\s*targetLayout\.x/);
  });
});

describe('Finding 08 Invariant: Symmetric Spring Direction Physics in PeriodNavigator', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('PeriodNavigator uses withSpring for leftward navigation instead of rigid withTiming', () => {
    const src = readComponent('src/screens/insights/PeriodNavigator.tsx');
    expect(src).not.toMatch(/slideLeft\.value\s*=\s*withTiming/);
    expect(src).toMatch(/slideLeft\.value\s*=\s*withSpring\(targetLeft,\s*springCfg\)/);
    expect(src).toContain('stiffness: 447.4');
    expect(src).toContain('damping: 49');
  });
});

describe('Finding 09 Invariant: Accelerated Cold Boot Splash Choreography', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('SplashScreen eliminates the 1480ms artificial hard lock with calibrated sub-second timeline', () => {
    const src = readComponent('src/screens/SplashScreen.tsx');
    expect(src).not.toContain('const ENTRANCE_MS = 900');
    expect(src).not.toContain('const EXIT_MS = 580');
    expect(src).toContain('const ENTRANCE_MS = 540');
    expect(src).toContain('const EXIT_MS = 360');
  });
});

describe('Finding 10 Invariant: Dataset-Proportional Stagger in Insights Charts', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('SpendingFlowChart eliminates fixed index * 35 delay and caps wave stagger to 100ms', () => {
    const src = readComponent('src/components/SpendingFlowChart.tsx');
    expect(src).not.toContain('const delay = index * 35');
    expect(src).toMatch(/Math\.min\(index\s*\*\s*\(100\s*\/\s*totalBars\),\s*100\)/);
    expect(src).toContain('tension: 110');
    expect(src).toContain('friction: 12');
  });

  it('CashFlowChart eliminates fixed index * 35 delay and upgrades to critically damped spring', () => {
    const src = readComponent('src/components/CashFlowChart.tsx');
    expect(src).not.toContain('Animated.delay(index * 35)');
    expect(src).not.toContain('friction: 8');
    expect(src).toMatch(/Math\.min\(index\s*\*\s*\(100\s*\/\s*totalBars\),\s*100\)/);
    expect(src).toContain('tension: 110');
    expect(src).toContain('friction: 12');
  });
});

describe('Finding 11 Invariant: Asymmetric Press and Release Tactile Physics', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('theme.ts defines Motion.springs.release with snappy return parameters', () => {
    const src = readComponent('src/config/theme.ts');
    expect(src).toContain('release: { tension: 180, friction: 14 }');
  });

  it('AppButton uses Motion.springs.press for press-in and Motion.springs.release for press-out', () => {
    const src = readComponent('src/components/ui/AppButton.tsx');
    expect(src).toContain('tension: Motion.springs.press.tension');
    expect(src).toContain('tension: Motion.springs.release.tension');
  });

  it('BrandedHeroCard and SavingsHeroCard use Motion.springs.release on press-out', () => {
    const heroSrc = readComponent('src/components/BrandedHeroCard.tsx');
    expect(heroSrc).toContain('tension: Motion.springs.press.tension');
    expect(heroSrc).toContain('tension: Motion.springs.release.tension');

    const savingsSrc = readComponent('src/components/savings/SavingsHeroCard.tsx');
    expect(savingsSrc).toContain('tension: Motion.springs.press.tension');
    expect(savingsSrc).toContain('tension: Motion.springs.release.tension');
  });

  it('ItemRowShell and BottomNavBar use Motion.springs.release on press-out', () => {
    const itemSrc = readComponent('src/components/ui/ItemRowShell.tsx');
    expect(itemSrc).toContain('tension: Motion.springs.release.tension');

    const navSrc = readComponent('src/components/BottomNavBar.tsx');
    expect(navSrc).toContain('tension: Motion.springs.release.tension');
  });
});

describe('Plans 001-006 Motion Invariants: Fluid Transitions and State Disclosures', () => {
  const readComponent = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');

  it('Plan 001: OnboardingScreen uses OnboardingPaginationDot with Motion.springs.settle and useReduceMotion', () => {
    const src = readComponent('src/screens/OnboardingScreen.tsx');
    expect(src).toContain('OnboardingPaginationDot');
    expect(src).toContain('Motion.springs.settle');
    expect(src).toContain('useReduceMotion()');
  });

  it('Plan 002: LedgerScreen uses ChevronRotator and LinearTransition for accordion with reduceMotion guard', () => {
    const src = readComponent('src/screens/LedgerScreen.tsx');
    expect(src).toContain('ChevronRotator');
    expect(src).toContain('Motion.duration.snappy');
    expect(src).toContain('LinearTransition.duration');
    expect(src).toContain('useReduceMotion()');
  });

  it('Plan 003: AppLockOverlay uses withTiming dissolve exit with Motion.duration.snappy and pointerEvents', () => {
    const src = readComponent('src/components/AppLockOverlay.tsx');
    expect(src).toContain('shouldRender');
    expect(src).toContain('Motion.duration.snappy');
    expect(src).toContain('pointerEvents={isLocked ? \'auto\' : \'none\'}');
    expect(src).toContain('useReduceMotion()');
  });

  it('Plan 004: AutoLogHomeBanner uses LinearTransition, FadeIn, FadeOut, and useReduceMotion', () => {
    const src = readComponent('src/components/autolog/AutoLogHomeBanner.tsx');
    expect(src).toContain('LinearTransition.duration(Motion.duration.standard)');
    expect(src).toContain('FadeIn.duration(Motion.duration.snappy)');
    expect(src).toContain('FadeOut.duration(Motion.duration.snappy)');
    expect(src).toContain('useReduceMotion()');
  });

  it('Plan 005: NotificationsScreen uses NotificationsEmptyState with Motion.duration.snappy and useReduceMotion', () => {
    const src = readComponent('src/screens/NotificationsScreen.tsx');
    expect(src).toContain('NotificationsEmptyState');
    expect(src).toContain('Motion.duration.snappy');
    expect(src).toContain('useReduceMotion()');
  });

  it('Plan 006: DeleteAccountModal and EditProfileModal use Motion.springs.settle and error layout transitions', () => {
    const deleteSrc = readComponent('src/components/profile/DeleteAccountModal.tsx');
    expect(deleteSrc).toContain('Motion.springs.settle');
    expect(deleteSrc).toContain('LinearTransition.duration');
    expect(deleteSrc).toContain('useReduceMotion()');

    const editSrc = readComponent('src/components/profile/EditProfileModal.tsx');
    expect(editSrc).toContain('Motion.springs.settle');
    expect(editSrc).toContain('LinearTransition.duration');
    expect(editSrc).toContain('useReduceMotion()');
  });
});






