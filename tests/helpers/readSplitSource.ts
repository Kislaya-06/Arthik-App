import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Source of a file AFTER the facade split (AGENTS.md 6.1, code-health pass): the file itself, its sibling
 * `<Name>.styles.ts` and every file in its split folder (e.g. `src/screens/history/` for HistoryScreen,
 * `src/components/budgetEdit/` for BudgetEditModal). Source-reading tests use it so a pure move of code into a
 * submodule keeps every assertion exactly as it was.
 *
 * `folder` is the split folder name when it is not derived from the file name.
 */
const ROOT = path.resolve(__dirname, '..', '..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(n) ? [full] : [];
  });

export function readSplitSource(relFile: string, folder?: string): string {
  const abs = path.join(ROOT, relFile);
  const dir = path.dirname(abs);
  const base = path.basename(abs).replace(/\.tsx?$/, '');
  const parts = [readFileSync(abs, 'utf8')];
  const styles = path.join(dir, `${base}.styles.ts`);
  if (existsSync(styles)) parts.push(readFileSync(styles, 'utf8'));
  const derived = base.replace(/(Screen|Modal|Store|Sheet)$/, '');
  const folderName = folder ?? derived.charAt(0).toLowerCase() + derived.slice(1);
  const splitDir = path.join(dir, folderName);
  if (existsSync(splitDir) && statSync(splitDir).isDirectory()) {
    for (const f of walk(splitDir)) parts.push(readFileSync(f, 'utf8'));
  }
  return parts.join('\n');
}
