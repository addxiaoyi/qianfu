import { describe, expect, it } from 'vitest';
import {
  buildReplyHeaders,
  normalizeReplySubject,
  resolveImapConfig,
  buildInboxRange,
  type InboxMessage,
} from '../../server/services/mailInboxService';

describe('mail inbox service', () => {
  it('does not issue an invalid fetch range for an empty mailbox', () => {
    expect(buildInboxRange(0, 1, 50)).toBeNull();
    expect(buildInboxRange(51, 2, 50)).toEqual({ start: 1, end: 1 });
  });

  it('allows inbox access when smtp sending is disabled but imap is configured', () => {
    const config = resolveImapConfig({
      transport: { kind: 'none' },
      adminConfig: {
        imapHost: '127.0.0.1',
        imapPort: 993,
        imapSecure: true,
        imapAllowInvalidCert: true,
        imapUser: 'admin@0st.top',
        imapPass: 'secret',
        smtpHost: '',
        smtpUser: '',
        smtpPass: '',
      },
    } as never);

    expect(config.host).toBe('127.0.0.1');
    expect(config.user).toBe('admin@0st.top');
  });

  it('preserves the thread when replying to a received message', () => {
    const source: InboxMessage = {
      id: '42',
      uid: 42,
      subject: '合作咨询',
      from: [{ name: '访客', address: 'visitor@example.com' }],
      to: [{ name: '千服客服', address: 'support@0st.top' }],
      date: '2026-07-19T08:00:00.000Z',
      unread: true,
      hasAttachments: false,
      preview: '想了解合作方式',
      text: '想了解合作方式',
      html: '<p>想了解合作方式</p>',
      messageId: '<source@example.com>',
      references: ['<older@example.com>'],
      attachments: [],
    };

    expect(normalizeReplySubject(source.subject)).toBe('Re: 合作咨询');
    expect(buildReplyHeaders(source)).toEqual({
      inReplyTo: '<source@example.com>',
      references: ['<older@example.com>', '<source@example.com>'],
    });
    expect(normalizeReplySubject('RE: 合作咨询')).toBe('RE: 合作咨询');
  });
});
