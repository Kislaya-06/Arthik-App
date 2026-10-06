import type { AccountKind, CreditKind, Direction, ParsedKind, ParsedMessage } from './types';

/**
 * On-device parsers for bank SMS and payment-app notifications.
 *
 * Rules that protect accuracy (spec §39):
 *  - only labelled / verb-adjacent amounts are trusted; balances are never amounts
 *  - future / mandate / collect / failed / balance-only messages are not transactions
 *  - anything financial-looking we cannot read safely becomes `unknown` (review), never a guess
 */

// ─── Banks ──────────────────────────────────────────────────────────────────

const BANKS: Array<[RegExp, string, string]> = [
  [/HDFC/, 'HDFC', 'HDFC Bank'],
  [/SBI|SBIINB|SBIUPI|SBMSMS|CBSSBI|ATMSBI/, 'SBI', 'SBI'],
  [/ICICI/, 'ICICI', 'ICICI Bank'],
  [/AXIS/, 'AXIS', 'Axis Bank'],
  [/KOTAK|KOTAKB/, 'KOTAK', 'Kotak Bank'],
  [/PNB/, 'PNB', 'PNB'],
  [/BOB|BARODA/, 'BOB', 'Bank of Baroda'],
  [/BOIIND|BOI/, 'BOI', 'Bank of India'],
  [/CANBNK|CANARA/, 'CANARA', 'Canara Bank'],
  [/UNIONB|UBOI/, 'UNION', 'Union Bank'],
  [/IDFC/, 'IDFC', 'IDFC FIRST Bank'],
  [/YESBNK|YESBK/, 'YES', 'Yes Bank'],
  [/INDUS/, 'INDUSIND', 'IndusInd Bank'],
  [/AUBANK|AUBNK/, 'AU', 'AU Bank'],
  [/FEDBNK|FEDERAL/, 'FEDERAL', 'Federal Bank'],
  [/SCBANK|STANCH/, 'SCB', 'Standard Chartered'],
  [/CITI/, 'CITI', 'Citi'],
  [/HSBC/, 'HSBC', 'HSBC'],
  [/RBL/, 'RBL', 'RBL Bank'],
  [/IDBI/, 'IDBI', 'IDBI Bank'],
  [/IPPB/, 'IPPB', 'India Post Payments Bank'],
  [/PAYTMB|PYTMBK/, 'PAYTMPB', 'Paytm Payments Bank'],
  [/AIRBNK|AIRTEL/, 'AIRTEL', 'Airtel Payments Bank'],
  [/JIOPBS|JIOPAY/, 'JIO', 'Jio Payments Bank'],
  [/AMEX/, 'AMEX', 'American Express'],
  [/ONECRD|ONECARD/, 'ONECARD', 'OneCard'],
  [/SLICE/, 'SLICE', 'slice'],
  [/INDBNK|INDIAN/, 'INDIAN', 'Indian Bank'],
  [/IOB/, 'IOB', 'Indian Overseas Bank'],
  [/CENTBK|CBOI/, 'CENTRAL', 'Central Bank'],
  [/UCOBNK|UCO/, 'UCO', 'UCO Bank'],
  [/BANDHN|BANDHAN/, 'BANDHAN', 'Bandhan Bank'],
  [/DBS/, 'DBS', 'DBS Bank'],
];

/** "VM-HDFCBK-S" → "HDFCBK" */
export const senderCore = (sender: string): string => {
  let s = (sender || '').toUpperCase().trim();
  s = s.replace(/^[A-Z]{2}-/, '').replace(/-[A-Z]$/, '');
  return s.replace(/[^A-Z0-9]/g, '');
};

export const resolveBank = (sender: string): { code: string; name: string } => {
  const core = senderCore(sender);
  for (const [re, code, name] of BANKS) {
    if (re.test(core)) return { code, name };
  }
  const code = core.slice(0, 8) || 'BANK';
  return { code, name: code.charAt(0) + code.slice(1).toLowerCase() };
};

// ─── Shared helpers ─────────────────────────────────────────────────────────

const RE_OTP = /\b(otp|one[ -]?time[ -]?password|verification code|auth(?:entication)? code)\b/i;
const RE_FAILED = /\b(failed|declined|unsuccessful|could not be (?:processed|completed)|was not successful|insufficient (?:funds|balance))\b/i;
const RE_FUTURE =
  /(will be (?:debited|deducted|charged)|to be debited|is due|due (?:on|by|date)|due amount|amount due|e-?mandate|mandate|standing instruction|autopay|auto-?debit (?:is )?(?:scheduled|set)|reminder|collect request|has requested|requested (?:money|rs|inr|₹)|request(?:ed)? (?:of|for) (?:rs|inr|₹)|payment request|bill (?:is )?generated|statement (?:is )?generated|min(?:imum)? (?:amount )?due|total (?:amount )?due)/i;
const RE_PROMO = /(offer|cashback up to|get up to|win |won |congratulations|pre-?approved|loan (?:of|upto|up to)|apply now|click here|limited period|discount|coupon|voucher|reward points? (?:earned|credited)|t&c)/i;

const RE_DEBIT = /\b(debited|debit(?:ed)? by|spent|paid|withdrawn|withdrawal|sent|purchase|deducted|charged|used at|transferred to|txn of|payment of)\b/i;
const RE_CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversed|reversal|added to)\b/i;

const RE_CURRENCY_AMT = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
const RE_VERB_AMT =
  /(debited|credited|spent|paid|sent|received|withdrawn|deducted|charged|deposited)\s+(?:by|for|with|of)?\s*(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const RE_BALANCE_BEFORE = /(avl\.?|avail(?:able)?|bal(?:ance)?|limit|outstanding|o\/s|due)\s*(?:bal(?:ance)?|amt|amount|lmt|limit)?\s*(?:is|:|-|of)?\s*$/i;

const toAmount = (raw?: string): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 99999999) return undefined;
  return Math.round(n * 100) / 100;
};

/** Amounts that are not balances / limits. */
const extractAmount = (text: string): number | undefined => {
  const verb = RE_VERB_AMT.exec(text);
  if (verb) {
    const a = toAmount(verb[2]);
    if (a) return a;
  }
  RE_CURRENCY_AMT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_CURRENCY_AMT.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 28), m.index);
    if (RE_BALANCE_BEFORE.test(before)) continue; // "Avl Bal Rs 12,000" is never the amount
    const a = toAmount(m[1]);
    if (a) return a;
  }
  return undefined;
};

const hasOnlyBalanceAmount = (text: string): boolean => {
  RE_CURRENCY_AMT.lastIndex = 0;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = RE_CURRENCY_AMT.exec(text))) {
    any = true;
    const before = text.slice(Math.max(0, m.index - 28), m.index);
    if (!RE_BALANCE_BEFORE.test(before)) return false;
  }
  return any;
};

const firstIndex = (re: RegExp, text: string): number => {
  const m = re.exec(text);
  return m ? m.index : -1;
};

const detectDirection = (text: string): Direction | undefined => {
  const d = firstIndex(RE_DEBIT, text);
  const c = firstIndex(RE_CREDIT, text);
  if (d < 0 && c < 0) return undefined;
  if (d < 0) return 'credit';
  if (c < 0) return 'debit';
  return d < c ? 'debit' : 'credit'; // earliest verb describes the account owner's side
};

const RE_ACCOUNT =
  /(?:a\/c|acct|account|a\/c no\.?|ac|card|bank a\/c)\s*(?:no\.?|number|num)?\s*(?:ending(?:\s+(?:with|in))?\s*)?[:\-]?\s*(?:[x*•.]+\s*)?(\d{3,6})\b/i;
const RE_ENDING = /ending\s*(?:with|in)?\s*[:\-]?\s*(?:[x*•]+)?(\d{4})\b/i;
const RE_MASKED = /\b[x*•]{2,}(\d{3,6})\b/i;

const extractLast4 = (text: string): string | undefined => {
  const m = RE_ACCOUNT.exec(text) || RE_ENDING.exec(text) || RE_MASKED.exec(text);
  if (!m) return undefined;
  const digits = m[1];
  return digits.length > 4 ? digits.slice(-4) : digits;
};

const detectAccountKind = (text: string): AccountKind =>
  /credit card|\bcc\b|card (?:no|ending|x)|debit card|card \*/i.test(text) ? 'card' : /wallet/i.test(text) ? 'wallet' : 'bank';

const RE_REF =
  /(?:upi\s*ref(?:\.|erence)?\s*(?:no\.?|number|id)?|ref(?:erence)?\.?\s*(?:no\.?|number|id)?|refno|rrn|utr|txn\s*id|transaction\s*id|upi)\s*[:\-#]?\s*([a-z0-9]{8,22})/i;

const extractRef = (text: string): string | undefined => {
  const m = RE_REF.exec(text);
  if (!m) return undefined;
  return /\d{6,}/.test(m[1]) ? m[1].toUpperCase() : undefined;
};

const STOP_MERCHANT = /^(a\/c|ac|acct|account|your|the|card|xx|you|vpa|upi|rs|inr|bank|beneficiary|on|via|ref)\b/i;

export const cleanMerchant = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  let s = raw.trim();
  s = s.replace(/^vpa\s+/i, '');
  if (s.includes('@')) s = s.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  s = s.replace(/\s{2,}/g, ' ').replace(/[.;,:]+$/, '').trim();
  if (s.length < 2 || s.length > 40) return undefined;
  if (STOP_MERCHANT.test(s)) return undefined;
  if (/^\d+$/.test(s) || /^[x*]+\d*$/i.test(s)) return undefined;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
};

const MERCHANT_END = String.raw`(?=\s+(?:on|ref|refno|rrn|utr|upi|via|using|from|avl|for|txn|dated|at\s+\d|is|has|was|thru|through|not you|if not)\b|\.(?:\s|$)|[;,(]|$)`;
const RE_TO = new RegExp(String.raw`(?:\bto|\bat|\btowards|trf to|paid to|info:?)\s+([A-Za-z0-9&._@' -]{2,40}?)` + MERCHANT_END, 'i');
const RE_FROM = new RegExp(String.raw`(?:\bfrom|\bby)\s+([A-Za-z0-9&._@' -]{2,40}?)` + MERCHANT_END, 'i');
const RE_SEMI_PAYEE = /;\s*([A-Za-z][A-Za-z .&']{1,30}?)\s+credited/i; // ICICI: "...; RAHUL credited"

const extractMerchant = (text: string, direction?: Direction): string | undefined => {
  if (direction === 'debit') {
    return cleanMerchant(RE_SEMI_PAYEE.exec(text)?.[1]) || cleanMerchant(RE_TO.exec(text)?.[1]);
  }
  if (direction === 'credit') return cleanMerchant(RE_FROM.exec(text)?.[1]);
  return undefined;
};

const RE_CARD_BILL =
  /(credit card (?:bill|payment)|cc (?:bill|payment)|payment (?:of .{1,25})?(?:received|credited).{0,40}(?:credit )?card|towards (?:your )?(?:credit )?card|card (?:bill|dues) (?:paid|payment))/i;

const detectCreditKind = (text: string, merchant?: string): CreditKind => {
  if (/salary|sal\b|payroll/i.test(text)) return 'salary';
  if (/interest/i.test(text)) return 'interest';
  if (/refund|reversal|reversed|cashback/i.test(text)) return 'refund';
  if (merchant && /upi|imps|neft|vpa/i.test(text)) return 'person';
  return 'other';
};

/**
 * Format signature: removes amounts, digits, names after to/from, VPAs and dates.
 * Two messages from the same bank template map to the same signature,
 * so "ignore similar" never becomes "ignore every ₹20".
 */
export const templateOf = (sender: string, text: string): string => {
  const norm = text
    .toLowerCase()
    .replace(/[a-z0-9._-]+@[a-z0-9]+/g, '<vpa>')
    .replace(/(?:rs\.?|inr|₹)\s*[0-9][0-9,]*(?:\.[0-9]+)?/g, '<amt>')
    .replace(/\b(to|from|by|at)\s+[a-z][a-z .&']{1,30}?(?=\s+(?:on|ref|upi|via|using)\b|[.;,]|$)/g, '$1 <name>')
    .replace(/[0-9]+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return `${senderCore(sender)}|${hash(norm)}`;
};

export const hash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Masks long digit runs (account / card / phone numbers) before storing text locally. */
export const maskSensitive = (text: string): string =>
  text.replace(/\d{5,}/g, (m) => '•'.repeat(Math.max(0, m.length - 4)).slice(0, 6) + m.slice(-4));

// ─── SMS ────────────────────────────────────────────────────────────────────

export const parseSms = (sender: string, body: string): ParsedMessage => {
  const text = (body || '').replace(/\s+/g, ' ').trim();
  const bank = resolveBank(sender);
  const base = { source: 'sms' as const, bank: bank.name, bankCode: bank.code, template: templateOf(sender, text) };

  const kindOnly = (kind: ParsedKind): ParsedMessage => ({ ...base, kind });

  if (RE_OTP.test(text)) return kindOnly('otp');
  if (RE_FAILED.test(text)) return kindOnly('failed');
  if (RE_FUTURE.test(text)) return kindOnly('future');

  const direction = detectDirection(text);
  if (!direction) {
    if (RE_PROMO.test(text)) return kindOnly('promo');
    if (hasOnlyBalanceAmount(text) || /\b(balance|bal)\b/i.test(text)) return kindOnly('balance');
    return kindOnly('unknown');
  }
  if (RE_PROMO.test(text) && !/(debited|credited)/i.test(text)) return kindOnly('promo');

  const amount = extractAmount(text);
  const last4 = extractLast4(text);
  const accountKind = detectAccountKind(text);
  const merchant = extractMerchant(text, direction);
  const ref = extractRef(text);
  const isCardBill = RE_CARD_BILL.test(text);

  if (!amount) {
    return { ...base, kind: hasOnlyBalanceAmount(text) ? 'balance' : 'unknown', direction, last4, accountKind };
  }

  return {
    ...base,
    kind: 'txn',
    amount,
    direction,
    last4,
    accountKind,
    merchant,
    ref,
    isCardBill,
    creditKind: direction === 'credit' ? detectCreditKind(text, merchant) : undefined,
  };
};

// ─── Payment-app notifications ──────────────────────────────────────────────

const RE_N_IGNORE =
  /(failed|declined|pending|processing|request|requested|collect|reminder|due|offer|cashback (?:up ?to|of up)|win|scratch|reward|bill (?:is )?generated|recharge (?:now|due)|expir|expires)/i;
const RE_N_DEBIT = /(paid|sent|payment of|payment to|debited|spent|you paid|money sent)/i;
const RE_N_CREDIT = /(received|credited|got|has sent you|sent you)/i;

export const parseNotification = (app: string, title: string, body: string): ParsedMessage => {
  const text = `${title || ''} ${body || ''}`.replace(/\s+/g, ' ').trim();
  const base = { source: 'notification' as const, bank: app, bankCode: app.toUpperCase().replace(/\W/g, ''), template: templateOf(app, text) };
  if (RE_OTP.test(text)) return { ...base, kind: 'otp' };
  if (RE_N_IGNORE.test(text)) return { ...base, kind: 'future' };

  const d = firstIndex(RE_N_DEBIT, text);
  const c = firstIndex(RE_N_CREDIT, text);
  let direction: Direction | undefined;
  if (d >= 0 && (c < 0 || d < c)) direction = 'debit';
  else if (c >= 0) direction = /has sent you|sent you/i.test(text) || d < 0 ? 'credit' : 'debit';
  if (!direction) return { ...base, kind: 'unknown' };

  RE_CURRENCY_AMT.lastIndex = 0;
  const m = RE_CURRENCY_AMT.exec(text);
  const amount = toAmount(m?.[1]);
  if (!amount) return { ...base, kind: 'unknown', direction };

  let merchant: string | undefined;
  if (direction === 'debit') {
    merchant = cleanMerchant(/(?:\bto|\bat)\s+(.+?)(?:\s+(?:was|is|has|successfully|using|via|on|from|payment|paid)\b|[.!,]|$)/i.exec(text)?.[1]);
  } else {
    merchant =
      cleanMerchant(/from\s+(.+?)(?:\s+(?:was|is|in|to|on|via)\b|[.!,]|$)/i.exec(text)?.[1]) ||
      cleanMerchant(/^(.+?)\s+(?:has )?sent you/i.exec(text)?.[1]);
  }
  return { ...base, kind: 'txn', amount, direction, merchant, ref: extractRef(text) };
};
