import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../src/lib/formatters';

describe('formatCurrency', () => {
  it('formats a positive whole number with Indian Rupee symbol and commas', () => {
    expect(formatCurrency(52000)).toBe('₹52,000');
  });
});
