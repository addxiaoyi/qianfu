import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('frontend async error integrity', () => {
  it('keeps the mutation audit clean', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-frontend-async-errors.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 12_000,
    });

    expect(output).toContain('FRONTEND_ASYNC_ERROR_FINDINGS=0');
  }, 15_000);

  it('preserves ticket replies when sending fails', () => {
    const userTicket = read('qianfu-liandeng/src/pages/TicketDetail.tsx');
    const adminTickets = read('qianfu-liandeng/src/pages/admin/AdminTickets.tsx');

    expect(userTicket).toContain("title: '回复失败'");
    expect(userTicket).toContain('内容已为您保留');
    expect(adminTickets).toContain("title: '回复失败'");
    expect(adminTickets).toContain('内容已为您保留');
  });
});
