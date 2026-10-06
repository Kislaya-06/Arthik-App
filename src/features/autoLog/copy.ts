import { format, formatDistanceToNowStrict } from 'date-fns';
import { formatCurrency } from '../../lib/formatters';
import type { AutoLogEvent, AutoLogMode, ReviewReason, TrackedAccount } from './types';

/** One vocabulary everywhere (spec §46). */
export const STATE_COPY = {
  discovery: { title: 'Discovery', body: 'Learning from messages. Nothing is logged.' },
  recovery: { title: 'Recovery', body: 'Checking activity from the period Automatic Logging was paused.' },
  live: { title: 'Automatic Logging Active', body: 'New supported transactions are being detected.' },
  paused: { title: 'Automatic Logging Paused', body: 'Nothing is being detected or logged right now.' },
  attention: { title: 'Automatic Logging needs attention', body: 'Something is stopping detection from working fully.' },
  off: { title: 'Automatic Logging is off', body: 'Turn it on to log bank transactions without typing them.' },
  setup_missing: { title: 'Auto-Logging setup not found', body: 'Your local setup appears to have been removed.' },
  signed_out: { title: 'Automatic Logging Paused', body: 'Paused while you were signed out.' },
} as const;

export const modeCopy = (mode: AutoLogMode, attention: boolean) =>
  mode === 'live' && attention ? STATE_COPY.attention : STATE_COPY[mode];

export const accountLabel = (a: Pick<TrackedAccount, 'bank' | 'last4'>) => `${a.bank} ••••${a.last4}`;

export const accountLabelFromKey = (key: string | null, accounts: TrackedAccount[]) => {
  if (!key) return null;
  const a = accounts.find((x) => x.key === key);
  if (a) return accountLabel(a);
  const [, last4] = key.split(':');
  return last4 ? `••••${last4}` : null;
};

export const money = (n: number | null | undefined) => (n == null ? '—' : formatCurrency(n));

export const eventTitle = (e: AutoLogEvent) => e.merchant || (e.direction === 'credit' ? 'Money received' : e.direction === 'debit' ? 'Payment' : 'Financial message');

export const directionWord = (e: AutoLogEvent) => (e.direction === 'credit' ? 'Received' : e.direction === 'debit' ? 'Debited' : 'Unclear');

export const REVIEW_LABEL: Record<ReviewReason, string> = {
  type: 'What is this?',
  category: 'Choose category',
  possible_duplicate: 'Possible duplicate',
  unrecognized: 'Unrecognized message',
  notification_only: "Bank SMS didn't arrive",
  no_account: 'Account unclear',
};

export const reviewLabelFor = (e: AutoLogEvent) =>
  e.status === 'logged' && e.needsCategory ? REVIEW_LABEL.category : e.reviewReason ? REVIEW_LABEL[e.reviewReason] : 'Review';

export const sourceLabel = (e: AutoLogEvent) => (e.source === 'sms' ? `${e.sender} SMS` : `${e.sender} notification`);

export const statusLine = (e: AutoLogEvent): string => {
  switch (e.status) {
    case 'awaiting_sms': return 'Waiting for bank confirmation…';
    case 'logged': return e.needsCategory ? 'Logged · choose a category' : 'Logged automatically';
    case 'queued': return 'Will be logged when you are online';
    case 'pending': return 'Needs your review';
    case 'merged': return 'Matched automatically';
    case 'transfer': return 'Own transfer · not counted as expense';
    default: return '';
  }
};

export const relative = (ms: number | null) => {
  if (!ms) return 'Never';
  if (Date.now() - ms < 60_000) return 'Just now';
  return `${formatDistanceToNowStrict(ms)} ago`;
};

export const dateTime = (ms: number) => format(ms, 'd MMM, h:mm a');
