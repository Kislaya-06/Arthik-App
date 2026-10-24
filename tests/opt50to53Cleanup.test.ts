import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    const st = statSync(join(root, rel));
    if (st.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('OPT-50: dead files stay deleted and nothing points at them', () => {
  it('AppInput and useMoneyWaterfall are gone', () => {
    expect(existsSync(join(root, 'src/components/ui/AppInput.tsx'))).toBe(false);
    expect(existsSync(join(root, 'src/hooks/useMoneyWaterfall.ts'))).toBe(false);
  });

  it('no source or test imports them', () => {
    const files = [...sourceFiles('src'), ...sourceFiles('tests'), 'App.tsx', 'index.ts'];
    for (const f of files) {
      if (f.endsWith('opt50to53Cleanup.test.ts')) continue;
      const src = read(f);
      expect(src, f).not.toMatch(/ui\/AppInput['"]/);
      expect(src, f).not.toMatch(/useMoneyWaterfall['"]/);
    }
  });

  it('the waterfall ENGINE is still there and used (only the unused hook was removed)', () => {
    expect(existsSync(join(root, 'src/lib/moneyWaterfall.ts'))).toBe(true);
    expect(read('src/screens/HomeScreen.tsx')).toMatch(/lib\/moneyWaterfall/);
    expect(read('src/screens/SavingsScreen.tsx')).toMatch(/lib\/moneyWaterfall/);
  });

  it('docs and the repo map no longer list them', () => {
    expect(read('AGENTS.md')).not.toMatch(/AppInput|useMoneyWaterfall/);
    expect(read('docs/CODEBASE_GUIDE.md')).not.toMatch(/AppInput|useMoneyWaterfall/);
    expect(read('docs/design-system.md')).not.toMatch(/AppInput/);
    expect(read('docs/maps/daily-budget-map.md')).not.toMatch(/useMoneyWaterfall\.ts"/);
  });
});

describe('OPT-51: every console call is dev-only', () => {
  /** True when the console call at `idx` sits inside a block opened by a line that mentions __DEV__, is on a __DEV__ line, or follows an early `if (!__DEV__ ...) return`. */
  function isGuarded(lines: string[], idx: number): boolean {
    if (lines[idx].includes('__DEV__')) return true;
    for (let j = idx - 1; j >= Math.max(0, idx - 15); j--) {
      if (/if \(!__DEV__[^)]*\)\s*return/.test(lines[j])) return true;
    }
    let depth = 0;
    for (let j = idx - 1; j >= 0; j--) {
      const t = lines[j];
      for (let k = t.length - 1; k >= 0; k--) {
        const ch = t[k];
        if (ch === '}') depth++;
        else if (ch === '{') {
          if (depth === 0) {
            if (t.includes('__DEV__')) return true;
          } else depth--;
        }
      }
    }
    return false;
  }

  it('finds every console.* call in src, App.tsx and index.ts inside __DEV__', () => {
    const files = [...sourceFiles('src'), 'App.tsx', 'index.ts'];
    const bad: string[] = [];
    let total = 0;
    for (const f of files) {
      const lines = read(f).split('\n');
      lines.forEach((line, i) => {
        if (/\bconsole\.(log|warn|info|debug|error|trace)\b/.test(line) && !line.trim().startsWith('//')) {
          total += 1;
          if (!isGuarded(lines, i)) bad.push(`${relative(root, join(root, f))}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(total).toBeGreaterThan(50); // the scan really found the calls
    expect(bad).toEqual([]);
  });
});

describe('OPT-52: unused asset removed, used assets kept', () => {
  it('google.png is gone (the Google button is the GoogleIcon component)', () => {
    expect(existsSync(join(root, 'assets/google.png'))).toBe(false);
    expect(existsSync(join(root, 'src/components/GoogleIcon.tsx'))).toBe(true);
  });

  it('every other asset is still there', () => {
    for (const a of ['logo.png', 'logo_piece_1.png', 'logo_piece_2.png', 'logo_piece_3.png', 'virustotal-scan.png']) {
      expect(existsSync(join(root, 'assets', a)), a).toBe(true);
    }
    expect(read('README.md')).toMatch(/virustotal-scan\.png/);
  });

  it('nothing references google.png', () => {
    for (const f of [...sourceFiles('src'), 'App.tsx']) expect(read(f), f).not.toMatch(/google\.png/);
    expect(read('app.json')).not.toMatch(/google\.png/);
  });
});

describe('OPT-53: dead exports removed, money code untouched', () => {
  const gone: Array<[string, RegExp]> = [
    ['src/features/autoLog/db.ts', /\blocalDbExists\b/],
    ['src/features/autoLog/engine.ts', /\bprocessNotification\b/],
    ['src/lib/budgetModeUtils.ts', /\bProrationPreview\b/],
    ['src/lib/insightsCommon.ts', /\bInsightTakeawayStatus\b/],
    ['src/lib/notificationPolicy.ts', /\bpureDeficitBalancedCopy\b/],
    ['src/lib/rollingText.ts', /\bGLYPH_STRIP\b/],
    ['src/lib/splitLedger.ts', /\bknownPeopleNames\b/],
    ['src/lib/toggleMotion.ts', /\bPRESS_IN_SPRING\b/],
    ['src/store/dailyBudget/types.ts', /\bDailyBudget(Get|Set)\b/],
  ];
  for (const [file, pattern] of gone) {
    it(`${file} no longer defines ${pattern.source}`, () => {
      expect(read(file)).not.toMatch(pattern);
    });
  }

  it('look-alike live exports are untouched (getProrationPreview is still used by tests)', () => {
    expect(read('src/lib/budgetModeUtils.ts')).toMatch(/export const getProrationPreview = getUnproratedPacingPreview/);
  });

  it('money functions the guide forbids touching are still exported', () => {
    expect(read('src/money/budgetAllowance.ts')).toMatch(/export (const|function) dailyBudgetAllowanceOnDate/);
    expect(read('src/money/ledger.ts')).toMatch(/export (const|function) incomeTotalsByDateKey/);
  });

  it('the real PUR-001 notification text is still built in planActions.ts', () => {
    const src = read('src/store/dailyBudget/planActions.ts');
    expect(src).toMatch(/title: 'Pure Mode deficit balanced'/);
    expect(src).toMatch(/type: 'pure_deficit_balanced'/);
  });

  it('Auto Logging keeps SMS and email processing; payment-app pushes stay unprocessed (Option A)', () => {
    const src = read('src/features/autoLog/engine.ts');
    expect(src).toMatch(/export const processSms/);
    expect(src).toMatch(/export const processEmail/);
    expect(src).toMatch(/Option A/);
  });

  it('the removed symbols appear nowhere in src or tests', () => {
    const names = ['localDbExists', 'processNotification', 'ProrationPreview', 'InsightTakeawayStatus', 'pureDeficitBalancedCopy', 'GLYPH_STRIP', 'knownPeopleNames', 'PRESS_IN_SPRING', 'DailyBudgetGet', 'DailyBudgetSet'];
    const files = [...sourceFiles('src'), ...sourceFiles('tests'), 'App.tsx', 'index.ts'];
    for (const f of files) {
      if (f.endsWith('opt50to53Cleanup.test.ts')) continue;
      const src = read(f);
      for (const n of names) expect(src, `${f} ${n}`).not.toMatch(new RegExp(`\\b${n}\\b`));
    }
  });
});
