import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { LightColors, DarkColors, AmoledColors, FontSize, BorderRadius, ControlHeight, Spacing, LetterSpacing } from '../src/config/theme';
import { alertButtonPalette, contrastRatio } from '../src/lib/alertButtonPalette';
import { scrimColor, SCRIM_LIGHT, SCRIM_DARK, SCRIM_AMOLED } from '../src/lib/scrim';
import { PRESS_DIM_OPACITY } from '../src/lib/pressFeedback';

/**
 * UI consistency pass (November 2026): one back button, one press feedback, one scrim, two modal button
 * heights, a readable danger button, and a design-system document that matches theme.ts.
 */
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(full) ? [full] : [];
  });
const rel = (full: string) => path.relative(SRC, full).split(path.sep).join('/');

/** End of a JSX opening tag: the first ">" outside of any {...}. */
const openingTag = (source: string, start: number) => {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
};

describe('Headers: one back button on every pushed screen', () => {
  it('only HeaderBackButton draws a back arrow (sheet step-back arrows excepted)', () => {
    const STEP_BACK_IN_SHEET = ['components/DepositGullakModal.tsx', 'components/PeriodRenewalModal.tsx'];
    const offenders = walk(SRC)
      .filter((f) => readFileSync(f, 'utf8').includes("lucide-react-native/icons/arrow-left'"))
      .map(rel)
      .filter((f) => f !== 'components/ui/HeaderBackButton.tsx' && !STEP_BACK_IN_SHEET.includes(f));
    expect(offenders).toEqual([]);
  });

  it('the back button is a 24px arrow with a 44dp touch area and a screen-reader label', () => {
    const src = read('src/components/ui/HeaderBackButton.tsx');
    expect(src).toContain('export const HEADER_BACK_ICON_SIZE = 24;');
    expect(src).toContain('const HIT_SLOP = 10;');
    expect(src).toContain('accessibilityLabel="Go back"');
    expect(src).toContain('activeOpacity={PRESS_DIM_OPACITY}');
  });

  // Pages with a title bar. Auth and Profile Setup show only the arrow above their own big heading.
  const PUSHED_WITH_TITLE = [
    'screens/AddEditCategoryScreen.tsx', 'screens/CategoryDetailScreen.tsx', 'screens/ExpenseDetailScreen.tsx',
    'screens/ExpenseFormScreen.tsx', 'screens/FaqScreen.tsx', 'screens/GullakDepositDetailScreen.tsx',
    'screens/LedgerScreen.tsx', 'screens/ManageCategoriesScreen.tsx', 'screens/NotificationsScreen.tsx',
    'screens/ProfileScreen.tsx', 'screens/ResetPasswordScreen.tsx', 'components/autolog/AutoLogUi.tsx',
  ];

  it.each(PUSHED_WITH_TITLE)('%s draws its title bar with the shared ScreenHeader', (file) => {
    const src = read(`src/${file}`);
    expect(src).toMatch(/<(Shared)?ScreenHeader\b/);
    expect(src).not.toContain('<HeaderBackButton');
  });

  it('ScreenHeader: 48dp bar, 20px bold title centred on the whole bar, announced as a heading', () => {
    const src = read('src/components/ui/ScreenHeader.tsx');
    expect(src).toContain('height: ControlHeight.standard,');
    expect(src).toContain('marginTop: Spacing.micro,');
    expect(src).toContain('marginBottom: Spacing.element,');
    expect(src).toContain('fontSize: FontSize.titleMedium,');
    expect(src).toContain('fontFamily: FontFamily.bold,');
    expect(src).toContain("textAlign: 'center',");
    expect(src).toContain('accessibilityRole="header"');
    // Symmetric inset: the title layer is inset by the same `side` on the left and the right.
    expect(src).toMatch(/left: \(inset \? Spacing\.gutter : 0\) \+ side, right: \(inset \? Spacing\.gutter : 0\) \+ side/);
    expect(src).toContain('const side = Math.max(leftSide, rightSide);');
    // Long titles shrink a little instead of being cut.
    expect(src).toContain('adjustsFontSizeToFit');
  });

  it('no screen draws its own title row any more', () => {
    for (const file of PUSHED_WITH_TITLE.filter((f) => f.startsWith('screens/'))) {
      expect(read(`src/${file}`), file).not.toMatch(/styles\.(headerTitle|headerRow)\b/);
    }
  });
});

describe('Press feedback: nothing tappable is dead to the touch', () => {
  // Raw <Pressable> without pressed / ripple / onPressIn feedback that is NOT a backdrop.
  // `file#style the tag uses` → why it has no press feedback.
  const ALLOWED: Record<string, string> = {
    'components/AnimatedCategoryDonut.tsx#styles.centerPressable': 'invisible tap area in the donut centre',
    'components/profile/PauseBudgetModal.tsx#styles.modalCard': 'dialog card that only swallows taps so the backdrop does not close it',
    'screens/ExpenseFormScreen.tsx#styles.amountContainer': 'the big amount: tapping opens the keypad, which is the feedback',
  };

  it('every raw Pressable gives feedback, is a backdrop, or is listed with a reason', () => {
    const missing: string[] = [];
    for (const file of walk(SRC).filter((f) => f.endsWith('.tsx'))) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/<Pressable(?![\w.])/g)) {
        const tag = openingTag(source, m.index!);
        if (/pressed|android_ripple|onPressIn/.test(tag)) continue;
        if (/absoluteFill|styles\.(backdrop|modalOverlay)|accessible=\{false\}/.test(tag)) continue;
        if (Object.keys(ALLOWED).some((k) => k.startsWith(`${rel(file)}#`) && tag.includes(k.split('#')[1]))) continue;
        missing.push(`${rel(file)}:${source.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the shared dim is 0.7', () => {
    expect(PRESS_DIM_OPACITY).toBe(0.7);
  });

  it('no PressableOpacity falls back to the harsh 0.2 default dim', () => {
    const missing: string[] = [];
    for (const file of walk(SRC).filter((f) => f.endsWith('.tsx'))) {
      if (rel(file) === 'components/ui/PressableOpacity.tsx') continue;
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/<PressableOpacity(?![\w.])/g)) {
        if (!openingTag(source, m.index!).includes('activeOpacity')) {
          missing.push(`${rel(file)}:${source.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('Button heights: 48 in centered dialogs, 60 in bottom sheets and screen CTAs', () => {
  it('no button style uses an off-scale height (46 / 50 / 52)', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (rel(file) === 'components/KeyButton.tsx') continue; // keypad key, not a button height
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/^\s*(\w*(?:Btn|Button)\w*)\s*:\s*\{([^}]*)\}/gm)) {
        if (/\bheight:\s*(46|50|52)\b/.test(m[2])) offenders.push(`${rel(file)} ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('bottom-sheet footers use ControlHeight.cta', () => {
    expect(read('src/components/BudgetEditModal.tsx')).toMatch(/modalSaveBtn: \{\s*flex: 1,\s*height: ControlHeight\.cta/);
    expect(read('src/components/CadenceSwitchModal.tsx')).toMatch(/confirmBtn: \{\s*flex: 1,\s*height: ControlHeight\.cta/);
    expect(read('src/components/DepositGullakModal.styles.ts')).not.toMatch(/height: 52/);
    expect(ControlHeight.cta).toBe(60);
  });

  it('centered dialog buttons are 48dp', () => {
    expect(read('src/screens/ProfileScreen.styles.ts')).toMatch(/modalBtn: \{[^}]*height: ControlHeight\.standard/);
    expect(read('src/components/CustomDatePickerModal.tsx')).toContain('<AppButton label="Done"');
    expect(ControlHeight.standard).toBe(48);
  });
});

describe('Danger button is readable in every theme', () => {
  it('AppButton danger uses the alert dialog palette (>= 4.5:1 in Light, Dark and AMOLED)', () => {
    expect(read('src/components/ui/AppButton.tsx')).toContain("alertButtonPalette('destructive', colors, isAmoled)");
    for (const [colors, amoled] of [[LightColors, false], [DarkColors, false], [AmoledColors, true]] as const) {
      const p = alertButtonPalette('destructive', colors, amoled);
      expect(contrastRatio(p.background, p.text)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Scrim: every popup dims the screen the same way', () => {
  it('one value per theme', () => {
    expect(scrimColor(false, false)).toBe(SCRIM_LIGHT);
    expect(scrimColor(true, false)).toBe(SCRIM_DARK);
    expect(scrimColor(true, true)).toBe(SCRIM_AMOLED);
  });

  it('no popup keeps its own black overlay', () => {
    const POPUPS = [
      'BudgetEditModal.tsx', 'CadenceSwitchModal.tsx', 'CustomDatePickerModal.tsx', 'OtaUpdateModal.tsx',
      'PeriodRenewalModal.tsx', 'VaultSpendingGuardModal.tsx', 'DepositGullakModal.styles.ts',
      'StreakCalendarModal.styles.ts', 'MoneyExplainerModal.tsx', 'profile/DeleteAccountModal.tsx',
      'profile/EditProfileModal.tsx', 'profile/PauseBudgetModal.tsx',
    ];
    for (const f of POPUPS) {
      expect(read(`src/components/${f}`), f).not.toMatch(/rgba\(0, ?0, ?0, ?0\.(4|5|55|65|7|72|75)\)/);
    }
  });
});

describe('Empty states: one design everywhere', () => {
  const USERS: Array<[string, 'screen' | 'section']> = [
    ['screens/HistoryScreen.tsx', 'screen'],
    ['screens/NotificationsScreen.tsx', 'screen'],
    ['screens/LedgerScreen.tsx', 'screen'],
    ['screens/autolog/AutoLogReviewScreen.tsx', 'screen'],
    ['screens/FaqScreen.tsx', 'section'],
    ['components/savings/SavingsHistorySection.tsx', 'section'],
    ['screens/CategoryDetailScreen.tsx', 'section'],
    ['screens/InsightsScreen.tsx', 'section'],
  ];

  it.each(USERS)('%s uses the shared EmptyState (%s)', (file, size) => {
    const src = read(`src/${file}`);
    expect(src).toContain('<EmptyState');
    if (size === 'section') expect(src).toMatch(/<EmptyState\s+size="section"/);
    // No hand-made flat grey icon circle (design-system §9.9: icon badges are GradientIconBadge).
    expect(src).not.toMatch(/styles\.iconCircle\b/);
  });

  it('EmptyState: gradient badge, bold title, one muted line, compact button; no motion of its own', () => {
    const src = read('src/components/ui/EmptyState.tsx');
    expect(src).toContain('<GradientIconBadge');
    expect(src).toContain('screen: { badge: 72, icon: 32, title: FontSize.titleMedium');
    expect(src).toContain('section: { badge: 56, icon: 26, title: FontSize.titleSmall');
    expect(src).toContain('size="compact"');
    expect(src).not.toMatch(/react-native-reanimated|Animated\./);
  });
});

describe('Section labels: one letter spacing for every small UPPERCASE label', () => {
  it('the token is 0.8', () => {
    expect(LetterSpacing.label).toBe(0.8);
  });

  it('every caption-size uppercase label uses LetterSpacing.label', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      const at = source.indexOf('StyleSheet.create(');
      if (at < 0) continue;
      for (const m of source.slice(at).matchAll(/^ {2}(\w+): \{([^{}]*)\}/gm)) {
        const block = m[2];
        if (!/textTransform:\s*'uppercase'/.test(block) || !/fontSize:\s*FontSize\.caption\b/.test(block)) continue;
        if (!/letterSpacing:\s*LetterSpacing\.label\b/.test(block)) offenders.push(`${rel(file)} ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the all-caps captions written in capitals use it too', () => {
    for (const [file, key] of [
      ['src/screens/LedgerScreen.tsx', 'summaryLabel'], ['src/screens/LedgerScreen.tsx', 'sectionLabel'],
      ['src/components/HeroDetailsSheet.tsx', 'heroLabel'], ['src/components/WelcomeBackGapModal.tsx', 'amountLabel'],
      ['src/components/split/SettleExpenseSheet.tsx', 'sectionLabel'], ['src/components/split/MoneyBackSheet.tsx', 'breakdownHeader'],
    ]) {
      expect(read(file), `${file} ${key}`).toMatch(new RegExp(`${key}: \\{[^{}]*letterSpacing: LetterSpacing\\.label`));
    }
  });
});

describe('docs/design-system.md matches src/config/theme.ts', () => {
  const doc = read('docs/design-system.md');
  it('LetterSpacing.label', () => {
    expect(doc).toContain(`\`LetterSpacing.label\` | \`${LetterSpacing.label}px\``);
  });
  it.each(Object.entries(FontSize))('FontSize.%s = %ipx', (name, value) => {
    expect(doc).toContain(`\`FontSize.${name}\` | \`${value}px\``);
  });
  it.each(Object.entries(BorderRadius))('BorderRadius.%s = %ipx', (name, value) => {
    expect(doc).toContain(`\`BorderRadius.${name}\` | \`${value}px\``);
  });
  it.each(Object.entries(Spacing))('Spacing.%s = %ipx', (name, value) => {
    expect(doc).toContain(`\`Spacing.${name}\` | \`${value}px\``);
  });
  it.each(Object.entries(ControlHeight))('ControlHeight.%s = %ipx', (name, value) => {
    expect(doc).toContain(`\`ControlHeight.${name}\` | \`${value}px\``);
  });
  it('theme surface colours', () => {
    for (const hex of [LightColors.background, DarkColors.background, DarkColors.card, DarkColors.cardSubtle, AmoledColors.card]) {
      expect(doc).toContain(hex);
    }
  });
});

describe('Light theme: mint / coral used as text are readable (Home accents, all money amounts)', () => {
  it('mintText / coralText reach 4.5:1 on every light surface', () => {
    for (const token of ['mintText', 'coralText'] as const) {
      for (const bg of [LightColors.card, LightColors.background, LightColors.cardSubtle]) {
        expect(contrastRatio(LightColors[token], bg), `${token} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('Dark and AMOLED keep the exact brand mint / coral (no visual change there)', () => {
    for (const c of [DarkColors, AmoledColors]) {
      expect(c.mintText).toBe(c.mint);
      expect(c.coralText).toBe(c.coral);
    }
  });

  it('amounts and the Home accents use the text tokens', () => {
    const amount = read('src/components/ui/AmountText.tsx');
    expect(amount).toContain("? colors.mintText");
    expect(amount).toContain("? colors.coralText");
    const home = read('src/screens/HomeScreen.tsx');
    expect(home).toContain('styles.historyAffordanceText, { color: colors.mintText');
    expect(home).toContain('styles.networkStatusText, { color: colors.mintText }');
  });
});
