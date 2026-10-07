import * as SecureStore from 'expo-secure-store';
import { ArthikAutoLog, isAutoLogNativeAvailable } from '../../../modules/arthik-autolog';
import * as db from './db';
import { flushQueued, processEmail, processNotification, processSms, RawSms, sweepAwaiting } from './engine';
import { DISCOVERY_DAYS, DISCOVERY_MAX_MESSAGES } from './matching';
import { hasSmsPermission } from './permissions';
import { fetchRemoteProfile, RemoteAccount, upsertRemoteProfile } from './remote';
import type { AutoLogEvent, EventOrigin, TrackedAccount } from './types';

/**
 * Lifecycle of Automatic Logging: setup → Discovery → Live → sign-out → Recovery / Learn → Live.
 * All work is serialised (one job at a time) so the headless task and the UI never race.
 */

let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
};

const DAY = 86400_000;
const dismissKey = (userId: string) => `arthik_autolog_dataloss_dismissed_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;

export const isSupported = () => isAutoLogNativeAvailable();

const setCapture = (on: boolean) => {
  try { ArthikAutoLog?.setCaptureEnabled(on); } catch {}
};

// ─── Email notifications (v2.1) — separate opt-in, independent of SMS ───────

const setNativeEmail = (on: boolean) => {
  try { ArthikAutoLog?.setEmailEnabled?.(on); } catch {}
};

/** Re-applies the saved email choice to the native listener (after sign-in, resume, setup). */
const applyEmailFlag = async () => setNativeEmail((await db.getMeta('email_enabled')) === '1');

/** True when this app binary can read email notifications (v2.1+ native module). */
export const emailSupported = () => {
  try {
    return !!ArthikAutoLog && typeof ArthikAutoLog.setEmailEnabled === 'function';
  } catch {
    return false;
  }
};

export const isEmailEnabled = async (userId: string): Promise<boolean> => {
  await db.openDb(userId);
  return (await db.getMeta('email_enabled')) === '1';
};

/** Turns email notification detection on/off. Never touches SMS or payment-app notifications. */
export const setEmailEnabled = (userId: string, on: boolean) =>
  serial(async () => {
    await db.openDb(userId);
    await db.setMeta('email_enabled', on ? '1' : '0');
    setNativeEmail(on);
  });

// ─── State helpers ──────────────────────────────────────────────────────────

export interface LocalState {
  setupComplete: boolean;
  liveSince: number | null;
  lastChecked: number | null;
  signedOutAt: number | null;
  pausedAt: number | null;
}

export const readLocalState = async (userId: string): Promise<LocalState> => {
  await db.openDb(userId);
  return {
    setupComplete: (await db.getMeta('setup_complete')) === '1',
    liveSince: await db.getMetaNum('live_since'),
    lastChecked: await db.getMetaNum('last_checked'),
    signedOutAt: await db.getMetaNum('signed_out_at'),
    pausedAt: await db.getMetaNum('paused_at'),
  };
};

const isLiveState = (s: LocalState) => s.setupComplete && !s.signedOutAt && !s.pausedAt;

// ─── Entry decision (runs when the main tabs mount) ─────────────────────────

export type EntryDecision =
  | { kind: 'none' }
  | { kind: 'welcome_back'; from: number; to: number }
  | { kind: 'data_loss'; lastActiveAt: number | null; previous: RemoteAccount[] };

export interface EntryInfo { decision: EntryDecision; remoteEnabled: boolean }

export const evaluateEntry = (userId: string): Promise<EntryInfo> =>
  serial(async () => {
    if (!isSupported()) return { decision: { kind: 'none' }, remoteEnabled: false };
    const local = await readLocalState(userId);
    if (local.setupComplete) {
      if (local.signedOutAt) {
        setCapture(false);
        return { decision: { kind: 'welcome_back', from: local.signedOutAt, to: Date.now() }, remoteEnabled: true };
      }
      setCapture(!local.pausedAt);
      await applyEmailFlag();
      return { decision: { kind: 'none' }, remoteEnabled: true };
    }
    // No local state. If the account had Automatic Logging before, this device lost it (spec §30–31).
    setCapture(false);
    const remote = await fetchRemoteProfile(userId);
    const enabled = !!remote.profile?.enabled;
    if (enabled && !(await SecureStore.getItemAsync(dismissKey(userId)))) {
      return {
        decision: {
          kind: 'data_loss',
          lastActiveAt: remote.profile?.last_active_at ? Date.parse(remote.profile.last_active_at) : null,
          previous: remote.profile?.tracked_accounts ?? [],
        },
        remoteEnabled: true,
      };
    }
    return { decision: { kind: 'none' }, remoteEnabled: enabled };
  });

export const dismissDataLoss = async (userId: string) => {
  await SecureStore.setItemAsync(dismissKey(userId), '1');
};

// ─── Live processing ────────────────────────────────────────────────────────

interface QueueLine { type: 'sms' | 'notification' | 'email'; address?: string; body?: string; date?: number; app?: string; title?: string }

const catchUpInbox = async (since: number, notify: boolean) => {
  if (!(await hasSmsPermission()) || !ArthikAutoLog) return;
  const collected: RawSms[] = [];
  let before = Date.now() + 60_000;
  for (let i = 0; i < 5; i++) {
    const page = await ArthikAutoLog.readSmsPage(since, before, 200);
    collected.push(...page.messages.map((m) => ({ address: m.address, body: m.body, date: m.date })));
    if (page.done) break;
    before = page.oldest;
  }
  collected.sort((a, b) => a.date - b.date);
  for (const m of collected) await processSms(m, { origin: 'live', notify });
};

export const processQueue = (userId: string, opts: { notify: boolean } = { notify: true }): Promise<boolean> =>
  serial(async () => {
    if (!isSupported()) return false;
    const state = await readLocalState(userId);
    if (!isLiveState(state)) {
      try { ArthikAutoLog?.drainQueue(); } catch {} // never log while signed out / paused
      return false;
    }
    const liveSince = state.liveSince ?? Date.now();
    let lines: string[] = [];
    try { lines = ArthikAutoLog?.drainQueue() ?? []; } catch {}
    const parsed: QueueLine[] = [];
    for (const l of lines) {
      try { parsed.push(JSON.parse(l)); } catch {}
    }
    parsed.sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
    for (const ev of parsed) {
      if (!ev.date || ev.date < liveSince) continue; // live boundary (spec §40)
      if (ev.type === 'sms' && ev.address && ev.body) {
        await processSms({ address: ev.address, body: ev.body, date: ev.date }, { origin: 'live', notify: opts.notify });
      } else if (ev.type === 'notification' && ev.app) {
        await processNotification({ app: ev.app, title: ev.title ?? '', body: ev.body ?? '', date: ev.date }, { origin: 'live', notify: opts.notify });
      } else if (ev.type === 'email' && ev.app) {
        // Email failure must never break SMS / notification processing (spec email §38–39).
        try {
          if ((await db.getMeta('email_enabled')) === '1') {
            await processEmail({ app: ev.app, title: ev.title ?? '', body: ev.body ?? '', date: ev.date }, { origin: 'live', notify: opts.notify });
          }
        } catch {}
      }
    }
    // Safety net: SMS the receiver may have missed (OEM killed the app, etc.).
    const since = Math.max(liveSince, (state.lastChecked ?? liveSince) - 30 * 60_000);
    try { await catchUpInbox(since, opts.notify); } catch {}
    const now = Date.now();
    await sweepAwaiting(now, opts.notify);
    await flushQueued();
    await db.setMeta('last_checked', String(now));

    const lastBeat = (await db.getMetaNum('remote_beat')) ?? 0;
    if (now - lastBeat > 6 * 3600_000) {
      await db.setMeta('remote_beat', String(now));
      upsertRemoteProfile(userId, { last_active_at: new Date(now).toISOString() });
    }
    const lastPrune = (await db.getMetaNum('last_prune')) ?? 0;
    if (now - lastPrune > DAY) {
      await db.setMeta('last_prune', String(now));
      await db.pruneOldEvents(now - 180 * DAY);
    }
    return true;
  });

// ─── Discovery / Recovery scans ─────────────────────────────────────────────

export interface ScanProgress { checked: number; total: number; phase: 'reading' | 'understanding' }

export interface ScanSummary {
  scanned: number;
  financial: number;
  formatsLearned: number;
  newAccountKeys: string[];
  suspicious: AutoLogEvent[];
  logged: number;
  needsReview: number;
  matched: number;
  found: number;
}

const scan = async (
  userId: string,
  from: number,
  to: number,
  origin: Exclude<EventOrigin, 'live'>,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanSummary> => {
  await db.openDb(userId);
  if (!ArthikAutoLog) throw new Error('Automatic Logging is not available on this device');
  const cap = origin === 'discovery' ? DISCOVERY_MAX_MESSAGES : 20000;
  const total = Math.min(await ArthikAutoLog.countSms(from, to), cap);
  const before0 = new Set((await db.listAccounts()).map((a) => a.key));
  const collected: RawSms[] = [];
  let scanned = 0;
  let before = to;
  onProgress?.({ checked: 0, total, phase: 'reading' });
  while (scanned < cap) {
    const page = await ArthikAutoLog.readSmsPage(from, before, 250);
    scanned += page.scanned;
    collected.push(...page.messages.map((m) => ({ address: m.address, body: m.body, date: m.date })));
    onProgress?.({ checked: Math.min(scanned, total), total, phase: 'reading' });
    if (page.done || page.scanned === 0) break;
    before = page.oldest;
  }
  collected.sort((a, b) => a.date - b.date);
  const summary: ScanSummary = {
    scanned, financial: collected.length, formatsLearned: 0, newAccountKeys: [], suspicious: [],
    logged: 0, needsReview: 0, matched: 0, found: 0,
  };
  const suspiciousIds: string[] = [];
  for (let i = 0; i < collected.length; i++) {
    const r = await processSms(collected[i], { origin, notify: false });
    if (r.learnedTemplate) summary.formatsLearned++;
    if (origin === 'discovery' && r.reviewReason === 'unrecognized' && r.eventId) suspiciousIds.push(r.eventId);
    if (origin === 'recovery') {
      if (r.status === 'logged' || r.status === 'queued') { summary.logged++; summary.found++; }
      if (r.status === 'pending') { summary.needsReview++; summary.found++; }
      if (r.status === 'transfer') summary.found++;
    }
    if (i % 25 === 0) onProgress?.({ checked: total, total, phase: 'understanding' });
  }
  summary.matched = summary.logged;
  summary.newAccountKeys = (await db.listAccounts()).map((a) => a.key).filter((k) => !before0.has(k));
  // Most recent suspicious messages first, at most 12 — reviewing should feel finite.
  const sus: AutoLogEvent[] = [];
  for (const id of suspiciousIds.slice(-12).reverse()) {
    const e = await db.getEvent(id);
    if (e) sus.push(e);
  }
  summary.suspicious = sus;
  return summary;
};

export const runDiscovery = (
  userId: string,
  range: { from?: number; to?: number } = {},
  onProgress?: (p: ScanProgress) => void
) =>
  serial(() => {
    const to = range.to ?? Date.now();
    const from = range.from ?? to - DISCOVERY_DAYS * DAY;
    return scan(userId, from, to, 'discovery', onProgress);
  });

export const runRecovery = (userId: string, from: number, to: number, onProgress?: (p: ScanProgress) => void) =>
  serial(() => scan(userId, from, to, 'recovery', onProgress));

// ─── Setup / resume / pause / sign-out / turn off ───────────────────────────

export const completeSetup = (
  userId: string,
  opts: { trackedKeys: string[]; keepAccounts: RemoteAccount[] }
) =>
  serial(async () => {
    await db.openDb(userId);
    const all = await db.listAccounts();
    for (const a of all) await db.setAccountTracked(a.key, opts.trackedKeys.includes(a.key));
    for (const k of opts.keepAccounts) {
      await db.upsertAccountManual({ key: `${k.bankCode}:${k.last4}`, bank: k.bank, bankCode: k.bankCode, last4: k.last4, kind: k.kind }, true);
    }
    const now = Date.now();
    await db.setMeta('setup_complete', '1');
    await db.setMeta('live_since', String(now)); // the Live boundary
    await db.setMeta('last_checked', String(now));
    await db.setMeta('signed_out_at', null);
    await db.setMeta('paused_at', null);
    try { ArthikAutoLog?.clearQueue(); } catch {}
    setCapture(true);
    await applyEmailFlag();
    await SecureStore.deleteItemAsync(dismissKey(userId));
    await syncRemoteAccounts(userId, { enabled: true, setup_at: new Date(now).toISOString(), signed_out_at: null, last_active_at: new Date(now).toISOString() });
    await ensureBackgroundRegistered();
  });

/** After Recovery or "Learn from this period": Live resumes from now. */
export const resumeLive = (userId: string) =>
  serial(async () => {
    await db.openDb(userId);
    const now = Date.now();
    await db.setMeta('signed_out_at', null);
    await db.setMeta('paused_at', null);
    await db.setMeta('last_checked', String(now));
    try { ArthikAutoLog?.clearQueue(); } catch {}
    setCapture(true);
    await applyEmailFlag();
    upsertRemoteProfile(userId, { signed_out_at: null, last_active_at: new Date(now).toISOString() });
    await ensureBackgroundRegistered();
  });

export const pause = async (userId: string) => {
  await processQueue(userId, { notify: false });
  await serial(async () => {
    await db.openDb(userId);
    await db.setMeta('paused_at', String(Date.now()));
    setCapture(false);
  });
};

export const getPausedAt = async (userId: string) => (await readLocalState(userId)).pausedAt;

export const onBeforeSignOut = async (userId: string) => {
  if (!isSupported()) return;
  try {
    const state = await readLocalState(userId);
    if (!state.setupComplete) return;
    await Promise.race([processQueue(userId, { notify: false }), new Promise((r) => setTimeout(r, 4000))]);
    await serial(async () => {
      await db.openDb(userId);
      const now = Date.now();
      if (!state.signedOutAt) await db.setMeta('signed_out_at', String(now));
      setCapture(false);
      await upsertRemoteProfile(userId, { signed_out_at: new Date(now).toISOString(), last_active_at: new Date(now).toISOString() });
    });
  } catch {
    setCapture(false);
  } finally {
    await db.closeDb();
  }
};

export const turnOff = (userId: string) =>
  serial(async () => {
    setCapture(false);
    setNativeEmail(false);
    try { ArthikAutoLog?.clearQueue(); } catch {}
    await db.deleteLocalData(userId);
    await upsertRemoteProfile(userId, { enabled: false, tracked_accounts: [], signed_out_at: null });
    await unregisterBackground();
  });

export const syncRemoteAccounts = async (userId: string, extra: Record<string, unknown> = {}) => {
  const accounts = (await db.listAccounts()).filter((a) => a.tracked);
  await upsertRemoteProfile(userId, {
    ...extra,
    tracked_accounts: accounts.map((a) => ({ bank: a.bank, bankCode: a.bankCode, last4: a.last4, kind: a.kind })),
  });
};

export const setTracked = (userId: string, key: string, tracked: boolean) =>
  serial(async () => {
    await db.openDb(userId);
    await db.setAccountTracked(key, tracked);
    await syncRemoteAccounts(userId);
  });

export const removeTrackedAccount = (userId: string, key: string) =>
  serial(async () => {
    await db.openDb(userId);
    await db.removeAccount(key);
    await syncRemoteAccounts(userId);
  });

export type { TrackedAccount };

// ─── Background (wired in background.ts, imported lazily to keep this file testable) ──

export const ensureBackgroundRegistered = async () => {
  try {
    const { registerBackground } = await import('./background');
    await registerBackground();
  } catch {}
};
const unregisterBackground = async () => {
  try {
    const { unregisterBackground: un } = await import('./background');
    await un();
  } catch {}
};

// ─── Developer test tools (used only from __DEV__ UI; never shown in release builds) ──

export type DevSimulation = 'notification_debit' | 'sms_debit' | 'email_debit' | 'sms_credit_person' | 'sms_unreadable' | 'expire_previews';

/**
 * Pushes realistic fake events through the REAL live pipeline (parser → engine → ledger),
 * for emulators (which cannot send bank-style SMS) and for testing without spending money.
 */
export const devSimulate = (userId: string, kind: DevSimulation): Promise<string> =>
  serial(async () => {
    await db.openDb(userId);
    const state = await readLocalState(userId);
    if (!isLiveState(state)) return 'Automatic Logging must be active (finish setup / resume first).';
    const now = Date.now();
    if (kind === 'expire_previews') {
      const n = await sweepAwaiting(now + 21 * 60_000, true);
      return `${n} waiting preview(s) moved to Pending Review.`;
    }
    if (kind === 'notification_debit') {
      const r = await processNotification({ app: 'PhonePe', title: 'Paid ₹349 to Zomato', body: 'Payment successful', date: now }, { origin: 'live', notify: true });
      return `PhonePe notification → ${r.status}`;
    }
    const acc = (await db.listAccounts()).find((a) => a.tracked);
    if (!acc) return 'Track at least one account first.';
    if (kind === 'email_debit') {
      const d = new Date(now);
      const dd = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const r = await processEmail(
        {
          app: 'Gmail',
          title: `${acc.bank} Alerts`,
          body: `Transaction alert. Rs. 349.00 has been debited from your account XX${acc.last4} for a UPI payment to ZOMATO on ${dd} at ${hm}. Never share your OTP or password with anyone.`,
          date: now,
        },
        { origin: 'live', notify: true }
      );
      return `Bank email → ${r.status}${r.reviewReason ? ` (${r.reviewReason})` : ''}`;
    }
    const sender = `VM-${acc.bankCode}`;
    const ref = String(now).slice(-12).padStart(12, '6');
    const body =
      kind === 'sms_debit'
        ? `Sent Rs.349.00 From ${acc.bank} A/C *${acc.last4} To ZOMATO On today Ref ${ref}`
        : kind === 'sms_credit_person'
        ? `Rs.2000.00 credited to ${acc.bank} A/c XX${acc.last4} from VPA rahul.k@okaxis (UPI ${ref})`
        : `Your A/c XX${acc.last4} has a transaction of Rs 750 kindly check`;
    const r = await processSms({ address: sender, body, date: now }, { origin: 'live', notify: true });
    return `Bank SMS → ${r.status}${r.reviewReason ? ` (${r.reviewReason})` : ''}`;
  });
