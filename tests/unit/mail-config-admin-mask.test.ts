import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {
    systemConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../server/db';
import { getMailConfigForAdmin } from '../../server/services/mailConfigService';

describe('mail admin secret masking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.systemConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.systemConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    process.env.NODE_ENV = 'test';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-secret';
    process.env.SMTP_FROM = 'from@example.test';
    process.env.IMAP_HOST = 'imap.example.test';
    process.env.IMAP_USER = 'imap-user';
    process.env.IMAP_PASS = 'imap-secret';
  });

  it('never returns SMTP or IMAP secrets in editable config payloads', async () => {
    const payload = await getMailConfigForAdmin();

    expect(payload.config.smtpPass).toBe('');
    expect(payload.config.imapPass).toBe('');
    expect(payload.effective.adminConfig.smtpPass).toBe('');
    expect(payload.effective.adminConfig.imapPass).toBe('');
    expect(payload.maskedSecrets.smtpPass).toBe('sm***et');
    expect(payload.maskedSecrets.imapPass).toBe('im***et');
    expect(JSON.stringify(payload)).not.toContain('smtp-secret');
    expect(JSON.stringify(payload)).not.toContain('imap-secret');
  });
});
