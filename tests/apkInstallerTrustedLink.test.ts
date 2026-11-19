import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { downloadApk } from '../src/lib/apkInstaller';

describe('SEC-03 downloadApk refuses links from outside Arthik\'s repository', () => {
  it('throws before anything is downloaded', async () => {
    const onEvent = vi.fn();
    await expect(downloadApk('https://evil.example/Arthik.apk', '9.9.9', onEvent)).rejects.toThrow(
      'This update link is not from Arthik. Please update from the official release page.'
    );
    await expect(
      downloadApk('https://github.com/Kislaya-06/Arthik-App/../../x/y/a.apk', '9.9.9', onEvent)
    ).rejects.toThrow('This update link is not from Arthik');
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('the update screen uses the filtered link for the browser fallback too', () => {
    const source = readFileSync(path.resolve(__dirname, '../src/screens/UpdateRequiredScreen.tsx'), 'utf8');
    expect(source).toContain('const url = directApk || resolveReleasePageUrl(releaseUrl);');
    expect(source).not.toContain('directApk || releaseUrl || DEFAULT_RELEASE_URL');
  });
});
