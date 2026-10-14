import { describe, it, expect } from 'vitest';
import { mapRemoteRowsToDayLog, RemoteSavingsRow } from '../src/lib/streakCalendarData';

describe('streakCalendarData - mapRemoteRowsToDayLog', () => {
  it('returns an empty map when input is empty array, null, or undefined', () => {
    expect(mapRemoteRowsToDayLog([])).toEqual({});
    expect(mapRemoteRowsToDayLog(null)).toEqual({});
    expect(mapRemoteRowsToDayLog(undefined)).toEqual({});
  });

  it('handles unknown status row: maps to status unknown and amount 0', () => {
    const rows: RemoteSavingsRow[] = [
      { date: '2026-10-01', status: 'unknown', amount_saved: 150 },
    ];
    const result = mapRemoteRowsToDayLog(rows);
    expect(result['2026-10-01']).toEqual({
      date: '2026-10-01',
      status: 'unknown',
      amount: 0,
    });
  });

  it('handles saved status with positive amount: maps to status saved and converted amount', () => {
    const rows: RemoteSavingsRow[] = [
      { date: '2026-10-02', status: 'saved', amount_saved: 250 },
      { date: '2026-10-03', status: 'saved', amount_saved: '100.5' },
    ];
    const result = mapRemoteRowsToDayLog(rows);
    expect(result['2026-10-02']).toEqual({
      date: '2026-10-02',
      status: 'saved',
      amount: 250,
    });
    expect(result['2026-10-03']).toEqual({
      date: '2026-10-03',
      status: 'saved',
      amount: 100.5,
    });
  });

  it('maps saved status with 0 or negative amount to missed', () => {
    const rows: RemoteSavingsRow[] = [
      { date: '2026-10-04', status: 'saved', amount_saved: 0 },
      { date: '2026-10-05', status: 'saved', amount_saved: '0' },
      { date: '2026-10-06', status: 'saved', amount_saved: -50 },
    ];
    const result = mapRemoteRowsToDayLog(rows);
    expect(result['2026-10-04']).toEqual({
      date: '2026-10-04',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-05']).toEqual({
      date: '2026-10-05',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-06']).toEqual({
      date: '2026-10-06',
      status: 'missed',
      amount: -50,
    });
  });

  it('handles missed status row with amount', () => {
    const rows: RemoteSavingsRow[] = [
      { date: '2026-10-07', status: 'missed', amount_saved: 0 },
      { date: '2026-10-08', status: 'missed', amount_saved: 50 },
    ];
    const result = mapRemoteRowsToDayLog(rows);
    expect(result['2026-10-07']).toEqual({
      date: '2026-10-07',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-08']).toEqual({
      date: '2026-10-08',
      status: 'missed',
      amount: 50,
    });
  });

  it('handles null, undefined, and NaN amount_saved values', () => {
    const rows: RemoteSavingsRow[] = [
      { date: '2026-10-09', status: 'saved', amount_saved: null },
      { date: '2026-10-10', status: 'saved', amount_saved: undefined },
      { date: '2026-10-11', status: 'saved', amount_saved: 'not-a-number' },
      { date: '2026-10-12', status: 'missed', amount_saved: null },
    ];
    const result = mapRemoteRowsToDayLog(rows);
    expect(result['2026-10-09']).toEqual({
      date: '2026-10-09',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-10']).toEqual({
      date: '2026-10-10',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-11']).toEqual({
      date: '2026-10-11',
      status: 'missed',
      amount: 0,
    });
    expect(result['2026-10-12']).toEqual({
      date: '2026-10-12',
      status: 'missed',
      amount: 0,
    });
  });
});
