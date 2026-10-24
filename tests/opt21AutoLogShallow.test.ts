import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('OPT-21: AutoLog screens do not subscribe to the whole store', () => {
  for (const file of ['src/screens/autolog/AutoLogCenterScreen.tsx', 'src/screens/autolog/AutoLogInfoScreen.tsx']) {
    it(`${file} picks fields with useShallow`, () => {
      const src = read(file);
      expect(src).not.toMatch(/const s = useAutoLogStore\(\);/);
      expect(src).toMatch(/useShallow/);
      // every s.<field> used in JSX/handlers must be in the shallow pick
      const used = new Set([...src.matchAll(/\bs\.([a-zA-Z]+)/g)].map((m) => m[1]).filter((f) => f !== 'user'));
      const pick = src.match(/useShallow\(\(st\) => \(\{([^}]*)\}\)\)/)?.[1] ?? '';
      for (const f of used) expect(pick, `${file}: missing ${f}`).toContain(`${f}: st.${f}`);
    });
  }
});
