import { describe, it, expect, vi } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import {
  createSecureSessionStorage,
  ENCRYPTED_PREFIX,
  SESSION_KEY_NAME,
  isEncryptedSessionValue,
  type SessionCipher,
} from '../src/lib/secureSessionStorage';

const KEY = 'sb-test-auth-token';
const SESSION = JSON.stringify({
  access_token: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
  refresh_token: 'refresh-token-SECRET-123',
  user: { id: 'u1', email: 'user@arthik.app', user_metadata: { first_name: 'अर्थिक 😀' } },
});

/** Real AES-256-GCM (Node), with the same string-only contract as `expoSessionCipher.ts`. */
const makeCipher = () => {
  const cipher = {
    generateKey: vi.fn(async () => randomBytes(32).toString('base64')),
    encrypt: vi.fn(async (plainBase64: string, keyBase64: string) => {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv);
      const data = Buffer.concat([c.update(Buffer.from(plainBase64, 'base64')), c.final(), c.getAuthTag()]);
      return { iv: iv.toString('base64'), data: data.toString('base64') };
    }),
    decrypt: vi.fn(async (ivBase64: string, dataBase64: string, keyBase64: string) => {
      const buf = Buffer.from(dataBase64, 'base64');
      const d = createDecipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), Buffer.from(ivBase64, 'base64'));
      d.setAuthTag(buf.subarray(buf.length - 16));
      return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('base64');
    }),
  };
  return cipher satisfies SessionCipher;
};

const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: vi.fn(async (k: string) => map.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      map.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      map.delete(k);
    }),
  };
};

const makeVault = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItemAsync: vi.fn(async (k: string) => map.get(k) ?? null),
    setItemAsync: vi.fn(async (k: string, v: string) => {
      map.set(k, v);
    }),
  };
};

const setup = (over: Partial<Parameters<typeof createSecureSessionStorage>[0]> = {}) => {
  const storage = makeStorage();
  const vault = makeVault();
  const cipher = makeCipher();
  const onUnreadable = vi.fn();
  const make = () =>
    createSecureSessionStorage({ storage, vault, cipher, onUnreadable, retryDelayMs: 0, ...over });
  return { storage, vault, cipher, onUnreadable, make, secure: make() };
};

/** Lets background work (the plain → encrypted upgrade) finish. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

describe('SEC-02 secureSessionStorage', () => {
  it('stores the session encrypted and reads it back', async () => {
    const { secure, storage, vault } = setup();
    await secure.setItem(KEY, SESSION);

    const raw = storage.map.get(KEY)!;
    expect(raw.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(isEncryptedSessionValue(raw)).toBe(true);
    expect(raw).not.toContain('refresh-token-SECRET-123');
    expect(raw).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(raw).not.toContain('user@arthik.app');
    expect(vault.map.get(SESSION_KEY_NAME)).toMatch(/^[A-Za-z0-9+/]{43}=$/); // 32 random bytes
    expect(await secure.getItem(KEY)).toBe(SESSION);
  });

  it('reads the session after an app restart (new instance, same phone storage)', async () => {
    const { secure, make } = setup();
    await secure.setItem(KEY, SESSION);
    expect(await make().getItem(KEY)).toBe(SESSION);
  });

  it('uses a new IV for every write and keeps one key', async () => {
    const { secure, storage, cipher } = setup();
    await secure.setItem(KEY, SESSION);
    const first = storage.map.get(KEY);
    await secure.setItem(KEY, SESSION);
    expect(storage.map.get(KEY)).not.toBe(first);
    expect(cipher.generateKey).toHaveBeenCalledTimes(1);
  });

  it('creates only one key when the first writes overlap', async () => {
    const { secure, cipher } = setup();
    await Promise.all([secure.setItem(KEY, SESSION), secure.setItem(`${KEY}-code-verifier`, 'verifier')]);
    expect(cipher.generateKey).toHaveBeenCalledTimes(1);
    expect(await secure.getItem(KEY)).toBe(SESSION);
    expect(await secure.getItem(`${KEY}-code-verifier`)).toBe('verifier');
  });

  it('returns null for a key that was never stored', async () => {
    const { secure, onUnreadable } = setup();
    expect(await secure.getItem(KEY)).toBeNull();
    expect(onUnreadable).not.toHaveBeenCalled();
  });

  it('removeItem removes the stored value', async () => {
    const { secure, storage } = setup();
    await secure.setItem(KEY, SESSION);
    await secure.removeItem(KEY);
    expect(storage.map.has(KEY)).toBe(false);
    expect(await secure.getItem(KEY)).toBeNull();
  });

  it('does not decrypt again while the stored value is unchanged', async () => {
    const { secure, cipher } = setup();
    await secure.setItem(KEY, SESSION);
    const calls = cipher.decrypt.mock.calls.length;
    await secure.getItem(KEY);
    await secure.getItem(KEY);
    expect(cipher.decrypt.mock.calls.length).toBe(calls);
  });

  describe('session saved as plain text by an older app version', () => {
    it('is returned at once, then encrypted in the background', async () => {
      const { secure, storage, make } = setup();
      storage.map.set(KEY, SESSION);

      expect(await secure.getItem(KEY)).toBe(SESSION);
      await settle();

      expect(storage.map.get(KEY)!.startsWith(ENCRYPTED_PREFIX)).toBe(true);
      expect(await secure.getItem(KEY)).toBe(SESSION);
      expect(await make().getItem(KEY)).toBe(SESSION);
    });

    it('never overwrites a newer session that was saved meanwhile', async () => {
      const { secure, storage, make } = setup();
      storage.map.set(KEY, SESSION);
      const newer = SESSION.replace('refresh-token-SECRET-123', 'refresh-token-NEWER-456');

      const read = secure.getItem(KEY); // starts the background upgrade of the old value
      const write = secure.setItem(KEY, newer); // Supabase refreshes the token right away
      await Promise.all([read, write]);
      await settle();

      expect(await make().getItem(KEY)).toBe(newer);
    });

    it('is left alone when it was removed meanwhile (sign out)', async () => {
      const { secure, storage } = setup();
      storage.map.set(KEY, SESSION);
      const read = secure.getItem(KEY);
      storage.map.delete(KEY);
      await read;
      await settle();
      expect(storage.map.has(KEY)).toBe(false);
    });

    it('starts only one background upgrade for repeated reads', async () => {
      const { secure, storage, cipher } = setup();
      storage.map.set(KEY, SESSION);
      await Promise.all([secure.getItem(KEY), secure.getItem(KEY), secure.getItem(KEY)]);
      await settle();
      expect(cipher.encrypt).toHaveBeenCalledTimes(1);
    });
  });

  describe('falls back to plain storage (the old behaviour) instead of risking the session', () => {
    it('when the cipher cannot encrypt', async () => {
      const { secure, storage, cipher } = setup();
      cipher.encrypt.mockRejectedValue(new Error('native module missing'));

      await secure.setItem(KEY, SESSION);
      expect(storage.map.get(KEY)).toBe(SESSION);
      expect(await secure.getItem(KEY)).toBe(SESSION);

      await secure.setItem(KEY, SESSION + ' ');
      expect(cipher.encrypt).toHaveBeenCalledTimes(1); // stays off for this app run
    });

    it('when the encrypted value does not decrypt back to the original', async () => {
      const { secure, storage, cipher } = setup();
      cipher.decrypt.mockResolvedValue(Buffer.from('something else').toString('base64'));
      await secure.setItem(KEY, SESSION);
      expect(storage.map.get(KEY)).toBe(SESSION);
    });

    it('when the cipher returns something that is not base64', async () => {
      const { secure, storage, cipher } = setup();
      cipher.encrypt.mockResolvedValue({ iv: {} as unknown as string, data: 'x' });
      await secure.setItem(KEY, SESSION);
      expect(storage.map.get(KEY)).toBe(SESSION);
    });

    it('when secure storage cannot save the key', async () => {
      const { secure, storage, vault } = setup();
      vault.setItemAsync.mockRejectedValue(new Error('keystore unavailable'));
      await secure.setItem(KEY, SESSION);
      expect(storage.map.get(KEY)).toBe(SESSION);
      expect(await secure.getItem(KEY)).toBe(SESSION);
    });

    it('when secure storage does not give the key back', async () => {
      const { secure, storage, vault } = setup();
      vault.setItemAsync.mockResolvedValue(undefined); // accepts the write but stores nothing
      await secure.setItem(KEY, SESSION);
      expect(storage.map.get(KEY)).toBe(SESSION);
    });

    it('and does not try to upgrade a plain value again in the same app run', async () => {
      const { secure, storage, cipher } = setup();
      cipher.encrypt.mockRejectedValue(new Error('broken'));
      storage.map.set(KEY, SESSION);
      await secure.getItem(KEY);
      await settle();
      await secure.getItem(KEY);
      await settle();
      expect(cipher.encrypt).toHaveBeenCalledTimes(1);
      expect(storage.map.get(KEY)).toBe(SESSION);
    });

    it('a storage write error is still reported to the caller', async () => {
      const { secure, storage } = setup();
      storage.setItem.mockRejectedValueOnce(new Error('disk full'));
      await expect(secure.setItem(KEY, SESSION)).rejects.toThrow('disk full');
    });
  });

  describe('a stored value that cannot be read', () => {
    it('key gone from secure storage → no session, the app is told once, the value is kept', async () => {
      const { secure, storage, vault, cipher, onUnreadable, make } = setup();
      await secure.setItem(KEY, SESSION);
      const stored = storage.map.get(KEY);
      vault.map.clear();

      const restarted = make();
      expect(await restarted.getItem(KEY)).toBeNull();
      expect(onUnreadable).toHaveBeenCalledTimes(1);
      expect(onUnreadable).toHaveBeenCalledWith(KEY);
      expect(storage.map.get(KEY)).toBe(stored);
      expect(cipher.decrypt.mock.calls.length).toBe(1); // only the self-check of the write; no key, so no decrypt
    });

    it('a momentary secure storage error is retried and the session is read', async () => {
      const { secure, vault, onUnreadable, make } = setup();
      await secure.setItem(KEY, SESSION);
      const restarted = make();
      vault.getItemAsync.mockRejectedValueOnce(new Error('keystore busy'));
      expect(await restarted.getItem(KEY)).toBe(SESSION);
      expect(onUnreadable).not.toHaveBeenCalled();
    });

    it('changed ciphertext is refused (GCM tag)', async () => {
      const { secure, storage, onUnreadable, make } = setup();
      await secure.setItem(KEY, SESSION);
      const raw = storage.map.get(KEY)!;
      const flipped = raw.slice(0, -6) + (raw.slice(-6, -5) === 'A' ? 'B' : 'A') + raw.slice(-5);
      storage.map.set(KEY, flipped);
      expect(await make().getItem(KEY)).toBeNull();
      expect(onUnreadable).toHaveBeenCalledTimes(1);
    });

    it('an unknown format after the prefix is refused', async () => {
      const { storage, onUnreadable, make } = setup();
      storage.map.set(KEY, `${ENCRYPTED_PREFIX}not base64!`);
      expect(await make().getItem(KEY)).toBeNull();
      storage.map.set(KEY, `${ENCRYPTED_PREFIX}QUJD`);
      expect(await make().getItem(KEY)).toBeNull();
      expect(onUnreadable).toHaveBeenCalledTimes(2);
    });

    it('an error inside onUnreadable never escapes', async () => {
      const { storage, make } = setup({
        onUnreadable: () => {
          throw new Error('boom');
        },
      });
      storage.map.set(KEY, `${ENCRYPTED_PREFIX}QUJD:QUJD`);
      await expect(make().getItem(KEY)).resolves.toBeNull();
    });

    it('signing in again after that works with a fresh key', async () => {
      const { secure, vault, make } = setup();
      await secure.setItem(KEY, SESSION);
      vault.map.clear();
      const restarted = make();
      expect(await restarted.getItem(KEY)).toBeNull();
      await restarted.setItem(KEY, SESSION);
      expect(await make().getItem(KEY)).toBe(SESSION);
    });
  });

  it('the Supabase client uses the encrypted storage, and removes the offline user when the session is unreadable', () => {
    const source = readFileSync(path.resolve(__dirname, '../src/config/supabase.ts'), 'utf8');
    expect(source).toContain('storage: sessionStorage,');
    expect(source).not.toMatch(/auth:\s*\{\s*storage:\s*AsyncStorage/);
    expect(source).toContain("AsyncStorage.removeItem('@arthik_cached_user')");
  });
});
