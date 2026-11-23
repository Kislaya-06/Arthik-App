import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { startOfWeek } from 'date-fns/startOfWeek';
import { WEEK_OPTIONS } from '../src/money/dateKeys';

const root = join(__dirname, '..');
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('weeks start on Monday, from one place (WEEK_OPTIONS)', () => {
  it('WEEK_OPTIONS is Monday', () => {
    expect(WEEK_OPTIONS.weekStartsOn).toBe(1);
    // Wednesday 14 Oct 2026 -> Monday 12 Oct 2026
    expect(startOfWeek(new Date(2026, 9, 14), WEEK_OPTIONS).getDate()).toBe(12);
  });

  it('no source file writes its own weekStartsOn, and every week function gets WEEK_OPTIONS', () => {
    const bad: string[] = [];
    for (const f of sourceFiles('src')) {
      if (f.replace(/\\/g, '/').endsWith('src/money/dateKeys.ts')) continue;
      readFileSync(join(root, f), 'utf8').split('\n').forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('import')) return;
        if (/weekStartsOn\s*:/.test(code)) bad.push(`${f}:${i + 1} own weekStartsOn`);
        if (/\b(startOfWeek|endOfWeek|isSameWeek)\(/.test(code) && !code.includes('WEEK_OPTIONS')) bad.push(`${f}:${i + 1} missing WEEK_OPTIONS`);
      });
    }
    expect(bad).toEqual([]);
  });
});
