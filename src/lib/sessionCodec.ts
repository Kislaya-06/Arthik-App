/**
 * SEC-02: text <-> bytes <-> base64 helpers for the encrypted login session.
 *
 * Pure JavaScript on purpose: the native AES module takes and returns base64 strings, and these helpers do not
 * depend on `TextEncoder`, `atob` or `btoa` being present in the JS engine.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET[i]] = i;

/** String -> UTF-8 bytes. A lone surrogate becomes U+FFFD, like `TextEncoder`. */
export function utf8Encode(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }

    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return out;
}

/** UTF-8 bytes -> string. Throws on bytes that are not valid UTF-8 (the caller treats that as "cannot read"). */
export function utf8Decode(bytes: ArrayLike<number>): string {
  const parts: string[] = [];
  let chunk: number[] = [];
  const pushUnit = (unit: number) => {
    chunk.push(unit);
    if (chunk.length >= 4096) {
      parts.push(String.fromCharCode.apply(null, chunk));
      chunk = [];
    }
  };
  const continuation = (index: number): number => {
    const b = bytes[index];
    if (b === undefined || (b & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 data');
    return b & 0x3f;
  };

  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i];
    let code: number;
    if (b0 < 0x80) {
      code = b0;
      i += 1;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      code = ((b0 & 0x1f) << 6) | continuation(i + 1);
      i += 2;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      code = ((b0 & 0x0f) << 12) | (continuation(i + 1) << 6) | continuation(i + 2);
      if (code < 0x800 || (code >= 0xd800 && code <= 0xdfff)) throw new Error('Invalid UTF-8 data');
      i += 3;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      code =
        ((b0 & 0x07) << 18) | (continuation(i + 1) << 12) | (continuation(i + 2) << 6) | continuation(i + 3);
      if (code < 0x10000 || code > 0x10ffff) throw new Error('Invalid UTF-8 data');
      i += 4;
    } else {
      throw new Error('Invalid UTF-8 data');
    }

    if (code < 0x10000) {
      pushUnit(code);
    } else {
      const offset = code - 0x10000;
      pushUnit(0xd800 + (offset >> 10));
      pushUnit(0xdc00 + (offset & 0x3ff));
    }
  }
  if (chunk.length) parts.push(String.fromCharCode.apply(null, chunk));
  return parts.join('');
}

/** Bytes -> standard base64 with `=` padding (the format the native AES module reads). */
export function bytesToBase64(bytes: ArrayLike<number>): string {
  const parts: string[] = [];
  let piece = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    piece +=
      ALPHABET[b0 >> 2] +
      ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] +
      (has1 ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=') +
      (has2 ? ALPHABET[b2 & 0x3f] : '=');
    if (piece.length >= 8192) {
      parts.push(piece);
      piece = '';
    }
  }
  parts.push(piece);
  return parts.join('');
}

/** Standard base64 (padding optional, line breaks ignored) -> bytes. Throws on any other character. */
export function base64ToBytes(base64: string): number[] {
  const clean = base64.replace(/[\r\n\s]/g, '').replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('Invalid base64 data');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = LOOKUP[clean[i]];
    if (value === undefined) throw new Error('Invalid base64 data');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return out;
}

export const textToBase64 = (text: string): string => bytesToBase64(utf8Encode(text));
export const base64ToText = (base64: string): string => utf8Decode(base64ToBytes(base64));
