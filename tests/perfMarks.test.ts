import { describe, it, expect, vi, beforeEach } from 'vitest';
import { perfMark, perfSummary } from '../src/lib/perfMarks';

describe('perfMarks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records marks and logs summary in dev', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    perfMark('test_mark_1');
    perfMark('test_mark_2');
    perfMark('test_mark_1'); // duplicate should be ignored

    perfSummary('test');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('[perf:test]');
    expect(logCall).toContain('test_mark_1');
    expect(logCall).toContain('test_mark_2');
  });
});
