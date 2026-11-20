import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * UX-01: a button that shows only an icon must tell a screen reader what it does.
 *
 * This test reads every .tsx file in src/ and finds touchables that contain no text. Each one needs an
 * `accessibilityLabel`, or must be listed in ALLOWED below with the reason.
 */
const SRC = path.resolve(__dirname, '../src');
const TOUCHABLES = ['TouchableOpacity', 'Pressable', 'PressableOpacity', 'ReanimatedPressable', 'TouchableWithoutFeedback'];
const TEXT_CHILD = /<(Text|AppText|AmountText|Animated\.Text|Reanimated\.Text|RollingText|AppButton|[A-Z]\w*Text)\b/;

/** `file#first words of the opening tag` → why no label is needed. */
const ALLOWED: Record<string, string> = {
  // (Full-screen backdrops are hidden from the screen reader with accessible={false} since UX-06, so they are not listed.)
  // The primitive itself: callers pass the label.
  'components/ui/PressableOpacity.tsx#<Pressable': 'primitive',
  // Wrappers whose child component renders its own text (title + amount).
  'screens/history/HistoryRows.tsx#<Pressable onPress': 'wraps GullakDepositRow',
  'screens/home/HomeRecentItems.tsx#<PressableOpacity activeOpacity={0.75} onPress={handlePress}': 'wraps GullakDepositRow',
  // Buttons whose text comes from the caller as children.
  'screens/AuthScreen.tsx#<Pressable accessibilityRole="button" accessibilityState': 'AnimatedButton: children hold the text',
  'screens/ProfileSetupScreen.tsx#<Pressable accessibilityRole="button" accessibilityState': 'AnimatedButton: children hold the text',
  'screens/ResetPasswordScreen.tsx#<Pressable accessibilityRole="button" accessibilityState': 'AnimatedButton: children hold the text',
  // Decorative taps.
  'components/savings/SavingsHeroCard.tsx#<PressableOpacity activeOpacity': 'piggy bank bounce, decoration only',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
  });

interface Finding {
  key: string;
  where: string;
}

const scan = (): Finding[] => {
  const findings: Finding[] = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    for (const tag of TOUCHABLES) {
      const opener = new RegExp(`<${tag}(?![\\w.])`, 'g');
      let match: RegExpExecArray | null;
      while ((match = opener.exec(source))) {
        // End of the opening tag: the first ">" outside of any {...}.
        let depth = 0;
        let end = match.index;
        for (; end < source.length; end++) {
          const ch = source[end];
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          else if (ch === '>' && depth === 0) break;
        }
        const opening = source.slice(match.index, end + 1);
        if (/accessibilityLabel=|accessible=\{false\}/.test(opening)) continue;
        const selfClosing = source[end - 1] === '/';
        const close = selfClosing ? -1 : source.indexOf(`</${tag}>`, end);
        const inner = close > 0 ? source.slice(end + 1, close) : '';
        if (TEXT_CHILD.test(inner) || /\{\s*(children|label|title)\s*\}/.test(inner)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        const head = opening.replace(/\s+/g, ' ');
        const key = Object.keys(ALLOWED).find((k) => {
          const [f, start] = k.split('#');
          return f === rel && head.startsWith(start);
        });
        if (!key) findings.push({ key: `${rel}#${head.slice(0, 70)}`, where: `${rel}:${line}` });
      }
    }
  }
  return findings;
};

describe('UX-01: icon-only buttons have a screen-reader label', () => {
  it('every touchable without text has an accessibilityLabel (or is listed with a reason)', () => {
    const missing = scan();
    expect(missing.map((m) => `${m.where}  ${m.key}`)).toEqual([]);
  });

  it('the main icon buttons say what they do', () => {
    const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
    expect(read('components/BottomNavBar.tsx').match(/accessibilityLabel="Add transaction"/g)).toHaveLength(2);
    expect(read('components/BottomNavBar.tsx')).toContain(
      'accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}'
    );
    expect(read('components/KeyButton.tsx')).toContain("isBackspace ? 'Delete last digit'");
    expect(read('screens/ExpenseDetailScreen.tsx')).toContain('accessibilityLabel="Edit transaction"');
    expect(read('screens/ExpenseDetailScreen.tsx')).toContain('accessibilityLabel="Delete transaction"');
    expect(read('screens/NotificationsScreen.tsx')).toContain('accessibilityLabel="Mark all as read"');
    expect(read('screens/NotificationsScreen.tsx')).toContain('accessibilityLabel="Clear all notifications"');
    expect(read('screens/ExpenseFormScreen.tsx')).toContain('accessibilityLabel="Save transaction"');
    for (const screen of [
      'AddEditCategoryScreen', 'AuthScreen', 'CategoryDetailScreen', 'ExpenseDetailScreen', 'ExpenseFormScreen',
      'FaqScreen', 'GullakDepositDetailScreen', 'ManageCategoriesScreen', 'NotificationsScreen', 'ProfileScreen',
      'ProfileSetupScreen', 'ResetPasswordScreen',
    ]) {
      // Every pushed screen draws its back arrow with the shared HeaderBackButton (which carries the label),
      // directly or through ScreenHeader.
      expect(read(`screens/${screen}.tsx`), screen).toMatch(/<(HeaderBackButton|ScreenHeader)\b/);
    }
    expect(read('components/ui/HeaderBackButton.tsx')).toContain('accessibilityLabel="Go back"');
  });
});
