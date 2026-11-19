import { describe, it, expect, vi } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createSecureSessionStorage, ENCRYPTED_PREFIX, type SessionCipher } from '../src/lib/secureSessionStorage';

/**
 * SEC-02: the encrypted storage plugged into the REAL Supabase client (same options as src/config/supabase.ts).
 * No network: every request fails at once, like a phone that is offline.
 */
const cipher: SessionCipher = {
  generateKey: async () => randomBytes(32).toString('base64'),
  encrypt: async (plainBase64, keyBase64) => {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv);
    const data = Buffer.concat([c.update(Buffer.from(plainBase64, 'base64')), c.final(), c.getAuthTag()]);
    return { iv: iv.toString('base64'), data: data.toString('base64') };
  },
  decrypt: async (ivBase64, dataBase64, keyBase64) => {
    const buf = Buffer.from(dataBase64, 'base64');
    const d = createDecipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), Buffer.from(ivBase64, 'base64'));
    d.setAuthTag(buf.subarray(buf.length - 16));
    return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('base64');
  },
};

const STORAGE_KEY = 'sb-testproject-auth-token';
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const makeSession = () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-1', exp, role: 'authenticated' })}.signature`,
    refresh_token: 'refresh-token-SECRET-123',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: { id: 'user-1', aud: 'authenticated', email: 'user@arthik.app', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
};

const phone = () => {
  const disk = new Map<string, string>();
  const vault = new Map<string, string>();
  const onUnreadable = vi.fn();
  /** A new app start on the same phone: new storage object, new Supabase client. */
  const startApp = () => {
    const storage = createSecureSessionStorage({
      storage: {
        getItem: async (k) => disk.get(k) ?? null,
        setItem: async (k, v) => void disk.set(k, v),
        removeItem: async (k) => void disk.delete(k),
      },
      vault: {
        getItemAsync: async (k) => vault.get(k) ?? null,
        setItemAsync: async (k, v) => void vault.set(k, v),
      },
      cipher,
      onUnreadable,
      retryDelayMs: 0,
    });
    return createClient('https://testproject.supabase.co', 'anon-key', {
      auth: { storage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
      global: { fetch: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch },
    });
  };
  return { disk, vault, onUnreadable, startApp };
};

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

describe('SEC-02 encrypted session storage inside the real Supabase client', () => {
  it('the client uses the storage key this test expects', async () => {
    const { disk, startApp } = phone();
    const session = makeSession();
    disk.set(STORAGE_KEY, JSON.stringify(session));
    const { data } = await startApp().auth.getSession();
    expect(data.session?.user.id).toBe('user-1');
  });

  it('a user who was signed in before the update stays signed in, and the session gets encrypted', async () => {
    const { disk, startApp, onUnreadable } = phone();
    const session = makeSession();
    disk.set(STORAGE_KEY, JSON.stringify(session)); // plain text, written by the old app version

    const first = await startApp().auth.getSession();
    expect(first.error).toBeNull();
    expect(first.data.session?.refresh_token).toBe('refresh-token-SECRET-123');
    await settle();

    const stored = disk.get(STORAGE_KEY)!;
    expect(stored.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(stored).not.toContain('refresh-token-SECRET-123');
    expect(stored).not.toContain('user@arthik.app');

    const second = await startApp().auth.getSession(); // next app start
    expect(second.data.session?.refresh_token).toBe('refresh-token-SECRET-123');
    expect(second.data.session?.user.email).toBe('user@arthik.app');
    expect(onUnreadable).not.toHaveBeenCalled();
  });

  it('local sign-out removes the stored session', async () => {
    const { disk, startApp } = phone();
    disk.set(STORAGE_KEY, JSON.stringify(makeSession()));
    const client = startApp();
    await client.auth.getSession();
    await settle();
    await client.auth.signOut({ scope: 'local' });
    expect(disk.has(STORAGE_KEY)).toBe(false);
    expect((await startApp().auth.getSession()).data.session).toBeNull();
  });

  it('secure storage lost its key: the app sees "no session" (login screen), is told once, nothing crashes', async () => {
    const { disk, vault, startApp, onUnreadable } = phone();
    disk.set(STORAGE_KEY, JSON.stringify(makeSession()));
    await startApp().auth.getSession();
    await settle();
    vault.clear();

    const result = await startApp().auth.getSession();
    expect(result.data.session).toBeNull();
    expect(onUnreadable).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('nobody signed in: nothing is stored and no key is created', async () => {
    const { disk, vault, startApp } = phone();
    expect((await startApp().auth.getSession()).data.session).toBeNull();
    await settle();
    expect(disk.size).toBe(0);
    expect(vault.size).toBe(0);
  });
});
