import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('OPT-17: Same press feel everywhere (TouchableOpacity -> PressableOpacity)', () => {
  it('has zero occurrences of TouchableOpacity across all source files in src/', () => {
    let matches = '';
    try {
      matches = execSync('git grep -n "TouchableOpacity" src', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
      });
    } catch {
      matches = ''; // git grep exits with 1 when no matches are found
    }
    expect(matches.trim()).toBe('');
  });

  it('provides a drop-in PressableOpacity component in src/components/ui/PressableOpacity.tsx', () => {
    const filePath = path.join(__dirname, '../src/components/ui/PressableOpacity.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export const PressableOpacity');
    expect(content).toContain('activeOpacity = 0.2');
    expect(content).toContain('<Pressable');
  });

  it('ensures all former TouchableOpacity callers now import PressableOpacity', () => {
    const callerFiles = [
      'src/components/ErrorBoundary.tsx',
      'src/components/ui/BottomSheetModal.tsx',
      'src/components/SyncFailedBanner.tsx',
      'src/components/profile/PauseBudgetModal.tsx',
      'src/components/PeriodRenewalModal.tsx',
      'src/components/CadenceSwitchModal.tsx',
      'src/components/MoneyExplainerModal.tsx',
      'src/components/BrandedHeroCard.tsx',
      'src/components/DepositGullakModal.tsx',
      'src/components/BudgetEditModal.tsx',
      'src/components/SavingsRecordRow.tsx',
      'src/components/WelcomeBackGapModal.tsx',
      'src/components/savings/SavingsHistorySection.tsx',
      'src/components/savings/BudgetHubSection.tsx',
      'src/components/savings/SavingsHeader.tsx',
      'src/components/savings/SavingsHeroCard.tsx',
      'src/components/VaultSpendingGuardModal.tsx',
      'src/components/OfflineBanner.tsx',
      'src/screens/HomeScreen.tsx',
      'src/screens/NotificationsScreen.tsx',
      'src/screens/HistoryScreen.tsx',
      'src/screens/OnboardingScreen.tsx',
    ];

    for (const relPath of callerFiles) {
      const fullPath = path.join(__dirname, '..', relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('PressableOpacity');
      expect(content).not.toContain('TouchableOpacity');
    }
  });
});
