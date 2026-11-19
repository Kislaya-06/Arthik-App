import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (file: string) => readFileSync(path.resolve(__dirname, '../src', file), 'utf8');

/** The JSX of one `<AuthFormField ... />` whose label is `label`. */
const field = (source: string, label: string): string => {
  const at = source.indexOf(`label="${label}"`);
  expect(at, `field ${label}`).toBeGreaterThan(0);
  const start = source.lastIndexOf('<AuthFormField', at);
  const end = source.indexOf('/>', at);
  return source.slice(start, end);
};

describe('UX-02: sign-in forms work with autofill and the keyboard', () => {
  const formField = read('components/ui/AuthFormField.tsx');

  it('AuthFormField passes the new options to the text input', () => {
    for (const line of [
      'ref={inputRef}',
      'accessibilityLabel={label}',
      'autoComplete={autoComplete}',
      'textContentType={textContentType}',
      'autoCorrect={autoCorrect ?? (isPassword ? false : undefined)}',
      'maxLength={maxLength}',
      'submitBehavior={submitBehavior}',
    ]) {
      expect(formField, line).toContain(line);
    }
  });

  it('Auth screen: name → email → password with Enter, password submits, autofill hints set', () => {
    const auth = read('screens/AuthScreen.tsx');
    const name = field(auth, 'FULL NAME');
    expect(name).toContain('autoComplete="name"');
    expect(name).toContain('maxLength={50}'); // profiles_first_name_len on the server
    expect(name).toContain('onSubmitEditing={() => emailInputRef.current?.focus()}');

    const email = field(auth, 'EMAIL');
    expect(email).toContain('autoComplete="email"');
    expect(email).toContain('autoCorrect={false}');
    expect(email).toContain('inputRef={emailInputRef}');
    expect(email).toContain('returnKeyType="next"');
    expect(email).toContain('onSubmitEditing={() => passwordInputRef.current?.focus()}');

    const password = field(auth, 'PASSWORD');
    expect(password).toContain("autoComplete={isSignUp ? 'new-password' : 'current-password'}");
    expect(password).toContain('inputRef={passwordInputRef}');
    expect(password).toContain('onSubmitEditing={handleAuth}');
    // handleAuth already ignores a second call while a request is running
    expect(auth).toContain('if (authLoading || googleLoading || forgotLoading) return;');
  });

  it('Reset password screen: new-password hints, Enter moves on, last field submits', () => {
    const reset = read('screens/ResetPasswordScreen.tsx');
    const first = field(reset, 'NEW PASSWORD');
    expect(first).toContain('autoComplete="new-password"');
    expect(first).toContain('onSubmitEditing={() => confirmInputRef.current?.focus()}');
    const second = field(reset, 'CONFIRM NEW PASSWORD');
    expect(second).toContain('autoComplete="new-password"');
    expect(second).toContain('inputRef={confirmInputRef}');
    expect(second).toContain('onSubmitEditing={handleUpdatePassword}');
  });

  it('Profile setup: Enter on the first name moves to the last name', () => {
    const setup = read('screens/ProfileSetupScreen.tsx');
    expect(field(setup, 'FIRST NAME')).toContain('onSubmitEditing={() => lastNameInputRef.current?.focus()}');
    expect(field(setup, 'LAST NAME')).toContain('inputRef={lastNameInputRef}');
    expect(field(setup, 'LAST NAME')).toContain('onSubmitEditing={handleSubmit}');
  });
});

describe('UX-03: with the keyboard open, the first tap works', () => {
  it('History list, FAQ lists and the Gullak deposit sheet keep taps while the keyboard is open', () => {
    const history = read('screens/HistoryScreen.tsx');
    expect(history).toContain('keyboardShouldPersistTaps="handled"');
    expect(history).toContain('keyboardDismissMode="on-drag"');
    expect(read('screens/FaqScreen.tsx').match(/keyboardShouldPersistTaps="handled"/g)).toHaveLength(2);
    expect(read('screens/FaqScreen.tsx')).toContain('keyboardDismissMode="on-drag"');
    expect(read('components/DepositGullakModal.tsx')).toContain('keyboardShouldPersistTaps="handled"');
  });

  it('search fields show a Search key and do not auto-correct', () => {
    const history = read('screens/HistoryScreen.tsx');
    const input = history.slice(history.indexOf('placeholder="Search transactions..."'), history.indexOf('searchQuery.length > 0'));
    expect(input).toContain('returnKeyType="search"');
    expect(input).toContain('autoCorrect={false}');
    expect(input).toContain('accessibilityLabel="Search transactions"');
    expect(read('screens/FaqScreen.tsx')).toContain('returnKeyType="search"');
  });
});

describe('UX-04: sign-in errors are announced by the screen reader', () => {
  it('the message banner and the field error are live regions', () => {
    expect(read('components/ui/AuthMessageBanner.tsx')).toContain('accessibilityLiveRegion="polite"');
    expect(read('components/ui/AuthFormField.tsx')).toContain('accessibilityLiveRegion="polite"');
  });
});
