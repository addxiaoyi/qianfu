import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/Login.tsx'),
  'utf8',
);
const app = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/App.tsx'), 'utf8');

describe('login page verification contract', () => {
  it('checks email verification before it persists client authentication', () => {
    const submitStart = source.indexOf("const result = await api.post<any>('/auth/login', payload)");
    const submitEnd = source.indexOf('} catch (err: any)', submitStart);
    const submitBody = source.slice(submitStart, submitEnd);
    const verificationCheck = submitBody.indexOf('if (!user.email_verified)');

    expect(verificationCheck).toBeGreaterThanOrEqual(0);
    expect(submitBody.indexOf('setLocalAuthToken(token)')).toBeGreaterThan(verificationCheck);
    expect(submitBody.indexOf('setUser(user)')).toBeGreaterThan(verificationCheck);
  });

  it('keeps the email verification screen reachable without an authenticated session', () => {
    expect(app).toContain('<Route path="/verify-code" element={<VerifyEmail />} />');
    expect(app).not.toContain('<Route path="/verify-code" element={<RequireAuth><VerifyEmail /></RequireAuth>} />');
  });
});
