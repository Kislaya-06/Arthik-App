import { runExclusive } from './queueLock';
import { textToBase64, base64ToText } from './sessionCodec';

/**
 * SEC-02: the Supabase login session (access token + refresh token) is no longer kept as readable text.
 *
 * How it is stored:
 * - The value stays under the SAME AsyncStorage key Supabase always used, but as
 *   `arthik-enc-v1:<iv>:<ciphertext+tag>` (AES-256-GCM, base64 parts).
 * - The AES key lives in the phone's secure storage (Android Keystore through expo-secure-store).
 *
 * Safety rules (the app must never lose a working session because of this file):
 * 1. A session saved by an older app version (plain text) is read as it is, then encrypted in the background.
 * 2. Before an encrypted value is written, it is decrypted again and compared with the original. If anything is
 *    off (no secure storage, cipher error, mismatch), the value is written as plain text exactly like before and
 *    encryption stays off until the app is restarted.
 * 3. Writes for one key never overlap (same per-key lock the offline queues use).
 * 4. A stored value that cannot be decrypted (after one retry) reads as "no session": `onUnreadable` runs first so
 *    the app can show the login screen cleanly, and the user signs in again. The value itself is never deleted here,
 *    so if the problem was temporary the next app start reads it normally.
 */

export const ENCRYPTED_PREFIX = 'arthik-enc-v1:';
export const SESSION_KEY_NAME = 'arthik_session_key_v1';

/** The key-value store the encrypted values live in (AsyncStorage in the app). */
export interface PlainStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Where the AES key lives (expo-secure-store in the app). */
export interface KeyVault {
  getItemAsync(name: string): Promise<string | null>;
  setItemAsync(name: string, value: string): Promise<void>;
}

/** AES-GCM with base64 strings on both sides (see `expoSessionCipher.ts`). */
export interface SessionCipher {
  /** A new random 256-bit key, base64. */
  generateKey(): Promise<string>;
  encrypt(plainBase64: string, keyBase64: string): Promise<{ iv: string; data: string }>;
  /** Returns the plaintext as base64. Must throw when the key is wrong or the data was changed. */
  decrypt(ivBase64: string, dataBase64: string, keyBase64: string): Promise<string>;
}

export interface SecureSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const BASE64_PART = /^[A-Za-z0-9+/]+={0,2}$/;
const lockKeyFor = (key: string) => `secure-session:${key}`;

export const isEncryptedSessionValue = (raw: string | null | undefined): boolean =>
  typeof raw === 'string' && raw.startsWith(ENCRYPTED_PREFIX);

export const UNREADABLE_RETRY_MS = 200;

export function createSecureSessionStorage(deps: {
  storage: PlainStorage;
  vault: KeyVault;
  cipher: SessionCipher;
  /** Runs (and is awaited) before an unreadable stored value is reported as "no session". Errors are ignored. */
  onUnreadable?: (key: string) => Promise<void> | void;
  /** Wait before the single retry of an unreadable value. */
  retryDelayMs?: number;
}): SecureSessionStorage {
  const { storage, vault, cipher, onUnreadable } = deps;
  const retryDelayMs = deps.retryDelayMs ?? UNREADABLE_RETRY_MS;

  /** The AES key once it is known in this app run. */
  let knownKey: string | null = null;
  let creatingKey: Promise<string | null> | null = null;
  /** Set when sealing failed once; plain text (the old behaviour) is used until the next app start. */
  let encryptionOff = false;
  /** Last value read or written per key, so an unchanged value is not decrypted again (the token refresh timer reads often). */
  const lastSeen = new Map<string, { raw: string; plain: string }>();
  /** Keys whose plain-text value is being encrypted in the background right now. */
  const upgrading = new Set<string>();

  const readKey = async (): Promise<string | null> => {
    if (knownKey) return knownKey;
    const stored = await vault.getItemAsync(SESSION_KEY_NAME);
    if (stored) knownKey = stored;
    return knownKey;
  };

  const ensureKey = (): Promise<string | null> => {
    if (knownKey) return Promise.resolve(knownKey);
    if (!creatingKey) {
      creatingKey = (async () => {
        const existing = await readKey();
        if (existing) return existing;
        const fresh = await cipher.generateKey();
        await vault.setItemAsync(SESSION_KEY_NAME, fresh);
        // Trust the key only when secure storage really gives it back.
        const confirmed = await vault.getItemAsync(SESSION_KEY_NAME);
        if (confirmed !== fresh) throw new Error('Secure storage did not keep the session key');
        knownKey = fresh;
        return fresh;
      })().finally(() => {
        creatingKey = null;
      });
    }
    return creatingKey;
  };

  /** Decrypts a stored value. Throws when it cannot be read. */
  const open = async (raw: string): Promise<string> => {
    const body = raw.slice(ENCRYPTED_PREFIX.length);
    const split = body.indexOf(':');
    const iv = split > 0 ? body.slice(0, split) : '';
    const data = split > 0 ? body.slice(split + 1) : '';
    if (!BASE64_PART.test(iv) || !BASE64_PART.test(data)) throw new Error('Stored session has an unknown format');
    const key = await readKey();
    if (!key) throw new Error('Session key is missing');
    return base64ToText(await cipher.decrypt(iv, data, key));
  };

  /** Encrypts a value and proves it can be read back. Returns null when plain text must be used instead. */
  const seal = async (value: string): Promise<string | null> => {
    if (encryptionOff) return null;
    try {
      const key = await ensureKey();
      if (!key) throw new Error('Session key is missing');
      const { iv, data } = await cipher.encrypt(textToBase64(value), key);
      if (!BASE64_PART.test(iv) || !BASE64_PART.test(data)) throw new Error('Cipher returned an unknown format');
      const sealed = `${ENCRYPTED_PREFIX}${iv}:${data}`;
      if ((await open(sealed)) !== value) throw new Error('Encrypted session did not read back');
      return sealed;
    } catch (e) {
      encryptionOff = true;
      if (__DEV__) console.warn('[secureSessionStorage] Encryption unavailable, keeping plain storage:', e);
      return null;
    }
  };

  /** A session saved as plain text by an older version: encrypt it, but only if it is still the current value. */
  const upgradeInBackground = (key: string, plain: string) => {
    if (encryptionOff || upgrading.has(key)) return;
    upgrading.add(key);
    runExclusive(lockKeyFor(key), async () => {
      const sealed = await seal(plain);
      if (!sealed) return;
      if ((await storage.getItem(key)) !== plain) return; // changed or removed meanwhile: leave it
      await storage.setItem(key, sealed);
      lastSeen.set(key, { raw: sealed, plain });
    })
      .catch(() => {})
      .then(() => {
        upgrading.delete(key);
      });
  };

  return {
    getItem: async (key) => {
      const raw = await storage.getItem(key);
      if (raw === null || raw === undefined) return null;

      if (!isEncryptedSessionValue(raw)) {
        upgradeInBackground(key, raw);
        return raw;
      }

      const seen = lastSeen.get(key);
      if (seen && seen.raw === raw) return seen.plain;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const plain = await open(raw);
          lastSeen.set(key, { raw, plain });
          return plain;
        } catch (e) {
          if (attempt === 0) {
            // Secure storage can fail for a moment right after the phone starts: try once more.
            await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          if (__DEV__) console.warn('[secureSessionStorage] Stored session could not be read:', e);
        }
      }
      try {
        await onUnreadable?.(key);
      } catch {}
      return null;
    },

    setItem: (key, value) =>
      runExclusive(lockKeyFor(key), async () => {
        const sealed = await seal(value);
        const raw = sealed ?? value;
        await storage.setItem(key, raw);
        if (sealed) lastSeen.set(key, { raw, plain: value });
        else lastSeen.delete(key);
      }),

    removeItem: (key) =>
      runExclusive(lockKeyFor(key), async () => {
        lastSeen.delete(key);
        await storage.removeItem(key);
      }),
  };
}
