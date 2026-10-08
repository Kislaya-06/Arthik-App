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
