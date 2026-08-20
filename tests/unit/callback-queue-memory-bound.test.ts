import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const callbackQueue = path.resolve('server/core/task/CallbackQueue.ts');

describe('callback queue memory bound', () => {
  it('defines and enforces a pending task capacity', () => {
    const source = fs.readFileSync(callbackQueue, 'utf8');

    expect(source).toMatch(/MAX_PENDING_CALLBACK_TASKS/);
    expect(source).toMatch(/this\.queue\.size\s*\+\s*this\.retryQueue\.size\s*>=\s*MAX_PENDING_CALLBACK_TASKS/);
  });
});
