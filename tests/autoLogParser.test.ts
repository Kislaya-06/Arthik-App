import { describe, it, expect } from 'vitest';
import { parseSms, parseNotification, templateOf, maskSensitive, resolveBank, cleanMerchant } from '../src/features/autoLog/parser';
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

describe('AL-01..09: bank SMS formats the parser could not read fully', () => {
  const sms = (sender: string, body: string) => parseSms(sender, body);

  it('AL-01: EMI message uses the account that paid, not the loan account', () => {
    const p = sms('VM-HDFCBK-S', 'EMI of Rs.3,500.00 for Loan A/c XX5678 has been debited from your A/c XX1234 on 05-11-26.');
    expect(p).toMatchObject({ kind: 'txn', amount: 3500, direction: 'debit', last4: '1234' });
  });

  it('AL-01: a message that names only the loan account keeps it', () => {
    expect(sms('VM-HDFCBK-S', 'Rs.3,500.00 debited towards EMI of Loan A/c XX5678 on 05-11-26.').last4).toBe('5678');
  });

  it('AL-02: "Rs.450 Dr. from A/C ... and Cr. to" (Bank of Baroda)', () => {
    const p = sms('VM-BOBTXN-S', 'Rs.450 Dr. from A/C XXXXXX1234 and Cr. to swiggy@ybl. Ref:430512345678. AvlBal:Rs2000(2026:11:05 12:30:00). Not you? Call 18005700-BOB');
    expect(p).toMatchObject({ kind: 'txn', amount: 450, direction: 'debit', last4: '1234', merchant: 'Swiggy', ref: '430512345678' });
  });

  it('AL-02: "Rs.450 Cr." is a credit; a balance followed by CR is never a transaction', () => {
    expect(sms('VM-BOBTXN-S', 'Rs.450 Cr. to A/C XXXXXX1234. Ref:430512345679. AvlBal:Rs2450')).toMatchObject({ kind: 'txn', amount: 450, direction: 'credit' });
    expect(sms('BP-PNBSMS-S', 'Your A/c XX1234 Aval Bal Rs.1200.50 CR as on 05-11-2026.').kind).toBe('balance');
  });

  it('AL-03: amount written as "Rs:200.00" (Union Bank, Indian Bank); the balance is still not the amount', () => {
    expect(
      sms('VM-UNIONB-S', 'A/c *1234 Debited for Rs:200.00 on 05-11-2026 12:30:11 by Mob Bk ref no 430512345678 Avl Bal Rs:5000.00.If not you, Call 1800222243 -Union Bank of India')
    ).toMatchObject({ kind: 'txn', amount: 200, direction: 'debit', last4: '1234', ref: '430512345678' });
    expect(sms('VM-INDBNK-S', 'Your SB A/c **1234 Debited for Rs:200 on 05-11-2026 by Transfer Avl Bal Rs:5000 -Indian Bank')).toMatchObject({
      kind: 'txn', amount: 200, direction: 'debit', last4: '1234',
    });
    expect(sms('VM-UNIONB-S', 'A/c *1234 Avl Bal Rs:5000.00 as on 05-11-2026 -Union Bank of India').kind).toBe('balance');
  });

  it('AL-04: Axis "UPI/P2M/<ref>/<payee>" gives the payee and the reference, never the helpline number', () => {
    const p = sms('AX-AXISBK-S', 'INR 1,299.00 debited from A/c no. XX1234 on 05-11-26 12:30:05 IST UPI/P2M/430512345678/AMAZON PAY. Not you? SMS BLOCKUPI Cust ID to 919951860002 - Axis Bank');
    expect(p).toMatchObject({ kind: 'txn', amount: 1299, direction: 'debit', last4: '1234', merchant: 'Amazon Pay', ref: '430512345678' });
    expect(cleanMerchant('919951860002 - Axis Bank')).toBeUndefined();
  });

  it('AL-05: card spend "on NETFLIX" gives the merchant; a date, card or bank is never the merchant', () => {
    expect(
      sms('JD-ICICIT-S', 'INR 349.00 spent using ICICI Bank Card XX1234 on 05-Nov-26 on NETFLIX. Avl Limit: INR 1,45,000.00. If not you, call 1800 2662/SMS BLOCK 1234 to 9215676766.')
    ).toMatchObject({ kind: 'txn', amount: 349, last4: '1234', merchant: 'Netflix' });
    expect(sms('VM-HDFCBK-S', 'Rs 500 spent on HDFC Bank Card 1234 on 05-11-26. Avl Lmt Rs 9000').merchant).toBeUndefined();
    expect(sms('AD-SBICRD-S', 'Rs.1,250.00 spent on your SBI Credit Card ending 1234 at BIG BAZAAR on 05/11/26.').merchant).toBe('Big Bazaar');
  });

  it('AL-06: "reference number is 430512345678"', () => {
    const p = sms('VM-FEDBNK-S', 'Dear Customer, Rs.1000 has been debited from account 1234 to VPA merchant@icici on 05-11-26. Your UPI transaction reference number is 430512345678. -Federal Bank');
    expect(p).toMatchObject({ kind: 'txn', amount: 1000, last4: '1234', ref: '430512345678' });
  });

  it('AL-09: bank channel words are removed from the name', () => {
    expect(sms('VM-HDFCBK-S', 'UPDATE: INR 2,000.00 debited from HDFC Bank XX1234 on 05-NOV-26. Info: ACH D- ZERODHA BROKING. Avl bal:INR 10,000.00').merchant).toBe('Zerodha Broking');
    expect(cleanMerchant('NEFT-ACME CORP')).toBe('Acme Corp');
    expect(cleanMerchant('IMPS/RAHUL KUMAR')).toBe('Rahul Kumar');
  });

  it('formats that already worked give exactly the same result as before', () => {
    const same: Array<[string, string, Record<string, unknown>]> = [
      ['VM-HDFCBK-S', 'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/11/26 Ref 430512345678 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808', { amount: 250, direction: 'debit', last4: '1234', merchant: 'Swiggy', ref: '430512345678' }],
      ['AD-SBIUPI-S', 'Dear UPI user A/C X1234 debited by 150.0 on date 05Nov26 trf to RAHUL KUMAR Refno 430512345678. If not u? call 1800111109. -SBI', { amount: 150, direction: 'debit', last4: '1234', merchant: 'Rahul Kumar', ref: '430512345678' }],
      ['JD-ICICIT-S', 'ICICI Bank Acct XX123 debited for Rs 500.00 on 05-Nov-26; ZOMATO credited. UPI:430512345678. Call 18002662 for dispute.', { amount: 500, direction: 'debit', last4: '123', merchant: 'Zomato', ref: '430512345678' }],
      ['VK-KOTAKB-S', 'Sent Rs.80.00 from Kotak Bank AC X1234 to paytmqr28100505@paytm on 05-11-26.UPI Ref 430512345678. Not you, https://kotak.com/KBANKT/Fraud', { amount: 80, direction: 'debit', last4: '1234', merchant: 'Paytmqr', ref: '430512345678' }],
      ['VM-HDFCBK-S', 'Spent Rs.2,499 On HDFC Bank Card 1234 At AMAZON On 2026-11-05:12:30:45.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 1234 to 7308080808', { amount: 2499, direction: 'debit', last4: '1234', merchant: 'Amazon', accountKind: 'card' }],
      ['VM-HDFCBK-S', 'Rs.5000 withdrawn from A/c XX1234 at ATM on 05-11-26. Avl Bal Rs.12,345.67 -HDFC Bank', { amount: 5000, direction: 'debit', last4: '1234', merchant: 'Atm' }],
      ['VM-HDFCBK-S', 'Credit Alert! Rs.500.00 credited to HDFC Bank A/c XX1234 on 05-11-26 from VPA rahul@okaxis (UPI 430512345678)', { amount: 500, direction: 'credit', last4: '1234', merchant: 'Rahul', ref: '430512345678', creditKind: 'person' }],
      ['VM-HDFCBK-S', 'Rs.199.00 debited from A/c XX1234 for UPI Mandate/AutoPay towards SPOTIFY on 05-11-26', { amount: 199, direction: 'debit', last4: '1234', merchant: 'Spotify' }],
      ['BP-PNBSMS-S', 'Ac XXXXXXXX1234 Debited with Rs.300.00, 05-11-2026 12:30:00 thru UPI:430512345678. Aval Bal Rs.1200.50 CR. Helpline 18001800-PNB', { amount: 300, direction: 'debit', last4: '1234', ref: '430512345678' }],
      ['VM-HDFCBK-S', 'Refund of Rs 349.00 from NETFLIX has been credited to your HDFC Bank Card ending 1234 on 05-11-26.', { amount: 349, direction: 'credit', last4: '1234', merchant: 'Netflix', creditKind: 'refund' }],
    ];
    for (const [sender, body, expected] of same) expect(sms(sender, body), body).toMatchObject({ kind: 'txn', ...expected });
    expect(sms('VM-HDFCBK-S', 'Your UPI-Mandate for Rs.199 is successfully created towards SPOTIFY from A/c XX1234.').kind).toBe('future');
    expect(sms('VM-HDFCBK-S', 'Avl Bal in A/c XX1234 is Rs.12,345.67 as on 05-11-26').kind).toBe('balance');
  });

  it('the format signature (used by "ignore similar" rules) did not change', () => {
    expect(templateOf('VM-UNIONB-S', 'A/c *1234 Debited for Rs:200.00 on 05-11-2026')).toBe(templateOf('VM-UNIONB-S', 'A/c *9999 Debited for Rs:200.00 on 06-12-2026'));
  });
});
