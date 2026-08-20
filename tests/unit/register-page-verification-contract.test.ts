import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/Register.tsx'),
  'utf8',
);

describe('registration page verification contract', () => {
  it('keeps pending registrations outside the authenticated client state', () => {
    const submitStart = source.indexOf("const result = await api.post<any>('/auth/register', values)");
    const submitEnd = source.indexOf('} catch (err: any)', submitStart);
    const submitBody = source.slice(submitStart, submitEnd);

    expect(submitBody).toContain('result?.pendingVerification !== true');
    expect(submitBody).not.toContain('setLocalAuthToken(');
    expect(submitBody).not.toContain('setUser(');
  });
});
