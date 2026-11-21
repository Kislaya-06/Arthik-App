import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Button size ladder (design-system "Button sizes"): every button is one of three heights.
 *  - 60 `ControlHeight.cta`      full-width buttons at the bottom of a page or a bottom sheet (a stack shares it)
 *  - 48 `ControlHeight.standard` buttons in centered dialogs, and full-width buttons inside a card / content block
 *  - 36 `ControlHeight.compact`  small pill actions inside content (Change, See More, Edit, empty-state actions)
 */
const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

/** The JSX of the <AppButton> whose label is `label` (props up to the closing `/>` of the button itself). */
function appButton(src: string, label: string): string {
  const at = src.indexOf(label);
  expect(at, `label ${label} not found`).toBeGreaterThan(-1);
  const start = src.lastIndexOf('<AppButton', at);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') depth--;
    if (depth === 0 && src.startsWith('/>', i)) return src.slice(start, i + 2);
  }
  throw new Error('unterminated AppButton');
}

describe('Button size ladder: page / sheet buttons are 60', () => {
  it('Profile Log Out and Delete Account match every other page button (60)', () => {
    const src = read('src/screens/ProfileScreen.tsx');
    expect(appButton(src, 'label="Log Out"')).toMatch(/size="cta"/);
    expect(appButton(src, 'label="Delete Account"')).toMatch(/size="cta"/);
  });

  it('a secondary button stacked under a 60 button is 60 too (Automatic Logging pages)', () => {
    const setup = read('src/screens/autolog/AutoLogSetupScreen.tsx');
    for (const label of ['label="App info"', 'label="Skip for now"', "label=\"I'll do it later\""]) {
      expect(appButton(setup, label)).toMatch(/size="cta"/);
    }
    expect(appButton(read('src/screens/autolog/AutoLogIntroScreen.tsx'), 'label="Not now"')).toMatch(/size="cta"/);
  });

  it('bottom sheets use 60: the spending guard sheet and the welcome-back sheet', () => {
    const vault = read('src/components/VaultSpendingGuardModal.tsx');
    expect(vault).toMatch(/primaryButton:\s*\{[\s\S]*?height:\s*ControlHeight\.cta/);
    expect(vault).toMatch(/cancelButton:\s*\{[\s\S]*?height:\s*ControlHeight\.cta/);
    expect(appButton(read('src/components/WelcomeBackGapModal.tsx'), 'label="Skip for now"')).toMatch(/size="cta"/);
  });
});

describe('Button size ladder: centered dialogs are 48', () => {
  it('the update popup and the money explainer use 48 like every other dialog', () => {
    const ota = read('src/components/OtaUpdateModal.tsx');
    expect(appButton(ota, 'label="Got it"')).toMatch(/size="standard"/);
    expect(appButton(ota, "'Update Now'")).toMatch(/size="standard"/);
    expect(appButton(read('src/components/MoneyExplainerModal.tsx'), 'label="Got It"')).toMatch(/size="standard"/);
  });
});

describe('Button size ladder: small pill actions are 36', () => {
  it.each([
    ['src/screens/SavingsScreen.styles.ts', 'ucChangeBtn'],
    ['src/screens/SavingsScreen.styles.ts', 'seeMoreBtn'],
    ['src/screens/HistoryScreen.styles.ts', 'seeMoreBtn'],
    ['src/screens/ProfileScreen.styles.ts', 'editProfileBtn'],
    ['src/screens/ExpenseFormScreen.styles.ts', 'createCategoryBtn'],
    ['src/components/split/SplitExtras.tsx', 'equalBtn'],
    ['src/components/split/SplitExtras.tsx', 'addPersonBtn'],
    ['src/components/autolog/AutoLogUi.tsx', 'fixBtn'],
  ])('%s %s is ControlHeight.compact with no padding-made height', (file, style) => {
    const m = read(file).match(new RegExp(`\\b${style}:\\s*\\{([^{}]*)\\}`));
    expect(m, `${style} not found`).toBeTruthy();
    expect(m![1]).toMatch(/height:\s*ControlHeight\.compact/);
    expect(m![1]).not.toMatch(/paddingVertical/);
  });
});
