import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const routes = read('server/routes/user.ts');
const controller = read('server/controllers/userController.ts');
const store = read('qianfu-liandeng/src/store/authStore.ts');

describe('anonymous session probe', () => {
  it('uses an optional-auth endpoint for application hydration', () => {
    expect(routes).toContain(
      "router.get('/session-profile', userLimiter, authenticateOptional, getSessionProfile)",
    );
    expect(store).toContain("api.get<User | null>('/session-profile')");
    expect(store).not.toContain("api.get<User>('/profile')");
  });

  it('returns an empty successful session for anonymous visitors', () => {
    const start = controller.indexOf('export const getSessionProfile');
    const end = controller.indexOf('export const getProfile', start);
    const probe = controller.slice(start, end);

    expect(probe).toContain("return sendSuccess(res, null, 'No active session')");
  });
});
