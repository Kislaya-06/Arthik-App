import { describe, it, expect } from 'vitest';
import { evaluateVersionRequirement, resolveApkUrl, DEFAULT_RELEASE_URL } from '../src/lib/versionCheck';

const APK = 'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.0.0/Arthik.apk';

describe('force update to v2.0.0', () => {
  const cfg = {
    min_supported_version: '2.0.0',
    force_update_enabled: true,
    release_url: APK,
    apk_url: APK,
    update_title: 'Arthik 2.0 is here',
    update_highlights: ['Automatic Logging (Beta)', '', 42, 'In-app updates'],
  };

  it('blocks v1.2.4 and v1.9.9', () => {
    expect(evaluateVersionRequirement(cfg, '1.2.4').isRequired).toBe(true);
    expect(evaluateVersionRequirement(cfg, '1.9.9').isRequired).toBe(true);
  });
  it('does not block v2.0.0 or newer', () => {
    expect(evaluateVersionRequirement(cfg, '2.0.0').isRequired).toBe(false);
    expect(evaluateVersionRequirement(cfg, '2.0.1').isRequired).toBe(false);
  });
  it('passes server copy through, dropping junk highlights', () => {
    const r = evaluateVersionRequirement(cfg, '1.2.4');
    expect(r.apkUrl).toBe(APK);
    expect(r.title).toBe('Arthik 2.0 is here');
    expect(r.highlights).toEqual(['Automatic Logging (Beta)', 'In-app updates']);
  });
  it('kill switch: force_update_enabled false never blocks', () => {
    expect(evaluateVersionRequirement({ ...cfg, force_update_enabled: false }, '1.2.4').isRequired).toBe(false);
  });
});

describe('resolveApkUrl', () => {
  it('prefers apk_url', () => expect(resolveApkUrl({ apkUrl: APK, releaseUrl: DEFAULT_RELEASE_URL })).toBe(APK));
  it('uses release_url when it is already a direct .apk link (old-client compatible config)', () =>
    expect(resolveApkUrl({ apkUrl: undefined, releaseUrl: APK })).toBe(APK));
  it('release page (not a file) → no in-app download, browser fallback', () =>
    expect(resolveApkUrl({ apkUrl: undefined, releaseUrl: DEFAULT_RELEASE_URL })).toBeNull());
  it('rejects non-https links', () => expect(resolveApkUrl({ apkUrl: 'http://evil.example/a.apk', releaseUrl: '' })).toBeNull());
});
