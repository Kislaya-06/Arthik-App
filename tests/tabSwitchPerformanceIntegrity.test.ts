import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PERF: Tab Switching and Screen Transition Integrity', () => {
  const navFilePath = path.resolve(__dirname, '../src/navigation/index.tsx');
  const navContent = fs.readFileSync(navFilePath, 'utf8');
  const insightsFilePath = path.resolve(__dirname, '../src/screens/InsightsScreen.tsx');
  const insightsContent = fs.readFileSync(insightsFilePath, 'utf8');
  const donutFilePath = path.resolve(__dirname, '../src/components/AnimatedCategoryDonut.tsx');
  const donutContent = fs.readFileSync(donutFilePath, 'utf8');

  it('keeps Tab.Navigator animation as none to eliminate dark crossfade blink', () => {
    // Bottom tabs must never cross-fade (animation: 'fade' creates an opacity dip)
    expect(navContent).toContain("animation: 'none'");
    expect(navContent).not.toMatch(/<Tab\.Navigator[^>]*animation:\s*'fade'/);
  });

  it('disables freezeOnBlur on bottom tabs to prevent Android unfreeze layout hitches', () => {
    expect(navContent).toContain('freezeOnBlur: false');
    expect(navContent).not.toMatch(/<Tab\.Navigator[^>]*freezeOnBlur:\s*true/);
  });

  it('applies contentStyle background to Stack.Navigator to prevent window canvas flash', () => {
    expect(navContent).toContain('contentStyle: { backgroundColor: colors.background }');
  });

  it('does not re-collapse Insights charts on casual tab focus', () => {
    // focusSeq must NOT trigger chart collapse on tab switch
    expect(insightsContent).not.toContain('setFocusSeq');
    expect(insightsContent).not.toContain('focusSeq');
  });

  it('AnimatedCategoryDonut does not collapse to zero sweep on tab blur', () => {
    // Donut should retain drawn state when user switches tabs
    expect(donutContent).not.toMatch(/if\s*\(!isFocused\)\s*\{\s*sweep\.value\s*=\s*0/);
  });
});
