import { describe, it, expect, vi } from 'vitest';

/**
 * A stand-in for the native AES module of expo-crypto with the same rules the Android code has
 * (node_modules/expo-crypto/android/.../aes): strings are base64, `combined('base64')` is IV + ciphertext + tag,
 * `fromParts(iv, ciphertextWithTag, tagLength)` takes base64 strings, decrypt with `output: 'base64'` returns a string.
 */
vi.mock('expo-crypto', async () => {
  const { createCipheriv, createDecipheriv, randomBytes } = await import('crypto');
  class Key {
    constructor(public raw: Buffer) {}
    static async generate() {
      return new Key(randomBytes(32));
    }
    static async import(input: string, encoding: 'base64' | 'hex') {
      if (typeof input !== 'string' || encoding !== 'base64') throw new Error('test fake: base64 string expected');
      return new Key(Buffer.from(input, 'base64'));
    }
    async encoded(encoding: 'base64' | 'hex') {
      return this.raw.toString(encoding);
    }
  }
  class Sealed {
    constructor(public content: Buffer, public ivSize: number, public tagSize: number) {}
    static fromParts(iv: unknown, data: unknown, tag: unknown) {
      if (typeof iv !== 'string' || typeof data !== 'string' || typeof tag !== 'number') {
        throw new Error('test fake: (base64, base64, number) expected');
      }
      const ivBytes = Buffer.from(iv, 'base64');
      return new Sealed(Buffer.concat([ivBytes, Buffer.from(data, 'base64')]), ivBytes.length, tag);
    }
    async combined(format?: 'base64' | 'bytes') {
      return format === 'base64' ? this.content.toString('base64') : new Uint8Array(this.content);
    }
  }
  return {
    AESEncryptionKey: Key,
    AESSealedData: Sealed,
    aesEncryptAsync: async (plain: unknown, key: Key) => {
      if (typeof plain !== 'string') throw new Error('test fake: base64 string expected');
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key.raw, iv);
      const body = Buffer.concat([c.update(Buffer.from(plain, 'base64')), c.final(), c.getAuthTag()]);
      return new Sealed(Buffer.concat([iv, body]), 12, 16);
    },
    aesDecryptAsync: async (sealed: Sealed, key: Key, options?: { output?: 'base64' | 'bytes' }) => {
      const iv = sealed.content.subarray(0, sealed.ivSize);
      const tag = sealed.content.subarray(sealed.content.length - sealed.tagSize);
      const body = sealed.content.subarray(sealed.ivSize, sealed.content.length - sealed.tagSize);
      const d = createDecipheriv('aes-256-gcm', key.raw, iv);
      d.setAuthTag(tag);
      const plain = Buffer.concat([d.update(body), d.final()]);
      return options?.output === 'base64' ? plain.toString('base64') : new Uint8Array(plain);
    },
  };
});

import { expoSessionCipher } from '../src/lib/expoSessionCipher';
import { createSecureSessionStorage, ENCRYPTED_PREFIX } from '../src/lib/secureSessionStorage';

describe('SEC-02 expoSessionCipher (wrapper around the expo-crypto AES API)', () => {
  it('makes a 256-bit key as base64', async () => {
    const key = await expoSessionCipher.generateKey();
    expect(Buffer.from(key, 'base64').length).toBe(32);
  });

  it('splits IV and ciphertext so that decrypt gets the original back', async () => {
    const key = await expoSessionCipher.generateKey();
    const plain = Buffer.from('{"refresh_token":"abc","name":"अर्थिक 😀"}', 'utf8').toString('base64');
    const { iv, data } = await expoSessionCipher.encrypt(plain, key);
    expect(Buffer.from(iv, 'base64').length).toBe(12);
    expect(iv).toHaveLength(16);
    expect(await expoSessionCipher.decrypt(iv, data, key)).toBe(plain);
  });

  it('refuses a wrong key', async () => {
    const key = await expoSessionCipher.generateKey();
    const other = await expoSessionCipher.generateKey();
    const { iv, data } = await expoSessionCipher.encrypt(Buffer.from('secret').toString('base64'), key);
    await expect(expoSessionCipher.decrypt(iv, data, other)).rejects.toThrow();
  });

  it('works end to end inside the encrypted session storage', async () => {
    const store = new Map<string, string>();
    const vault = new Map<string, string>();
    const make = () =>
      createSecureSessionStorage({
        storage: {
          getItem: async (k) => store.get(k) ?? null,
          setItem: async (k, v) => void store.set(k, v),
          removeItem: async (k) => void store.delete(k),
        },
        vault: {
          getItemAsync: async (k) => vault.get(k) ?? null,
          setItemAsync: async (k, v) => void vault.set(k, v),
        },
        cipher: expoSessionCipher,
      });
    const session = JSON.stringify({ refresh_token: 'r-SECRET', user: { email: 'a@b.co' } });
    await make().setItem('sb-x-auth-token', session);
    expect(store.get('sb-x-auth-token')!.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(store.get('sb-x-auth-token')).not.toContain('r-SECRET');
    expect(await make().getItem('sb-x-auth-token')).toBe(session);
  });
});
