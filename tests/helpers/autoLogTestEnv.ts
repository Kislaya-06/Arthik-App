/**
 * Test doubles for Automatic Logging.
 * - expo-sqlite → Node's built-in SQLite (real SQL, so db.ts is genuinely exercised)
 * - native module → in-memory SMS inbox + event queue + capture flag
 * - ledger → records transactions instead of touching expenseStore / Supabase
 * - remote → in-memory autolog_profiles row
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';

// ─── expo-sqlite ───
const files = new Map<string, DatabaseSync>();
const norm = (v: unknown) => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v);
const wrap = (d: DatabaseSync) => ({
  execAsync: async (sql: string) => {
    if (/^\s*PRAGMA\s+(key|journal_mode)/i.test(sql)) return; // SQLCipher-only / file-only pragmas
    d.exec(sql);
  },
  runAsync: async (sql: string, ...params: unknown[]) => d.prepare(sql).run(...(params.map(norm) as any[])),
  getFirstAsync: async (sql: string, ...params: unknown[]) => (d.prepare(sql).get(...(params.map(norm) as any[])) as any) ?? null,
  getAllAsync: async (sql: string, ...params: unknown[]) => d.prepare(sql).all(...(params.map(norm) as any[])) as any[],
  closeAsync: async () => {},
});
export const fakeSqlite = {
  openDatabaseAsync: async (name: string) => {
    let d = files.get(name);
    if (!d) {
      d = new DatabaseSync(':memory:');
      files.set(name, d);
    }
    return wrap(d);
  },
  deleteDatabaseAsync: async (name: string) => {
    files.delete(name);
  },
};
/** Simulates "Clear storage" / uninstall: every local database file is gone. */
export const wipeAllLocalFiles = () => files.clear();

// ─── expo-secure-store ───
export const secure = new Map<string, string>();
export const fakeSecureStore = {
  getItemAsync: async (k: string) => secure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void secure.set(k, v),
  deleteItemAsync: async (k: string) => void secure.delete(k),
};

// ─── expo-crypto ───
export const fakeCrypto = {
  randomUUID: () => randomUUID(),
  getRandomBytesAsync: async (n: number) => new Uint8Array(randomBytes(n)),
};

// ─── native module ───
export interface InboxSms { id: string; address: string; body: string; date: number }
export const native = {
  inbox: [] as InboxSms[],
  queue: [] as string[],
  capture: false,
  notifAccess: true,
  battery: true,
};
const isFinancial = (address: string, body: string) =>
  !/^\+?[0-9 ]{8,15}$/.test(address) &&
  !/\b(otp|one[ -]?time[ -]?password|verification code)\b/i.test(body) &&
  /((rs\.?|inr|₹)\s*[0-9]|(debited|credited)\s+(by|for|with|of)?\s*[0-9])/i.test(body);

export const fakeNative = {
  isAvailable: () => true,
  setCaptureEnabled: (v: boolean) => void (native.capture = v),
  isCaptureEnabled: () => native.capture,
  getLastEventAt: () => 0,
  drainQueue: () => native.queue.splice(0),
  getQueueSize: () => native.queue.length,
  clearQueue: () => void native.queue.splice(0),
  countSms: async (since: number, until: number) => native.inbox.filter((m) => m.date >= since && m.date < until).length,
  readSmsPage: async (since: number, before: number, pageSize: number) => {
    const rows = native.inbox.filter((m) => m.date >= since && m.date < before).sort((a, b) => b.date - a.date).slice(0, pageSize);
    return {
      messages: rows.filter((m) => isFinancial(m.address, m.body)),
      scanned: rows.length,
      oldest: rows.length ? rows[rows.length - 1].date : before,
      done: rows.length < pageSize,
    };
  },
  isNotificationListenerEnabled: () => native.notifAccess,
  openNotificationListenerSettings: () => {},
  isIgnoringBatteryOptimizations: () => native.battery,
  openAppDetails: () => {},
  openBatteryOptimizationList: () => {},
};

/** What a native receiver would push when an SMS arrives while capture is on. */
export const receiveSms = (address: string, body: string, date: number) => {
  native.inbox.push({ id: String(native.inbox.length + 1), address, body, date });
  if (native.capture && isFinancial(address, body)) native.queue.push(JSON.stringify({ type: 'sms', address, body, date }));
};
export const receiveNotification = (app: string, title: string, body: string, date: number) => {
  if (native.capture) native.queue.push(JSON.stringify({ type: 'notification', app, title, body, date }));
};

// ─── ledger ───
export interface Tx { id: string; amount: number; type: 'expense' | 'income'; categoryId: string | null; note: string; paymentMode: string; occurredAt: number }
export const ledger = {
  txs: new Map<string, Tx>(),
  manual: [] as Array<{ id: string; amount: number; type: 'expense' | 'income'; occurredAt: number }>,
  offline: false,
};
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
export const fakeLedger = {
  paymentModeFor: (kind: string | null | undefined, type: 'expense' | 'income') => (kind === 'card' && type === 'expense' ? 'card' : 'upi'),
  createTransaction: async (tx: Omit<Tx, 'id'>, presetId?: string) => {
    if (ledger.offline) return null;
    const id = presetId || randomUUID();
    ledger.txs.set(id, { ...tx, id });
    return id;
  },
  setTransactionCategory: async (id: string, categoryId: string | null) => {
    const t = ledger.txs.get(id);
    if (t) t.categoryId = categoryId;
    return !!t;
  },
  setTransactionType: async (id: string, type: 'expense' | 'income') => {
    const t = ledger.txs.get(id);
    if (t) t.type = type;
    return !!t;
  },
  deleteTransaction: async (id: string) => ledger.txs.delete(id),
  findManualLookalike: (amount: number, type: 'expense' | 'income', occurredAt: number) =>
    ledger.manual.find((m) => m.amount === amount && m.type === type && sameDay(m.occurredAt, occurredAt)),
};

// ─── remote (autolog_profiles) ───
/** One row per user, like the real table. `remote.row` is a shortcut to user-1's row. */
export const remote: { rows: Map<string, any>; ok: boolean; readonly row: any } = {
  rows: new Map(),
  ok: true,
  get row() {
    return this.rows.get('user-1') ?? null;
  },
};
export const fakeRemote = {
  fetchRemoteProfile: async (userId: string) =>
    remote.ok ? { ok: true, profile: remote.rows.get(userId) ?? null } : { ok: false, profile: null },
  upsertRemoteProfile: async (userId: string, patch: any) => {
    remote.rows.set(userId, {
      enabled: false, setup_at: null, last_active_at: null, signed_out_at: null, tracked_accounts: [],
      ...(remote.rows.get(userId) ?? {}), ...patch,
    });
  },
};

export const resetEnv = () => {
  files.clear();
  secure.clear();
  native.inbox = [];
  native.queue = [];
  native.capture = false;
  native.notifAccess = true;
  native.battery = true;
  ledger.txs.clear();
  ledger.manual = [];
  ledger.offline = false;
  remote.rows.clear();
  remote.ok = true;
};
