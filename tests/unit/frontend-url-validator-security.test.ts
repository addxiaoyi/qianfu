import { describe, expect, it } from 'vitest';
import { isUrlSafe } from '../../qianfu-liandeng/src/utils/urlValidator';

describe('frontend URL injection policy', () => {
  it('allows web URLs but rejects legacy FTP links', () => {
    expect(isUrlSafe('https://example.com/file.zip')).toBe(true);
    expect(isUrlSafe('http://example.com/file.zip')).toBe(true);
    expect(isUrlSafe('ftp://example.com/file.zip')).toBe(false);
  });
});
