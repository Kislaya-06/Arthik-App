import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { LightColors, DarkColors, AmoledColors } from '../src/config/theme';

const SRC = path.resolve(__dirname, '../src');
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
  });

describe('UX-05: the profile setup avatar does not promise a photo upload', () => {
  const setup = read('screens/ProfileSetupScreen.tsx');
  it('is a plain picture: no tap handler, no camera badge', () => {
    expect(setup).not.toContain('handleAvatarPress');
    expect(setup).not.toContain('lucide-react-native/icons/camera');
    expect(setup).not.toContain('cameraBadge');
    expect(setup).toContain('<View style={styles.avatarWrapper} accessible={false} importantForAccessibility="no-hide-descendants">');
  });
});

describe('UX-06: full-screen backdrops are skipped by the screen reader', () => {
  const HIDDEN = 'accessible={false} importantForAccessibility="no"';
  it.each([
    ['components/CadenceSwitchModal.tsx', `<Pressable style={StyleSheet.absoluteFill} onPress={onClose} ${HIDDEN} />`],
    ['components/VaultSpendingGuardModal.tsx', `<Pressable style={StyleSheet.absoluteFill} onPress={onClose} ${HIDDEN} />`],
    ['components/PeriodRenewalModal.tsx', `<Pressable style={StyleSheet.absoluteFill} onPress={onClose} ${HIDDEN} />`],
    ['components/CustomDatePickerModal.tsx', `<Pressable style={styles.backdrop} onPress={onClose} ${HIDDEN} />`],
    ['components/ui/BottomSheetModal.tsx', `<PressableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} ${HIDDEN} />`],
    ['screens/autolog/AutoLogReviewScreen.tsx', `<Pressable style={StyleSheet.absoluteFill} onPress={closeSwipe} ${HIDDEN} />`],
  ])('%s', (file, jsx) => {
    expect(read(file)).toContain(jsx); // still closes on tap: onPress is unchanged
  });

  it('components/MoneyExplainerModal.tsx', () => {
    const source = read('components/MoneyExplainerModal.tsx');
    const at = source.indexOf('accessible={false}');
    expect(at).toBeGreaterThan(0);
    const tag = source.slice(source.lastIndexOf('<Pressable', at), source.indexOf('/>', at));
    expect(tag).toContain('importantForAccessibility="no"');
    expect(tag).toContain('StyleSheet.absoluteFill');
    expect(tag).toContain('onPress={onClose}');
  });

  it('every modal still closes with the Android back button', () => {
    let modals = 0;
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/<Modal(?![\w.])/g)) {
        // End of the opening tag: the first ">" outside of any {...}.
        let depth = 0;
        let end = m.index!;
        for (; end < source.length; end++) {
          const ch = source[end];
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          else if (ch === '>' && depth === 0) break;
        }
        modals++;
        expect(source.slice(m.index!, end), path.relative(SRC, file)).toContain('onRequestClose=');
      }
    }
    expect(modals).toBeGreaterThan(10);
  });
});

describe('UX-07: Edit profile works with autofill and the Enter key', () => {
  const modal = read('components/profile/EditProfileModal.tsx');
  it('first name → Enter → last name; both fields have autofill hints and a screen-reader name', () => {
    expect(modal).toContain('autoComplete="given-name"');
    expect(modal).toContain('autoComplete="family-name"');
    expect(modal).toContain('onSubmitEditing={() => lastNameInputRef.current?.focus()}');
    expect(modal).toContain('ref={lastNameInputRef}');
    expect(modal).toContain('accessibilityLabel="First name"');
    expect(modal).toContain('accessibilityLabel="Last name"');
  });
});

describe('UX-08: colours come from theme tokens', () => {
  it('white, forestGreen, mint and coral are the same in Light, Dark and AMOLED (so swapping a literal for them changes no pixel)', () => {
    for (const [token, hex] of [['white', '#FFFFFF'], ['forestGreen', '#1A2B4C'], ['mint', '#B8E0C8'], ['coral', '#F4B8AE']] as const) {
      expect(LightColors[token], token).toBe(hex);
      expect(DarkColors[token], token).toBe(hex);
      expect(AmoledColors[token], token).toBe(hex);
    }
  });

  it('the streak calendar uses tokens where it had Dark-only values (AMOLED now gets its own colours)', () => {
    const calendar = read('components/StreakCalendarModal.tsx');
    expect(calendar).not.toContain("isDark ? '#F8FAFC'");
    expect(calendar).not.toContain("isDark ? '#1A263B' : '#F5F6F9'");
    expect(calendar).toContain('backgroundColor: colors.cardSubtle,');
    expect(calendar).toContain('{ borderColor: colors.textPrimary },');
  });

  it('the number of hard-coded hex colours in screens and components only goes down', () => {
    const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;
    const count = [...walk(path.join(SRC, 'screens')), ...walk(path.join(SRC, 'components'))]
      .map((file) => (readFileSync(file, 'utf8').match(HEX) ?? []).length)
      .reduce((a, b) => a + b, 0);
    // 552 before UX-08, 491 after, 484 after the UI consistency pass (ADR 0021). Lower this number when
    // more are moved to tokens; never raise it.
    expect(count).toBeLessThanOrEqual(484);
  });
});
