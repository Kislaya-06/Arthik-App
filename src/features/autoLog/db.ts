import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { AutoLogEvent, EventStatus, ReviewReason, TrackedAccount } from './types';

/**
 * On-device, encrypted (SQLCipher) store for Automatic Logging.
 * One database per signed-in user. Nothing here is ever uploaded.
 *
 * Its existence IS the "persistent local Automatic Logging state" from spec §30–36:
 * clear cache keeps it, clear data / uninstall removes it (key + file both go).
 */

const KEY_NAME = 'arthik_autolog_db_key_v1';
const SCHEMA_VERSION = 1;

const dbName = (userId: string) => `autolog_${userId.replace(/[^a-zA-Z0-9]/g, '')}.db`;

let current: { userId: string; db: SQLite.SQLiteDatabase } | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

const getKey = async (): Promise<string> => {
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_NAME, key);
  }
  return key;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
CREATE TABLE IF NOT EXISTS accounts (
  key TEXT PRIMARY KEY NOT NULL, bank TEXT NOT NULL, bank_code TEXT NOT NULL, last4 TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bank', tracked INTEGER NOT NULL DEFAULT 0, is_new INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, msg_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL, source TEXT NOT NULL, origin TEXT NOT NULL, sender TEXT NOT NULL,
  body TEXT NOT NULL, fingerprint TEXT NOT NULL, occurred_at INTEGER NOT NULL,
  amount REAL, direction TEXT, account_key TEXT, merchant TEXT, ref TEXT, template TEXT NOT NULL,
  kind TEXT NOT NULL, status TEXT NOT NULL, review_reason TEXT, expense_id TEXT, matched_id TEXT,
  needs_category INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_expense ON events (expense_id);
CREATE INDEX IF NOT EXISTS idx_events_ref ON events (ref);
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, sender TEXT, template TEXT, fingerprint TEXT,
  direction TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS merchant_prefs (
  merchant TEXT PRIMARY KEY NOT NULL, category_id TEXT, type TEXT, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  template TEXT PRIMARY KEY NOT NULL, bank TEXT, source TEXT, count INTEGER NOT NULL DEFAULT 0, learned_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY NOT NULL, event_id TEXT, expense_id TEXT, reason TEXT NOT NULL, created_at INTEGER NOT NULL
);
`;

const openFresh = async (name: string, key: string) => {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync(`PRAGMA key = '${key}';`);
  await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master'); // throws on a wrong key
  return db;
};

/** Returns true if a local Automatic Logging database file exists for this user. */
export const localDbExists = async (userId: string): Promise<boolean> => {
  try {
    const db = await openDb(userId);
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'setup_complete'");
    return row?.value === '1';
  } catch {
    return false;
  }
};

export const openDb = async (userId: string): Promise<SQLite.SQLiteDatabase> => {
  if (current && current.userId === userId) return current.db;
  if (opening) {
    const db = await opening;
    if (current && current.userId === userId) return db;
  }
  opening = (async () => {
    if (current) {
      try { await current.db.closeAsync(); } catch {}
      current = null;
    }
    const name = dbName(userId);
    const key = await getKey();
    let db: SQLite.SQLiteDatabase;
    try {
      db = await openFresh(name, key);
    } catch {
      // Key no longer matches (app data partially restored): the old state is unusable.
      // Spec §30: never pretend it still exists → start clean.
      try { await SQLite.deleteDatabaseAsync(name); } catch {}
      db = await openFresh(name, key);
    }
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync(SCHEMA);
    await db.runAsync("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', ?)", String(SCHEMA_VERSION));
    current = { userId, db };
    return db;
  })();
  try {
    return await opening;
  } finally {
    opening = null;
  }
};

export const closeDb = async () => {
  if (!current) return;
  try { await current.db.closeAsync(); } catch {}
  current = null;
};

export const deleteLocalData = async (userId: string) => {
  await closeDb();
  try { await SQLite.deleteDatabaseAsync(dbName(userId)); } catch {}
};

const requireDb = () => {
  if (!current) throw new Error('Automatic Logging database is not open');
  return current.db;
};

// ─── meta ───────────────────────────────────────────────────────────────────

export const getMeta = async (key: string): Promise<string | null> => {
  const row = await requireDb().getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
};
export const setMeta = async (key: string, value: string | null) => {
  if (value === null) await requireDb().runAsync('DELETE FROM meta WHERE key = ?', key);
  else await requireDb().runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
};
export const getMetaNum = async (key: string): Promise<number | null> => {
  const v = await getMeta(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

// ─── accounts ───────────────────────────────────────────────────────────────

interface AccountRow {
  key: string; bank: string; bank_code: string; last4: string; kind: string; tracked: number; is_new: number;
  first_seen: number; last_seen: number; msg_count: number;
}
const toAccount = (r: AccountRow): TrackedAccount => ({
  key: r.key, bank: r.bank, bankCode: r.bank_code, last4: r.last4, kind: r.kind as TrackedAccount['kind'],
  tracked: r.tracked === 1, isNew: r.is_new === 1, firstSeen: r.first_seen, lastSeen: r.last_seen, msgCount: r.msg_count,
});

export const listAccounts = async (): Promise<TrackedAccount[]> =>
  (await requireDb().getAllAsync<AccountRow>('SELECT * FROM accounts ORDER BY bank, last4')).map(toAccount);

export const getAccount = async (key: string): Promise<TrackedAccount | null> => {
  const r = await requireDb().getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE key = ?', key);
  return r ? toAccount(r) : null;
};

/** Records that an account was seen. New accounts start UNtracked (trust rule 4). */
export const touchAccount = async (
  a: { key: string; bank: string; bankCode: string; last4: string; kind: string },
  seenAt: number,
  markNew: boolean
) => {
  await requireDb().runAsync(
    `INSERT INTO accounts (key, bank, bank_code, last4, kind, tracked, is_new, first_seen, last_seen, msg_count)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen), msg_count = msg_count + 1`,
    a.key, a.bank, a.bankCode, a.last4, a.kind, markNew ? 1 : 0, seenAt, seenAt
  );
};

export const upsertAccountManual = async (a: { key: string; bank: string; bankCode: string; last4: string; kind: string }, tracked: boolean) => {
  await requireDb().runAsync(
    `INSERT INTO accounts (key, bank, bank_code, last4, kind, tracked, is_new, first_seen, last_seen, msg_count)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
     ON CONFLICT(key) DO UPDATE SET tracked = excluded.tracked, is_new = 0`,
    a.key, a.bank, a.bankCode, a.last4, a.kind, tracked ? 1 : 0
  );
};

export const setAccountTracked = async (key: string, tracked: boolean) => {
  await requireDb().runAsync('UPDATE accounts SET tracked = ?, is_new = 0 WHERE key = ?', tracked ? 1 : 0, key);
};

export const removeAccount = async (key: string) => {
  await requireDb().runAsync('DELETE FROM accounts WHERE key = ?', key);
};

// ─── events ─────────────────────────────────────────────────────────────────

interface EventRow {
  id: string; source: string; origin: string; sender: string; body: string; fingerprint: string; occurred_at: number;
  amount: number | null; direction: string | null; account_key: string | null; merchant: string | null; ref: string | null;
  template: string; kind: string; status: string; review_reason: string | null; expense_id: string | null;
  matched_id: string | null; needs_category: number; created_at: number;
}
const toEvent = (r: EventRow): AutoLogEvent => ({
  id: r.id, source: r.source as AutoLogEvent['source'], origin: r.origin as AutoLogEvent['origin'], sender: r.sender,
  body: r.body, fingerprint: r.fingerprint, occurredAt: r.occurred_at, amount: r.amount,
  direction: r.direction as AutoLogEvent['direction'], accountKey: r.account_key, merchant: r.merchant, ref: r.ref,
  template: r.template, kind: r.kind as AutoLogEvent['kind'], status: r.status as EventStatus,
  reviewReason: r.review_reason as ReviewReason | null, expenseId: r.expense_id, matchedId: r.matched_id,
  needsCategory: r.needs_category === 1, createdAt: r.created_at,
});

export const insertEvent = async (e: AutoLogEvent) => {
  await requireDb().runAsync(
    `INSERT OR IGNORE INTO events (id, source, origin, sender, body, fingerprint, occurred_at, amount, direction, account_key,
      merchant, ref, template, kind, status, review_reason, expense_id, matched_id, needs_category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id, e.source, e.origin, e.sender, e.body, e.fingerprint, e.occurredAt, e.amount, e.direction, e.accountKey,
    e.merchant, e.ref, e.template, e.kind, e.status, e.reviewReason, e.expenseId, e.matchedId, e.needsCategory ? 1 : 0, e.createdAt
  );
};

export const updateEvent = async (
  id: string,
  patch: Partial<Pick<AutoLogEvent, 'status' | 'reviewReason' | 'expenseId' | 'matchedId' | 'needsCategory' | 'merchant' | 'direction' | 'amount'>>
) => {
  const cols: string[] = [];
  const vals: (string | number | null)[] = [];
  const map: Record<string, string> = {
    status: 'status', reviewReason: 'review_reason', expenseId: 'expense_id', matchedId: 'matched_id',
    needsCategory: 'needs_category', merchant: 'merchant', direction: 'direction', amount: 'amount',
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    cols.push(`${map[k]} = ?`);
    vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number | null));
  }
  if (!cols.length) return;
  await requireDb().runAsync(`UPDATE events SET ${cols.join(', ')} WHERE id = ?`, ...vals, id);
};

export const getEvent = async (id: string) => {
  const r = await requireDb().getFirstAsync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return r ? toEvent(r) : null;
};

export const getEventsForExpense = async (expenseId: string): Promise<AutoLogEvent[]> => {
  const db = requireDb();
  const main = await db.getAllAsync<EventRow>('SELECT * FROM events WHERE expense_id = ? ORDER BY occurred_at', expenseId);
  const ids = main.map((m) => m.id);
  if (!ids.length) return [];
  const matched = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE matched_id IN (${ids.map(() => '?').join(',')})`, ...ids
  );
  // v2.1: a source can be merged into a source that was later merged into the main one
  // (email → notification → SMS). Walk one more level so every source is shown.
  const childIds = matched.map((m) => m.id);
  const grand = childIds.length
    ? await db.getAllAsync<EventRow>(`SELECT * FROM events WHERE matched_id IN (${childIds.map(() => '?').join(',')})`, ...childIds)
    : [];
  const seen = new Set<string>();
  return [...main, ...matched, ...grand].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).map(toEvent);
};

export const findEvents = async (where: string, ...params: (string | number | null)[]): Promise<AutoLogEvent[]> =>
  (await requireDb().getAllAsync<EventRow>(`SELECT * FROM events WHERE ${where}`, ...params)).map(toEvent);

export const listPending = async (): Promise<AutoLogEvent[]> =>
  findEvents(
    "(status = 'pending' OR (status = 'logged' AND needs_category = 1)) AND origin != 'discovery' ORDER BY occurred_at DESC LIMIT 200"
  );

export const countPending = async (): Promise<number> => {
  const r = await requireDb().getFirstAsync<{ n: number }>(
    "SELECT count(*) AS n FROM events WHERE (status = 'pending' OR (status = 'logged' AND needs_category = 1)) AND origin != 'discovery'"
  );
  return r?.n ?? 0;
};

export const listRecent = async (limit = 15): Promise<AutoLogEvent[]> =>
  findEvents("origin != 'discovery' AND status NOT IN ('ignored','duplicate','untracked') ORDER BY occurred_at DESC LIMIT ?", limit);

export const statsSince = async (since: number) => {
  const r = await requireDb().getFirstAsync<{ detected: number; matched: number; pending: number; logged: number }>(
    `SELECT
       SUM(CASE WHEN status IN ('logged','pending','transfer','queued') THEN 1 ELSE 0 END) AS detected,
       SUM(CASE WHEN status = 'merged' THEN 1 ELSE 0 END) AS matched,
       SUM(CASE WHEN status = 'pending' OR (status = 'logged' AND needs_category = 1) THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'logged' THEN 1 ELSE 0 END) AS logged
     FROM events WHERE occurred_at >= ? AND origin != 'discovery'`,
    since
  );
  return { detected: r?.detected ?? 0, matched: r?.matched ?? 0, pending: r?.pending ?? 0, logged: r?.logged ?? 0 };
};

export const pruneOldEvents = async (olderThan: number) => {
  // Keep explanations for logged transactions; drop old noise.
  await requireDb().runAsync(
    "DELETE FROM events WHERE occurred_at < ? AND status IN ('ignored','duplicate','untracked','discovery')",
    olderThan
  );
};

// ─── rules / templates / merchant prefs / feedback ───────────────────────────

export interface IgnoreRule { id: string; kind: 'ignore_message' | 'ignore_template' | 'accept_template'; sender: string | null; template: string | null; fingerprint: string | null; direction: string | null; }

export const listRules = async (): Promise<IgnoreRule[]> =>
  requireDb().getAllAsync<IgnoreRule>('SELECT id, kind, sender, template, fingerprint, direction FROM rules');

export const addRule = async (r: Omit<IgnoreRule, 'id'>) => {
  await requireDb().runAsync(
    'INSERT INTO rules (id, kind, sender, template, fingerprint, direction, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    Crypto.randomUUID(), r.kind, r.sender, r.template, r.fingerprint, r.direction, Date.now()
  );
};

export const learnTemplate = async (template: string, bank: string, source: string) => {
  await requireDb().runAsync(
    `INSERT INTO templates (template, bank, source, count, learned_at) VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(template) DO UPDATE SET count = count + 1`,
    template, bank, source, Date.now()
  );
};

export const countTemplates = async (): Promise<number> =>
  (await requireDb().getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM templates'))?.n ?? 0;

export const templateExists = async (template: string): Promise<boolean> =>
  !!(await requireDb().getFirstAsync('SELECT 1 FROM templates WHERE template = ?', template));

export const merchantKey = (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getMerchantPref = async (merchant: string | null) => {
  if (!merchant) return null;
  return requireDb().getFirstAsync<{ category_id: string | null; type: string | null }>(
    'SELECT category_id, type FROM merchant_prefs WHERE merchant = ?', merchantKey(merchant)
  );
};

export const setMerchantPref = async (merchant: string, categoryId: string | null, type: 'expense' | 'income' | null) => {
  await requireDb().runAsync(
    `INSERT INTO merchant_prefs (merchant, category_id, type, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(merchant) DO UPDATE SET category_id = COALESCE(excluded.category_id, category_id), type = COALESCE(excluded.type, type), updated_at = excluded.updated_at`,
    merchantKey(merchant), categoryId, type, Date.now()
  );
};

export const addFeedback = async (eventId: string | null, expenseId: string | null, reason: string) => {
  await requireDb().runAsync(
    'INSERT INTO feedback (id, event_id, expense_id, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    Crypto.randomUUID(), eventId, expenseId, reason, Date.now()
  );
};
