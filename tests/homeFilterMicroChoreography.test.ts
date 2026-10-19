import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILTER_DECOUPLE_DELAY_MS } from '../src/lib/homeCalculations';

describe('Home Filter Pill Micro-Choreography & Decoupling Invariant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('immediately updates selected pill indicator on Frame 0, but defers heavy calculations by FILTER_DECOUPLE_DELAY_MS (220ms)', () => {
    let pillFilter = 'Daily';
    let dataFilter = 'Daily';
    let heavyCalculationRuns = 0;

    let filterTimer: ReturnType<typeof setTimeout> | null = null;

    const handleFilterChange = (newFilter: string) => {
      if (newFilter === pillFilter) return;

      // Frame 0: Instant UI state update
      pillFilter = newFilter;

      if (filterTimer) clearTimeout(filterTimer);

      filterTimer = setTimeout(() => {
        dataFilter = newFilter;
        heavyCalculationRuns++;
      }, FILTER_DECOUPLE_DELAY_MS);
    };

    // User taps "Monthly"
    handleFilterChange('Monthly');

    // Frame 0 assertion: Pill is already "Monthly", but heavy calculation has NOT run yet
    expect(pillFilter).toBe('Monthly');
    expect(dataFilter).toBe('Daily');
    expect(heavyCalculationRuns).toBe(0);

    // Fast-forward 110ms (pill mid-flight across slots on UI thread)
    vi.advanceTimersByTime(110);
    expect(pillFilter).toBe('Monthly');
    expect(dataFilter).toBe('Daily');
    expect(heavyCalculationRuns).toBe(0);

    // Fast-forward remaining 110ms (total 220ms - pill has arrived at Monthly)
    vi.advanceTimersByTime(110);
    expect(pillFilter).toBe('Monthly');
    expect(dataFilter).toBe('Monthly');
    expect(heavyCalculationRuns).toBe(1);
  });

  it('cancels intermediate calculations during rapid sequential tab switching and executes only the final filter', () => {
    let pillFilter = 'Daily';
    let dataFilter = 'Daily';
    let heavyCalculationRuns = 0;

    let filterTimer: ReturnType<typeof setTimeout> | null = null;

    const handleFilterChange = (newFilter: string) => {
      if (newFilter === pillFilter) return;

      pillFilter = newFilter;

      if (filterTimer) clearTimeout(filterTimer);

      filterTimer = setTimeout(() => {
        dataFilter = newFilter;
        heavyCalculationRuns++;
      }, FILTER_DECOUPLE_DELAY_MS);
    };

    // User rapidly taps: Daily -> Weekly (at 0ms) -> Monthly (at 60ms) -> All (at 120ms)
    handleFilterChange('Weekly');
    expect(pillFilter).toBe('Weekly');

    vi.advanceTimersByTime(60);
    handleFilterChange('Monthly');
    expect(pillFilter).toBe('Monthly');

    vi.advanceTimersByTime(60);
    handleFilterChange('All');
    expect(pillFilter).toBe('All');

    // At 120ms, zero heavy calculation passes have executed
    expect(heavyCalculationRuns).toBe(0);
    expect(dataFilter).toBe('Daily');

    // Complete the remaining 220ms timer from the last tap
    vi.advanceTimersByTime(220);

    // Only the final destination 'All' executed exactly once
    expect(pillFilter).toBe('All');
    expect(dataFilter).toBe('All');
    expect(heavyCalculationRuns).toBe(1);
  });
});
