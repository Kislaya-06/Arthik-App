import { describe, it, expect } from 'vitest';
import {
  evaluateVersionRequirement,
  resolveApkUrl,
  resolveReleasePageUrl,
  isTrustedReleaseUrl,
  DEFAULT_RELEASE_URL,
} from '../src/lib/versionCheck';

const APK = 'https://github.com/Kislaya-06/Arthik-App/releases/download/v2.0.0/Arthik-v2.0.0.apk';

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

describe('SEC-03 update links only from Arthik\'s own GitHub repository', () => {
  const LATEST = 'https://github.com/Kislaya-06/Arthik-App/releases/latest/download/Arthik.apk';

  it('accepts the documented release links (docs/RELEASE_PROCESS.md)', () => {
    expect(isTrustedReleaseUrl(APK)).toBe(true);
    expect(isTrustedReleaseUrl(LATEST)).toBe(true);
    expect(isTrustedReleaseUrl(DEFAULT_RELEASE_URL)).toBe(true);
    expect(isTrustedReleaseUrl(`  ${APK}  `)).toBe(true);
    expect(isTrustedReleaseUrl('https://GitHub.com/kislaya-06/arthik-app/releases/download/v2.1.0/Arthik-v2.1.0.apk')).toBe(true);
    expect(isTrustedReleaseUrl(`${APK}?download=1`)).toBe(true);
    expect(resolveApkUrl({ apkUrl: LATEST, releaseUrl: DEFAULT_RELEASE_URL })).toBe(LATEST);
  });

  it('refuses every link that is not inside the repository', () => {
    const bad = [
      'https://evil.example/Arthik.apk',
      'https://github.com/someone-else/Arthik-App/releases/download/v9/Arthik.apk',
      'https://github.com/Kislaya-06/Arthik-App-fake/releases/download/v9/Arthik.apk',
      'https://github.com.evil.example/Kislaya-06/Arthik-App/releases/download/v9/Arthik.apk',
      'https://github.com@evil.example/Kislaya-06/Arthik-App/Arthik.apk',
      'https://evil.example/?https://github.com/Kislaya-06/Arthik-App/Arthik.apk',
      'https://raw.githubusercontent.com/Kislaya-06/Arthik-App/main/Arthik.apk',
      'http://github.com/Kislaya-06/Arthik-App/releases/download/v9/Arthik.apk',
      'https://github.com/Kislaya-06/Arthik-App/../../attacker/repo/releases/download/v1/a.apk',
      'https://github.com/Kislaya-06/Arthik-App/%2e%2e/%2e%2e/attacker/repo/a.apk',
      'https://github.com/Kislaya-06/Arthik-App/releases\\..\\..\\attacker/a.apk',
      'https://github.com/Kislaya-06/Arthik-App/releases/a.apk#@evil.example/b.apk',
      'https://github.com/Kislaya-06/Arthik-App/releases/a b.apk',
      'https://github.com/Kislaya-06/Arthik-App/releases/a.apk?next=https://evil.example/b.apk',
      `https://github.com/Kislaya-06/Arthik-App/${'a'.repeat(600)}.apk`,
      '',
    ];
    for (const url of bad) {
      expect(isTrustedReleaseUrl(url), url).toBe(false);
      expect(resolveApkUrl({ apkUrl: url, releaseUrl: url }), url).toBeNull();
    }
    expect(isTrustedReleaseUrl(undefined)).toBe(false);
    expect(isTrustedReleaseUrl(null)).toBe(false);
    expect(isTrustedReleaseUrl(42 as unknown as string)).toBe(false);
  });

  it('an untrusted apk_url does not block a trusted release_url', () =>
    expect(resolveApkUrl({ apkUrl: 'https://evil.example/Arthik.apk', releaseUrl: APK })).toBe(APK));

  it('browser fallback opens the server page only when it is Arthik\'s own, else the default release page', () => {
    expect(resolveReleasePageUrl(APK)).toBe(APK);
    expect(resolveReleasePageUrl('https://github.com/Kislaya-06/Arthik-App/releases/tag/v2.1.0')).toBe(
      'https://github.com/Kislaya-06/Arthik-App/releases/tag/v2.1.0'
    );
    expect(resolveReleasePageUrl('https://evil.example/update')).toBe(DEFAULT_RELEASE_URL);
    expect(resolveReleasePageUrl('')).toBe(DEFAULT_RELEASE_URL);
    expect(resolveReleasePageUrl(undefined)).toBe(DEFAULT_RELEASE_URL);
  });

  it('the server config is still passed through unchanged (the screen decides what to use)', () => {
    const res = evaluateVersionRequirement(
      { min_supported_version: '9.0.0', force_update_enabled: true, release_url: 'https://evil.example/x', apk_url: 'https://evil.example/x.apk' },
      '2.1.0'
    );
    expect(res.isRequired).toBe(true); // the force update still shows
    expect(resolveApkUrl(res)).toBeNull(); // but nothing is downloaded from there
    expect(resolveReleasePageUrl(res.releaseUrl)).toBe(DEFAULT_RELEASE_URL);
  });
});
