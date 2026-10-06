import { describe, it, expect } from 'vitest';
import { parseSms, parseNotification, templateOf, maskSensitive, resolveBank } from '../src/features/autoLog/parser';
import { isCrossSourceMatch, isSameSourceDuplicate, isOwnTransferPair, formatGap } from '../src/features/autoLog/matching';

describe('parseSms — completed transactions', () => {
  it('HDFC UPI debit', () => {
    const p = parseSms('VM-HDFCBK-S', 'Sent Rs.349.00 From HDFC Bank A/C *1234 To ZOMATO On 05/10/26 Ref 628712345678 Not You? Call 18002586161');
    expect(p.kind).toBe('txn');
    expect(p.amount).toBe(349);
    expect(p.direction).toBe('debit');
    expect(p.last4).toBe('1234');
    expect(p.bankCode).toBe('HDFC');
    expect(p.merchant).toBe('Zomato');
    expect(p.ref).toBe('628712345678');
  });

  it('SBI debit without currency symbol', () => {
    const p = parseSms('JD-SBIUPI-S', 'Dear UPI user A/C X7821 debited by 500.0 on date 05Oct26 trf to RAHUL KUMAR Refno 528112345678. If not u? call 1800111109. -SBI');
    expect(p.kind).toBe('txn');
    expect(p.amount).toBe(500);
    expect(p.direction).toBe('debit');
    expect(p.last4).toBe('7821');
    expect(p.merchant).toBe('Rahul Kumar');
  });

  it('ICICI debit with payee credited later in the text', () => {
    const p = parseSms('AD-ICICIT-S', 'ICICI Bank Acct XX567 debited for Rs 500.00 on 05-Oct-26; Rahul credited. UPI:628799999999. Call 18002662 for dispute.');
    expect(p.direction).toBe('debit');
    expect(p.amount).toBe(500);
    expect(p.last4).toBe('567');
    expect(p.merchant).toBe('Rahul');
  });

  it('credit from a person', () => {
    const p = parseSms('AX-HDFCBK', 'Rs.2000.00 credited to HDFC Bank A/c XX1234 on 05-10-26 from VPA rahul.k@okaxis (UPI 628700000001)');
    expect(p.kind).toBe('txn');
    expect(p.direction).toBe('credit');
    expect(p.amount).toBe(2000);
    expect(p.creditKind).toBe('person');
    expect(p.merchant).toBe('Rahul K');
  });

  it('never uses the balance as the amount', () => {
    const p = parseSms('VK-KOTAKB', 'Avl Bal Rs 45,210.55. Rs 120 debited from a/c XX4567 at SWIGGY on 05-Oct');
    expect(p.amount).toBe(120);
  });

  it('salary credit', () => {
    const p = parseSms('AX-HDFCBK', 'Your A/c XX1234 is credited with INR 85,000.00 on 01-Oct towards SALARY OCT. Avl bal INR 1,02,000.00');
    expect(p.creditKind).toBe('salary');
    expect(p.amount).toBe(85000);
  });

  it('credit card bill payment is flagged', () => {
    const p = parseSms('AX-ICICIT', 'Payment of Rs 12,500 received towards your ICICI Bank Credit Card XX9012. Thank you.');
    expect(p.isCardBill).toBe(true);
  });
});

describe('parseSms — not transactions', () => {
  it.each([
    ['will be debited', 'Rs 499 will be debited from your a/c XX1234 on 10-Oct for NETFLIX mandate'],
    ['collect request', 'Rahul has requested money Rs 500 from you on UPI. Pay via app.'],
    ['failed', 'Your txn of Rs 300 at AMAZON using card XX1111 has failed due to insufficient balance'],
    ['due', 'Your HDFC Credit Card bill of Rs 4,500 is due on 15-Oct. Min amount due Rs 225'],
  ])('%s', (_label, body) => {
    expect(parseSms('VM-HDFCBK', body).kind).not.toBe('txn');
  });

  it('balance only', () => {
    expect(parseSms('VM-HDFCBK', 'Available balance in your a/c XX1234 is Rs 12,000.00 as on 05-Oct').kind).toBe('balance');
  });

  it('otp', () => {
    expect(parseSms('VM-HDFCBK', '123456 is your OTP for txn of Rs 500 at AMAZON').kind).toBe('otp');
  });
});

describe('parseNotification', () => {
  it('PhonePe paid', () => {
    const p = parseNotification('PhonePe', 'Paid ₹349 to Zomato', 'Payment successful');
    expect(p.kind).toBe('txn');
    expect(p.direction).toBe('debit');
    expect(p.amount).toBe(349);
    expect(p.merchant).toBe('Zomato');
  });
  it('GPay received', () => {
    const p = parseNotification('Google Pay', 'Rahul sent you ₹2,000', '');
    expect(p.direction).toBe('credit');
    expect(p.amount).toBe(2000);
  });
  it('ignores collect requests', () => {
    expect(parseNotification('Google Pay', 'Rahul requested ₹500', 'Tap to pay').kind).not.toBe('txn');
  });
});

describe('templates and masking', () => {
  it('same format, different numbers → same template', () => {
    const a = templateOf('VM-HDFCBK', 'Sent Rs.20 From HDFC Bank A/C *1234 To Chai Point On 05/10 Ref 111111111111');
    const b = templateOf('AX-HDFCBK', 'Sent Rs.999 From HDFC Bank A/C *1234 To Big Bazaar On 06/10 Ref 222222222222');
    expect(a).toBe(b);
  });
  it('masks long numbers', () => {
    expect(maskSensitive('Ref 628712345678')).not.toContain('62871234');
  });
  it('resolves unknown banks without crashing', () => {
    expect(resolveBank('XY-FOOBNK').code).toBe('FOOBNK');
  });
});

describe('matching rules', () => {
  const t = Date.UTC(2026, 9, 5, 10, 30);
  it('notification + SMS match', () => {
    expect(isCrossSourceMatch(
      { amount: 349, direction: 'debit', occurredAt: t, ref: null },
      { amount: 349, direction: 'debit', occurredAt: t + 60_000, ref: '1' }
    )).toBe(true);
  });
  it('different refs never match', () => {
    expect(isCrossSourceMatch(
      { amount: 349, direction: 'debit', occurredAt: t, ref: 'A1' },
      { amount: 349, direction: 'debit', occurredAt: t, ref: 'B2' }
    )).toBe(false);
  });
  it('two genuine ₹20 SMS stay separate', () => {
    expect(isSameSourceDuplicate(
      { amount: 20, direction: 'debit', occurredAt: t, ref: null, fingerprint: 'x' },
      { amount: 20, direction: 'debit', occurredAt: t + 4 * 60_000, ref: null, fingerprint: 'y' }
    )).toBe(false);
  });
  it('own transfer pair', () => {
    expect(isOwnTransferPair(
      { amount: 10000, direction: 'debit', occurredAt: t, ref: null, accountKey: 'HDFC:1234' },
      { amount: 10000, direction: 'credit', occurredAt: t + 120_000, ref: null, accountKey: 'SBI:7821' }
    )).toBe(true);
  });
  it('gap formatting', () => {
    expect(formatGap((2 * 24 + 2) * 3600_000)).toBe('2 days, 2 hours');
  });
});
