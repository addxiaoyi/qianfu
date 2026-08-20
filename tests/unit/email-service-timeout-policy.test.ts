import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'server/services/emailService.ts'), 'utf8');

describe('email transport timeout policy', () => {
  it('bounds SMTP transport stages below the API request timeout', () => {
    expect(source).toContain('connectionTimeout: EMAIL_TRANSPORT_TIMEOUT_MS');
    expect(source).toContain('greetingTimeout: EMAIL_TRANSPORT_TIMEOUT_MS');
    expect(source).toContain('socketTimeout: EMAIL_TRANSPORT_TIMEOUT_MS');
  });

  it('bounds the complete send operation and closes a timed-out transport', () => {
    expect(source).toContain('const EMAIL_SEND_TIMEOUT_MS = 7_000;');
    expect(source).toContain('transporter.close();');
  });

  it('surfaces login-code delivery failures to the registration controller', () => {
    const start = source.indexOf('export const sendEmailLoginCode');
    const end = source.indexOf('export function toHashSpaPasswordResetLink', start);
    const sendCode = source.slice(start, end);

    expect(sendCode).toContain('throw error;');
  });

  it('fails closed when production has no configured mail transport', () => {
    const start = source.indexOf('export const sendEmailLoginCode');
    const end = source.indexOf('export function toHashSpaPasswordResetLink', start);
    const sendCode = source.slice(start, end);

    expect(sendCode).toContain("if (process.env.NODE_ENV === 'test')");
    expect(sendCode).toContain("throw new Error('邮件运行时尚未配置')");
  });
});
