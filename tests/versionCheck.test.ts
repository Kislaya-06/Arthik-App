import { describe, it, expect, vi } from 'vitest';
import {
  parseSemverParts,
  compareSemver,
  isVersionOutdated,
  shouldBlockForUpdate,
  evaluateVersionRequirement,
  checkAppVersionStatus,
  DEFAULT_RELEASE_URL,
} from '../src/lib/versionCheck';

describe('versionCheck', () => {
  describe('parseSemverParts', () => {
    it('parses standard semver strings into numeric triplets', () => {
      expect(parseSemverParts('1.2.3')).toEqual([1, 2, 3]);
      expect(parseSemverParts('0.1.0')).toEqual([0, 1, 0]);
      expect(parseSemverParts('10.20.30')).toEqual([10, 20, 30]);
    });

    it('handles leading v or V prefix', () => {
      expect(parseSemverParts('v1.2.3')).toEqual([1, 2, 3]);
      expect(parseSemverParts('V1.2.4')).toEqual([1, 2, 4]);
    });

    it('strips pre-release suffixes or build metadata', () => {
      expect(parseSemverParts('1.2.4-beta.1')).toEqual([1, 2, 4]);
      expect(parseSemverParts('1.2.4+20260919')).toEqual([1, 2, 4]);
      expect(parseSemverParts('v1.2.4-rc2+build.99')).toEqual([1, 2, 4]);
    });

    it('handles truncated or incomplete versions gracefully', () => {
      expect(parseSemverParts('1.2')).toEqual([1, 2, 0]);
      expect(parseSemverParts('1')).toEqual([1, 0, 0]);
    });

    it('returns [0, 0, 0] for invalid, non-string, or empty inputs', () => {
      expect(parseSemverParts('')).toEqual([0, 0, 0]);
      expect(parseSemverParts('invalid')).toEqual([0, 0, 0]);
      expect(parseSemverParts(null as any)).toEqual([0, 0, 0]);
      expect(parseSemverParts(undefined as any)).toEqual([0, 0, 0]);
    });
  });

  describe('compareSemver', () => {
    it('returns -1 when v1 < v2', () => {
      expect(compareSemver('1.2.3', '1.2.4')).toBe(-1);
      expect(compareSemver('1.1.9', '1.2.0')).toBe(-1);
      expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
    });

    it('returns 0 when v1 === v2', () => {
      expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
      expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
      expect(compareSemver('1.2.3-beta', '1.2.3')).toBe(0);
    });

    it('returns 1 when v1 > v2', () => {
      expect(compareSemver('1.2.4', '1.2.3')).toBe(1);
      expect(compareSemver('1.3.0', '1.2.9')).toBe(1);
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    });

    it('handles numerical vs lexicographical ordering correctly (e.g. 10 vs 9)', () => {
      expect(compareSemver('1.2.10', '1.2.9')).toBe(1);
      expect(compareSemver('1.2.9', '1.2.10')).toBe(-1);
      expect(compareSemver('1.10.0', '1.9.9')).toBe(1);
    });
  });

  describe('isVersionOutdated', () => {
    it('returns true only when current version is strictly less than required version', () => {
      expect(isVersionOutdated('1.2.3', '1.2.4')).toBe(true);
      expect(isVersionOutdated('1.2.2', '1.2.4')).toBe(true);
    });

    it('returns false when current version is equal or greater', () => {
      expect(isVersionOutdated('1.2.4', '1.2.4')).toBe(false);
      expect(isVersionOutdated('1.2.5', '1.2.4')).toBe(false);
      expect(isVersionOutdated('1.3.0', '1.2.4')).toBe(false);
    });

    it('returns false if any argument is empty or falsy', () => {
      expect(isVersionOutdated('', '1.2.4')).toBe(false);
      expect(isVersionOutdated('1.2.3', '')).toBe(false);
    });
  });

  describe('shouldBlockForUpdate', () => {
    it('returns false if forceUpdateEnabled is false even if version is outdated', () => {
      expect(
        shouldBlockForUpdate({
          currentVersion: '1.2.3',
          minSupportedVersion: '1.2.4',
          forceUpdateEnabled: false,
        })
      ).toBe(false);
    });

    it('returns true when forceUpdateEnabled is true and version is outdated', () => {
      expect(
        shouldBlockForUpdate({
          currentVersion: '1.2.3',
          minSupportedVersion: '1.2.4',
          forceUpdateEnabled: true,
        })
      ).toBe(true);
    });

    it('returns false when forceUpdateEnabled is true but user already has required or newer version', () => {
      expect(
        shouldBlockForUpdate({
          currentVersion: '1.2.4',
          minSupportedVersion: '1.2.4',
          forceUpdateEnabled: true,
        })
      ).toBe(false);

      expect(
        shouldBlockForUpdate({
          currentVersion: '1.2.5',
          minSupportedVersion: '1.2.4',
          forceUpdateEnabled: true,
        })
      ).toBe(false);
    });

    it('returns false for missing version strings', () => {
      expect(
        shouldBlockForUpdate({
          currentVersion: '',
          minSupportedVersion: '1.2.4',
          forceUpdateEnabled: true,
        })
      ).toBe(false);
    });
  });

  describe('evaluateVersionRequirement', () => {
    it('returns isRequired: false if config is null or undefined', () => {
      expect(evaluateVersionRequirement(null, '1.2.3')).toEqual({
        isRequired: false,
        minVersion: '',
        releaseUrl: DEFAULT_RELEASE_URL,
      });
    });

    it('returns isRequired: true when config forces update and current version is outdated', () => {
      const config = {
        min_supported_version: '1.2.4',
        force_update_enabled: true,
        release_url: 'https://github.com/custom/url',
      };
      expect(evaluateVersionRequirement(config, '1.2.3')).toEqual({
        isRequired: true,
        minVersion: '1.2.4',
        releaseUrl: 'https://github.com/custom/url',
      });
    });

    it('returns isRequired: false when config has force_update_enabled: false (killswitch)', () => {
      const config = {
        min_supported_version: '1.2.4',
        force_update_enabled: false,
        release_url: 'https://github.com/custom/url',
      };
      expect(evaluateVersionRequirement(config, '1.2.3')).toEqual({
        isRequired: false,
        minVersion: '1.2.4',
        releaseUrl: 'https://github.com/custom/url',
      });
    });

    it('returns isRequired: false when user has version 1.2.4 or higher', () => {
      const config = {
        min_supported_version: '1.2.4',
        force_update_enabled: true,
        release_url: 'https://github.com/custom/url',
      };
      expect(evaluateVersionRequirement(config, '1.2.4')).toEqual({
        isRequired: false,
        minVersion: '1.2.4',
        releaseUrl: 'https://github.com/custom/url',
      });
      expect(evaluateVersionRequirement(config, '1.3.0')).toEqual({
        isRequired: false,
        minVersion: '1.2.4',
        releaseUrl: 'https://github.com/custom/url',
      });
    });
  });

  describe('checkAppVersionStatus', () => {
    it('fails open when device is offline without calling remote server', async () => {
      const mockClient = {
        from: vi.fn(),
      };

      const result = await checkAppVersionStatus(mockClient, true, '1.2.3');

      expect(result.isRequired).toBe(false);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('fails open when database query throws or fails', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      };

      const result = await checkAppVersionStatus(mockClient, false, '1.2.3');

      expect(result.isRequired).toBe(false);
    });

    it('returns isRequired: true when remote config specifies force_update_enabled and version is outdated', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              value: {
                min_supported_version: '1.2.4',
                force_update_enabled: true,
                release_url: 'https://github.com/custom/url',
              },
            },
            error: null,
          }),
        }),
      };

      const result = await checkAppVersionStatus(mockClient, false, '1.2.3');

      expect(result.isRequired).toBe(true);
      expect(result.minVersion).toBe('1.2.4');
      expect(result.releaseUrl).toBe('https://github.com/custom/url');
    });

    it('returns isRequired: false when remote config has force_update_enabled: false (killswitch test)', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              value: {
                min_supported_version: '1.2.4',
                force_update_enabled: false,
                release_url: 'https://github.com/custom/url',
              },
            },
            error: null,
          }),
        }),
      };

      const result = await checkAppVersionStatus(mockClient, false, '1.2.3');

      expect(result.isRequired).toBe(false);
      expect(result.minVersion).toBe('1.2.4');
    });

    it('returns isRequired: false when user is running 1.2.4 even with force_update_enabled: true', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              value: {
                min_supported_version: '1.2.4',
                force_update_enabled: true,
                release_url: 'https://github.com/custom/url',
              },
            },
            error: null,
          }),
        }),
      };

      const result = await checkAppVersionStatus(mockClient, false, '1.2.4');

      expect(result.isRequired).toBe(false);
    });
  });
});
