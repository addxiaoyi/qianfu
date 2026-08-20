import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const legacyStore = read('qianfu-liandeng/src/store/auth.ts');
const legacyClient = read('qianfu-liandeng/src/lib/api-client.ts');
const authStore = read('qianfu-liandeng/src/store/authStore.ts');
const sessionConsumers = [
  'qianfu-liandeng/src/auth/guards.tsx',
  'qianfu-liandeng/src/auth/hooks.ts',
  'qianfu-liandeng/src/auth/buttons.tsx',
  'qianfu-liandeng/src/hooks/usePermission.tsx',
  'qianfu-liandeng/src/pages/MyServerFavorites.tsx',
].map(read);
const favoriteHook = read('qianfu-liandeng/src/hooks/useFavoriteServers.ts');

describe('frontend auth session contract', () => {
  it('does not retain access tokens in the legacy compatibility modules', () => {
    expect(legacyStore).not.toContain('persist');
    expect(legacyStore).not.toContain('accessToken');
    expect(legacyClient).not.toContain('localStorage');
    expect(legacyClient).not.toContain('accessToken');
  });

  it('uses the in-memory session store and shared request client everywhere', () => {
    for (const source of sessionConsumers) {
      expect(source).toContain("@/store/authStore");
      expect(source).not.toContain("@/store/auth'");
    }
    expect(favoriteHook).toContain("from '@/api/request'");
    expect(favoriteHook).not.toContain("from '@/lib/api-client'");
  });

  it('uses the CSRF-aware request client when ending a session', () => {
    expect(authStore).toContain("await api.post('/logout'");
    expect(authStore).not.toContain("fetch('/api/v1/logout'");
  });
});
