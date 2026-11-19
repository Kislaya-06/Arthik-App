import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from 'expo-crypto';
import type { SessionCipher } from './secureSessionStorage';

/**
 * SEC-02: AES-256-GCM for the login session, on the native AES module that ships inside expo-crypto
 * (already in the installed app, so this is OTA-safe).
 *
 * Only strings cross to native and back (base64): plaintext in, IV + ciphertext out, plaintext out.
 * `secureSessionStorage.ts` decrypts every value once before storing it, so a device where any of these calls
 * behaves differently simply keeps the old plain storage.
 */

const TAG_BYTES = 16;
const importedKeys = new Map<string, AESEncryptionKey>();

const importKey = async (keyBase64: string): Promise<AESEncryptionKey> => {
  let key = importedKeys.get(keyBase64);
  if (!key) {
    key = (await AESEncryptionKey.import(keyBase64, 'base64')) as AESEncryptionKey;
    importedKeys.set(keyBase64, key);
  }
  return key;
};

export const expoSessionCipher: SessionCipher = {
  generateKey: async () => {
    const key = await AESEncryptionKey.generate();
    return key.encoded('base64');
  },

  encrypt: async (plainBase64, keyBase64) => {
    const sealed = await aesEncryptAsync(plainBase64, await importKey(keyBase64));
    // `combined` is IV + ciphertext + tag. A 12-byte IV is exactly 16 base64 characters, so the text can be cut there.
    const ivChars = (sealed.ivSize / 3) * 4;
    if (!Number.isInteger(ivChars) || ivChars <= 0 || sealed.tagSize !== TAG_BYTES) {
      throw new Error('Unexpected AES-GCM parameters');
    }
    const combined = await sealed.combined('base64');
    if (typeof combined !== 'string' || combined.length <= ivChars) throw new Error('Unexpected AES-GCM output');
    return { iv: combined.slice(0, ivChars), data: combined.slice(ivChars) };
  },

  decrypt: async (ivBase64, dataBase64, keyBase64) => {
    const sealed = AESSealedData.fromParts(ivBase64, dataBase64, TAG_BYTES);
    const plain = await aesDecryptAsync(sealed, await importKey(keyBase64), { output: 'base64' });
    if (typeof plain !== 'string') throw new Error('Unexpected AES-GCM output');
    return plain;
  },
};
