/**
 * Dev-only timing marks. In release builds every function is a no-op (no cost, no logs).
 * Usage: perfMark('fonts_ready'); ... perfSummary();
 */
type Mark = { name: string; t: number };
const marks: Mark[] = [];
const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

export function perfMark(name: string): void {
  if (!__DEV__) return;
  if (marks.some((m) => m.name === name)) return; // first occurrence only
  marks.push({ name, t: now() });
}

export function perfSummary(label = 'startup'): void {
  if (!__DEV__ || marks.length === 0) return;
  const t0 = marks[0].t;
  const lines = marks.map((m) => `${m.name.padEnd(28)} +${Math.round(m.t - t0)}ms`);
  // eslint-disable-next-line no-console
  console.log(`[perf:${label}]\n${lines.join('\n')}`);
}
