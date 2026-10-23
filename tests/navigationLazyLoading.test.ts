import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-04: Navigation Lazy-Loaded Screens Integrity', () => {
  const navFilePath = path.resolve(__dirname, '../src/navigation/index.tsx');
  const navContent = fs.readFileSync(navFilePath, 'utf8');

  const lazyScreens = [
    { name: 'ResetPassword', fileRelPath: '../src/screens/ResetPasswordScreen.tsx', exportName: 'ResetPasswordScreen' },
    { name: 'ProfileSetup', fileRelPath: '../src/screens/ProfileSetupScreen.tsx', exportName: 'ProfileSetupScreen' },
    { name: 'GullakDepositDetail', fileRelPath: '../src/screens/GullakDepositDetailScreen.tsx', exportName: 'GullakDepositDetailScreen' },
    { name: 'CategoryDetail', fileRelPath: '../src/screens/CategoryDetailScreen.tsx', exportName: 'CategoryDetailScreen' },
    { name: 'ManageCategories', fileRelPath: '../src/screens/ManageCategoriesScreen.tsx', exportName: 'ManageCategoriesScreen' },
    { name: 'AddEditCategory', fileRelPath: '../src/screens/AddEditCategoryScreen.tsx', exportName: 'AddEditCategoryScreen' },
    { name: 'Notifications', fileRelPath: '../src/screens/NotificationsScreen.tsx', exportName: 'NotificationsScreen' },
    { name: 'Ledger', fileRelPath: '../src/screens/LedgerScreen.tsx', exportName: 'LedgerScreen' },
    { name: 'Profile', fileRelPath: '../src/screens/ProfileScreen.tsx', exportName: 'ProfileScreen' },
    { name: 'Faq', fileRelPath: '../src/screens/FaqScreen.tsx', exportName: 'FaqScreen' },
    { name: 'AutoLogCenter', fileRelPath: '../src/screens/autolog/AutoLogCenterScreen.tsx', exportName: 'AutoLogCenterScreen' },
    { name: 'AutoLogIntro', fileRelPath: '../src/screens/autolog/AutoLogIntroScreen.tsx', exportName: 'AutoLogIntroScreen' },
    { name: 'AutoLogSetup', fileRelPath: '../src/screens/autolog/AutoLogSetupScreen.tsx', exportName: 'AutoLogSetupScreen' },
    { name: 'AutoLogWelcomeBack', fileRelPath: '../src/screens/autolog/AutoLogWelcomeBackScreen.tsx', exportName: 'AutoLogWelcomeBackScreen' },
    { name: 'AutoLogReview', fileRelPath: '../src/screens/autolog/AutoLogReviewScreen.tsx', exportName: 'AutoLogReviewScreen' },
    { name: 'AutoLogEmail', fileRelPath: '../src/screens/autolog/AutoLogEmailScreen.tsx', exportName: 'AutoLogEmailScreen' },
    { name: 'AutoLogAccounts', fileRelPath: '../src/screens/autolog/AutoLogAccountsScreen.tsx', exportName: 'AutoLogAccountsScreen' },
    { name: 'AutoLogInfo', fileRelPath: '../src/screens/autolog/AutoLogInfoScreen.tsx', exportName: 'AutoLogInfoScreen' },
  ];

  it('verifies that each lazy screen uses getComponent with exact matching export', () => {
    for (const screen of lazyScreens) {
      // 1. File must exist
      const screenFilePath = path.resolve(__dirname, screen.fileRelPath);
      expect(fs.existsSync(screenFilePath)).toBe(true);

      // 2. Target file must actually export the named component
      const screenFileContent = fs.readFileSync(screenFilePath, 'utf8');
      const hasNamedExport = screenFileContent.includes(`export const ${screen.exportName}`) ||
        screenFileContent.includes(`export function ${screen.exportName}`);
      expect(hasNamedExport).toBe(true);

      // 3. Navigation index.tsx must contain the getComponent declaration for this screen
      const pattern = new RegExp(`<Stack\\.Screen\\s+name="${screen.name}"\\s+getComponent={\\(\\)\\s*=>\\s*require\\(['"].+['"]\\)\\.${screen.exportName}`);
      expect(navContent).toMatch(pattern);

      // 4. Navigation index.tsx must NOT statically import this screen at top level
      const staticImportPattern = new RegExp(`import\\s*\\{[^}]*\\b${screen.exportName}\\b[^}]*\\}\\s*from`);
      expect(navContent).not.toMatch(staticImportPattern);
    }
  });

  it('keeps eager hot-path screens statically imported and registered with component={...}', () => {
    const eagerScreens = ['Splash', 'Onboarding', 'Auth', 'AddExpense', 'EditExpense', 'ExpenseDetail', 'Savings'];
    for (const screen of eagerScreens) {
      const pattern = new RegExp(`<Stack\\.Screen\\s+name="${screen}"\\s+component=`);
      expect(navContent).toMatch(pattern);
    }
  });

  it('preserves required Stack.Screen options on lazy screens', () => {
    expect(navContent).toContain('name="AutoLogIntro" getComponent={() => require(\'../screens/autolog/AutoLogIntroScreen\').AutoLogIntroScreen} options={{ animation: \'fade_from_bottom\' }}');
    expect(navContent).toContain('name="AutoLogSetup" getComponent={() => require(\'../screens/autolog/AutoLogSetupScreen\').AutoLogSetupScreen} options={{ gestureEnabled: false }}');
    expect(navContent).toContain('name="AutoLogWelcomeBack" getComponent={() => require(\'../screens/autolog/AutoLogWelcomeBackScreen\').AutoLogWelcomeBackScreen} options={{ gestureEnabled: false, animation: \'fade_from_bottom\' }}');
  });
});
