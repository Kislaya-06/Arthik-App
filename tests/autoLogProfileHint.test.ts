import { describe, it, expect } from 'vitest';
import { profileRowHint, STATE_COPY } from '../src/features/autoLog/copy';

describe('profileRowHint (Automatic Logging row on Profile)', () => {
  it('missing setup tells the user what to do, not just that something is wrong', () => {
    expect(profileRowHint('setup_missing', false)).toBe('Tap to set it up again');
  });

  it('off keeps its invitation line', () => {
    expect(profileRowHint('off', false)).toBe('Log bank SMS & UPI payments automatically');
  });

  it('every other state uses the shared vocabulary (spec §46)', () => {
    expect(profileRowHint('live', false)).toBe(STATE_COPY.live.title);
    expect(profileRowHint('live', true)).toBe(STATE_COPY.attention.title);
    expect(profileRowHint('paused', false)).toBe(STATE_COPY.paused.title);
  });

  it('the shared vocabulary itself is unchanged', () => {
    expect(STATE_COPY.setup_missing.title).toBe('Auto-Logging setup not found');
  });
});
