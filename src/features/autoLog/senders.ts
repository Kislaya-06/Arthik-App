/**
 * Who sent a financial message (AUT-005).
 *
 * In India every bank must send an alert for each debit / credit on the account, and only the bank that
 * holds the account sends it. UPI apps and UPI handles (@ybl, @oksbi, …) never send SMS for the payer.
 * Other companies (mutual funds, insurers, brokers, billers) also quote "your A/c XX1234" when they pull
 * money from it, often under a header that contains a bank's name ("SBIMFS" = SBI Mutual Fund).
 *
 * So the sender decides whether a message may create an account:
 *  - 'bank'        : the account's own bank → may create / update the account
 *  - 'third_party' : a company that is not the bank → evidence only, never an account or a transaction
 *  - 'unknown'     : a header Arthik does not know (maybe a small bank) → decided by the engine
 */

export type SenderRole = 'bank' | 'third_party' | 'unknown';
export interface SenderIdentity { code: string; name: string; role: SenderRole }

/**
 * Banks and card issuers. One entry per institution; every header it sends from maps to the same code
 * (slice sends as SLCBNK and SLICEIT, and was North East Small Finance Bank before).
 */
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
  [/SLICE|SLCBNK|SLCBK|NESFB/, 'SLICE', 'slice'],
  [/INDBNK|INDIAN/, 'INDIAN', 'Indian Bank'],
  [/IOB/, 'IOB', 'Indian Overseas Bank'],
  [/CENTBK|CBOI/, 'CENTRAL', 'Central Bank'],
  [/UCOBNK|UCO/, 'UCO', 'UCO Bank'],
  [/BANDHN|BANDHAN/, 'BANDHAN', 'Bandhan Bank'],
  [/DBS/, 'DBS', 'DBS Bank'],
];

const BANK_CODES = new Set(BANKS.map(([, code]) => code));

/** A saved account code that belongs to a known bank (not a fallback code from an unknown header). */
export const isBankCode = (code: string) => BANK_CODES.has(code);

/**
 * Companies named after a bank that are not the bank: the letters right after the bank's name in the
 * header ("SBI" + "MFS", "HDFC" + "LI"). A bank's own headers never continue like this ("SBIUPI", "HDFCBK").
 */
const NON_BANK_SUFFIX: Array<[RegExp, string]> = [
  [/^(MF|AMC|MUT)/, 'Mutual Fund'],
  [/^(LI|LIF)/, 'Life'],
  [/^(GEN|GIC|GI$)/, 'General Insurance'],
  [/^ERG/, 'Ergo'],
  [/^LOM/, 'Lombard'],
  [/^INS/, 'Insurance'],
  [/^(SEC|SE$|CAP)/, 'Securities'],
  [/^PRU/, 'Prudential'],
  [/^MET/, 'MetLife'],
  [/^(HFL|HL$|HOM)/, 'Home Finance'],
];

/** Non-bank companies that quote the user's bank account (fund registrars, depositories, brokers, lenders). */
const THIRD_PARTIES: Array<[RegExp, string]> = [
  [/CAMS/, 'CAMS'],
  [/KFIN|KARVY/, 'KFintech'],
  [/CDSL/, 'CDSL'],
  [/MFCENT|MFUTIL/, 'MF Central'],
  [/LICIND|LICHFL/, 'LIC'],
  [/ZERODH/, 'Zerodha'],
  [/GROWW/, 'Groww'],
  [/UPSTOX/, 'Upstox'],
  [/BAJFIN|BAJAJF/, 'Bajaj Finance'],
];

/** "VM-HDFCBK-S" → "HDFCBK" */
export const senderCore = (sender: string): string => {
  let s = (sender || '').toUpperCase().trim();
  s = s.replace(/^[A-Z]{2}-/, '').replace(/-[A-Z]$/, '');
  return s.replace(/[^A-Z0-9]/g, '');
};

const brandOf = (bankName: string) => bankName.replace(/ Bank$/, '');

export const resolveBank = (sender: string): SenderIdentity => {
  const core = senderCore(sender);
  for (const [re, code, name] of BANKS) {
    const m = re.exec(core);
    if (!m) continue;
    const rest = core.slice(m.index + m[0].length);
    const nonBank = NON_BANK_SUFFIX.find(([suffix]) => suffix.test(rest));
    if (nonBank) return { code: core.slice(0, 8), name: `${brandOf(name)} ${nonBank[1]}`, role: 'third_party' };
    return { code, name, role: 'bank' };
  }
  const third = THIRD_PARTIES.find(([re]) => re.test(core));
  if (third) return { code: core.slice(0, 8), name: third[1], role: 'third_party' };
  const code = core.slice(0, 8) || 'BANK';
  return { code, name: code.charAt(0) + code.slice(1).toLowerCase(), role: 'unknown' };
};

/**
 * The code an account saved under `bankCode` belongs to today. Codes of known banks never move; an old
 * fallback code (e.g. "SLCBNK", saved before slice's header was known) moves to its bank.
 */
export const canonicalBankCode = (bankCode: string): string => {
  if (BANK_CODES.has(bankCode)) return bankCode;
  const id = resolveBank(bankCode);
  return id.role === 'bank' ? id.code : bankCode;
};

export const canonicalAccountKey = (bankCode: string, last4: string) => `${canonicalBankCode(bankCode)}:${last4}`;

/** Display name of a bank code ("SLICE" → "slice"); falls back to the code itself. */
export const bankNameOf = (bankCode: string): string => BANKS.find(([, code]) => code === bankCode)?.[2] ?? bankCode;

// ─── Email senders ──────────────────────────────────────────────────────────

/** Payment providers that send their own transaction emails (in addition to the BANKS list). */
const KNOWN_PROVIDERS: Array<[RegExp, string, string]> = [
  [/PAYTM/, 'PAYTM', 'Paytm'],
  [/PHONEPE/, 'PHONEPE', 'PhonePe'],
  [/GOOGLEPAY|GPAY/, 'GPAY', 'Google Pay'],
  [/AMAZONPAY/, 'AMAZONPAY', 'Amazon Pay'],
  [/CRED/, 'CRED', 'CRED'],
  [/MOBIKWIK/, 'MOBIKWIK', 'MobiKwik'],
  [/RAZORPAY/, 'RAZORPAY', 'Razorpay'],
  [/NAVI/, 'NAVI', 'Navi'],
  [/JUPITER/, 'JUPITER', 'Jupiter'],
  [/FI\b|FIMONEY|EPIFI/, 'FI', 'Fi'],
];

/** Display-name words of bank-branded companies that are not the bank ("SBI Mutual Fund", "HDFC Life"). */
const RE_EMAIL_NON_BANK =
  /\b(MUTUAL ?FUNDS?|MF|AMC|ASSET MANAGEMENT|LIFE|INSURANCE|ERGO|LOMBARD|GENERAL|SECURITIES|PRUDENTIAL|METLIFE|HOUSING|HOME ?LOANS?|CAPITAL)\b/;

export type EmailSenderKind = 'bank' | 'provider' | 'third_party' | 'unknown';

/** Bank / provider behind an email sender display name like "HDFC Bank InstaAlerts". */
export const resolveEmailSender = (
  senderName: string
): { code: string; name: string; recognized: boolean; kind: EmailSenderKind } => {
  const core = (senderName || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  const compact = core.replace(/\s+/g, '');
  for (const [re, code, name] of BANKS) {
    if (!re.test(compact)) continue;
    if (RE_EMAIL_NON_BANK.test(core)) {
      return { code: compact.slice(0, 10), name: (senderName || name).trim().slice(0, 40), recognized: false, kind: 'third_party' };
    }
    return { code, name, recognized: true, kind: 'bank' };
  }
  for (const [re, code, name] of KNOWN_PROVIDERS) {
    if (re.test(compact) || re.test(core)) return { code, name, recognized: true, kind: 'provider' };
  }
  const name = (senderName || 'Email').trim().slice(0, 40) || 'Email';
  return { code: compact.slice(0, 10) || 'EMAIL', name, recognized: false, kind: 'unknown' };
};
