import { describe, it, expect } from 'vitest';
import {
  utf8Encode,
  utf8Decode,
  bytesToBase64,
  base64ToBytes,
  textToBase64,
  base64ToText,
} from '../src/lib/sessionCodec';

const SAMPLES = [
  '',
  'a',
  'ab',
  'abc',
  'Arthik',
  '{"access_token":"eyJhbGciOi.J9.x-y_z","refresh_token":"abc123","user":{"email":"a@b.co"}}',
  'अर्थिक ₹1,23,456.78',
  'emoji 😀🎉 and a flag 🇮🇳',
  'mixed \u0000 control \n\t chars \u007f',
  'boundaries \u007f\u0080߿ࠀ￿\u{10000}\u{10ffff}',
];

describe('SEC-02 sessionCodec', () => {
  it('encodes text to the same UTF-8 bytes as Node', () => {
    for (const text of SAMPLES) {
      expect(utf8Encode(text)).toEqual(Array.from(Buffer.from(text, 'utf8')));
    }
  });

  it('decodes UTF-8 bytes back to the same text', () => {
    for (const text of SAMPLES) {
      expect(utf8Decode(Buffer.from(text, 'utf8'))).toBe(text);
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });

  it('turns a lone surrogate into U+FFFD, like TextEncoder', () => {
    expect(utf8Encode('a\ud800b')).toEqual(Array.from(new TextEncoder().encode('a\ud800b')));
    expect(utf8Encode('\udc00')).toEqual(Array.from(new TextEncoder().encode('\udc00')));
  });

  it('refuses bytes that are not valid UTF-8', () => {
    expect(() => utf8Decode([0xff])).toThrow();
    expect(() => utf8Decode([0xc3])).toThrow(); // cut in the middle of a character
    expect(() => utf8Decode([0xc0, 0x80])).toThrow(); // overlong
    expect(() => utf8Decode([0xe0, 0x80, 0x80])).toThrow(); // overlong
    expect(() => utf8Decode([0xed, 0xa0, 0x80])).toThrow(); // surrogate
    expect(() => utf8Decode([0xf4, 0x90, 0x80, 0x80])).toThrow(); // above U+10FFFF
    expect(() => utf8Decode([0xe2, 0x28, 0xa1])).toThrow(); // bad continuation
  });

  it('writes the same base64 as Node for every length and every byte value', () => {
    const all = Array.from({ length: 256 }, (_, i) => i);
    for (let len = 0; len <= 260; len++) {
      const bytes = Array.from({ length: len }, (_, i) => all[(i * 7 + len) % 256]);
      const expected = Buffer.from(bytes).toString('base64');
      expect(bytesToBase64(bytes)).toBe(expected);
      expect(base64ToBytes(expected)).toEqual(bytes);
    }
  });

  it('reads base64 without padding and with line breaks', () => {
    expect(base64ToBytes('QQ')).toEqual([65]);
    expect(base64ToBytes('QUI')).toEqual([65, 66]);
    expect(base64ToBytes('QUJD\nREVG\r\n')).toEqual([65, 66, 67, 68, 69, 70]);
  });

  it('refuses text that is not base64', () => {
    expect(() => base64ToBytes('QUJD*')).toThrow();
    expect(() => base64ToBytes('Q')).toThrow();
    expect(() => base64ToBytes('QU-_')).toThrow(); // url-safe alphabet is not accepted
  });

  it('round-trips a long session-sized text', () => {
    const long = JSON.stringify({ token: 'x'.repeat(50_000), name: 'अर्थिक 😀'.repeat(2_000) });
    expect(base64ToText(textToBase64(long))).toBe(long);
    expect(textToBase64(long)).toBe(Buffer.from(long, 'utf8').toString('base64'));
  });
});
