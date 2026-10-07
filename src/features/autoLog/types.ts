/**
 * Automatic Logging — shared types.
 * See docs/AUTO_LOGGING.md for the full product model (Discovery / Recovery / Live).
 */

export type Direction = 'debit' | 'credit';
export type EventSource = 'sms' | 'notification' | 'email';

/** Why an event exists in the pipeline. Discovery never creates transactions. */
export type EventOrigin = 'live' | 'recovery' | 'discovery';

export type ParsedKind =
  | 'txn'      // completed transaction, amount + direction known
  | 'future'   // "will be debited", mandate, reminder, collect request, due
  | 'failed'   // failed / declined
  | 'balance'  // balance-only message
  | 'promo'    // offers / marketing
  | 'otp'
  | 'unknown'; // looks financial but cannot be understood safely

export type AccountKind = 'bank' | 'card' | 'wallet';

export type CreditKind = 'salary' | 'interest' | 'refund' | 'person' | 'other';

export interface ParsedMessage {
  source: EventSource;
  kind: ParsedKind;
  amount?: number;
  direction?: Direction;
  last4?: string;
  accountKind?: AccountKind;
  bank: string;      // display name, e.g. "HDFC Bank" / "PhonePe"
  bankCode: string;  // stable code, e.g. "HDFC"
  merchant?: string;
  ref?: string;
  isCardBill?: boolean;
  creditKind?: CreditKind;
  template: string;  // privacy-safe format signature (numbers/names removed)
  /** Email only: sender is a known bank / payment provider (unknown senders get lower confidence). */
  senderRecognized?: boolean;
  /** Email only: the sender is the bank itself, so `bankCode:last4` names the account exactly. */
  senderIsBank?: boolean;
  /** When the transaction happened, if the message says so (emails often arrive hours later). */
  txnTime?: number;
}

export type EventStatus =
  | 'awaiting_sms'  // notification preview, waiting for bank SMS
  | 'queued'        // decided to log, but the transaction could not be created yet (offline / app closed)
  | 'logged'        // transaction created
  | 'pending'       // needs user review
  | 'merged'        // notification merged into an SMS (or vice versa)
  | 'transfer'      // own-account transfer / card bill — no expense
  | 'ignored'       // not a transaction, or ignored by a rule/user
  | 'untracked'     // account not selected by the user
  | 'duplicate'     // same physical message seen twice
  | 'discovery';    // learning only

export type ReviewReason =
  | 'type'               // Income or Expense?
  | 'category'           // logged; category not known yet
  | 'possible_duplicate' // a manual entry looks the same
  | 'unrecognized'       // financial-looking, could not parse safely
  | 'notification_only'  // bank SMS never arrived
  | 'no_account'         // could not tell which account
  | 'ambiguous_match'    // could be the same as more than one existing transaction (or only weakly matches one)
  | 'unknown_sender';    // financial email from a sender Arthik does not recognise yet

export interface AutoLogEvent {
  id: string;
  source: EventSource;
  origin: EventOrigin;
  sender: string;        // SMS sender id or payment app name
  body: string;          // masked text, on-device only (shown in review)
  fingerprint: string;
  occurredAt: number;    // ms
  amount: number | null;
  direction: Direction | null;
  accountKey: string | null;
  merchant: string | null;
  ref: string | null;
  template: string;
  kind: ParsedKind;
  status: EventStatus;
  reviewReason: ReviewReason | null;
  expenseId: string | null;
  matchedId: string | null;
  needsCategory: boolean;
  createdAt: number;
}

export interface TrackedAccount {
  key: string;        // `${bankCode}:${last4}`
  bank: string;
  bankCode: string;
  last4: string;
  kind: AccountKind;
  tracked: boolean;
  isNew: boolean;     // found after setup, user hasn't decided yet
  firstSeen: number;
  lastSeen: number;
  msgCount: number;
}

export type AutoLogMode = 'off' | 'live' | 'paused' | 'signed_out' | 'setup_missing';

export interface HealthReport {
  nativeAvailable: boolean;
  sms: boolean;
  notifications: boolean;
  battery: boolean;
  accounts: boolean;
  /** Email notifications: on AND notification access granted. Optional source — never "needs attention". */
  email: boolean;
}
